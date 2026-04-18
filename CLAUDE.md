# CLAUDE.md — Project Instructions for Claude Code

These rules apply to every session. Read them before taking any action.

## Preflight: do this BEFORE editing or adding anything

Whenever the user asks to **edit**, **add**, **refactor**, or **implement** something, run this preflight check **first** — before any Read/Edit/Write/Bash for the requested work:

```bash
git fetch                                   # safe: updates remote info only, changes nothing
git status                                  # shows local state + whether remote has moved ahead
```

Then decide:

1. **If `git status` says "Your branch is up to date with 'origin/main'"** → safe to proceed.

2. **If it says "Your branch is behind origin/main by N commits"** → STOP. Do not edit. Tell the user:
   > "Remote `origin/main` has N new commits you don't have locally. Pull first before I make changes, or we'll hit the same merge conflict situation as before. Run `git pull` (or I can run it if you confirm)?"
   Wait for user confirmation before pulling or editing.

3. **If it says "Your branch and 'origin/main' have diverged"** → STOP. This is exactly the problem that caused the big merge conflict. Tell the user:
   > "Local and remote have diverged — both sides have new commits. Editing now will make conflicts worse. Resolve the divergence first (rebase or merge) before I make changes."
   Wait for user instruction.

4. **If working tree has uncommitted changes** → mention them in the preflight summary so the user knows their current state before you add more. Example:
   > "Note: you have 3 uncommitted modified files (`X.tsx`, `Y.ts`, `Z.sql`) before I start."

## Working-copy rules

- **Never work directly on `main` for non-trivial changes.** Before starting a feature/refactor, suggest: `git checkout -b feature/<short-name>`. Only commit directly to `main` for tiny fixes (≤1 file, obviously correct).
- **Never `git push` without explicit user approval.** Local commits are safe; pushes are shared state.
- **Never `git push --force` or `--force-with-lease` unless the user explicitly says so in this message.**
- **Never run `git reset --hard`, `git clean -fd`, `git checkout .`, or `git rm` on user files without explicit confirmation.** These destroy uncommitted work.
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`) unless the user explicitly asks.

## Checkpoint discipline

- Encourage the user to commit in small logical chunks as work progresses — each commit is an undo point.
- If about to make a change spanning many files, suggest committing existing uncommitted work first as a checkpoint.
- Prefer many small commits over one giant commit. Squashing later is easy; splitting later is hard.

## Root cause of the 2026-04-18 merge conflict incident

For context on why these rules exist: on 2026-04-18 the user had 30+ uncommitted local changes while `origin/main` received 2 commits from another writer (likely the Lovable integration — `lovable-tagger` is in `package.json`). When they later pulled, 12 files conflicted because both sides had redesigned the same landing/layout/dashboard components.

**Two writers touched `main` without syncing.** The preflight above exists to make sure you catch that BEFORE editing, not after.

## Project-specific notes

- **Stack**: Vite + React + TypeScript + Tailwind + Supabase (Edge Functions in Deno) + n8n (automation)
- **Dev server**: `npm run dev` (usually `http://localhost:8080`)
- **Build check**: `npm run build` must pass before pushing
- **Lint**: `npm run lint` has 53 pre-existing errors — surface new ones but don't block on pre-existing ones
- **CI**: `.github/workflows/ci.yml` runs build on every push/PR
- **Docs**: See `docs/CONTRIBUTING.md` for setup and git workflow, `docs/SECURITY_IMPLEMENTATION.md` for security architecture
- **Secrets**: Never commit `.env`; Edge Function secrets live in Supabase dashboard, not the repo

## When the user is on `localhost`

If the user mentions they're testing locally:
- **Remind them** that edits auto-reload via Vite HMR — no push needed to test
- **Do NOT suggest pushing** just to see changes
- Only suggest `git push` when the feature is complete and tested

## Style

- Keep explanations concise. The user prefers direct answers with concrete commands, not long preambles.
- Use markdown code blocks for every command.
- When reporting, use file paths as clickable links: `[filename.ts](src/filename.ts)`.
