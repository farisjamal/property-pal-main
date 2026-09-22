# Contributing to PropertyPal

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Git
- Supabase CLI for migrations and Edge Functions
- Docker only for optional n8n automation

## Setup

```bash
git clone https://github.com/farisjamal/property-pal-main.git
cd property-pal-main
npm install
cp .env.example .env
npm run dev
```

Use only development credentials. Never copy production service-role keys, database
passwords, encryption keys, or provider API keys into `.env`.

## Development workflow

Use the following GitHub flow for every production-bound change:

1. **Issue** — define the problem, acceptance criteria, and production risk.
2. **Branch** — create a short-lived branch from the latest `main` and include the issue
   number in the branch name.
3. **Test** — add or update regression coverage and complete local verification.
4. **PR** — link the issue and record test evidence in the pull request template.
5. **Review** — self-review the complete diff and resolve all blocking CI checks. For a
   sole-maintainer repository, a review comment with findings and evidence is the review
   record; GitHub does not allow an author to approve their own PR.
6. **Release** — merge only when the PR is ready for production, then verify the live
   deployment.

Create the branch after the issue exists:

```bash
git switch main
git pull --ff-only
git switch -c test/123-short-description
```

Before committing:

```bash
npm test
npm run build
npm run lint
npm run check:repo
```

Use clear Conventional Commit messages, for example:

```text
feat(appointments): add rescheduling validation
fix(auth): handle expired MFA challenge
docs(security): clarify secret storage
```

Push the branch and open a pull request against `main`. Do not commit directly to `main`.
Merging to `main` triggers the production Vercel deployment, so pending or failed checks
block release.

## Project conventions

- Keep route-level components in `src/pages/`.
- Keep reusable UI and domain components in `src/components/`.
- Keep browser-side Supabase access in `src/integrations/supabase/`.
- Put privileged operations in Supabase Edge Functions, never in browser code.
- Add database changes as new migrations; do not edit migrations already deployed.
- Keep n8n workflow exports credential-free and use placeholders for credential IDs.
- Update documentation when behaviour, environment variables, or deployment steps change.

## Security checklist

- No `.env` or local deployment metadata is staged.
- No value prefixed with `VITE_` is treated as confidential.
- Service-role, encryption, email, database, and webhook secrets remain server-side.
- New tables and views have appropriate Row Level Security policies.
- Logs and screenshots contain no credentials or personal data.
- `npm run check:repo` passes.

See [SECURITY.md](SECURITY.md) for reporting and secret-handling rules, and
[docs/README.md](docs/README.md) for the documentation map.
