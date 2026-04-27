import { Octokit } from '@octokit/rest';
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

export interface PostFindingsParams {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  findings: ValidatedFinding[];
}

const SEVERITY_EMOJI: Record<ValidatedFinding['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🔴',
  critical: '🚨',
};

export async function postFindings(params: PostFindingsParams): Promise<void> {
  if (params.findings.length === 0) {
    console.log('No findings to post.');
    return;
  }

  const octokit = new Octokit({ auth: params.token });

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

  await octokit.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    commit_id: params.commitSha,
    event: 'COMMENT',
    body: `Margins reviewed this PR and found ${params.findings.length} item${params.findings.length === 1 ? '' : 's'}.`,
    comments,
  });
}
