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

Create a short-lived branch from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
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
