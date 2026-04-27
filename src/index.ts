import * as core from '@actions/core';
import * as github from '@actions/github';
import * as cache from '@actions/cache';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { parseConfig } from './config';
import { fetchPRDiff, postFindings, fetchRulesFile, fetchPreviousFindings } from './github';
import { callReview } from './anthropic';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { filterByConfidence } from './filter';
import { isAuthorAllowed } from './caps/author-allowlist';
import { estimateInputTokens, truncateDiff } from './caps/token-cap';
import { currentMonthKey, checkAndIncrementQuota } from './caps/monthly-quota';

async function quotaGet(key: string): Promise<string | null> {
  const path = `/tmp/${key}`;
  try {
    await cache.restoreCache([path], key);
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8');
    }
  } catch (err) {
    core.warning(`Cache restore failed: ${err}`);
  }
  return null;
}

async function quotaSet(key: string, value: string): Promise<void> {
  const path = `/tmp/${key}`;
  writeFileSync(path, value);
  try {
    await cache.saveCache([path], key);
  } catch (err) {
    core.warning(`Cache save failed: ${err}`);
  }
}

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
      rulesFile: core.getInput('rules-file'),
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

    const monthKey = currentMonthKey();
    const cacheKey = `margins-quota-${monthKey}`;
    const quota = await checkAndIncrementQuota({
      monthKey,
      limit: config.monthlyQuota,
      get: () => quotaGet(cacheKey),
      set: (v) => quotaSet(cacheKey, v),
    });

    if (!quota.allowed) {
      core.warning(
        `Monthly quota exceeded for ${monthKey} (${quota.used}/${quota.limit}). Skipping review.`
      );
      return;
    }
    core.info(`Quota: ${quota.used}/${quota.limit} for ${monthKey}`);

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

    let repoRules: string | undefined;
    try {
      const fetched = await fetchRulesFile({
        token: config.githubToken,
        owner,
        repo,
        path: config.rulesFile,
        ref: commitSha,
      });
      if (fetched) {
        repoRules = fetched;
        core.info(
          `Using ${config.rulesFile} from ${commitSha.slice(0, 7)} (${fetched.length} chars)`
        );
      } else {
        core.info(`No ${config.rulesFile} found; using default rules.`);
      }
    } catch (err) {
      core.warning(
        `Failed to fetch ${config.rulesFile}: ${err instanceof Error ? err.message : String(err)}. Using default rules.`
      );
    }

    let previousFindings: Array<{ path: string; line: number; body: string }> = [];
    try {
      previousFindings = await fetchPreviousFindings({
        token: config.githubToken,
        owner,
        repo,
        pullNumber,
      });
      if (previousFindings.length > 0) {
        core.info(
          `Found ${previousFindings.length} previous Margins findings; passing as context to suppress re-litigation.`
        );
      }
    } catch (err) {
      core.warning(
        `Failed to fetch previous findings: ${err instanceof Error ? err.message : String(err)}. Proceeding without them.`
      );
    }

    const findings = await callReview({
      apiKey: config.anthropicApiKey,
      model: config.model,
      maxTokens: config.maxTokensPerPr,
      systemPrompt: buildSystemPrompt({ repoRules }),
      userMessage: buildUserMessage({
        diff: cappedDiff,
        prTitle,
        prBody,
        previousFindings,
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
