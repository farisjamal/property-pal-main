## Issue

Closes #

## Change

- What changed:
- Why it changed:

## Test evidence

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run lint` (document existing warnings separately)
- [ ] `npm run check:repo`
- [ ] No test contacted production services or used production credentials

## Review

- [ ] Diff self-reviewed for scope, security, and failure states
- [ ] GitHub Actions checks are green
- [ ] Any reviewer findings are resolved or documented

## Release

- [ ] This change is safe to deploy from `main`
- [ ] Production impact and rollback path are understood
- [ ] Post-deploy smoke check is defined

> Merging to `main` triggers the production Vercel deployment. Do not merge while
> required checks are pending or failing.
