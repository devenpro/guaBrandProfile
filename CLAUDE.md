# Workflow

## Default flow
1. New feature → new branch off latest `main`, named `claude/<short-feature-slug>`.
2. Implement phases as separate commits in that branch (one phase = one commit).
3. Rebuild `dist/` before each commit so source and bundled output stay in sync.
4. Push after each phase commit so any open PR stays live.
5. When all phases are done, notify with a per-commit summary and stop.
6. User creates the PR and squash-merges manually unless they ask Claude to do it.

## Exceptions
- Reusing an existing branch (instead of cutting a new one) requires asking
  permission first and explaining why — e.g., direct follow-up tightly coupled
  to in-flight work, or a fix to an already-open PR.

## Cloud session quirk
- If the harness assigns a branch at session start and it's empty (no commits
  beyond main), use it. Otherwise fetch main and cut a fresh branch from there.
  If unsure, ask before the first commit.

## Build artifacts
- `dist/bpw.min.{js,css}` (production) and `dist/bpw.{js,css}` (debug)
  are committed, along with their `.map` sourcemaps. Always run
  `npm run build` before committing source changes — both bundles are
  emitted by a single `npm run build` invocation.

## Merge etiquette
- No force-push to a branch with an open PR without explicit confirmation.
- If `main` advances during work, flag it and ask before rebasing.
