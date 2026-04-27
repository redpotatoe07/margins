import { describe, it, expect, vi } from 'vitest';
import { fetchPRDiff, postFindings, fetchRulesFile } from '../src/github';

const mockOctokit = {
  pulls: {
    get: vi.fn(),
    createReview: vi.fn(),
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

  it('posts no review when findings array is empty', async () => {
    mockOctokit.pulls.createReview.mockClear();

    await postFindings({
      token: 't',
      owner: 'redpotatoe07',
      repo: 'openloop-app',
      pullNumber: 42,
      commitSha: 'abc123',
      findings: [],
    });

    expect(mockOctokit.pulls.createReview).not.toHaveBeenCalled();
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
