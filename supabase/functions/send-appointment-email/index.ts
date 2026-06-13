/**
 * send-appointment-email Edge Function
 *
 * Triggered by a Supabase Database Webhook on the `appointment` table.
 *
 * INSERT  → Email A (tenant: request submitted) + Email B (owner: new request)
 * UPDATE  → Email C (tenant: approved/rejected) when status changes to approved/rejected
 *
 * Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY   — Resend API key (https://resend.com)
 *   WEBHOOK_SECRET   — Random string matching the DB webhook header value
 *   APP_BASE_URL     — e.g. https://yourapp.com  (or http://localhost:8080 for dev)
 *   DEV_MODE         — Set to "true" to skip actual email sends and log instead
 */

import { createClient } from "@supabase/supabase-js";
import {
  tenantRequestConfirmTemplate,
  ownerNewRequestTemplate,
  tenantDecisionTemplate,
  AppointmentEmailData,
} from "./templates.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  ...(Deno.env.get("PRODUCTION_URL") ? [Deno.env.get("PRODUCTION_URL")!] : []),
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  };
}

interface AppointmentRecord {
  appointment_id: number;
  tenant_id: number;
  owner_id: number;
  property_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: AppointmentRecord;
  old_record: AppointmentRecord | null;
}

interface SendResult {
  ok: boolean;
  to: string;
  subject: string;
  error?: string;
}

/**
 * Constant-time string comparison to prevent timing attacks on the webhook
 * secret. Always compares every byte instead of short-circuiting on the first
 * mismatch.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Validate webhook secret to prevent unauthorized calls. Fail closed: a
  // missing secret means the function is misconfigured, not open to everyone.
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("WEBHOOK_SECRET is not configured — refusing all requests");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const incomingSecret = req.headers.get("x-webhook-secret");
  if (!incomingSecret || !timingSafeEqual(incomingSecret, webhookSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (payload.table !== "appointment") {
    return new Response(JSON.stringify({ skipped: true, reason: "Not an appointment event" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const record = payload.record;
  const oldRecord = payload.old_record;

  // Determine which emails to fire
  const isInsert = payload.type === "INSERT";
  const isDecision =
    payload.type === "UPDATE" &&
    oldRecord?.status !== record.status &&
    (record.status === "approved" || record.status === "rejected");

  if (!isInsert && !isDecision) {
    return new Response(JSON.stringify({ skipped: true, reason: "No email trigger for this event" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Join appointment data with tenant, owner, and property tables
  const [tenantRes, ownerRes, propertyRes] = await Promise.all([
    db.from("tenant").select("name, email").eq("tenant_id", record.tenant_id).single(),
    db.from("property_owner").select("name, email").eq("owner_id", record.owner_id).single(),
    db.from("property").select("location, property_type").eq("property_id", record.property_id).single(),
  ]);

  if (tenantRes.error || ownerRes.error || propertyRes.error) {
    const errors = [tenantRes.error, ownerRes.error, propertyRes.error].filter(Boolean);
    console.error("DB lookup error:", errors);
    return new Response(JSON.stringify({ error: "Failed to fetch appointment data", details: errors }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const tenant = tenantRes.data;
  const owner = ownerRes.data;
  const property = propertyRes.data;
  const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "http://localhost:8080";

  if (!tenant.email || !owner.email) {
    console.warn("Missing email address — tenant:", tenant.email, "owner:", owner.email);
    return new Response(JSON.stringify({ error: "Missing recipient email address" }), {
      status: 422,
      headers: corsHeaders,
    });
  }

  const emailData: AppointmentEmailData = {
    tenantName: tenant.name,
    tenantEmail: tenant.email,
    ownerName: owner.name,
    ownerEmail: owner.email,
    propertyLocation: property.location,
    propertyType: property.property_type,
    appointmentDate: record.appointment_date,
    appointmentTime: record.appointment_time,
    appointmentId: record.appointment_id,
    appBaseUrl,
  };

  const results: SendResult[] = [];

  if (isInsert) {
    const emailA = tenantRequestConfirmTemplate(emailData);
    const emailB = ownerNewRequestTemplate(emailData);

    const [resA, resB] = await Promise.all([
      sendEmail(tenant.email, emailA.subject, emailA.html),
      sendEmail(owner.email, emailB.subject, emailB.html),
    ]);

    results.push(
      { ok: resA.ok, to: tenant.email, subject: emailA.subject, error: resA.error },
      { ok: resB.ok, to: owner.email, subject: emailB.subject, error: resB.error },
    );

    await logNotifications(db, [
      { email: tenant.email, recipientType: "tenant", subject: emailA.subject, type: "appointment_request_tenant", ok: resA.ok },
      { email: owner.email, recipientType: "owner", subject: emailB.subject, type: "appointment_request_owner", ok: resB.ok },
    ]);
  }

  if (isDecision) {
    const decision = record.status as "approved" | "rejected";
    const emailC = tenantDecisionTemplate({ ...emailData, decision });
    const resC = await sendEmail(tenant.email, emailC.subject, emailC.html);

    results.push({ ok: resC.ok, to: tenant.email, subject: emailC.subject, error: resC.error });

    await logNotifications(db, [
      { email: tenant.email, recipientType: "tenant", subject: emailC.subject, type: "appointment_decision_tenant", ok: resC.ok },
    ]);
  }

  return new Response(JSON.stringify({ sent: results }), {
    status: 200,
    headers: corsHeaders,
  });
});

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const devMode = Deno.env.get("DEV_MODE") === "true";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "PropertyPal <onboarding@resend.dev>";

  if (devMode || !resendApiKey) {
    // Log the email payload instead of sending — safe for local dev
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[EMAIL MOCK]");
    console.log("To     :", to);
    console.log("Subject:", subject);
    console.log("HTML   :", html.slice(0, 300) + "...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend error ${res.status}:`, body);
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sendEmail fetch error:", message);
    return { ok: false, error: message };
  }
}

async function logNotifications(
  db: ReturnType<typeof createClient>,
  entries: { email: string; recipientType: string; subject: string; type: string; ok: boolean }[],
) {
  const rows = entries.map((e) => ({
    recipient_email: e.email,
    recipient_type: e.recipientType,
    subject: e.subject,
    type: e.type,
    status: e.ok ? "sent" : "failed",
    sent_at: new Date().toISOString(),
  }));

  const { error } = await db.from("notifications").insert(rows);
  if (error) {
    // Non-critical: log but don't fail the response
    console.error("Failed to log notifications:", error);
  }
}
