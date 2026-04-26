import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseConfig } from './config';
import { fetchPRDiff, postFindings } from './github';
import { callReview } from './anthropic';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { filterByConfidence } from './filter';
import { isAuthorAllowed } from './caps/author-allowlist';
import { estimateInputTokens, truncateDiff } from './caps/token-cap';

async function run(): Promise<void> {
  try {
    const config = parseConfig({
      anthropicApiKey: core.getInput('anthropic-api-key', { required: true }),
      githubToken: core.getInput('github-token', { required: true }),
      model: core.getInput('model'),
      maxTokensPerPr: core.getInput('max-tokens-per-pr'),
      confidenceThreshold: core.getInput('confidence-threshold'),
      allowedAuthors: core.getInput('allowed-authors'),
      monthlyQuota: core.getInput('monthly-quota'),
    });

    const ctx = github.context;
    const pr = ctx.payload.pull_request;
    if (!pr) {
      core.info('Not a pull request event; skipping.');
      return;
    }

    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;
    const pullNumber = pr.number;
    const commitSha = pr.head.sha;
    const author = pr.user.login;
    const prTitle = pr.title ?? '';
    const prBody = pr.body ?? '';

    if (!isAuthorAllowed(author, config.allowedAuthors)) {
      core.info(
        `Author "${author}" not in allowlist (${config.allowedAuthors.join(', ') || 'empty'}); skipping review.`
      );
      return;
    }

    core.info(`Reviewing PR #${pullNumber} by ${author}`);

    const diff = await fetchPRDiff({
      token: config.githubToken,
      owner,
      repo,
      pullNumber,
    });

    const MAX_INPUT_TOKENS = config.maxTokensPerPr * 2; // input headroom is roughly 2x output cap
    const inputTokens = estimateInputTokens(diff);
    core.info(`Diff size: ~${inputTokens} estimated tokens (cap: ${MAX_INPUT_TOKENS})`);

    const cappedDiff = truncateDiff(diff, MAX_INPUT_TOKENS);
    if (cappedDiff !== diff) {
      core.warning(`Diff truncated to fit input cap.`);
    }

    const findings = await callReview({
      apiKey: config.anthropicApiKey,
      model: config.model,
      maxTokens: config.maxTokensPerPr,
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage({
        diff: cappedDiff,
        prTitle,
        prBody,
      }),
    });

    core.info(`Anthropic returned ${findings.length} raw findings`);

    const highConfidence = filterByConfidence(findings, config.confidenceThreshold);
    core.info(`After confidence filter (≥${config.confidenceThreshold}): ${highConfidence.length} findings`);

    await postFindings({
      token: config.githubToken,
      owner,
      repo,
      pullNumber,
      commitSha,
      findings: highConfidence,
    });

    core.setOutput('findings-count', String(highConfidence.length));
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
