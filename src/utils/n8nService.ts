/**
 * n8n Integration Service
 *
 * Fires webhook calls to n8n automation workflows for appointment notifications.
 * All calls are fire-and-forget — a failed webhook never blocks the user action.
 *
 * Webhook URLs are configured via environment variables:
 *   VITE_N8N_NEW_BOOKING_WEBHOOK  — triggered when a new appointment is created
 *   VITE_N8N_STATUS_WEBHOOK       — triggered when an owner approves or rejects
 *
 * n8n workflows handle all email sending via SMTP (see n8n/SETUP.md).
 */

const N8N_NEW_BOOKING_WEBHOOK = import.meta.env.VITE_N8N_NEW_BOOKING_WEBHOOK as string | undefined;
const N8N_STATUS_WEBHOOK = import.meta.env.VITE_N8N_STATUS_WEBHOOK as string | undefined;
const N8N_WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET as string | undefined;

/**
 * Notifies n8n that a new appointment was booked.
 * n8n fetches appointment details from Supabase and sends confirmation emails
 * to both the tenant and the property owner.
 */
export const notifyNewBooking = (appointmentId: number): void => {
  if (!N8N_NEW_BOOKING_WEBHOOK) {
    if (import.meta.env.DEV) {
      console.warn('[n8n] VITE_N8N_NEW_BOOKING_WEBHOOK not set — skipping notification');
    }
    return;
  }
  fetch(N8N_NEW_BOOKING_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(N8N_WEBHOOK_SECRET ? { 'X-Webhook-Secret': N8N_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({ appointmentId }),
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[n8n] Failed to trigger new booking notification:', err);
    }
  });
};

/**
 * Notifies n8n that an appointment status changed (approved / rejected).
 * n8n fetches the updated status from Supabase and sends the appropriate
 * outcome email to the tenant.
 */
export const notifyStatusUpdate = (appointmentId: number): void => {
  if (!N8N_STATUS_WEBHOOK) {
    if (import.meta.env.DEV) {
      console.warn('[n8n] VITE_N8N_STATUS_WEBHOOK not set — skipping notification');
    }
    return;
  }
  fetch(N8N_STATUS_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(N8N_WEBHOOK_SECRET ? { 'X-Webhook-Secret': N8N_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({ appointmentId }),
  }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[n8n] Failed to trigger status update notification:', err);
    }
  });
};
