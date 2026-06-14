# Design Spec: Chatbot Fixes — Duplicate Properties & Appointment Management
**Date:** 2026-05-22  
**Branch:** `feature/chatbot-fixes`  
**File in scope:** `src/components/chat/PropertyChatbot.tsx`

---

## Problem Summary

Two bugs in `PropertyChatbot.tsx`:

1. **Duplicate property listings** — The booking flow collects properties from all chat messages via `messages.flatMap(...)`. Multiple searches cause the same properties to appear more than once in the booking quick-replies. The chatbot query also lacks an `.order()` clause, causing results to differ from the website's listing order.

2. **No cancel/reschedule via chat** — The chatbot has no ability to retrieve a user's existing appointments or act on them. Once a booking is made and the page is reloaded, the chatbot has no memory of it. The `TenantAppointments` page handles this separately and must remain unchanged.

---

## Scope

- Single file change: `src/components/chat/PropertyChatbot.tsx`
- No new components, no new Supabase tables, no schema migrations
- `TenantAppointments.tsx` page functionality is preserved as-is

---

## Section 1: Fix Duplicates & Sync

### Root Cause
`startBookingFlow` (line 435) reads:
```typescript
const recentProps = messages.flatMap((m) => m.relatedProperties || []);
```
This accumulates properties across all messages. Multiple searches produce duplicate entries in the booking quick-replies.

The chatbot's Supabase query has no `.order()` clause; the website uses `.order("created_at", { ascending: false })`, causing ordering inconsistency.

### Fix

**1. Add `lastSearchResults` state:**
```typescript
const [lastSearchResults, setLastSearchResults] = useState<ChatProperty[]>([]);
```
Every time a property search completes successfully, call `setLastSearchResults(data)` — replacing the previous results, not appending.

**2. Replace `messages.flatMap` with `lastSearchResults`:**
```typescript
// Before
const recentProps = messages.flatMap((m) => m.relatedProperties || []);

// After
await startBookingFlow(lastSearchResults);
```

**3. Add order clause to chatbot query:**
```typescript
const { data, error } = await query
  .eq("availability_status", "Available")
  .order("created_at", { ascending: false })
  .limit(5);  // raised from 3 to 5 to give more booking options
```

---

## Section 2: Cancel & Reschedule via Chat

### New `BookingStep` values
```typescript
type BookingStep =
  | "idle"
  | "select_property"
  | "select_date"
  | "select_slot"
  | "confirm"
  | "view_appointments"   // new
  | "cancel_confirm"      // new
  | "reschedule_date"     // new
  | "reschedule_slot"     // new
  | "reschedule_confirm"; // new
```

### New field on `BookingContext`
```typescript
interface BookingContext {
  step: BookingStep;
  property?: { property_id: number; property_type: string; location: string };
  date?: string;
  time?: string;
  appointmentId?: number;      // new — tracks which appointment is being acted on
  appointmentStatus?: string;  // new — stored on selection, needed for audit log old_status
  originalDate?: string;       // new — shown in reschedule confirmation
  originalTime?: string;       // new — shown in reschedule confirmation
}
```

### New intent detection constants
```typescript
const CANCEL_KEYWORDS    = ["cancel", "remove appointment", "delete appointment", "cancel appointment"];
const RESCHEDULE_KEYWORDS = ["reschedule", "change appointment", "modify", "change date", "change time", "move appointment"];
```

### Appointment query (used on open and on intent)
```typescript
supabase
  .from("appointment")
  .select(`
    appointment_id,
    appointment_date,
    appointment_time,
    status,
    property:property_id (property_type, location)
  `)
  .eq("tenant_id", tenantId)
  .in("status", ["pending", "approved"])
  .order("appointment_date", { ascending: true })
```
Only `pending` and `approved` appointments are actionable.

### Contextual greeting on chat open (Option A)
When the widget opens and `tenantId` is resolved, a silent appointment fetch runs. The static welcome message in initial state is **not modified** — a second bot message is appended after it. If the user has active appointments:

> "Welcome back! You have N active appointment(s):\n• [Type] at [Location] — [Date] at [Time] ([status])\n...\nWhat would you like to do?"

Quick replies: **Book New Appointment**, **Cancel an Appointment**, **Reschedule an Appointment**.

If no active appointments exist, no second message is added and the default welcome stands alone.

### Cancel flow
```
User: "cancel appointment"
  → Bot fetches pending/approved appointments
  → Shows list as quick-reply buttons (one per appointment)

User selects an appointment
  → Bot: "Are you sure you want to cancel [Type] at [Location] on [Date] at [Time]?"
  → Quick replies: "Yes, Cancel It" / "No, Keep It"

User confirms
  → UPDATE appointment SET status = 'cancelled' WHERE appointment_id = ?
  → logAppointmentStatusChange(id, old_status, 'cancelled')
  → Bot: "Appointment cancelled. Would you like to book a new one?"
  → Quick replies: "Book New Appointment" / "No Thanks"
  → booking.step resets to "idle"
```

### Reschedule flow
```
User: "reschedule"
  → Bot fetches pending/approved appointments
  → Shows list as quick-reply buttons

User selects an appointment
  → booking.step = "reschedule_date", stores appointmentId + originalDate + originalTime
  → Bot: "What new date would you like? Current booking: [Date] at [Time]. Enter a future date:"

User enters date
  → Reuses parseDate() + getAvailableSlots()
  → booking.step = "reschedule_slot"
  → Bot shows available time-slot quick replies

User selects a slot
  → booking.step = "reschedule_confirm"
  → Bot: "Confirm reschedule: [Type] at [Location] → [NewDate] at [NewSlot]?"
  → Quick replies: "Yes, Reschedule" / "No, Cancel"

User confirms
  → UPDATE appointment SET appointment_date = ?, appointment_time = ? WHERE appointment_id = ?
  → logAppointmentStatusChange(id, 'pending'/'approved', 'pending')  // resets to pending for owner re-approval
  → notifyNewBooking(appointmentId)  // re-triggers email notification
  → Bot: "Done! Your appointment has been rescheduled. Pending owner re-approval."
  → booking.step resets to "idle"
```

**Note:** A rescheduled appointment resets to `pending` status because the owner must re-approve the new time.

---

## Section 3: Audit Logging

All cancel and reschedule actions call the existing `logAppointmentStatusChange` utility from `src/utils/auditLog.ts`. No new logging infrastructure is introduced.

---

## Out of Scope

- Persisting chat message history to Supabase (deferred)
- Replacing or modifying `TenantAppointments.tsx`
- Any changes to owner or admin appointment flows
- New Supabase tables or migrations
