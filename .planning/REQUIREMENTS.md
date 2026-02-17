# Requirements

## AI-Powered Booking (Core)

### REQ-AI-1: Natural Language Understanding
Tenant sends natural language message describing property needs. Claude API extracts structured criteria (property type, location, budget, bedrooms, preferred date/time) via tool calling. Supports English, Malay, and code-mixed inputs with 90%+ accuracy on common patterns.

**Acceptance:** Given a message like "Cari apartment 2 bilik dekat PJ bawah RM1500", the system extracts `{type: "Apartment", bedrooms: 2, location: "Petaling Jaya", max_price: 1500}` and returns matching properties.

### REQ-AI-2: Property Matching & Results
n8n workflow converts extracted criteria to Supabase REST queries against the `property` table. Returns top 3-5 matches ranked by relevance. Displays property cards in chat with name, price, location, bedrooms, and key details. Sub-2-second response time for database queries.

**Acceptance:** Extracted criteria produce filtered results from database. If no exact matches, broadens search (e.g., increase price range by 20%) and communicates adjustments to tenant.

### REQ-AI-3: Appointment Availability Checking
Before booking, n8n queries the `appointment` table for existing bookings on the selected property + date. Enforces business hours (9am-5pm, 1-hour slots). Returns available time slots to tenant. Prevents showing already-booked slots.

**Acceptance:** For a property with appointments at 10am and 2pm on March 1st, available slots shown are: 9am, 11am, 12pm, 1pm, 3pm, 4pm. No slots outside 9am-5pm are offered.

### REQ-AI-4: Automated Appointment Booking
Upon tenant selection, n8n creates the appointment record in Supabase with conflict detection. Uses database unique constraint on `(property_id, appointment_date, appointment_time)` to prevent double-booking at the database level. Returns confirmation with full details (property, date, time, owner info).

**Acceptance:** Two tenants attempting to book the same slot simultaneously — one succeeds, the other receives "slot just taken" message with alternative suggestions. Appointment visible in tenant and owner dashboards immediately.

### REQ-AI-5: Conversational Context
Chat maintains last 10 messages in conversation history, sent to n8n on each request. Supports multi-turn dialogues: "Show me cheaper ones" references previous search criteria. Session timeout after 30 minutes of inactivity.

**Acceptance:** After initial search, tenant says "what about in Shah Alam instead?" — system modifies only the location while retaining other criteria (bedrooms, budget).

### REQ-AI-6: Error Handling & Fallback
All AI workflow errors return user-friendly messages (never expose internal errors, stack traces, or raw API responses). If Claude API is unavailable, display "AI assistant is temporarily unavailable" with link to manual property browsing. Input validation prevents malformed requests from reaching n8n.

**Acceptance:** Claude API timeout → friendly error message within 3 seconds. Invalid date input → clarifying question. n8n workflow crash → graceful degradation with error logged.

## AI-Powered Booking (Differentiators)

### REQ-AI-7: Smart Follow-Up Questions
When tenant query is vague (e.g., "apartment in Selangor"), AI proactively asks clarifying questions prioritized by search impact: "Which area in Selangor? Subang Jaya, Petaling Jaya, or Shah Alam?" Rather than returning too many results, narrows search intelligently.

**Acceptance:** "I want a place in KL" triggers follow-up question about specific area, budget range, and number of bedrooms before executing search.

### REQ-AI-8: Preference Learning
Store tenant's last 3 search criteria in a `tenant_preferences` table. On return visits, pre-fill or suggest: "Last time you searched for 2BR apartments in PJ under RM1500. Search again or try something new?" Simple last-used heuristic, no ML required.

**Acceptance:** Tenant who previously searched for apartments in Subang returns to chatbot and sees suggestion based on prior searches. Can accept (quick re-search) or specify new criteria.

### REQ-AI-9: Bilingual Code-Switching
System prompt instructs Claude to match the tenant's language. If tenant writes in Malay, respond in Malay. If mixed, respond in the same mix. Handles Malaysian English colloquialisms and property terminology (e.g., "bilik" = bedroom, "rumah" = house).

**Acceptance:** Tenant writes "Ada tak condo dekat KL Sentral?" → AI responds in Malay with property results. Tenant switches to English mid-conversation → AI follows.

## n8n Workflow Backend

### REQ-N8N-1: n8n Deployment
n8n self-hosted via Docker Compose with PostgreSQL persistence. Auto-restart on failure (`restart: unless-stopped`). Timezone configured to Asia/Kuala_Lumpur. Basic auth enabled for dashboard access. Webhook URL configured for production path.

**Acceptance:** `docker compose up -d` starts n8n, survives container restart, workflows persist across restarts. Dashboard accessible at `localhost:5678` with authentication.

### REQ-N8N-2: Webhook Endpoint
Single webhook endpoint (`/webhook/property-chat`) receives POST requests from React frontend. Accepts JSON body with `message`, `tenant_id`, and `conversation_history`. Returns JSON response synchronously within 30-second timeout. CORS handled automatically.

**Acceptance:** Frontend POST to webhook returns structured JSON with `response` (text), `properties` (array, optional), and `booking` (object, optional) within 30 seconds.

### REQ-N8N-3: JWT Validation
n8n workflow extracts Supabase JWT from Authorization header. Decodes payload to get `user_id` and validates that the user exists and has tenant role. Rejects requests without valid JWT or from non-tenant users.

**Acceptance:** Request without JWT → 401. Request with expired JWT → 401. Request with valid owner JWT → 403 (tenant-only). Request with valid tenant JWT → proceeds to workflow.

### REQ-N8N-4: Claude API Integration
n8n HTTP Request node calls Claude Messages API (`/v1/messages`) with tool definitions (`search_properties`, `book_appointment`). Parses tool_use responses and routes to appropriate Supabase queries. Sends property data back to Claude for natural language formatting (RAG pattern).

**Acceptance:** Claude returns `tool_use` with `search_properties` → n8n queries Supabase → injects results into follow-up Claude call → returns natural language response with property details.

### REQ-N8N-5: Supabase Integration from n8n
n8n accesses Supabase via REST API using service role key (bypasses RLS). Queries `property` table with PostgREST filters. Queries `appointment` table for availability. Creates appointments with conflict detection. Service role key stored in n8n credentials vault (encrypted).

**Acceptance:** n8n can query all properties (cross-user), check any appointment slot availability, and create appointments — all via HTTP Request nodes with proper authentication headers.

### REQ-N8N-6: Workflow Error Handling
n8n workflow uses Try-Catch pattern for Claude API calls and Supabase operations. Retries failed HTTP requests (2 attempts, 1-second delay). All errors logged to n8n execution log. Returns user-friendly error response via "Respond to Webhook" node on any failure.

**Acceptance:** Claude API 500 error → retry once → if still fails → return "I'm having trouble right now, please try again" response. Supabase connection error → return "Service temporarily unavailable" response.

## Frontend (Chatbot UI)

### REQ-FE-1: Dedicated Booking Page
New route `/tenant/ai-booking` with full-page chat interface. Accessible from tenant navigation. Uses TenantLayout wrapper. Protected by ProtectedRoute (roleId: 3 only). Chat occupies main content area with message history and input field.

**Acceptance:** Logged-in tenant navigates to AI Booking page from sidebar/navbar. Full chat interface renders with welcome message. Non-tenants cannot access the route.

### REQ-FE-2: Chat Message Interface
Messages displayed in scrollable area (shadcn ScrollArea). User messages right-aligned, AI messages left-aligned. Typing indicator while waiting for n8n response. Auto-scroll to latest message. Message input with send button and Enter key support.

**Acceptance:** Tenant types message → appears immediately in chat → loading indicator shows → AI response appears below → scroll follows conversation.

### REQ-FE-3: Property Card Rendering
When AI response includes properties, render as interactive cards within the chat. Each card shows: property name, price (RM), location, bedrooms, bathrooms. Cards are selectable — clicking a property proceeds to booking flow (shows available slots).

**Acceptance:** AI returns 3 properties → 3 cards render inline in chat → tenant clicks one → chat shows available time slots for that property.

### REQ-FE-4: Booking Confirmation Flow
After tenant selects property + time slot, display confirmation summary: property details, date, time, owner name. "Confirm Booking" button creates appointment via n8n. Success shows confirmation message with appointment reference. Appointment appears in tenant appointments page.

**Acceptance:** Tenant confirms booking → loading state → success message with details → appointment visible in `/tenant/appointments` immediately.

### REQ-FE-5: n8n Webhook Client
Abstracted API client function for sending messages to n8n webhook. Includes Supabase JWT in Authorization header. Handles timeout (25-second client-side timeout with user message). Parses structured JSON response. Configured via `VITE_N8N_WEBHOOK_URL` environment variable.

**Acceptance:** Environment variable configurable. JWT automatically included. Timeout produces user-friendly message. Response parsed into ChatMessage objects.

## Security Fixes

### REQ-SEC-1: Server-Side Encryption
Move AES-256 encryption from client-side (`VITE_ENCRYPTION_KEY`) to Supabase Edge Function. Frontend calls Edge Function for encrypt/decrypt operations. Encryption key stored as Edge Function secret (never in client bundle). Existing encrypted data must be re-encrypted with server-side function.

**Acceptance:** `VITE_ENCRYPTION_KEY` removed from `.env`. Browser bundle contains no encryption key. Encrypt/decrypt operations work via Edge Function with no visible change to user experience. Existing data still decryptable.

### REQ-SEC-2: Appointment Double-Booking Prevention
Add database unique constraint: `CREATE UNIQUE INDEX ON appointment(property_id, appointment_date, appointment_time) WHERE status != 'cancelled'`. All booking paths (AI chatbot AND manual booking) respect this constraint. Conflict error caught and returns friendly "slot taken" message.

**Acceptance:** Database rejects duplicate `(property_id, date, time)` combinations for non-cancelled appointments. Both AI and manual booking paths handle the constraint violation gracefully.

### REQ-SEC-3: Decrypt Owner Contact in Tenant View
Fix TenantAppointments page to decrypt `property_owner.contact_no` before display. Currently shows ciphertext. Apply `decryptData()` and log sensitive data access via `logSensitiveDataAccess()`.

**Acceptance:** Tenant appointments page shows readable phone number (e.g., "012-3456789") instead of encrypted string. Audit log records the data access.

### REQ-SEC-4: Graceful Decryption Failure Handling
When `decryptData()` fails (corrupted data, wrong key), return placeholder text ("Contact unavailable") instead of raw ciphertext. Log the failure for admin review. Apply across all decrypt operations in the codebase.

**Acceptance:** Corrupted encrypted field → shows "Contact unavailable" → error logged. No ciphertext ever visible to end users.

### REQ-SEC-5: n8n Credential Security
Service role key stored in n8n credentials vault (not in workflow JSON). Anthropic API key stored as n8n credential. `.n8n/` directory added to `.gitignore`. No secrets in n8n workflow exports. n8n dashboard requires authentication.

**Acceptance:** `git log` never shows service role key or API key. n8n dashboard login required. Workflow JSON export contains credential references (not values).

## Platform Improvements

### REQ-PLAT-1: Admin Audit Log Viewer
New page `/admin/audit-logs` displaying the `audit_log` table. Filterable by event type, date range, and user. Paginated (25 rows per page). Shows timestamp, event type, user, details. Accessible only to admin role.

**Acceptance:** Admin navigates to Audit Logs page, sees recent events, can filter by type (LOGIN, PROFILE_UPDATE, SENSITIVE_DATA_ACCESS), paginate through results.

### REQ-PLAT-2: Notification System
Populate the existing `notifications` table when appointment status changes. Notify property owner when new appointment booked (both AI and manual). Notify tenant when owner accepts/rejects appointment. Display notification count badge in navigation. Notification list page shows all notifications with read/unread status.

**Acceptance:** AI books appointment → owner receives notification "New viewing request for [Property] on [Date]". Owner approves → tenant receives notification "Your viewing at [Property] has been confirmed".

### REQ-PLAT-3: Appointment Cancellation
Tenants can cancel their own appointments. Owners can cancel appointments on their properties. Cancelled appointments free up the time slot (database constraint respects `status != 'cancelled'`). Cancellation triggers notification to the other party.

**Acceptance:** Tenant cancels appointment → status changes to "cancelled" → time slot available for new bookings → owner notified. Owner cancels → tenant notified.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-AI-1 | Phase 2 | Pending |
| REQ-AI-2 | Phase 2 | Pending |
| REQ-AI-3 | Phase 2 | Pending |
| REQ-AI-4 | Phase 2 | Pending |
| REQ-AI-5 | Phase 3 | Pending |
| REQ-AI-6 | Phase 2 | Pending |
| REQ-AI-7 | Phase 4 | Pending |
| REQ-AI-8 | Phase 4 | Pending |
| REQ-AI-9 | Phase 4 | Pending |
| REQ-N8N-1 | Phase 1 | Pending |
| REQ-N8N-2 | Phase 2 | Pending |
| REQ-N8N-3 | Phase 2 | Pending |
| REQ-N8N-4 | Phase 2 | Pending |
| REQ-N8N-5 | Phase 2 | Pending |
| REQ-N8N-6 | Phase 2 | Pending |
| REQ-FE-1 | Phase 3 | Pending |
| REQ-FE-2 | Phase 3 | Pending |
| REQ-FE-3 | Phase 3 | Pending |
| REQ-FE-4 | Phase 3 | Pending |
| REQ-FE-5 | Phase 3 | Pending |
| REQ-SEC-1 | Phase 1 | Pending |
| REQ-SEC-2 | Phase 2 | Pending |
| REQ-SEC-3 | Phase 4 | Pending |
| REQ-SEC-4 | Phase 4 | Pending |
| REQ-SEC-5 | Phase 1 | Pending |
| REQ-PLAT-1 | Phase 5 | Pending |
| REQ-PLAT-2 | Phase 5 | Pending |
| REQ-PLAT-3 | Phase 5 | Pending |

**Coverage:** 28/28 requirements mapped to phases (100%)

---
*Derived from PROJECT.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, STACK.md, SUMMARY.md*
*Last updated: 2026-02-18*
