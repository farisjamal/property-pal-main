# Roadmap: PropertyPal AI-Powered Booking

## Overview

PropertyPal is evolving from a basic property management platform into an AI-powered booking assistant for the Malaysian rental market. This roadmap transforms manual property browsing into natural language conversations where tenants describe what they want and the AI finds, checks availability, and books viewings automatically. The journey spans infrastructure setup, core AI workflow implementation, frontend integration, intelligent differentiators, platform enhancements, and comprehensive FYP preparation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure & Security Foundation** - Deploy n8n, secure credentials, fix encryption key exposure
- [ ] **Phase 2: Core AI Booking Workflow** - Build end-to-end n8n workflow with Gemini API and Supabase integration
- [ ] **Phase 3: Frontend Chat Integration** - Connect React chatbot UI to n8n backend with conversation management
- [ ] **Phase 4: Differentiators & Polish** - Add preference learning, smart follow-ups, bilingual support
- [ ] **Phase 5: Platform Features** - Admin audit logs, notifications, appointment cancellation
- [ ] **Phase 6: Testing & FYP Preparation** - Comprehensive testing, demo prep, evaluation metrics, documentation

## Phase Details

### Phase 1: Infrastructure & Security Foundation
**Goal**: Establish stable n8n deployment, secure credential management, and fix critical encryption key exposure in client bundle
**Depends on**: Nothing (first phase)
**Requirements**: REQ-N8N-1, REQ-SEC-1, REQ-SEC-5
**Success Criteria** (what must be TRUE):
  1. n8n runs via Docker Compose with PostgreSQL persistence and auto-restart on failure
  2. Service role key and Gemini API key stored securely in n8n credentials vault (never in workflow JSON or git)
  3. Encryption key removed from client bundle (VITE_ENCRYPTION_KEY no longer exposed in browser)
  4. Supabase Edge Function handles encrypt/decrypt operations successfully
  5. n8n dashboard accessible with authentication, test workflow executes successfully
**Plans**: 2 plans
Plans:
- [ ] 01-01-PLAN.md -- n8n Docker Compose infrastructure with PostgreSQL persistence and credential security
- [ ] 01-02-PLAN.md -- Server-side encryption migration (Edge Function + frontend update)

### Phase 2: Core AI Booking Workflow
**Goal**: Build complete booking flow from natural language input to appointment confirmation via n8n orchestration
**Depends on**: Phase 1
**Requirements**: REQ-AI-1, REQ-AI-2, REQ-AI-3, REQ-AI-4, REQ-AI-6, REQ-N8N-2, REQ-N8N-3, REQ-N8N-4, REQ-N8N-5, REQ-N8N-6, REQ-SEC-2
**Success Criteria** (what must be TRUE):
  1. Tenant sends "3BR apartment in KL under RM2000" to webhook and receives matching properties within 5 seconds
  2. Gemini API extracts structured criteria (bedrooms, location, budget) with 90%+ accuracy on test cases
  3. Property search queries Supabase and returns top 3-5 ranked matches
  4. Availability checking shows only free time slots (9am-5pm, excludes existing bookings)
  5. Appointment booking creates record atomically with database-level double-booking prevention
  6. Two simultaneous booking attempts for same slot result in one success and one "slot taken" error
  7. All errors return user-friendly messages (never internal stack traces or API errors)
  8. All AI-created appointments logged in audit_log table
**Plans**: TBD

### Phase 3: Frontend Chat Integration
**Goal**: Build dedicated tenant booking page with full chat interface connected to n8n backend
**Depends on**: Phase 2
**Requirements**: REQ-FE-1, REQ-FE-2, REQ-FE-3, REQ-FE-4, REQ-FE-5, REQ-AI-5
**Success Criteria** (what must be TRUE):
  1. Logged-in tenant navigates to /tenant/ai-booking and sees full-page chat interface
  2. User messages appear immediately, AI responses render after n8n call with loading indicator
  3. Property results display as interactive cards showing name, price, location, bedrooms
  4. Clicking a property card shows available time slots for booking
  5. Booking confirmation flow displays summary and creates appointment visible in /tenant/appointments
  6. Multi-turn conversations work ("show cheaper ones" references previous search criteria)
  7. Conversation history persists across page refreshes (stored in Supabase)
  8. Network timeouts produce user-friendly error with fallback to manual browsing
**Plans**: TBD

### Phase 4: Differentiators & Polish
**Goal**: Add intelligent features that demonstrate AI capabilities beyond simple command execution
**Depends on**: Phase 3
**Requirements**: REQ-AI-7, REQ-AI-8, REQ-AI-9, REQ-SEC-3, REQ-SEC-4
**Success Criteria** (what must be TRUE):
  1. Vague query ("apartment in Selangor") triggers clarifying questions about specific area and budget
  2. Returning tenant sees suggestion based on last 3 searches ("Search again for 2BR in PJ under RM1500?")
  3. Tenant's search history stored in tenant_preferences table with last-used heuristic
  4. AI responds in Malay when tenant writes in Malay, English when in English (code-switching)
  5. Malaysian property terms recognized ("bilik" = bedroom, "rumah" = house)
  6. Tenant appointments page shows decrypted owner contact number (not ciphertext)
  7. Decryption failures display "Contact unavailable" placeholder instead of raw encrypted data
  8. All decryption operations logged via logSensitiveDataAccess()
**Plans**: TBD

### Phase 5: Platform Features
**Goal**: Complete admin tools, notification system, and appointment lifecycle management
**Depends on**: Phase 4
**Requirements**: REQ-PLAT-1, REQ-PLAT-2, REQ-PLAT-3
**Success Criteria** (what must be TRUE):
  1. Admin accesses /admin/audit-logs and sees paginated audit events with filters by type and date
  2. AI books appointment and property owner receives notification "New viewing request for [Property] on [Date]"
  3. Owner approves appointment and tenant receives notification "Your viewing at [Property] has been confirmed"
  4. Navigation bar shows notification count badge when unread notifications exist
  5. Tenant cancels appointment and status changes to "cancelled" freeing the time slot
  6. Owner cancels appointment and tenant receives cancellation notification
  7. Cancelled appointments do not block new bookings for same slot (database constraint respects status)
**Plans**: TBD

### Phase 6: Testing & FYP Preparation
**Goal**: Validate system reliability, prepare demo, collect evaluation metrics, complete academic documentation
**Depends on**: Phase 5
**Requirements**: All (validation of complete system)
**Success Criteria** (what must be TRUE):
  1. Manual test script covers 20+ conversation scenarios (happy path, errors, edge cases) with 100% pass rate
  2. Concurrent user testing confirms double-booking prevention works under load
  3. Timezone testing verifies UTC storage and GMT+8 display for Malaysian business hours
  4. Malaysian language testing validates Malay, English, and code-mixed inputs
  5. Security testing confirms no credential exposure, prompt injection defenses active
  6. Demo rehearsed 5+ times with backup video recorded and second laptop prepared
  7. User testing with 10 participants complete with task completion metrics and satisfaction scores
  8. Evaluation metrics documented (response time, accuracy, user satisfaction comparison)
  9. Technical report draft complete with literature review, methodology, implementation, and testing sections
  10. n8n workflow documentation explains architecture and custom business logic
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Security Foundation | 0/2 | Planned | - |
| 2. Core AI Booking Workflow | 0/TBD | Not started | - |
| 3. Frontend Chat Integration | 0/TBD | Not started | - |
| 4. Differentiators & Polish | 0/TBD | Not started | - |
| 5. Platform Features | 0/TBD | Not started | - |
| 6. Testing & FYP Preparation | 0/TBD | Not started | - |
