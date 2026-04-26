import { describe, it, expect, vi } from 'vitest';
import { fetchPRDiff, postFindings } from '../src/github';

const mockOctokit = {
  pulls: {
    get: vi.fn(),
    createReview: vi.fn(),
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
