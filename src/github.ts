import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { ValidatedFinding } from './schema';

export interface FetchDiffParams {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function fetchPRDiff(params: FetchDiffParams): Promise<string> {
  const octokit = new Octokit({ auth: params.token });
  const response = await octokit.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    mediaType: { format: 'diff' },
  });
  // When mediaType is "diff", the response data is a string
  return response.data as unknown as string;
}

export interface FetchRulesFileParams {
  token: string;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

export async function fetchRulesFile(
  params: FetchRulesFileParams
): Promise<string | null> {
  const octokit = new Octokit({ auth: params.token });
  let response;
  try {
    response = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.ref,
    });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) {
      return null;
    }
    throw err;
  }
  const data = response.data as unknown;
  if (
    !data ||
    Array.isArray(data) ||
    typeof data !== 'object' ||
    (data as { type?: string }).type !== 'file'
  ) {
    return null;
  }
  const file = data as { content: string; encoding: string };
  return Buffer.from(file.content, 'base64').toString('utf-8');
}

export interface FetchPreviousFindingsParams {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  botUser?: string;
}

export interface PreviousFinding {
  path: string;
  line: number;
  body: string;
}

export async function fetchPreviousFindings(
  params: FetchPreviousFindingsParams
): Promise<PreviousFinding[]> {
  const octokit = new Octokit({ auth: params.token });
  const botUser = params.botUser ?? 'github-actions[bot]';
  const response = await octokit.pulls.listReviewComments({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    per_page: 100,
  });
  const comments = response.data as Array<{
    user: { login: string } | null;
    path: string;
    line: number | null;
    original_line?: number | null;
    body: string;
  }>;
  return comments
    .filter((c) => c.user?.login === botUser)
    .map((c) => ({
      path: c.path,
      line: c.line ?? c.original_line ?? 0,
      body: c.body,
    }));
}

export interface PostFindingsParams {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  findings: ValidatedFinding[];
  diffTruncated?: boolean;
  rawFindingsCount?: number;
  confidenceThreshold?: number;
}

const SEVERITY_EMOJI: Record<ValidatedFinding['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🔴',
  critical: '🚨',
};

export async function postFindings(params: PostFindingsParams): Promise<void> {
  const octokit = new Octokit({ auth: params.token });

  if (params.findings.length === 0) {
    const lines = ['Margins reviewed this PR — no findings.'];
    if (params.diffTruncated) {
      lines.push(
        '',
        '_Note: the diff exceeded the input cap and was truncated; not the entire diff was reviewed._'
      );
    }
    if (
      params.rawFindingsCount !== undefined &&
      params.rawFindingsCount > 0 &&
      params.confidenceThreshold !== undefined
    ) {
      const n = params.rawFindingsCount;
      lines.push(
        '',
        `_(${n} raw finding${n === 1 ? '' : 's'} dropped below the ${params.confidenceThreshold} confidence threshold.)_`
      );
    }
    await octokit.pulls.createReview({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      commit_id: params.commitSha,
      event: 'COMMENT',
      body: lines.join('\n'),
    });
    core.info('Posted no-findings review.');
    return;
  }

  const comments = params.findings.map((f) => {
    const emoji = SEVERITY_EMOJI[f.severity];
    let body = `${emoji} **[${f.severity}/${f.category}]** ${f.message}`;
    if (f.suggested_fix) {
      body += `\n\n\`\`\`suggestion\n${f.suggested_fix}\n\`\`\``;
    }
    return {
      path: f.file_path,
      line: f.line,
      body,
    };
  });

  try {
    await octokit.pulls.createReview({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      commit_id: params.commitSha,
      event: 'COMMENT',
      body: `Margins reviewed this PR and found ${params.findings.length} item${params.findings.length === 1 ? '' : 's'}.`,
      comments,
    });
    return;
  } catch (err) {
    core.warning(
      `createReview failed (${err instanceof Error ? err.message : String(err)}); falling back to per-comment posting so good comments still land.`
    );
  }

  let succeeded = 0;
  let failed = 0;
  for (const c of comments) {
    try {
      await octokit.pulls.createReviewComment({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pullNumber,
        commit_id: params.commitSha,
        body: c.body,
        path: c.path,
        line: c.line,
      });
      succeeded++;
    } catch (err) {
      failed++;
      core.warning(
        `Failed to post comment on ${c.path}:${c.line}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  core.info(
    `Per-comment fallback posted ${succeeded}/${comments.length} (${failed} dropped)`
  );
}
