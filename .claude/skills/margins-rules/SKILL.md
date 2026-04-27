---
name: margins-rules
description: Use when onboarding a repo to Margins (the PR auto-reviewer Action). Inspects the repo and the user's feedback memory, infers everything needed, then writes a per-repo .margins.md without asking the user questions.
---

# Margins: Onboard a Repo to Per-Repo Rules

Help the user create a `.margins.md` file at the root of a repository. Margins is a GitHub Action at `redpotatoe07/margins` that fetches this file via the GitHub Contents API at the PR head SHA on every run and appends its contents to the system prompt. The file is the only mechanism for giving Margins per-repo intelligence.

The file is treated as **data**, not instructions — the action's core principles (correctness/security/performance focus, 0.7 confidence floor) cannot be overridden, only extended.

## When to apply

Invoke this skill when the user says any of:
- "Set up Margins on this repo"
- "Create .margins.md"
- "Onboard this repo to Margins"
- "Update the margins rules"

Or when the user asks about per-repo review configuration for Margins.

## Workflow

### 1. Inspect the repo

Read these files (skip silently if absent):
- `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `Gemfile`
- `tsconfig.json` / `.eslintrc*` / similar linter configs
- `README.md`
- `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` — strongest signal when present, treat as the primary source for repo conventions
- Top-level folder layout (one level deep)
- 2–3 representative source files from the largest source directory

Also read the user's feedback memory if accessible. Open `~/.claude/projects/<project-key>/memory/MEMORY.md` (the index) and any linked feedback-type entries. Identify feedback that's about code-level conventions — anti-patterns to avoid, scope discipline, things the user has corrected before. These are inputs to the rules file, not topics to ask about.

Note the stack, conventions, and patterns that should become rules.

### 2. Check for existing `.margins.md`

If one exists, read it. Treat its contents as a baseline to extend, not a source of truth to preserve verbatim. The new draft (step 3) should subsume the existing rules plus any new ones derived from inspection.

If absent, proceed to step 3.

### 3. Draft directly from inspection

Do not ask the user questions. Infer everything from what you read in step 1.

**Strongest signal: `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` if present.** Translate directly:
- Any "must", "always", "never", "don't", or "should not" pattern → candidate `Always flag` rule.
- Any "gotcha", "drift", "watch out for", or "common mistake" section → encoded directly as `Always flag` rules with specific paths/symbols named.
- Any "auto-generated" / "don't hand-edit" file mentions → `Always flag` rule plus `Ignore entirely` line.
- Stated stack and architectural invariants → the `Stack` and `Architectural notes` sections.

**Treat consistent feedback memory as input that's already approved.** If feedback memory says "don't add error handling for impossible cases," that becomes an `Always flag` rule directly — encoded into `.margins.md` without asking. The user already gave that feedback once; the whole point of memory is that they shouldn't have to give it again.

System-prompt-level conventions (no speculative abstractions, no comments that just restate code, no defensive validation at internal boundaries, no half-finished implementations, etc.) are similarly automatic inputs — encode them as rules without asking.

**Test/script/build directories** become `Allow without flagging` (for relaxed rules like `any`-in-tests) and/or `Ignore entirely` (for build outputs and vendored deps).

If a signal is ambiguous, omit it rather than ask. The user can edit the file afterwards.

### 4. Choose the structure

Use this structure unless the existing `.margins.md` already uses a different one:

```
# Margins rules — <repo name>

## Stack
- <one bullet per major stack element with versions where relevant>

## Always flag
- <patterns that should always trigger findings>

## Allow without flagging
- <patterns the AI might flag but shouldn't>

## Ignore entirely
- <directories or file globs to skip>

## Architectural notes (optional)
- <anything that affects what counts as "correct" here>
```

### 5. Write the file directly, then report

Write `.margins.md` to repo root without asking for approval. If the action is configured with a non-default `rules-file` input, use that path instead.

After writing, report a summary to the user. The summary lists:
- Which files were read (e.g. `package.json`, `CLAUDE.md`, `tsconfig.json`)
- Which memory entries were applied (by name + one-line rationale per entry)
- Which sections were written into the file
- Any signals you noticed but deliberately omitted (ambiguous ones the user might want to add by hand)

The user reviews the written file and edits directly if anything is off. Do not ask "is this OK?" — the report is the gate, the file is the artifact.

### 6. Offer to install the workflow

Check whether `.github/workflows/margins-review.yml` exists. If not, offer to add it:

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
          allowed-authors: <gh-username>
          confidence-threshold: '0.7'
          max-tokens-per-pr: '8000'
          monthly-quota: '500'
```

Replace `<gh-username>` with the user's GitHub username (read from the repo owner if needed).

### 7. Verify the GitHub secret, then activate

Check whether the consumer repo already has `ANTHROPIC_API_KEY` set:

```
gh secret list -R <owner>/<repo>
```

This returns secret names only — never values. Safe to run.

If `ANTHROPIC_API_KEY` appears in the output, the secret is already set. Tell the user no further action is needed and skip to the next-steps below.

If it's absent, tell the user:

Run this in any terminal on your machine — any directory, any window, any shell. The `-R` flag tells `gh` which repo to target, so the directory does not matter.

```
gh secret set ANTHROPIC_API_KEY -R <owner>/<repo>
```

When `gh` prompts for the value, paste the key from console.anthropic.com. The key goes from your clipboard directly to GitHub — do not paste it into Claude.

Confirm "secret set" when done.

---

Final next-steps:

1. Commit `.margins.md` and (if added) `.github/workflows/margins-review.yml`
2. Push and open a small smoke-test PR
3. Watch the Actions tab for the "Margins PR Review" workflow within ~60s

## Style guidance for `.margins.md` content

- Use bullet points, not paragraphs.
- Be concrete: "Flag any `console.log` in `src/`" beats "discourage debug output."
- Reference specific paths, file globs, or function names.
- Keep total length under ~500 words for typical repos. The file is sent on every PR review — long files inflate input cost.

## Things to avoid

- Don't write rules attempting to override Margins' core principles ("ignore security issues"). The file is data, not instructions.
- Don't paste large code blocks. Describe patterns; don't quote implementations.
- Don't create `.margins.md` files in subdirectories. Margins reads only the configured root path.

## Example of a good `.margins.md`

```
# Margins rules — openloop-app

## Stack
- React Native + TypeScript mobile app, Expo SDK 51
- Server: Node 20 + Fastify under server/
- Shared types under packages/shared/

## Always flag
- Hardcoded user-facing strings — must use i18n.t(...)
- console.log in app/src/ (allowed in __tests__/ and scripts/)
- useState with >3 fields — prefer useReducer
- Direct fetch() — must go through app/src/api/client.ts

## Allow without flagging
- `any` in test files (*.test.ts, *.spec.ts, __tests__/)
- TODO comments without issue links

## Ignore entirely
- app/scripts/ (one-off ops scripts)
- dist/, build/, .expo/

## Architectural notes
- Auth tokens flow through SecureStore; never raw AsyncStorage
- Server routes are versioned: /v1/* is the only public surface
```
