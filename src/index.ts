import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseConfig } from './config';
import { fetchPRDiff, postFindings } from './github';
import { callReview } from './anthropic';
import { buildSystemPrompt, buildUserMessage } from './prompt';

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

    core.info(`Reviewing PR #${pullNumber} by ${author}`);

    const diff = await fetchPRDiff({
      token: config.githubToken,
      owner,
      repo,
      pullNumber,
    });

    const findings = await callReview({
      apiKey: config.anthropicApiKey,
      model: config.model,
      maxTokens: config.maxTokensPerPr,
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage({ diff, prTitle, prBody }),
    });

    core.info(`Anthropic returned ${findings.length} raw findings`);

    await postFindings({
      token: config.githubToken,
      owner,
      repo,
      pullNumber,
      commitSha,
      findings,
    });

    core.setOutput('findings-count', String(findings.length));
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
