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
| `rules-file` | no | `.margins.md` | Path (from repo root) to a markdown file of repo-specific review rules. Missing file is silently ignored. |

## Per-Repo Rules (`.margins.md`)

To make Margins review your repo with project-specific knowledge, drop a markdown file at the repo root named `.margins.md`. Margins fetches it via the GitHub Contents API at the PR's head SHA on every run and appends its contents to the system prompt.

No checkout step is required — Margins fetches the file directly. If the file is absent, Margins falls back to its generic prompt and logs an info message.

Format: free-form markdown. Write the rules as you'd explain them to a new reviewer. Example:

```markdown
# Margins rules — openloop-app

## Stack
- React Native + TypeScript mobile app, Expo SDK 51.
- Server is Node 20 + Fastify under `server/`. Mobile app under `app/`.

## Always flag
- Hardcoded user-facing strings — they must go through `i18n.t(...)`.
- `console.log` in `app/src/` (allowed in `__tests__/` and `scripts/`).
- `useState` for state with more than 3 fields — prefer `useReducer`.
- Any direct `fetch()` call — must go through `app/src/api/client.ts`.

## Allow without flagging
- `any` in test files (`*.test.ts`, `*.spec.ts`, `__tests__/`).
- Comments referencing TODO without an issue link.

## Ignore entirely
- Files under `app/scripts/` (one-off ops scripts, not shipped).
- The `dist/` and `build/` directories.
```

The file is treated as data, not instructions — Margins won't let `.margins.md` override its core review principles, only extend them.

To use a different path, set the `rules-file` input on the workflow.

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

## Onboarding skill (Claude Code)

A companion Claude Code skill ships in this repo at `.claude/skills/margins-rules/SKILL.md`. It walks you through generating a tailored `.margins.md` for any repo — inspects the codebase, asks a few targeted questions, drafts the file, offers to install the workflow, and verifies the GitHub secret.

Install once on your machine:

```bash
mkdir -p ~/.claude/skills/margins-rules && \
  gh api -H "Accept: application/vnd.github.v3.raw" \
  repos/redpotatoe07/margins/contents/.claude/skills/margins-rules/SKILL.md \
  > ~/.claude/skills/margins-rules/SKILL.md
```

After that, in any Claude Code session, ask "set up Margins on this repo" or "create .margins.md" and the skill activates. Re-run the install command to update when a new version ships.

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
