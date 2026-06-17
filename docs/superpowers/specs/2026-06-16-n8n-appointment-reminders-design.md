# Design — n8n Scheduled Appointment Reminders

**Date:** 2026-06-16
**Status:** Approved, implemented
**Author:** Faris Jamal (with Claude Code)

## Problem

The submitted project documentation describes n8n as the platform's **automation engine**.
In reality the only working notification path is the Supabase Edge Function
`send-appointment-email` (event-driven, via Resend); the n8n integration only ever pointed at
`localhost:5678` and never ran in production. This left the documentation claim unsupported.

## Goal

Give n8n a real, production-hosted job that fits the "automation engine" description without
disturbing the working Edge Function — and that genuinely runs on its own (no manual trigger).

## Architecture — event-driven vs time-driven

Two clearly separated notification mechanisms:

| Concern | Owner | Trigger |
|---|---|---|
| Instant booking / approval / rejection emails | Supabase Edge Function `send-appointment-email` | DB webhook on `appointment` INSERT/UPDATE (event-driven) |
| Upcoming-viewing reminder emails | **n8n workflow (this design)** | Schedule Trigger every 15 min (time-driven) |

This separation is the defensible architectural story: *event-driven notifications run as
serverless functions; scheduled automation runs in n8n.*

## Workflow

`n8n/workflows/appointment-reminder.json` — 6 nodes, linear:

```
Schedule Trigger (every 15 min)
  → Postgres SELECT  (approved + reminder_sent_at IS NULL + date today/tomorrow,
                      joined with tenant, owner, property)   [auto-iterates rows]
  → HTTP → Resend    (reminder email to tenant)
  → HTTP → Resend    (reminder email to owner)
  → Postgres UPDATE  (appointment.reminder_sent_at = now())
  → Postgres INSERT  (two notifications rows, type='appointment_reminder')
```

- **Hosting:** n8n Cloud (always-on; 14-day trial covers the demo). Production path beyond
  the trial: paid n8n Cloud or self-host (Oracle Always Free VM / VPS).
- **Email transport:** Resend HTTP API using the verified domain `propertypals.org`
  (`PropertyPal <noreply@propertypals.org>`), reusing the existing Resend key.
- **DB access:** Postgres node over the Supabase Session pooler (IPv4, port 5432, SSL required).
  Credentials are stored in n8n (Postgres + Header Auth), **not** `$vars` — `$vars` is gated on
  paid/Enterprise plans and unreliable on the Cloud trial.

## Idempotency (exactly-once)

The `notifications` table has no `appointment_id`, so it cannot identify already-reminded
appointments. New nullable column added:

```
appointment.reminder_sent_at TIMESTAMPTZ   -- NULL = not yet reminded
```

Migration `supabase/migrations/20260616120000_appointment_reminder_tracking.sql` (applied to the
live DB). The SELECT excludes rows where `reminder_sent_at IS NOT NULL`; `Mark Reminded` stamps
it. Frequent polling therefore never double-sends.

## Non-goals / unchanged

- The `send-appointment-email` Edge Function and its DB webhook are untouched.
- The dead frontend `notifyNewBooking`/`notifyStatusUpdate` calls and the old localhost n8n
  workflows are left as-is for now (separate cleanup decision).

## Setup

See `n8n/REMINDER_SETUP.md` for the n8n Cloud import + credential steps.
