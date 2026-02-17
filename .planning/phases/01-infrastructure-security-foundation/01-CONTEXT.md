# Phase 1: Infrastructure & Security Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy n8n via Docker Compose for AI workflow orchestration, move AES-256 encryption from client-side to Supabase Edge Function, and secure all credentials (service role key, API keys). This phase establishes the infrastructure foundation that all subsequent phases depend on.

</domain>

<decisions>
## Implementation Decisions

### n8n Deployment Setup
- Run n8n locally via Docker Compose (no cloud deployment)
- Docker Desktop needs to be installed first (user doesn't have it yet)
- n8n on default port 5678 (React dev server on 8080, no conflict)
- docker-compose.yml in a **separate sibling folder** (e.g., `~/FYP/property-pal-n8n/`), not inside the main repo
- PostgreSQL for n8n's internal database (not SQLite)
- Basic auth enabled for n8n dashboard access
- Demo will run on user's own laptop (full control over environment)
- Timezone: Asia/Kuala_Lumpur
- Auto-restart: `restart: unless-stopped`

### Encryption Migration
- All existing data is test data — safe to wipe or re-encrypt
- Claude's Discretion: Choose between fresh start (simplest) or re-encrypt migration script based on implementation complexity. Fresh start is preferred given all data is test data.
- Claude's Discretion: Whether to support offline/fallback mode. Recommendation: Edge Function required (no client-side fallback) for maximum security — the whole point is removing the key from the client.
- Claude's Discretion: Whether n8n shares the encryption key. Recommendation: Edge Function only holds the key; n8n calls Edge Function if it needs decrypted data. Minimizes key exposure.

### Edge Function Design
- Claude's Discretion: Single function vs separate functions. Recommend single function with action parameter for simpler deployment.
- JWT required for Edge Function calls (matches existing auth pattern)
- Claude's Discretion: Direct HTTP call vs batch decrypt. Recommend batch approach for profile pages (fewer network requests).
- User has never deployed Edge Functions before — plan must include step-by-step guidance for first-time setup

### Credential Management
- User needs to check Supabase dashboard for service role key (may or may not have it)
- User needs to check if they have an Google Gemini API key (may need to create one)
- Claude's Discretion: .env file management approach. Recommend .env files per project (simplest for FYP).
- Plan must include step-by-step guides for obtaining Supabase service role key and Google Gemini API key
- n8n credentials vault for storing service role key and API keys (not in workflow JSON)
- .n8n/ directory must be in .gitignore

### Claude's Discretion
- Encryption migration strategy (fresh start vs re-encrypt — lean fresh start)
- Edge Function structure (single vs separate — lean single)
- Batch vs direct decrypt API design (lean batch)
- Key sharing between Edge Function and n8n (lean Edge Function only)
- Fallback mode (lean no fallback — Edge Function required)
- .env file management approach (lean per-project .env)

</decisions>

<specifics>
## Specific Ideas

- n8n folder as sibling to main repo: `~/FYP/property-pal-n8n/` containing docker-compose.yml and .env
- User will demo on own laptop — Docker must be pre-tested and reliable before demo day
- Include Docker Desktop installation steps in the plan (Windows)
- Include Supabase dashboard navigation steps for finding service role key
- Include Google AI Studio steps for creating/finding API key

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-security-foundation*
*Context gathered: 2026-02-18*
