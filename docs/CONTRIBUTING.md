# Contributing to PropertyPal

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Supabase CLI** (for Edge Functions and migrations)
- **Docker** (for n8n automation server)
- **Git**

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd property-pal-main

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env   # Then fill in your Supabase credentials

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080` (or the port Vite assigns).

## Available Scripts

<!-- AUTO-GENERATED: scripts-table -->
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with hot reload |
| `npm run build` | Production build with TypeScript type checking |
| `npm run build:dev` | Development build (unminified, with source maps) |
| `npm run lint` | Run ESLint across the project |
| `npm run preview` | Preview the production build locally |
<!-- END AUTO-GENERATED -->

## Project Structure

```
src/
  components/       # Reusable UI components
    auth/           # MFA, protected route components
    chat/           # Property chatbot
    layout/         # Admin, Owner, Tenant layout shells
    ui/             # shadcn/ui primitives
  hooks/            # Custom React hooks (useAuth, etc.)
  pages/            # Route-level page components
    admin/          # Admin dashboard, users, owners, reports
    owner/          # Owner dashboard, properties, appointments, profile
    tenant/         # Tenant dashboard, properties, appointments, profile
  utils/            # Shared utilities (security, audit, password validation, n8n)
  integrations/     # Supabase client configuration

supabase/
  functions/        # Edge Functions (crypto-service, admin-create-user, rate-limiter)
  migrations/       # SQL migrations (audit logs, RBAC, rate limiting)

n8n/
  workflows/        # n8n workflow JSON files for email notifications
  SETUP.md          # n8n setup guide
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Auth, Database, Edge Functions, RLS)
- **State Management:** TanStack React Query
- **Routing:** React Router v6
- **Automation:** n8n (Docker) for email notifications
- **Encryption:** AES-256-GCM via Supabase Edge Function (server-side)

## Working with Edge Functions

```bash
# Deploy a function
supabase functions deploy crypto-service

# Set secrets
supabase secrets set ENCRYPTION_KEY="your-key"

# Test locally
supabase functions serve crypto-service
```

## Working with Migrations

```bash
# Push all pending migrations
supabase db push

# Create a new migration
supabase migration new <migration_name>
```

## Code Style

- **Linter:** ESLint with React Hooks and React Refresh plugins
- **Formatter:** Follow existing patterns (no Prettier config — match surrounding code)
- **TypeScript:** Strict mode enabled
- **Imports:** Use `@/` path alias for `src/` directory

## Security Guidelines

- **Never store secrets in client-side code** — use Edge Function secrets
- **All PII must be encrypted** via the `crypto-service` Edge Function
- **Validate passwords** on both client and server side
- **Use RLS policies** for all database tables
- **Log sensitive operations** via the audit logging system

See [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) for full security architecture.

## Git Workflow

Work happens on short-lived feature branches, never directly on `main`.

```bash
# Start a new feature
git checkout main
git pull
git checkout -b feature/short-name

# Test locally while iterating
npm run dev        # hot-reload dev server at localhost
npm run build      # verify it compiles
npm run lint       # catch code issues

# Checkpoint as you go — commits are your undo history
git add <files>
git commit -m "checkpoint: what this change does"

# When the feature works end-to-end
git push -u origin feature/short-name
# open a PR on GitHub, let CI run, merge when green
```

### Undoing things

| Situation | Command |
|-----------|---------|
| Undo unstaged edits in a file | `git restore <file>` |
| Unstage a file (keep edits) | `git restore --staged <file>` |
| Undo last commit, keep changes as edits | `git reset --soft HEAD~1` |
| Undo last commit and discard changes | `git reset --hard HEAD~1` |
| Revert an old commit safely (new inverse commit) | `git revert <hash>` |
| Find any past repo state (even "lost" commits) | `git reflog` |

`git reflog` keeps ~90 days of history — almost nothing is truly lost once committed.

## n8n Workflows

See [n8n/SETUP.md](../n8n/SETUP.md) for setting up the email notification automation server.
