# PropertyPal

PropertyPal is a secure property-viewing and appointment-management web application
built as a Final Year Project. It connects tenants, property owners, and administrators
through role-specific dashboards, controlled data access, and automated appointment
workflows.

> **Project status:** Academic evaluation build. The public deployment is provided for
> demonstration and assessment; it is not a commercial production service.

## Live application

- Application: <https://www.propertypals.org/>
- Hosting: Vercel
- Backend: Supabase

Do not enter real identity documents, financial information, or other sensitive personal
data into the evaluation deployment.

## Core capabilities

| Area | Capabilities |
| --- | --- |
| Tenant | Browse properties, request viewings, and manage appointments |
| Property owner | Manage listings, viewing requests, profile details, and KYC status |
| Administrator | Manage users and owners, review KYC submissions, and view reports |
| Security | Role-based access control, Row Level Security, audit logging, MFA support, and password-strength checks |
| Automation | Optional n8n workflows for appointment notifications and reminders |

## Technology stack

- React 18, TypeScript, and Vite
- Tailwind CSS and shadcn/ui
- Supabase Auth, PostgreSQL, Row Level Security, and Edge Functions
- TanStack React Query and React Router
- Vitest and Testing Library
- Vercel deployment and optional n8n automation

## Architecture

```text
Browser (React/Vite)
        |
        v
Supabase Auth + PostgreSQL + RLS
        |
        +--> Edge Functions (privileged server-side operations)
        |
        +--> Optional n8n workflows (notifications/reminders)
```

See [system diagrams](docs/DIAGRAMS.md) and the
[security implementation summary](docs/SECURITY_IMPLEMENTATION.md) for more detail.

## Local development

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- A Supabase project for backend features
- Supabase CLI only when working with migrations or Edge Functions
- Docker only when running the optional n8n automation stack

### Setup

```bash
git clone https://github.com/farisjamal/property-pal-main.git
cd property-pal-main
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` with your own development values. Never commit `.env`, private keys,
database passwords, service-role keys, or provider API keys.

### Client environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Client-safe Supabase publishable key |
| `VITE_N8N_NEW_BOOKING_WEBHOOK` | No | Optional booking workflow endpoint |
| `VITE_N8N_STATUS_WEBHOOK` | No | Optional appointment-status workflow endpoint |

Every variable prefixed with `VITE_` is bundled into browser code and must be treated as
public. Server-only values belong in Supabase Edge Function secrets or the relevant
provider's secret store; see [SECURITY.md](SECURITY.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run check:repo` | Check tracked files for repository-hygiene violations |

## Repository structure

```text
src/                 React application, pages, components, and client integrations
supabase/functions/  Server-side Edge Functions
supabase/migrations/ Database schema and security migrations
n8n/workflows/       Credential-free workflow templates
docs/                Architecture, security, verification, and implementation records
public/              Static assets
```

## Documentation

Start with the [documentation index](docs/README.md). Contributor setup and workflow are
covered in [CONTRIBUTING.md](CONTRIBUTING.md). Security reporting and secret-handling rules
are in [SECURITY.md](SECURITY.md).

## Deployment

Vercel deploys the `main` branch. Use a short-lived branch and a pull request for every
change; merge only after the build and repository-hygiene checks pass.

Environment values for the deployed application must be configured in Vercel or Supabase,
not committed to this repository.

## License

No open-source license has been granted. All rights are reserved by the repository owner.
