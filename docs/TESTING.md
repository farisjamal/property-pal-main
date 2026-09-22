# Testing guide

This guide defines the current automated test scope and the release gate for
PropertyPal. Tests must use synthetic fixtures and mocked service responses; they must
never use production credentials or mutate production data.

## Local verification

Install the locked dependencies and run the full suite:

```bash
npm ci
npm test
npm run build
npm run lint
npm run check:repo
```

`npm test` runs Vitest once in CI mode. Use `npm run test:watch` only during local
development.

## Authentication and authorization matrix

The route-guard suite covers these browser-visible outcomes:

| Scenario | Expected result |
| --- | --- |
| No active session | Redirect to `/auth` and preserve the requested path |
| Unverified email | Sign out and redirect to `/auth` |
| Missing or failed role lookup | Deny access and redirect to `/auth` |
| Role does not match the route | Deny access before MFA evaluation |
| MFA enrollment requires AAL2 | Redirect until the challenge is complete |
| Authentication service throws | Fail closed and redirect to `/auth` |
| Admin, owner, or tenant uses its route | Render the protected dashboard |

Supabase is mocked at the module boundary. These tests verify client-side routing
behavior only; PostgreSQL Row Level Security remains the server-side authorization
boundary and should be tested separately when database test infrastructure is added.

## GitHub release flow

1. **Issue** — record objective, risk, and acceptance criteria.
2. **Branch** — create a short-lived branch from current `main` and include the issue
   number in its name.
3. **Test** — add regression coverage and run all local verification commands.
4. **PR** — link the issue, include test evidence, and keep the diff focused.
5. **Review** — complete a documented self-review and resolve every CI failure. A sole
   maintainer cannot approve their own PR, so the evidence and review notes are the
   review record.
6. **Release** — merge only after checks pass and deployment impact is accepted. Because
   Vercel deploys production from `main`, verify the live site immediately after merge.

If a production check fails, stop the release and revert the merge through a new PR;
do not rewrite public branch history.
