import { describe, it, expect, vi } from 'vitest';
import { fetchPRDiff, postFindings, fetchRulesFile, fetchPreviousFindings, countPreviousMarginsReviews } from '../src/github';

const mockOctokit = {
  pulls: {
    get: vi.fn(),
    createReview: vi.fn(),
    createReviewComment: vi.fn(),
    listReviewComments: vi.fn(),
    listReviews: vi.fn(),
  },
  repos: {
    getContent: vi.fn(),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(function () {
    return mockOctokit;
  }),
}));

describe('fetchPRDiff', () => {
  it('returns the diff text from the API', async () => {
    mockOctokit.pulls.get.mockResolvedValueOnce({
      data: 'diff --git a/x b/x\n+hello\n',
    });

    const result = await fetchPRDiff({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
    });

    expect(result).toContain('hello');
    expect(mockOctokit.pulls.get).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'redpotatoe07',
        repo: 'openloop-app',
        pull_number: 42,
        mediaType: { format: 'diff' },
      })
    );
  });
});

describe('countPreviousMarginsReviews', () => {
  it('counts only reviews from the bot user with the Margins prefix', async () => {
    mockOctokit.pulls.listReviews.mockResolvedValueOnce({
      data: [
        { user: { login: 'github-actions[bot]' }, body: 'Margins reviewed this PR (run #1) — no findings.' },
        { user: { login: 'github-actions[bot]' }, body: 'Margins reviewed this PR and found 8 items.' },
        { user: { login: 'github-actions[bot]' }, body: 'Some unrelated bot comment.' },
        { user: { login: 'redpotatoe07' }, body: 'Margins reviewed this PR — manual mention.' },
        { user: { login: 'github-actions[bot]' }, body: null },
      ],
    });

    const count = await countPreviousMarginsReviews({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
    });

    expect(count).toBe(2);
  });

  it('returns 0 when there are no reviews', async () => {
    mockOctokit.pulls.listReviews.mockResolvedValueOnce({ data: [] });

    const count = await countPreviousMarginsReviews({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
    });

    expect(count).toBe(0);
  });
});

describe('postFindings', () => {
  it('creates a review with comments mapped from findings', async () => {
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 1 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [
        {
          file_path: 'src/a.ts',
          line: 5,
          severity: 'warning',
          category: 'correctness',
          message: 'Possible bug',
          confidence: 0.85,
        },
      ],
    });

    expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'redpotatoe07',
        repo: 'openloop-app',
        pull_number: 42,
        commit_id: 'abc123',
        event: 'COMMENT',
        comments: expect.arrayContaining([
          expect.objectContaining({
            path: 'src/a.ts',
            line: 5,
          }),
        ]),
      })
    );
  });

  it('posts a "no findings" review when findings array is empty', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 2 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [],
    });

    expect(mockOctokit.pulls.createReview).toHaveBeenCalledTimes(1);
    expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'redpotatoe07',
        repo: 'openloop-app',
        pull_number: 42,
        commit_id: 'abc123',
        event: 'COMMENT',
        body: expect.stringContaining('no findings'),
      })
    );
  });

  it('appends a truncation note to the no-findings review when diffTruncated is true', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 3 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [],
      diffTruncated: true,
    });

    const call = mockOctokit.pulls.createReview.mock.calls[0][0];
    expect(call.body).toContain('no findings');
    expect(call.body).toContain('truncated');
  });

  it('includes the run number in the no-findings review body', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 7 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [],
      runNumber: 3,
    });

    const call = mockOctokit.pulls.createReview.mock.calls[0][0];
    expect(call.body).toContain('(run #3)');
    expect(call.body).toContain('no findings');
  });

  it('includes the run number in the with-findings review body', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 8 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      runNumber: 5,
      findings: [
        {
          file_path: 'src/a.ts',
          line: 5,
          severity: 'warning',
          category: 'correctness',
          message: 'X',
          confidence: 0.9,
          suggested_fix: null,
        },
      ],
    });

    const call = mockOctokit.pulls.createReview.mock.calls[0][0];
    expect(call.body).toContain('(run #5)');
    expect(call.body).toContain('found 1 item');
  });

  it('reports raw findings dropped below threshold in the no-findings review', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReview.mockResolvedValueOnce({ data: { id: 4 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [],
      rawFindingsCount: 3,
      confidenceThreshold: 0.7,
    });

    const call = mockOctokit.pulls.createReview.mock.calls[0][0];
    expect(call.body).toContain('3 raw findings');
    expect(call.body).toContain('0.7');
  });

  it('falls back to per-comment posting when createReview fails (e.g. invalid line on one comment)', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReviewComment.mockReset();

    const err = new Error('Unprocessable Entity: "Line could not be resolved"') as Error & { status: number };
    err.status = 422;
    mockOctokit.pulls.createReview.mockRejectedValueOnce(err);

    mockOctokit.pulls.createReviewComment
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockResolvedValueOnce({ data: { id: 2 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'speakr',
      pullNumber: 1,
      commitSha: 'abc123',
      findings: [
        {
          file_path: 'src/a.ts',
          line: 5,
          severity: 'warning',
          category: 'correctness',
          message: 'finding 1',
          confidence: 0.85,
        },
        {
          file_path: 'src/b.ts',
          line: 10,
          severity: 'info',
          category: 'docs',
          message: 'finding 2',
          confidence: 0.9,
        },
      ],
    });

    expect(mockOctokit.pulls.createReviewComment).toHaveBeenCalledTimes(2);
  });

  it('keeps posting good comments when one per-comment call fails in fallback', async () => {
    mockOctokit.pulls.createReview.mockReset();
    mockOctokit.pulls.createReviewComment.mockReset();

    const err = new Error('Unprocessable Entity') as Error & { status: number };
    err.status = 422;
    mockOctokit.pulls.createReview.mockRejectedValueOnce(err);

    const lineErr = new Error('Line could not be resolved') as Error & { status: number };
    lineErr.status = 422;
    mockOctokit.pulls.createReviewComment
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockRejectedValueOnce(lineErr)
      .mockResolvedValueOnce({ data: { id: 3 } });

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'speakr',
      pullNumber: 1,
      commitSha: 'abc123',
      findings: [
        { file_path: 'a.ts', line: 1, severity: 'warning', category: 'correctness', message: 'm1', confidence: 0.8 },
        { file_path: 'b.ts', line: 999, severity: 'warning', category: 'correctness', message: 'm2', confidence: 0.8 },
        { file_path: 'c.ts', line: 3, severity: 'warning', category: 'correctness', message: 'm3', confidence: 0.8 },
      ],
    });

    expect(mockOctokit.pulls.createReviewComment).toHaveBeenCalledTimes(3);
  });
});

describe('fetchRulesFile', () => {
  it('returns the decoded UTF-8 content when the file exists', async () => {
    const original = '# Margins rules\n- Flag console.log in src/\n';
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(original, 'utf-8').toString('base64'),
      },
    });

    const result = await fetchRulesFile({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      path: '.margins.md',
      ref: 'sha123',
    });

    expect(result).toBe(original);
    expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'redpotatoe07',
        repo: 'openloop-app',
        path: '.margins.md',
        ref: 'sha123',
      })
    );
  });

  it('returns null when the file does not exist (404)', async () => {
    const err = new Error('Not Found') as Error & { status: number };
    err.status = 404;
    mockOctokit.repos.getContent.mockRejectedValueOnce(err);

    const result = await fetchRulesFile({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      path: '.margins.md',
      ref: 'sha123',
    });

    expect(result).toBeNull();
  });

  it('returns null when the path resolves to a directory', async () => {
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: [{ name: 'something.md', type: 'file' }],
    });

    const result = await fetchRulesFile({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      path: '.margins',
      ref: 'sha123',
    });

    expect(result).toBeNull();
  });

  it('returns empty list when no previous bot findings exist', async () => {
    mockOctokit.pulls.listReviewComments.mockResolvedValueOnce({
      data: [
        { user: { login: 'someone' }, path: 'a.ts', line: 1, body: 'human comment' },
      ],
    });
    const result = await fetchPreviousFindings({
      token: 't', owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(result).toEqual([]);
  });

  it('returns previous bot findings filtered by login', async () => {
    mockOctokit.pulls.listReviewComments.mockResolvedValueOnce({
      data: [
        { user: { login: 'github-actions[bot]' }, path: 'a.ts', line: 5, body: 'finding A' },
        { user: { login: 'human' }, path: 'b.ts', line: 10, body: 'human comment' },
        { user: { login: 'github-actions[bot]' }, path: 'c.ts', line: 7, body: 'finding B' },
      ],
    });
    const result = await fetchPreviousFindings({
      token: 't', owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ path: 'a.ts', line: 5, body: 'finding A' });
    expect(result[1]).toMatchObject({ path: 'c.ts', line: 7, body: 'finding B' });
  });

  it('falls back to original_line when line is null', async () => {
    mockOctokit.pulls.listReviewComments.mockResolvedValueOnce({
      data: [
        { user: { login: 'github-actions[bot]' }, path: 'a.ts', line: null, original_line: 12, body: 'x' },
      ],
    });
    const result = await fetchPreviousFindings({
      token: 't', owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(result[0].line).toBe(12);
  });

  it('throws on non-404 errors so callers can warn and degrade', async () => {
    const err = new Error('Server error') as Error & { status: number };
    err.status = 500;
    mockOctokit.repos.getContent.mockRejectedValueOnce(err);

    await expect(
      fetchRulesFile({
        token: 't',
        owner: 'redpotatoe07',
        repo: 'openloop-app',
        path: '.margins.md',
        ref: 'sha123',
      })
    ).rejects.toThrow('Server error');
  });
});
