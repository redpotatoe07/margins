# Margins

Self-hosted PR auto-reviewer using the Anthropic API. Drop-in replacement for third-party review services with five-layer cost capping.

## Usage

In any consumer repo, add `.github/workflows/margins-review.yml`:

```yaml
name: Margins PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: margins-review-${{ github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: redpotatoe07/margins@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed-authors: redpotatoe07
          confidence-threshold: '0.7'
          max-tokens-per-pr: '8000'
          monthly-quota: '500'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `anthropic-api-key` | yes | — | Anthropic API key (from Anthropic Console) |
| `github-token` | no | `${{ github.token }}` | GitHub token for posting comments |
| `model` | no | `claude-haiku-4-5` | Anthropic model |
| `max-tokens-per-pr` | no | `8000` | Output token cap per PR |
| `confidence-threshold` | no | `0.7` | Minimum confidence (0-1) for posting findings |
| `allowed-authors` | no | `''` (empty = allow all) | Comma-separated GitHub usernames |
| `monthly-quota` | no | `500` | Maximum reviews per repo per calendar month |

## Cost Controls

Five layers, defense-in-depth:

1. **Anthropic Console monthly budget cap** — set in your Anthropic dashboard, hardest layer
2. **Per-PR token cap** — `max-tokens-per-pr` input
3. **Per-author allowlist** — `allowed-authors` input
4. **Workflow concurrency** — set in consumer workflow with `concurrency:` block
5. **Per-repo monthly quota** — `monthly-quota` input

Set the Anthropic Console cap deliberately. Recommended starting point: $25/month, observe, adjust.

## Output Schema

Every finding posted as an inline review comment uses the Greptile-compatible schema:

```typescript
{
  file_path: string;
  line: number;
  severity: "info" | "warning" | "error" | "critical";
  category: "correctness" | "security" | "performance" | "style" | "docs";
  message: string;
  confidence: number; // 0-1
  suggested_fix?: string; // rendered as GitHub suggestion block when present
}
```

## Local Development

```bash
git clone https://github.com/redpotatoe07/margins
cd margins
npm install
npm test           # run vitest
npm run build      # bundle to dist/index.js
npm run type-check # tsc --noEmit
```

## Status

Built as a personal PR-review Action. Source is published for transparency and so the author's own consumer repos can use it via `uses: redpotatoe07/margins@v1`. No license is granted for reuse or redistribution; all rights reserved.
