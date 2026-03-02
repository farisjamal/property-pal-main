# n8n Setup Guide for PropertyPal

n8n is already running on Docker at `http://localhost:5678`.

---

## Step 1 — Set n8n Variables

Open n8n → **Settings** → **Variables** → Add these three:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://wlflgdiqnrhjhgnhosvu.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **service_role** key (from Supabase Dashboard → Settings → API) |
| `SMTP_FROM_EMAIL` | The email address n8n will send from (e.g. `noreply@yourdomain.com`) |

---

## Step 2 — Create SMTP Credential

Open n8n → **Credentials** → **Add Credential** → Search for **SMTP**

Name it exactly: `PropertyPal SMTP`

Fill in your SMTP details:

### Gmail Example
| Field | Value |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `465` |
| SSL/TLS | `SSL/TLS` |
| User | your Gmail address |
| Password | [App Password](https://myaccount.google.com/apppasswords) (not your regular password) |

> **Gmail requirement:** You must enable 2FA and create an App Password at https://myaccount.google.com/apppasswords

---

## Step 3 — Import Workflows

1. Open n8n → **Workflows** → **Import from File**
2. Import `workflows/new-appointment-notification.json`
3. Import `workflows/appointment-status-update.json`
4. For each workflow, open it and click the email nodes → verify the credential shows **PropertyPal SMTP**
5. **Activate both workflows** (toggle switch in top-right)

---

## Step 4 — Copy Webhook URLs

After activating the workflows, click on each **Webhook** node to see its URL.

They will look like:
- `http://localhost:5678/webhook/new-appointment`
- `http://localhost:5678/webhook/appointment-status`

Copy these and add them to your `.env` file:

```env
VITE_N8N_NEW_BOOKING_WEBHOOK=http://localhost:5678/webhook/new-appointment
VITE_N8N_STATUS_WEBHOOK=http://localhost:5678/webhook/appointment-status
```

Then restart the dev server: `npm run dev`

---

## How It Works

```
Tenant books appointment (chatbot or /tenant/properties)
        ↓
Frontend calls n8n webhook → { appointmentId }
        ↓
n8n fetches appointment details from Supabase (service role)
        ↓
n8n sends email to TENANT (request received)
n8n sends email to OWNER (new viewing request)

Owner approves/rejects in dashboard
        ↓
Frontend calls n8n webhook → { appointmentId }
        ↓
n8n fetches updated status from Supabase
        ↓
n8n sends email to TENANT (approved ✓ or rejected ✗)
```

---

## Troubleshooting

- **Emails not sending**: Check n8n execution logs (Workflows → Executions) for error details
- **Supabase query failing**: Verify `SUPABASE_SERVICE_ROLE_KEY` is the `service_role` key, not `anon`
- **Webhook not triggering**: Ensure both workflows are **Active** (green toggle)
- **Gmail App Password**: Must be exactly 16 characters with no spaces
