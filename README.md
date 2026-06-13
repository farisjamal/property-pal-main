# PropertyPal — Secure AI-Powered Property Appointment System

A web application for managing property listings, viewings, and appointment bookings
between property owners and prospective tenants, with an administrative panel for
oversight and KYC verification.

> **Final Year Project (FYP) — Evaluation Build**
> This is a temporary deployment prepared for the evaluation panel. It is **not** the
> final production release.

---

## 🔗 Live Application

**URL:** https://property-pal-main-pi.vercel.app

The application is hosted on Vercel with a Supabase backend. No installation is required —
simply open the link in any modern browser (Chrome, Edge, or Firefox recommended).

---

## 👥 User Roles

The system has three roles, each with its own dashboard:

| Role | What they can do | Dashboard route |
|------|------------------|-----------------|
| **Tenant** | Browse properties, book viewing appointments, manage their bookings | `/tenant` |
| **Property Owner** | List properties, manage appointments, complete KYC verification | `/owner` |
| **Admin** | Manage users & owners, review KYC submissions, view reports | `/admin` |

---

## 🚀 How to Access (for the Evaluation Panel)

1. Open **https://property-pal-main-pi.vercel.app**
2. Click **Sign Up / Register** on the authentication page (`/auth`).
3. Choose a role (Tenant or Property Owner) and complete the registration form.
4. After registering, **log in** with the same credentials to enter the dashboard.
5. Explore the features available to your selected role.

> The panel is welcome to create one account per role to evaluate the full experience.

---

## ⚠️ Important Note on Email Confirmation (Please Read)

**Email confirmation is currently disabled / non-functional in this evaluation build.**

The application is designed to send a confirmation email upon registration (and other
transactional emails such as appointment notifications). However, sending real emails
requires a configured **SMTP email service**, which involves a paid subscription.

As this is a student project, I am currently saving toward this cost from my part-time
job and have **not yet been able to set up the SMTP service**. As a direct result, the
email-confirmation step after registration is **not available** at this time — no
confirmation email will be sent.

To ensure the panel can still access and evaluate every feature, registration has been
configured to allow **immediate login without email confirmation**.

🙏 **I kindly ask for the panel's understanding and discretion regarding this limitation.**
It is purely a temporary financial/infrastructure constraint, not a design or
implementation flaw. The email-confirmation flow is fully implemented in the codebase and
will work as intended once the SMTP service is funded and configured.

---

## 🛠️ Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Automation:** n8n (appointment workflows)
- **Hosting:** Vercel

---

## 📌 Known Limitations (Evaluation Build)

- **No transactional emails** — SMTP not yet configured (see note above).
- This is a temporary build; data may be reset before the final submission.
- Some automation features (e.g., booking notification emails) depend on the same
  pending email configuration.

---

*Thank you for taking the time to evaluate this project.*
