# PropertyPal

## What This Is

PropertyPal is a property management platform for the Malaysian rental market, connecting property owners with tenants through AI-powered property discovery and appointment booking. Built with React, TypeScript, Vite, and Supabase, it supports three user roles (Admin, Property Owner, Tenant) with role-based access control and encrypted sensitive data.

## Core Value

Tenants can describe what they want in natural language and the AI finds matching properties, checks available appointment slots, and books viewings automatically — removing the manual back-and-forth from property discovery.

## Requirements

### Validated

<!-- Shipped and confirmed working in the existing codebase. -->

- ✓ User authentication with email/password login and registration — existing
- ✓ Three-tier RBAC: Admin (roleId 1), Property Owner (roleId 2), Tenant (roleId 3) — existing
- ✓ Route-level authorization via ProtectedRoute component — existing
- ✓ Property owners can create, edit, and delete property listings — existing
- ✓ Tenants can browse properties and manually book viewing appointments — existing
- ✓ Profile management for all roles (Admin, Owner, Tenant) — existing
- ✓ AES-256 encryption for sensitive data (IC numbers, contact numbers) — existing
- ✓ Bcrypt hashing for security PINs — existing
- ✓ Comprehensive audit logging system with database triggers — existing
- ✓ Role-specific dashboards and layouts — existing
- ✓ Row Level Security (RLS) policies on all database tables — existing
- ✓ Admin can manage users (create, view tenants and property owners) — existing
- ✓ Admin can generate system reports — existing

### Active

<!-- Current scope. Building toward these for the next milestone. -->

- [ ] AI-powered property discovery chatbot on dedicated tenant booking page
- [ ] Natural language understanding of tenant requirements (property type, location, budget, bedrooms, dates)
- [ ] Intelligent property matching based on extracted criteria
- [ ] Automated appointment slot availability checking (business hours 9am-5pm, conflict detection)
- [ ] AI-driven appointment booking upon tenant selection
- [ ] n8n workflow integration (self-hosted) as AI orchestration backend
- [ ] Google Gemini API (free tier) integration for tenant request understanding
- [ ] n8n webhook endpoint for frontend-to-backend AI communication
- [ ] Fix: Move encryption to server-side (Supabase Edge Function) to protect encryption key
- [ ] Fix: Decrypt owner contact number in tenant appointments view
- [ ] Fix: Handle decryption failures gracefully (show placeholder instead of ciphertext)
- [ ] Fix: Prevent appointment double-booking at database level
- [ ] Admin audit log viewer page
- [ ] Notification system for appointment status changes

### Out of Scope

- Mobile native app — web-first, responsive design only
- OAuth/social login — email/password sufficient for FYP scope
- Real-time chat between owner and tenant — adds complexity without core value
- Payment processing — not needed for appointment booking
- Server-side rendering — SPA architecture is established
- Multi-language support — English only for FYP

## Context

- This is a Final Year Project (FYP) for university
- The panel specifically requested the "AI powered" claim be substantiated with real AI-driven workflows
- The panel's expectation: tenant prompts requirements, AI finds matching properties and available slots, tenant selects, AI books automatically
- n8n was chosen as the workflow automation layer to orchestrate LLM API calls and Supabase operations
- **Zero budget** — all services must be free tier or self-hosted
- Existing codebase has a basic PropertyChatbot widget that does simple property search — this will be replaced/upgraded
- The `notifications` table exists in the schema but is never populated — needs implementation
- Appointment time slots are currently hardcoded (7 fixed slots) with no conflict checking
- Codebase analysis identified several security concerns and bugs (see `.planning/codebase/CONCERNS.md`)

## Constraints

- **Tech Stack**: React + TypeScript + Vite frontend, Supabase backend (PostgreSQL, Auth, Edge Functions) — established, do not change
- **AI Backend**: n8n (self-hosted) for workflow orchestration — chosen by user
- **LLM**: Google Gemini API free tier (Gemini 2.0 Flash) for natural language understanding — zero budget constraint
- **UI Framework**: shadcn/ui + Tailwind CSS — established, do not change
- **Timeline**: 2+ months until final presentation
- **Budget**: Zero — all services must be free tier or self-hosted, no paid APIs
- **Security**: Encryption key must not be exposed in client bundle (critical fix)
- **Database**: Supabase PostgreSQL with RLS — all data access must respect existing security model

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| n8n for AI orchestration | Visual workflow builder, self-hosted, good LLM integration | — Pending |
| Google Gemini free tier for NLU | Free tier (15 RPM, 1M tokens/day), supports function calling, zero cost | — Pending |
| Dedicated booking page (not widget) | Full chat interface needs more space than floating widget | — Pending |
| Fixed business hours (9am-5pm) | Simpler than owner-managed slots, sufficient for FYP demo | — Pending |
| Server-side encryption via Edge Functions | Fix critical security issue of exposed VITE_ENCRYPTION_KEY | — Pending |

---
*Last updated: 2026-02-18 after initialization*
