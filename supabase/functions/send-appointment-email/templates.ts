export interface AppointmentEmailData {
  tenantName: string;
  tenantEmail: string;
  ownerName: string;
  ownerEmail: string;
  propertyLocation: string;
  propertyType: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentId: number;
  appBaseUrl: string;
}

export interface DecisionEmailData extends AppointmentEmailData {
  decision: "approved" | "rejected";
}

// Escape user-controlled values before interpolating into HTML email bodies.
// Recipients' webmail clients render this markup, so unescaped input enables
// content spoofing / stored XSS.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #18181b; padding: 32px 40px; text-align: center; }
    .header-logo { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header-logo span { color: #6366f1; }
    .body { padding: 40px; color: #3f3f46; }
    .body h1 { font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
    .body p { font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .detail-box { background: #f9f9fb; border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #e4e4e7; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #71717a; font-weight: 500; }
    .detail-value { color: #18181b; font-weight: 600; text-align: right; }
    .btn { display: inline-block; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 4px; }
    .btn-primary { background: #6366f1; color: #ffffff; }
    .btn-danger { background: #ef4444; color: #ffffff; }
    .btn-outline { background: #ffffff; color: #3f3f46; border: 1px solid #d4d4d8; }
    .cta-block { text-align: center; margin: 28px 0; }
    .status-approved { color: #16a34a; font-weight: 700; }
    .status-rejected { color: #dc2626; font-weight: 700; }
    .footer { background: #f4f4f5; padding: 20px 40px; text-align: center; font-size: 12px; color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Property<span>Pal</span></div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>© 2026 PropertyPal. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

function detailBox(data: AppointmentEmailData): string {
  return `<div class="detail-box">
    <div class="detail-row">
      <span class="detail-label">Property</span>
      <span class="detail-value">${escapeHtml(data.propertyType)} — ${escapeHtml(data.propertyLocation)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Date</span>
      <span class="detail-value">${escapeHtml(formatDate(data.appointmentDate))}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Time</span>
      <span class="detail-value">${escapeHtml(formatTime(data.appointmentTime))}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Booking Ref</span>
      <span class="detail-value">#${data.appointmentId}</span>
    </div>
  </div>`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-MY", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":");
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return timeStr;
  }
}

// Email A: Tenant confirmation that their request was submitted
export function tenantRequestConfirmTemplate(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `Appointment Request Submitted — ${data.propertyType} at ${data.propertyLocation}`;
  const html = baseWrapper(subject, `
    <h1>Your request has been submitted!</h1>
    <p>Hi ${escapeHtml(data.tenantName)},</p>
    <p>Your viewing appointment request has been sent to the property owner. You will receive another email once the owner responds.</p>
    ${detailBox(data)}
    <p><strong>What's next?</strong> The owner typically responds within 1–2 business days. We'll notify you by email as soon as they accept or decline.</p>
    <div class="cta-block">
      <a href="${data.appBaseUrl}/tenant" class="btn btn-primary">View My Appointments</a>
    </div>
    <p style="font-size:13px;color:#71717a;">If you need to cancel this request, please log in to your account.</p>
  `);
  return { subject, html };
}

// Email B: Owner notification of a new appointment request
export function ownerNewRequestTemplate(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `New Viewing Request — ${data.propertyType} at ${data.propertyLocation}`;
  const html = baseWrapper(subject, `
    <h1>New appointment request</h1>
    <p>Hi ${escapeHtml(data.ownerName)},</p>
    <p><strong>${escapeHtml(data.tenantName)}</strong> has requested a viewing for your property. Please log in to accept or decline.</p>
    <div class="detail-box">
      <div class="detail-row">
        <span class="detail-label">Tenant</span>
        <span class="detail-value">${escapeHtml(data.tenantName)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Property</span>
        <span class="detail-value">${escapeHtml(data.propertyType)} — ${escapeHtml(data.propertyLocation)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Requested Date</span>
        <span class="detail-value">${escapeHtml(formatDate(data.appointmentDate))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Requested Time</span>
        <span class="detail-value">${escapeHtml(formatTime(data.appointmentTime))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking Ref</span>
        <span class="detail-value">#${data.appointmentId}</span>
      </div>
    </div>
    <div class="cta-block">
      <a href="${data.appBaseUrl}/owner/appointments" class="btn btn-primary">Accept Appointment</a>
      <a href="${data.appBaseUrl}/owner/appointments" class="btn btn-danger">Decline Appointment</a>
    </div>
    <p style="font-size:13px;color:#71717a;">Clicking these buttons will take you to your PropertyPal dashboard where you can confirm your decision.</p>
  `);
  return { subject, html };
}

// Email C: Tenant notified of owner's decision
export function tenantDecisionTemplate(data: DecisionEmailData): { subject: string; html: string } {
  const isApproved = data.decision === "approved";
  const subject = isApproved
    ? `Appointment Confirmed — ${data.propertyType} at ${data.propertyLocation}`
    : `Appointment Update — ${data.propertyType} at ${data.propertyLocation}`;

  const body = isApproved
    ? `
    <h1>Your appointment is confirmed!</h1>
    <p>Hi ${escapeHtml(data.tenantName)},</p>
    <p>Great news! <strong>${escapeHtml(data.ownerName)}</strong> has <span class="status-approved">approved</span> your viewing request. Please make sure to arrive on time.</p>
    ${detailBox(data)}
    <p><strong>Owner contact:</strong> ${escapeHtml(data.ownerEmail)}</p>
    <div class="cta-block">
      <a href="${data.appBaseUrl}/tenant" class="btn btn-primary">View Details</a>
    </div>
    <p style="font-size:13px;color:#71717a;">If you need to cancel, please log in to your account as soon as possible and notify the owner.</p>
  `
    : `
    <h1>Appointment not available</h1>
    <p>Hi ${escapeHtml(data.tenantName)},</p>
    <p>Unfortunately, <strong>${escapeHtml(data.ownerName)}</strong> has <span class="status-rejected">declined</span> your viewing request for the following property:</p>
    ${detailBox(data)}
    <p>Don't worry — there are many more properties available on PropertyPal. Browse our listings to find your next home.</p>
    <div class="cta-block">
      <a href="${data.appBaseUrl}/tenant" class="btn btn-primary">Browse Properties</a>
    </div>
  `;

  return { subject, html: baseWrapper(subject, body) };
}
