# Project Research Summary

**Project:** PropertyPal AI-Powered Booking Assistant
**Domain:** Property Management Platform + LLM Chatbot Integration
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

PropertyPal is adding AI-powered property booking to an existing React + Supabase platform for the Malaysian rental market. The research validates using **n8n as a workflow orchestration layer** between the frontend chatbot and backend services, with **Claude API (Sonnet)** handling natural language understanding. This architecture preserves the existing direct Supabase access patterns while adding a stateless AI layer for complex booking workflows.

The recommended approach uses a **hybrid data access pattern**: keep direct Supabase queries for read operations (property browsing), route write operations (appointment booking) through n8n for AI orchestration. This minimizes risk by isolating changes to the chatbot feature. Core implementation requires 6 table-stakes features (NLU, property matching, availability checking, booking confirmation, context management, error handling) plus 2-3 differentiators (preference learning, smart follow-up questions) to meet FYP evaluation criteria.

**Critical risks center on three areas:** (1) **double-booking race conditions** requiring database-level uniqueness constraints, (2) **credential exposure** (service role key in n8n, encryption key in client), and (3) **FYP demo reliability** (n8n must be running, network connectivity). Mitigation strategies include optimistic locking for bookings, moving encryption server-side via Edge Functions, and comprehensive demo backup plans (recorded video, local instance, redundant hardware).

## Key Findings

### Recommended Stack

Research confirms the existing stack choice (React + Supabase) and validates n8n + Claude API as the optimal AI integration approach for a university FYP timeline. The stack provides visual workflow management (easier to explain to panels), self-hosted deployment (cost control), and strong Claude API integration for structured output via tool calling.

**Core technologies:**
- **n8n (1.x latest)**: Workflow orchestration between frontend and Claude API — visual editor reduces development time, self-hosted deployment maintains control, webhook pattern enables synchronous chat responses
- **Claude API (Sonnet 4.5)**: Natural language understanding and structured output — best-in-class tool calling for extracting booking parameters, 200K context window supports conversation history, $3-15 per million tokens fits FYP budget (~$1 for 20 demo sessions)
- **Docker Compose**: n8n hosting environment — simplest reliable setup for FYP, auto-restart on failures, volume persistence for workflows, single YAML configuration
- **Supabase Service Role Key**: Backend database access from n8n — bypasses RLS for AI queries, requires JWT validation layer for security, enables cross-user property search
- **shadcn/ui components**: Chat interface (existing library) — ScrollArea for messages, Card for properties, no external chat library needed, maintains design consistency

**Key version constraints:**
- n8n 1.x (breaking changes from 0.x)
- Claude API version header: 2023-06-01
- PostgreSQL 14+ (Supabase current)

**Alternative architectures considered and rejected:**
- Direct Claude API from frontend (security risk: exposed API key)
- Custom Node.js/Express backend (longer development time, loses visual workflow benefits)
- Supabase Edge Functions (no visual editor, harder debugging, less flexible orchestration)

### Expected Features

Research identifies 12 total features: 6 table stakes (mandatory for "AI-powered booking"), 6 differentiators (choose 2-3 for impressive FYP), and 7 anti-features (deliberately excluded to maintain scope).

**Must have (table stakes):**
- Natural Language Understanding — Parse Malay/English mixed inputs, extract location/price/bedrooms/dates with 90%+ accuracy, handle typos and colloquialisms
- Property Matching & Results — Convert NLU to database queries, rank by relevance, display top 3-5 properties with key details, sub-2-second response time
- Appointment Availability Checking — Query existing bookings, enforce business hours (9am-5pm), show available slots, prevent double-booking
- Automated Booking Confirmation — Create appointment record atomically, link tenant/property/time, set status, provide confirmation with details
- Conversational Context Maintenance — Remember previous messages (last 10), handle multi-turn dialogues, reference earlier property selections, 30-min session timeout
- Error Handling & Fallback — Graceful failures (no crashes), clarifying questions for ambiguity, redirect to manual booking when AI fails, validate all inputs

**Should have (competitive - pick 2-3):**
- **Preference Learning** (HIGH impact) — Store last 3 searches per tenant, pre-fill criteria on return visits, suggest based on historical preferences, simple "last used" heuristic sufficient
- **Smart Follow-Up Questions** (shows AI intelligence) — Proactive clarification when vague (e.g., "Selangor" → "Which part: Subang/PJ/Shah Alam?"), strategic questioning to narrow search, prioritize high-impact criteria
- Multi-Property Comparison (useful utility) — Side-by-side comparison tables, pros/cons analysis, recommendations based on stated priorities
- Bilingual Code-Switching (easy win) — Malay/English mixing handled natively by Claude, respond in user's language, localization awareness for Malaysia

**Defer (v2+):**
- Real-time owner chat (WebSocket complexity)
- Payment processing (PCI compliance, not core to booking)
- Image recognition / virtual tours (separate FYP-level effort)
- Machine learning recommendations (insufficient training data)
- Voice input (browser compatibility issues)
- Multi-tenant group bookings (edge case, adds complexity)
- Dynamic pricing / negotiation bot (requires owner buy-in)

**Feature dependencies:**
Critical path requires NLU (1) → Property Matching (2) → Availability (3) → Booking (4) working before any differentiators. Context Management (5) and Error Handling (6) can develop in parallel. All differentiators build on top of the core flow.

### Architecture Approach

The target architecture extends PropertyPal's existing React SPA + Supabase pattern with a stateless n8n workflow layer. Frontend maintains direct Supabase access for read-heavy operations (property browsing, appointment viewing), while write operations (booking appointments) route through n8n for AI orchestration, business logic validation, and audit logging.

**Major components:**

1. **PropertyChatbot (React)** — Enhanced chat UI component, maintains conversation state in local state (no persistence), sends user messages to n8n webhook with Supabase JWT, renders property cards and booking confirmations from AI responses

2. **n8n Workflow Engine** — Stateless orchestrator, receives webhook POSTs from frontend, validates JWT and extracts user_id/role, routes to Claude API for NLU, queries Supabase for properties/availability, creates appointments with conflict detection, returns formatted JSON responses within 30-second timeout

3. **Claude API (External Service)** — Structured output via tool calling, extracts search criteria from natural language, uses predefined tools (property_search, book_appointment) with JSON schemas, returns tool_use responses parsed by n8n, average 2-5 second latency per call

4. **Supabase (Existing Platform)** — n8n accesses via service role key (bypasses RLS), frontend continues using anon key + RLS for direct queries, appointments table extended with created_by_ai flag and conversation_id, optional conversations table for session persistence, existing audit_log system captures all AI actions

**Critical architectural decisions:**

- **Hybrid data access pattern** — Maintains existing performance (no latency for browsing), isolates frontend changes to chatbot component, requires maintaining two access patterns (complexity tradeoff)
- **Stateless workflow (no memory)** — Simpler logic in MVP (conversation history in frontend only), cannot handle follow-ups like "show cheaper options" (future: store in Supabase conversations table)
- **Service role key usage** — Enables AI to query all properties (not just user's RLS-filtered view), requires JWT validation layer to prevent authorization bypass, higher security risk if key leaks

**Data flow (booking lifecycle):**
1. Tenant → PropertyChatbot: "I need 3BR apartment in KL under RM2000"
2. PropertyChatbot → n8n webhook: POST with message + JWT + tenant_id
3. n8n validates JWT → extracts user_id + role (must be tenant)
4. n8n → Claude API: Message + property_search tool schema
5. Claude → n8n: tool_use response with {bedrooms: 3, location: "KL", max_price: 2000}
6. n8n → Supabase: Query properties matching criteria + check availability
7. n8n → PropertyChatbot: JSON with properties array + available time slots
8. Tenant selects property + time → n8n webhook: book_appointment action
9. n8n → Supabase: Conflict check (optimistic lock) → INSERT appointment
10. n8n → Supabase: Create notification for property owner
11. n8n → PropertyChatbot: Confirmation with appointment details

**Build order implications:**
- Phase 1 (Infrastructure): Deploy n8n, configure credentials, test connections — 1-2 days
- Phase 2 (Backend Workflow): Build n8n flows, JWT validation, Claude integration — 3-5 days
- Phase 3 (Frontend Integration): Enhanced PropertyChatbot, webhook client, UI rendering — 2-3 days
- Phase 4 (Database): Extend appointment table, add indexes, optional conversations table — 1 day (parallel with Phase 2)
- Phase 5 (Testing & Optimization): Performance tuning, error scenarios, concurrent users — ongoing

### Critical Pitfalls

Research identifies 36 pitfalls across 6 categories. Top 8 are critical-path risks that will cause demo failure or FYP low marks if unaddressed:

1. **Double-Booking Race Conditions** — Two users book same slot simultaneously, chatbot checks availability but slot taken before confirmation. **Prevention:** Database unique constraint (`CREATE UNIQUE INDEX idx_unique_appointment ON appointment(property_id, appointment_date, appointment_time) WHERE status != 'cancelled'`), optimistic locking with error recovery, "just booked" message suggests alternatives. PropertyPal already identified this as existing bug (per PROJECT.md).

2. **Live Demo Murphy's Law** — n8n crashes, internet fails, API quota exceeded during presentation. **Prevention:** Pre-demo checklist (test on university network, verify credentials, check Claude quota), record backup video, bring second laptop with full setup, mobile hotspot for network redundancy, print architecture diagrams as fallback, rehearse 5+ times with timing.

3. **Credential Exposure** — Supabase service role key in n8n logs/workflows, encryption key in client bundle. **Prevention:** Store in n8n credentials vault (encrypted), never commit workflow JSON to git (add `.n8n/` to `.gitignore`), use environment variables, rotate quarterly, redact from logs. Related to existing PropertyPal issue (VITE_ENCRYPTION_KEY exposure per CLAUDE.md).

4. **Hallucinated Property Details** — Claude invents amenities/prices not in database, destroys credibility. **Prevention:** RAG pattern (query Supabase first, inject as "VERIFIED FACTS"), structured output with JSON schema constraints, fact-checking layer compares AI response to DB, system prompt: "Only use provided data, never assume".

5. **Cannot Explain How It Works** — Panel asks technical questions, student relies on "AI handles it" without understanding internals. **Prevention:** Memorize architecture diagram (User → React → n8n → Claude → Supabase flow), prepare explanation scripts (30-sec elevator pitch, 2-min technical overview, 5-min deep dive), document custom algorithms (conflict detection, date parsing), anticipate questions ("Why n8n vs custom backend?", "How prevent hallucinations?", "Testing strategy?").

6. **Over-Reliance on AI (Not Demonstrating Engineering)** — n8n workflow is just Webhook → HTTP (Claude) → Response, no custom logic. **Prevention:** Show engineering skills via pre-processing (validate input, extract entities), business logic (double-booking check BEFORE Claude), post-processing (format response, inject UI elements), error handling (retry logic, fallbacks), integration with existing appointment/notification systems, document algorithms and evaluation metrics.

7. **Timezone Disasters** — "Book for 2pm tomorrow" — which timezone? Malaysia GMT+8 vs UTC vs user device time. **Prevention:** Store all timestamps as UTC in database, convert user input to UTC in n8n, display as Malaysia Time (GMT+8) in UI, explicit confirmation: "February 19, 2026 at 2:00 PM Malaysia Time?", use ISO 8601: `2026-02-19T14:00:00+08:00`.

8. **Ignoring FYP Evaluation Criteria** — Great code but poor report, no literature review, no evaluation metrics. **Prevention:** Read rubric early, allocate time proportionally (40% coding, 30% documentation, 30% testing/evaluation), literature review (compare n8n vs LangChain vs custom backend, cite NLU/RAG papers), evaluation metrics (response time, accuracy, user satisfaction survey), comparison study (AI chatbot vs form-based booking), document continuously (not last-minute).

**Secondary pitfalls to address:**
- Tight coupling between n8n and React (create API abstraction layer)
- State management chaos (store conversation history in Supabase)
- Missing audit trail for AI actions (extend existing audit_log)
- Prompt injection attacks (input sanitization, output validation, hardened prompts)
- Context window overflow (sliding window: last 10-15 messages)
- No cancellation flow (support full CRUD, not just Create)
- No error handling in workflows (Try-Catch pattern in n8n)
- Malaysian context ignorance (DD/MM/YYYY dates, RM currency, "lah" colloquialisms)

## Implications for Roadmap

Based on combined research, recommended phase structure follows a **risk-first, vertical-slice approach**: establish infrastructure reliability early, build end-to-end MVP, then layer differentiators and polish. Total 6 phases over 8-10 weeks.

### Phase 1: Infrastructure & Security Foundation
**Rationale:** n8n deployment and credential management are critical-path blockers. Must be stable before any workflow development. Addresses "Credential Exposure" and "Live Demo Murphy's Law" pitfalls.

**Delivers:**
- n8n running via Docker Compose with PostgreSQL persistence (not SQLite)
- SSL certificate configured (Let's Encrypt or self-signed for local)
- Service role key stored in n8n credentials vault
- Supabase connection tested (simple SELECT query succeeds)
- Claude API credentials configured and tested
- `.gitignore` updated to exclude `.n8n/` directory
- Server-side encryption via Supabase Edge Function (fixes VITE_ENCRYPTION_KEY exposure)

**Addresses from FEATURES.md:** None directly (infrastructure prerequisites)

**Avoids from PITFALLS.md:**
- Credential Exposure (1.2)
- Self-Hosting n8n Without Proper Setup (4.5)
- Live Demo Murphy's Law (5.1) — partial mitigation

**Research flag:** Standard deployment patterns, well-documented in n8n docs. **No additional research needed.**

**Timeline:** 2-3 days
**Blockers:** None (can start immediately)

---

### Phase 2: Core Chatbot Workflow (MVP)
**Rationale:** Build vertical slice of complete booking flow (search → book). Addresses 4 of 6 table-stakes features. Implements RAG pattern to prevent hallucinations. Architecture research provides exact n8n node structure.

**Delivers:**
- n8n workflow: Webhook Trigger → JWT Validator → Claude API → Property Query → Availability Check → Booking Creation → Response
- Natural Language Understanding via Claude (property_search tool)
- Property matching queries to Supabase (filter by bedrooms/location/price)
- Appointment availability checking (query existing bookings, enforce 9am-5pm)
- Automated booking confirmation (INSERT with conflict detection)
- Database unique constraint to prevent double-booking
- Business hours validation (reject appointments outside 9am-5pm)
- Error handling with Try-Catch pattern in n8n
- Audit logging for all AI-created appointments

**Addresses from FEATURES.md:**
- Natural Language Understanding (must-have #1)
- Property Matching & Results (must-have #2)
- Appointment Availability Checking (must-have #3)
- Automated Booking Confirmation (must-have #4)
- Error Handling & Fallback (must-have #6)

**Avoids from PITFALLS.md:**
- Double-Booking Race Conditions (3.1)
- Hallucinated Property Details (2.1) via RAG pattern
- No Error Handling in Workflows (4.2)
- Over-Reliance on AI (2.5) — custom business logic for conflict detection
- Missing Audit Trail (1.4)

**Uses from STACK.md:**
- n8n workflow nodes (Webhook, Function, HTTP Request, Supabase)
- Claude API with tool calling (property_search input schema)
- Supabase service role key for backend queries
- PostgreSQL unique constraint for double-booking prevention

**Implements from ARCHITECTURE.md:**
- n8n Workflow structure (Branch A: Property Search Flow, Branch B: Booking Flow)
- JWT validation in Function Node
- RAG pattern: Query DB → Inject into prompt → Claude responds

**Research flag:** Complex n8n workflow design with multiple branches. **Consider `/gsd:research-phase` for optimistic locking patterns and n8n error handling best practices** if team lacks distributed systems experience.

**Timeline:** 4-5 days
**Blockers:** Phase 1 complete (n8n infrastructure)

---

### Phase 3: Frontend Integration & Context
**Rationale:** Connect PropertyChatbot to n8n, add conversational memory. Completes table-stakes feature set (6 of 6). Addresses state management pitfalls.

**Delivers:**
- Enhanced PropertyChatbot component with n8n webhook client
- Message state management (array of ChatMessage objects)
- Conversation context sent to n8n (last 10 messages)
- Property cards rendered from AI responses
- Booking confirmation UI flow
- Loading states ("AI is thinking...")
- Error message display
- Conversation history persistence in Supabase (conversations table)
- Session resume capability after page refresh

**Addresses from FEATURES.md:**
- Conversational Context Maintenance (must-have #5) — completes table stakes

**Avoids from PITFALLS.md:**
- State Management Chaos (1.3)
- Tight Coupling Between n8n and React (1.1) — API abstraction layer

**Uses from STACK.md:**
- shadcn/ui components (ScrollArea, Card, Button, Input, Skeleton)
- React state + React Query for chat messages
- Supabase client for JWT token extraction

**Implements from ARCHITECTURE.md:**
- Frontend → n8n communication pattern (POST with JWT bearer token)
- Conversation history management (sliding window)

**Research flag:** Standard React patterns for chat UI. **No additional research needed** (shadcn/ui well-documented).

**Timeline:** 2-3 days
**Blockers:** Phase 2 complete (n8n workflow functional)

---

### Phase 4: Differentiators (FYP Wow Factor)
**Rationale:** Add 2-3 impressive features to stand out in FYP evaluation. Preference Learning + Smart Follow-Up Questions recommended (high impact, medium effort). Demonstrates AI intelligence beyond simple command execution.

**Delivers:**
- Preference Learning: Store last 3 searches per tenant (tenant_preferences table)
- Pre-fill search criteria on return visits
- Smart Follow-Up Questions: Proactive clarification when location too broad
- Hardcoded Malaysian geography (Selangor → Subang/PJ/Shah Alam hierarchy)
- Bilingual Code-Switching: System prompt for language matching
- Multi-Property Comparison (optional, if time allows): Side-by-side table generation

**Addresses from FEATURES.md:**
- Preference Learning (differentiator #9) — HIGH impact
- Smart Follow-Up Questions (differentiator #7) — shows intelligence
- Bilingual Code-Switching (differentiator #10) — easy win

**Uses from STACK.md:**
- Claude API advanced prompting (few-shot learning for follow-ups)
- Supabase tenant_preferences table (simple last-used heuristic)

**Avoids from PITFALLS.md:**
- Over-Reliance on AI (2.5) — demonstrates thoughtful UX design
- Malaysian Context Ignorance (6.1) — code-switching shows localization

**Research flag:** Advanced Claude API prompting techniques. **Standard patterns, no additional research needed** (documented in Anthropic docs).

**Timeline:** 2-3 days
**Blockers:** Phase 3 complete (core chatbot working)

---

### Phase 5: Testing, Polish & Security Hardening
**Rationale:** Systematic testing to catch regressions. Security audit before demo. Performance optimization. Addresses FYP evaluation criteria for testing methodology.

**Delivers:**
- Manual test script covering 20+ conversation scenarios (happy path, errors, edge cases)
- Concurrent user testing (simulate double-booking attempts)
- Timezone testing (verify UTC storage, GMT+8 display)
- Malaysian language testing (code-mixed inputs, colloquialisms)
- Prompt injection security testing
- Performance baseline (measure response times, optimize slow queries)
- Load testing with 10+ concurrent users
- Error scenario testing (Claude API down, Supabase timeout, invalid inputs)
- Accessibility testing (keyboard navigation, screen reader)
- Security audit (credential scan, log redaction, JWT validation)
- Cancellation/rescheduling flow (full CRUD support)

**Addresses from FEATURES.md:**
- Appointment Reminders (differentiator #11) — via existing notifications system

**Avoids from PITFALLS.md:**
- Lack of Testing for n8n Workflows (4.3)
- Timezone Disasters (3.2)
- Prompt Injection Attacks (2.2)
- No Cancellation Flow (3.4)
- Performance Bottlenecks (4.4)
- Accessibility Ignored (6.2)

**Research flag:** Testing methodologies for LLM applications. **Consider `/gsd:research-phase` for prompt injection defense techniques** if targeting security-conscious panel members.

**Timeline:** 3-4 days (ongoing in parallel with other phases)
**Blockers:** Phases 2-4 complete (features implemented)

---

### Phase 6: FYP Preparation & Deployment
**Rationale:** Addresses FYP-specific pitfalls. Demo reliability is paramount. Report writing requires 2+ weeks. Evaluation metrics demonstrate academic rigor.

**Delivers:**
- Recorded demo video (backup for live demo failure)
- Pre-demo checklist (test on university network, verify credentials, check API quota)
- Second laptop with full setup (redundancy)
- Architecture diagrams for presentation (printed copies)
- Explanation scripts (30-sec pitch, 2-min overview, 5-min deep dive)
- Q&A preparation (anticipated panel questions with answers)
- User testing with 10 participants (5 form-based, 5 chatbot)
- Evaluation metrics: Task completion time, user satisfaction (SUS questionnaire), accuracy
- Comparison study results (charts, user quotes)
- Literature review (n8n vs alternatives, NLU techniques, RAG papers)
- Technical report (problem definition, methodology, implementation, testing, evaluation)
- Code documentation (comments, README setup instructions, API docs)
- Feature flag implementation (VITE_CHATBOT_ENABLED for rollback)
- Deployment to production environment (or stable staging)

**Avoids from PITFALLS.md:**
- Live Demo Murphy's Law (5.1) — comprehensive backup plan
- Cannot Explain How It Works (5.2)
- Ignoring Evaluation Criteria (5.3)
- Overselling Capabilities (5.4)
- No Comparison or Baseline (5.5)
- No Rollback Plan (6.3)

**Research flag:** FYP best practices, academic writing standards. **No technical research needed** (project-specific).

**Timeline:** 2 weeks (1 week testing/metrics, 1 week report writing)
**Blockers:** All phases complete (system fully functional)

---

### Phase Ordering Rationale

**Infrastructure-first approach:** Phase 1 (n8n setup) is non-negotiable prerequisite. Unstable infrastructure causes cascading failures. Research shows Docker Compose is simplest reliable option for FYP (no cloud cost, auto-restart, familiar to students).

**Vertical slice for risk reduction:** Phase 2 delivers end-to-end booking flow (search → book) to validate architecture assumptions early. If fundamental flaws exist (e.g., n8n performance inadequate, Claude API doesn't meet requirements), discover in Week 2 not Week 8.

**Parallelization opportunities:** Phase 4 (database schema extensions) can run parallel with Phase 2 (workflow development). Phase 5 (testing) starts during Phase 3 and continues through Phase 4. This shaves 1-2 weeks off total timeline.

**Differentiation after validation:** Phase 4 (impressive features) comes after core functionality proven. Avoids feature creep causing MVP failure. Research shows 2-3 differentiators sufficient for FYP evaluation (more = diminishing returns + risk).

**FYP-specific constraints shape Phase 6:** Academic projects require disproportionate documentation/evaluation effort vs industry MVPs. Allocating 2 weeks for Phase 6 (25% of 8-week timeline) reflects FYP rubric weighting (report + presentation = 40-50% of marks).

**Dependencies discovered during research:**
- Cannot test chatbot (Phase 5) without frontend integration (Phase 3)
- Cannot build frontend (Phase 3) without backend workflow (Phase 2)
- Cannot deploy workflows (Phase 2) without n8n infrastructure (Phase 1)
- Evaluation metrics (Phase 6) require completed feature set (Phases 2-4)

**Pitfall-driven ordering:**
- Database unique constraint (Phase 2) prevents double-booking from Day 1
- Credential security (Phase 1) addresses before any workflow development (avoid need to retrofit)
- Demo preparation (Phase 6 late) requires stable features to rehearse against

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (Core Chatbot Workflow):** Complex n8n workflow with branching logic, optimistic locking patterns for double-booking prevention, n8n Try-Catch error handling best practices. **Reason:** If team lacks distributed systems experience, researching transaction isolation levels and race condition mitigation would reduce implementation bugs. **Recommended if:** First time building booking system or using n8n.

- **Phase 5 (Security Hardening):** Prompt injection defense techniques, JWT validation edge cases, rate limiting strategies. **Reason:** Security testing for LLM applications is emerging field with evolving best practices. **Recommended if:** Panel includes security-focused evaluators or project handles sensitive tenant data beyond existing encryption.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Infrastructure):** n8n Docker Compose deployment, SSL certificate setup, credential management. Well-documented in n8n official docs and community guides. Thousands of similar deployments exist as reference.

- **Phase 3 (Frontend Integration):** React chat UI with shadcn/ui components, webhook POST requests, state management. Established React patterns, no novel integration challenges.

- **Phase 4 (Differentiators):** Claude API prompting, simple database preference storage. Anthropic documentation covers advanced prompting extensively. Preference learning uses basic SQL queries (no ML required).

- **Phase 6 (FYP Preparation):** Demo best practices, academic report writing. Domain-agnostic skills, not technical research. Supervisor/peers are better resource than documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | n8n + Claude API validated by official documentation, Docker Compose is standard deployment pattern, Supabase integration via REST API well-established. All recommended technologies have 1+ year production track record. |
| Features | **HIGH** | 6 table-stakes features derived from industry analysis of property booking chatbots (Zillow, Redfin patterns). 6 differentiators ranked by impact vs effort from FYP evaluation criteria. Feature dependencies mapped clearly. |
| Architecture | **HIGH** | Hybrid data access pattern preserves existing PropertyPal stability, n8n workflow structure detailed down to individual nodes (16-step data flow documented), security considerations address credential exposure risks. |
| Pitfalls | **MEDIUM-HIGH** | 36 pitfalls identified across 6 categories from n8n community reports, LLM application case studies, and FYP failure modes. Top 8 critical-path pitfalls have concrete prevention strategies. Some FYP-specific pitfalls (panel questions, evaluation criteria) are context-dependent and may need adjustment per university. |

**Overall confidence:** **HIGH**

Research draws from authoritative sources (n8n official docs, Anthropic API reference, Supabase documentation), validated patterns from production systems, and comprehensive pitfall analysis from community post-mortems. Architecture is conservative (extends existing working system rather than rewrite), reducing risk. Stack choices are justified with comparison of alternatives.

**Confidence降低 factors addressed:**
- FYP evaluation criteria are university-specific → Recommended allocating time to review actual rubric early (Phase 1)
- Claude API prompt engineering effectiveness varies by use case → Suggest monitoring NLU accuracy metrics in Phase 2 and iterating prompts
- n8n performance under concurrent load is environment-dependent → Load testing in Phase 5 validates assumptions or triggers optimization

### Gaps to Address

**Malaysian market context:** Research references Malaysian geography (Selangor, Kuala Lumpur) and cultural factors (prayer times, festivals, language mixing) but lacks on-the-ground user research. **Mitigation:** Phase 5 user testing with 10 Malaysian participants validates language handling and cultural appropriateness. Phase 4 code-switching feature can be tuned based on early feedback.

**Claude API quota and rate limits:** Research assumes standard API quota but FYP demo timing may hit rate limits if multiple concurrent demos occur (e.g., FYP showcase day). **Mitigation:** Prepay for higher quota before demo (estimated $50 covers 1000+ conversations), implement rate limiting in n8n (max 20 requests/user/hour), record backup video as ultimate fallback.

**n8n version stability:** n8n 1.x is "latest stable" but minor version updates during FYP timeline (Feb-Apr 2026) may introduce breaking changes. **Mitigation:** Pin exact Docker image version in docker-compose.yml (e.g., `n8nio/n8n:1.28.0`), test updates in separate staging environment before applying to demo instance, document n8n version in README for reproducibility.

**University network firewall restrictions:** Research assumes n8n webhook accessible from frontend but some university networks block non-standard ports or self-signed SSL certificates. **Mitigation:** Phase 6 pre-demo checklist includes testing on university network 1 week before presentation, prepare mobile hotspot as network redundancy, deploy n8n to cloud (DigitalOcean) if local hosting fails.

**Edge Function encryption migration complexity:** Moving encryption server-side (Supabase Edge Function) to fix VITE_ENCRYPTION_KEY exposure is architecturally sound but adds deployment complexity (Deno runtime, Edge Function debugging). **Mitigation:** If Edge Functions prove difficult, acceptable fallback is documenting the security risk in FYP report as "known limitation, production deployment would use server-side encryption" — panel values honesty over perfect security in academic context.

**Conversation history storage schema:** Research suggests optional `conversations` table but doesn't specify full schema (conversation_id, tenant_id, messages JSONB, created_at, last_message_at, status). **Mitigation:** Define schema during Phase 3 implementation based on actual conversation structure discovered in Phase 2 testing. Worst case: store conversation_id only, reconstruct history from audit_log events.

## Sources

### Primary (HIGH confidence)

- **n8n Official Documentation** (docs.n8n.io) — Webhook configuration, credential management, Supabase node usage, Docker deployment, error handling patterns, workflow best practices. Verified January 2025 (current as of research date).

- **Anthropic Claude API Reference** (docs.anthropic.com/claude/reference) — Messages endpoint, tool calling (structured output), prompt engineering, token usage, rate limits, version 2023-06-01 specification. Official API provider documentation.

- **Supabase Documentation** (supabase.com/docs) — PostgREST API filters (eq, lte, gte, ilike operators), service role key usage, Row Level Security (RLS) bypass patterns, Edge Functions (Deno runtime), real-time subscriptions. Official platform documentation.

- **PropertyPal CLAUDE.md** (codebase) — Existing security implementation (AES-256 encryption, bcrypt hashing, audit logging), architecture (React + Supabase + RBAC), database schema (users, roles, appointment, property tables), known issues (encryption key exposure, double-booking).

### Secondary (MEDIUM confidence)

- **n8n Community Forum** (community.n8n.io) — Workflow patterns for LLM integration, credential security best practices, performance optimization techniques, Docker Compose production deployment examples. Community consensus from 50+ threads reviewed.

- **Property Booking Chatbot Case Studies** — Analysis of Zillow AI search (Copilot feature), Redfin chatbot, Airbnb messaging assistant. Inferred industry patterns for NLU features (search, filter, book flow), typical accuracy targets (80-90% intent recognition), common pitfalls (double-booking, timezone issues). Publicly documented product features, not internal implementations.

- **FYP Evaluation Criteria** (generic university rubric) — Standard categories (problem definition 10%, literature review 15%, methodology 10%, implementation 25%, testing 15%, evaluation 10%, presentation 10%, report 5%). Specific university rubric may differ — **validate during Phase 1.**

### Tertiary (LOW confidence, validate during implementation)

- **Malaysian Real Estate Market Context** — Business hours (9am-5pm assumption), public holidays (Hari Raya, Chinese New Year), appointment booking norms (24-hour cancellation policy). Based on general knowledge, not market research. **Validate:** Phase 5 user testing confirms expectations match reality.

- **Claude API Cost Estimates** — $0.05 per conversation session, $1 for 20 sessions. Calculated from published token pricing ($3-15/million tokens) and estimated conversation length (2000 input + 500 output tokens × 5 turns). Actual cost may vary based on prompt length and conversation complexity. **Validate:** Monitor actual usage in Phase 2-3.

- **Load Performance Assumptions** — n8n workflow handles 10-50 concurrent users, 5-second response time target, 30-second timeout. Based on typical low-code platform capabilities, not PropertyPal-specific load testing. **Validate:** Phase 5 load testing confirms or triggers optimization.

---

## Key Takeaways for Roadmapper

1. **Stack is validated:** n8n + Claude API + existing React/Supabase is optimal for FYP scope (visual workflows, self-hosted, strong tool calling). No changes recommended.

2. **6 table stakes + 2-3 differentiators:** Minimum viable FYP requires all 6 must-have features (NLU, matching, availability, booking, context, errors). Choose Preference Learning + Smart Follow-Up for maximum evaluation impact.

3. **Infrastructure-first sequencing:** Phase 1 (n8n deployment, security foundation) is critical path. Don't start workflow development until infrastructure proven stable.

4. **Double-booking is highest technical risk:** Database unique constraint + optimistic locking must ship in Phase 2. Research provides exact SQL for constraint.

5. **FYP demo preparation = 25% of timeline:** Phase 6 allocates 2 weeks for testing, metrics, documentation, and rehearsal. This is not padding—it reflects academic evaluation weighting.

6. **Research-phase triggers:** Consider deeper research for Phase 2 (distributed locking patterns) and Phase 5 (prompt injection defense) if team lacks experience. All other phases use well-documented patterns.

7. **Known gaps require validation:** Malaysian context (user testing), network restrictions (pre-demo testing), Edge Function complexity (fallback plan). Address in respective phases.

---

*Research completed: 2026-02-18*
*Ready for roadmap: **YES***
*Suggested roadmap structure: 6 phases, 8-10 weeks total*
