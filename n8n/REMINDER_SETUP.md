# n8n Appointment Reminder — Setup Guide (n8n Cloud)

Automated, scheduled viewing reminders. The workflow polls Supabase every 15 minutes
and emails the tenant + owner about approved appointments happening **today or tomorrow**,
then stamps `appointment.reminder_sent_at` so each reminder is sent **exactly once**.

This is **time-driven** automation and runs entirely on its own — no manual trigger.
It complements (does not replace) the `send-appointment-email` Edge Function, which is
**event-driven** (fires instantly on booking/approval).

Workflow file: [`workflows/appointment-reminder.json`](workflows/appointment-reminder.json)

---

## Prerequisites

- An n8n Cloud account (the 14-day trial is enough for a demo). The instance is hosted
  and always-on, so the schedule fires without your laptop being on.
- The DB column `appointment.reminder_sent_at` must exist
  (migration `20260616120000_appointment_reminder_tracking.sql` — already applied).

---

## Step 1 — Create the Supabase Postgres credential

n8n Cloud connects to Supabase over the **Session pooler** (IPv4, supports all queries).

1. In Supabase Dashboard → click **Connect** (top bar) → **Session pooler** tab.
2. Copy the values. They look like this for your project (`fyp`, region `ap-south-1`):

   | Field | Value |
   |---|---|
   | Host | `aws-0-ap-south-1.pooler.supabase.com` *(copy the exact host shown — it may be `aws-1-…`)* |
   | Port | `5432` |
   | Database | `postgres` |
   | User | `postgres.wlflgdiqnrhjhgnhosvu` |
   | Password | your **database password** (Supabase → Settings → Database → reset if forgotten) |
   | SSL | `require` |

3. In n8n → **Credentials → New → Postgres**. Name it exactly **`Supabase Postgres`**.
   Fill in the values above, set **SSL = require**, and **Save** (n8n tests the connection).

---

## Step 2 — Create the Resend credential

1. In n8n → **Credentials → New → Header Auth**. Name it exactly **`Resend API`**.
2. Set:
   | Field | Value |
   |---|---|
   | Name | `Authorization` |
   | Value | `Bearer re_xxxxxxxx` (your Resend API key — same one in Supabase secrets) |
3. **Save.**

> Sender is hard-coded as `PropertyPal <noreply@propertypals.org>` (your verified Resend
> domain). To change it, edit the `from` field in both email nodes.

---

## Step 3 — Import the workflow

1. In n8n → **Workflows → Import from File** (or **Import from URL/Clipboard**).
2. Select `n8n/workflows/appointment-reminder.json`.
3. The 6-node graph appears:
   `Every 15 Minutes → Get Due Appointments → Email Tenant → Email Owner → Mark Reminded → Log Notifications`

---

## Step 4 — Attach credentials to the nodes

The imported nodes reference credentials by name but need you to select them once:

- **Get Due Appointments**, **Mark Reminded**, **Log Notifications** → select credential **`Supabase Postgres`**
- **Email Tenant - Reminder**, **Email Owner - Reminder** → select credential **`Resend API`**

Open each node, pick the matching credential from the dropdown, and save.

---

## Step 5 — Activate

Toggle the workflow **Active** (top-right). It now runs every 15 minutes automatically.

---

## Step 6 — Test / Demo

1. In the app (or via SQL), create an appointment with **status `approved`** dated **tomorrow**.
2. Either wait for the next 15-minute run, or — for a live demo — open the
   **Every 15 Minutes** node and temporarily set the interval to **2 minutes**, save, and re-activate.
3. Within the interval, the tenant + owner receive reminder emails.
4. Show the panel:
   - n8n → **Executions** tab → the run that fired with no manual trigger.
   - The reminder emails in the inboxes.
   - In Supabase, `appointment.reminder_sent_at` is now set, and `notifications` has two
     `appointment_reminder` rows. Running again does **not** re-send (idempotent).

> Remember to set the interval back to 15 minutes after the demo.

---

## Troubleshooting

- **Postgres connection fails** → you're likely using the direct host (`db.<ref>.supabase.co`,
  IPv6-only). Use the **Session pooler** host from Step 1, port `5432`, SSL `require`.
- **Emails not sending** → check the Resend key in the `Resend API` credential, and that
  `propertypals.org` is still **Verified** in Resend → Domains.
- **No appointments found** → the SELECT only matches `status='approved'`,
  `reminder_sent_at IS NULL`, and date within today/tomorrow. Check the row meets all three.
- **Reminder sent twice** → shouldn't happen; `Mark Reminded` sets `reminder_sent_at`. If it
  did, confirm that node ran and is connected after the email nodes.
