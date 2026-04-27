---
name: margins-rules
description: Use when onboarding a repo to Margins (the PR auto-reviewer Action). Inspects the repo, asks 3-5 targeted questions, drafts and writes a per-repo .margins.md rules file.
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
- Top-level folder layout (one level deep)
- 2–3 representative source files from the largest source directory

Note the stack, conventions, and patterns that look like project-specific rules.

### 2. Check for existing `.margins.md`

If one exists, read it, summarize what's already there to the user, and ask: "Extend, replace, or revise specific sections?"

If absent, proceed to step 3.

### 3. Ask 3–5 targeted questions

Tailor questions to what you saw in step 1. Do not use a generic checklist.

Examples:
- "I see this is a [stack]. Any [stack]-specific patterns to flag or allow?"
- "Any directories Margins should not review (tests, scripts, generated)?"
- "Is there a style guide or convention doc I should mirror?"
- "What's been a recurring source of bugs or PR pushback here?"
- "Anything about your team's conventions that isn't obvious from the code?"

Cap at 5 questions in the first pass.

### 4. Draft the file

Use this structure unless the user prefers otherwise:

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

Show the draft inline before writing. Iterate on user feedback.

### 5. Write the file

After approval, write to `<repo-root>/.margins.md`. If the action is configured with a non-default `rules-file` input, use that path instead.

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
