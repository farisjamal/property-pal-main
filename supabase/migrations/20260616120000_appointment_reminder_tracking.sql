-- Track whether a scheduled viewing-reminder has already been sent for an appointment.
-- Consumed by the n8n "appointment reminder" automation: the workflow only emails
-- appointments where reminder_sent_at IS NULL, then stamps this column so a reminder
-- is sent exactly once even though the schedule polls every few minutes.
--
-- NULL  = no reminder sent yet (eligible)
-- value = reminder already sent at this timestamp (skip)
--
-- Rollback: ALTER TABLE public.appointment DROP COLUMN IF EXISTS reminder_sent_at;

ALTER TABLE public.appointment
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.appointment.reminder_sent_at IS
  'When the scheduled n8n viewing-reminder email was sent. NULL = not yet reminded. Ensures exactly-once reminders.';
