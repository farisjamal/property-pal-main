# Chatbot Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix duplicate property listings in the chatbot and add cancel/reschedule appointment flows with persistent identity via Supabase.

**Architecture:** All changes are confined to `src/components/chat/PropertyChatbot.tsx` plus a new helper module `src/components/chat/chatbotHelpers.ts` extracted for testability. Pure functions move to the helper module; the component imports them. No new Supabase tables, no schema migrations, no changes to `TenantAppointments.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, Supabase JS v2, Vitest, Tailwind CSS / shadcn/ui

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/chat/chatbotHelpers.ts` | Pure helper functions (extractSearchCriteria, parseDate, isBookingIntent, isCancelIntent, isRescheduleIntent) |
| Create | `src/components/chat/chatbotHelpers.test.ts` | Unit tests for all helpers |
| Modify | `src/components/chat/PropertyChatbot.tsx` | All component logic changes |
| Modify | `vite.config.ts` | Add Vitest test config |
| Modify | `package.json` | Add `test` script |

---

## Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install Vitest and Testing Library**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add `"test"` to the `"scripts"` block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Add Vitest config to vite.config.ts**

Replace the entire contents of `vite.config.ts` with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
}));
```

- [ ] **Step 4: Create test setup file**

Create `src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Verify Vitest runs**

```bash
npm test
```

Expected output: `No test files found` or `0 tests passed` — not an error, just empty suite. Any other error means setup is wrong; fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json package-lock.json src/test-setup.ts
git commit -m "chore: add Vitest + Testing Library test infrastructure"
```

---

## Task 2: Extract Pure Helpers to chatbotHelpers.ts

**Files:**
- Create: `src/components/chat/chatbotHelpers.ts`
- Create: `src/components/chat/chatbotHelpers.test.ts`

These helpers currently live inside `PropertyChatbot.tsx` before the component. Moving them to a separate file makes them importable and testable without rendering the whole component.

- [ ] **Step 1: Write failing tests**

Create `src/components/chat/chatbotHelpers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractSearchCriteria,
  parseDate,
  isBookingIntent,
  isCancelIntent,
  isRescheduleIntent,
} from "./chatbotHelpers";

describe("extractSearchCriteria", () => {
  it("extracts bedroom count", () => {
    expect(extractSearchCriteria("3 bedroom apartment")).toEqual(
      expect.objectContaining({ minBeds: 3 })
    );
  });

  it("extracts max price from 'under RM 2000'", () => {
    expect(extractSearchCriteria("under RM 2000")).toEqual(
      expect.objectContaining({ maxPrice: 2000 })
    );
  });

  it("extracts property type", () => {
    expect(extractSearchCriteria("looking for a condo")).toEqual(
      expect.objectContaining({ type: "condominium" })
    );
  });

  it("extracts location", () => {
    expect(extractSearchCriteria("apartment in Skudai")).toEqual(
      expect.objectContaining({ location: "skudai" })
    );
  });

  it("returns empty object for unrecognised input", () => {
    expect(extractSearchCriteria("show me available list")).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(extractSearchCriteria("")).toEqual({});
  });
});

describe("parseDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22"));
  });

  it("accepts valid ISO future date", () => {
    expect(parseDate("2026-06-15")).toEqual({ date: "2026-06-15" });
  });

  it("rejects past ISO date", () => {
    expect(parseDate("2026-01-01")).toEqual({ error: "past" });
  });

  it("rejects today as past (same day not allowed)", () => {
    expect(parseDate("2026-05-22")).toEqual({ error: "past" });
  });

  it("accepts English month-day format", () => {
    expect(parseDate("June 15")).toEqual({ date: "2026-06-15" });
  });

  it("accepts day-month format", () => {
    expect(parseDate("15 June")).toEqual({ date: "2026-06-15" });
  });

  it("returns invalid for gibberish", () => {
    expect(parseDate("not a date")).toEqual({ error: "invalid" });
  });
});

describe("isBookingIntent", () => {
  it("detects 'book'", () => {
    expect(isBookingIntent("I want to book a viewing")).toBe(true);
  });

  it("detects 'appointment'", () => {
    expect(isBookingIntent("make an appointment")).toBe(true);
  });

  it("returns false for unrelated text", () => {
    expect(isBookingIntent("show me available properties")).toBe(false);
  });
});

describe("isCancelIntent", () => {
  it("detects 'cancel'", () => {
    expect(isCancelIntent("I want to cancel my appointment")).toBe(true);
  });

  it("detects 'cancel appointment'", () => {
    expect(isCancelIntent("cancel appointment")).toBe(true);
  });

  it("returns false for booking intent", () => {
    expect(isCancelIntent("book appointment")).toBe(false);
  });
});

describe("isRescheduleIntent", () => {
  it("detects 'reschedule'", () => {
    expect(isRescheduleIntent("can I reschedule")).toBe(true);
  });

  it("detects 'change date'", () => {
    expect(isRescheduleIntent("I need to change date")).toBe(true);
  });

  it("detects 'modify'", () => {
    expect(isRescheduleIntent("modify my booking")).toBe(true);
  });

  it("returns false for cancel intent", () => {
    expect(isRescheduleIntent("cancel my appointment")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './chatbotHelpers'` — the file doesn't exist yet.

- [ ] **Step 3: Create chatbotHelpers.ts**

Create `src/components/chat/chatbotHelpers.ts`:

```typescript
export const extractSearchCriteria = (text: string) => {
  try {
    if (!text) return {};
    const criteria: Record<string, unknown> = {};
    const lower = text.toLowerCase();

    const bedMatch = lower.match(/(\d+)\s*(?:bed|room)/);
    if (bedMatch) criteria.minBeds = parseInt(bedMatch[1]);

    const priceMatch =
      lower.match(/(?:under|rm|max|budget)\s*(\d+)/) ||
      lower.match(/<\s*(\d+)/);
    if (priceMatch) criteria.maxPrice = parseInt(priceMatch[1]);

    const types = ["apartment", "condo", "condominium", "terrace", "flat", "bungalow", "semi-d", "house"];
    const foundType = types.find((t) => lower.includes(t));
    if (foundType) criteria.type = foundType === "condo" ? "condominium" : foundType;

    const locations = ["johor bahru", "jb", "skudai", "mount austin", "pasir gudang", "kulai", "muar", "batu pahat"];
    const foundLoc = locations.find((l) => lower.includes(l));
    if (foundLoc) criteria.location = foundLoc;

    return criteria;
  } catch {
    return {};
  }
};

/**
 * Accepts ISO dates (2026-03-15), "March 15", "15 March", "15/3/2026", etc.
 * Returns { date: ISO string } on success, { error: "past" | "invalid" } on failure.
 * Today is treated as past — only future dates are valid.
 */
export const parseDate = (text: string): { date: string } | { error: "past" | "invalid" } => {
  const trimmed = text.trim();
  const todayStr = new Date().toISOString().split("T")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return { error: "invalid" };
    return trimmed > todayStr ? { date: trimmed } : { error: "past" };
  }

  const currentYear = new Date().getFullYear();
  const withYear = /\d{4}/.test(trimmed) ? trimmed : `${trimmed} ${currentYear}`;
  const parsed = new Date(withYear);
  if (isNaN(parsed.getTime())) return { error: "invalid" };

  const iso = parsed.toISOString().split("T")[0];
  return iso > todayStr ? { date: iso } : { error: "past" };
};

const BOOKING_KEYWORDS = ["book", "appointment", "schedule", "viewing", "visit", "arrange"];
const CANCEL_KEYWORDS = ["cancel", "remove appointment", "delete appointment", "cancel appointment"];
const RESCHEDULE_KEYWORDS = ["reschedule", "change appointment", "modify", "change date", "change time", "move appointment"];

export const isBookingIntent = (text: string) =>
  BOOKING_KEYWORDS.some((k) => text.toLowerCase().includes(k));

export const isCancelIntent = (text: string) =>
  CANCEL_KEYWORDS.some((k) => text.toLowerCase().includes(k));

export const isRescheduleIntent = (text: string) =>
  RESCHEDULE_KEYWORDS.some((k) => text.toLowerCase().includes(k));
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all 20 tests pass. If the `parseDate` "today is past" test fails, check that the comparison uses `>` not `>=`.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/chatbotHelpers.ts src/components/chat/chatbotHelpers.test.ts
git commit -m "feat(chatbot): extract pure helper functions to chatbotHelpers.ts with tests"
```

---

## Task 3: Update Types in PropertyChatbot.tsx

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Add ChatAppointment interface**

After the existing `ChatProperty` interface (around line 21), add:

```typescript
interface ChatAppointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  property_id: number;
  property: {
    property_type: string;
    location: string;
  } | null;
}
```

- [ ] **Step 2: Replace BookingStep type**

Replace the existing `BookingStep` type (line 42):

```typescript
// Before
type BookingStep = "idle" | "select_property" | "select_date" | "select_slot" | "confirm";

// After
type BookingStep =
  | "idle"
  | "select_property"
  | "select_date"
  | "select_slot"
  | "confirm"
  | "cancel_select"
  | "cancel_confirm"
  | "reschedule_select"
  | "reschedule_date"
  | "reschedule_slot"
  | "reschedule_confirm";
```

- [ ] **Step 3: Replace BookingContext interface**

Replace the existing `BookingContext` interface (lines 44–53):

```typescript
interface BookingContext {
  step: BookingStep;
  property?: {
    property_id: number;
    property_type: string;
    location: string;
  };
  date?: string;
  time?: string;
  appointmentId?: number;
  appointmentStatus?: string;
  originalDate?: string;
  originalTime?: string;
}
```

- [ ] **Step 4: Replace the top imports block to use chatbotHelpers**

Replace the existing helper constant/function definitions in `PropertyChatbot.tsx` (the `BOOKING_KEYWORDS` constant, `extractSearchCriteria`, `isBookingIntent`, and `parseDate` function blocks — lines 59–121) with a single import:

```typescript
import {
  extractSearchCriteria,
  parseDate,
  isBookingIntent,
  isCancelIntent,
  isRescheduleIntent,
} from "./chatbotHelpers";
```

The `ALL_TIME_SLOTS` constant at line 59 stays in `PropertyChatbot.tsx` — do not move it:

```typescript
const ALL_TIME_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: build succeeds. If TypeScript errors appear about `isCancelIntent`/`isRescheduleIntent` not being used yet, that is fine — they will be used in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "refactor(chatbot): update types and import helpers from chatbotHelpers"
```

---

## Task 4: Fix Duplicate Properties (lastSearchResults)

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Add lastSearchResults state**

Inside the `PropertyChatbot` component, after the existing `const [booking, setBooking]` line (around line 139), add:

```typescript
const [lastSearchResults, setLastSearchResults] = useState<ChatProperty[]>([]);
```

- [ ] **Step 2: Update the property search query**

In `handleSend`, replace the query block (around lines 444–455) with:

```typescript
const { data, error } = await query
  .eq("availability_status", "Available")
  .order("created_at", { ascending: false })
  .limit(5);
if (error) throw error;

setLastSearchResults(data || []);
```

- [ ] **Step 3: Fix startBookingFlow to use lastSearchResults**

In `handleSend`, replace:

```typescript
// Before (around line 435)
if (isBookingIntent(inputValue)) {
  const recentProps = messages.flatMap((m) => m.relatedProperties || []);
  await startBookingFlow(recentProps);
  return;
}

// After
if (isBookingIntent(inputValue)) {
  await startBookingFlow(lastSearchResults);
  return;
}
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "fix(chatbot): replace messages.flatMap with lastSearchResults to eliminate duplicate properties"
```

---

## Task 5: Add Appointment DB Functions

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

Add three new functions and one state variable inside the `PropertyChatbot` component, placed just after the existing `createAppointment` function (around line 284).

- [ ] **Step 1: Add activeAppointments state**

After `const [lastSearchResults, setLastSearchResults]` (added in Task 4):

```typescript
const [activeAppointments, setActiveAppointments] = useState<ChatAppointment[]>([]);
```

- [ ] **Step 2: Add loadActiveAppointments**

After `createAppointment`, add:

```typescript
const loadActiveAppointments = async (tid: number): Promise<ChatAppointment[]> => {
  const { data } = await supabase
    .from("appointment")
    .select(`
      appointment_id,
      appointment_date,
      appointment_time,
      status,
      property_id,
      property:property_id (property_type, location)
    `)
    .eq("tenant_id", tid)
    .in("status", ["pending", "approved"])
    .order("appointment_date", { ascending: true });
  const appointments = (data || []) as ChatAppointment[];
  setActiveAppointments(appointments);
  return appointments;
};
```

- [ ] **Step 3: Add cancelAppointment**

```typescript
const cancelAppointment = async (appointmentId: number): Promise<void> => {
  const { error } = await supabase
    .from("appointment")
    .update({ status: "cancelled" })
    .eq("appointment_id", appointmentId);
  if (error) throw error;
};
```

- [ ] **Step 4: Add rescheduleAppointment**

```typescript
const rescheduleAppointment = async (
  appointmentId: number,
  date: string,
  time: string
): Promise<void> => {
  const { error } = await supabase
    .from("appointment")
    .update({ appointment_date: date, appointment_time: time, status: "pending" })
    .eq("appointment_id", appointmentId);
  if (error) throw error;
};
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "feat(chatbot): add loadActiveAppointments, cancelAppointment, rescheduleAppointment DB functions"
```

---

## Task 6: Contextual Greeting on Chat Open

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Add showContextualGreeting function**

After `loadActiveAppointments`, add:

```typescript
const showContextualGreeting = async (tid: number): Promise<void> => {
  const appointments = await loadActiveAppointments(tid);
  if (appointments.length === 0) return;

  const list = appointments
    .map(
      (a) =>
        `• ${a.property?.property_type ?? "Property"} at ${a.property?.location ?? "—"} — ${a.appointment_date} at ${a.appointment_time} (${a.status})`
    )
    .join("\n");

  addBotMessage(
    `Welcome back! You have ${appointments.length} active appointment${appointments.length > 1 ? "s" : ""}:\n${list}\n\nWhat would you like to do?`,
    {
      quickReplies: [
        { label: "Book New Appointment", value: "intent_book" },
        { label: "Cancel an Appointment", value: "intent_cancel" },
        { label: "Reschedule an Appointment", value: "intent_reschedule" },
      ],
    }
  );
};
```

- [ ] **Step 2: Call showContextualGreeting from checkAuth**

Replace the existing `checkAuth` function (around lines 176–190):

```typescript
const checkAuth = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    setIsAuthenticated(true);
    const { data } = await supabase
      .from("tenant")
      .select("tenant_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (data) {
      setTenantId(data.tenant_id);
      await showContextualGreeting(data.tenant_id);
    }
  }
};
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "feat(chatbot): show contextual greeting with active appointments on chat open"
```

---

## Task 7: Add Cancel Flow

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Add startCancelFlow function**

After `showContextualGreeting`, add:

```typescript
const startCancelFlow = async (): Promise<void> => {
  if (!isAuthenticated) {
    addBotMessage("You need to be logged in to manage appointments.", {
      quickReplies: [{ label: "Go to Login", value: "goto_login" }],
    });
    return;
  }
  if (!tenantId) {
    addBotMessage("Only tenant accounts can manage appointments.");
    return;
  }

  setIsTyping(true);
  try {
    const appointments = await loadActiveAppointments(tenantId);
    if (appointments.length === 0) {
      addBotMessage("You have no active appointments to cancel.");
      return;
    }

    setBooking({ step: "cancel_select" });
    addBotMessage("Which appointment would you like to cancel?", {
      quickReplies: [
        ...appointments.map((a) => ({
          label: `${a.property?.property_type ?? "Property"} — ${a.appointment_date} at ${a.appointment_time}`,
          value: `cancel_appt_${a.appointment_id}`,
        })),
        { label: "Never mind", value: "cancel_booking" },
      ],
    });
  } catch {
    addBotMessage("Sorry, I couldn't load your appointments. Please try again.");
  } finally {
    setIsTyping(false);
  }
};
```

- [ ] **Step 2: Wire cancel intent in handleSend**

In `handleSend`, after the `booking.step === "select_date"` guard and before `isBookingIntent`, add:

```typescript
if (isCancelIntent(inputValue) && booking.step === "idle") {
  await startCancelFlow();
  return;
}
```

- [ ] **Step 3: Wire cancel appointment selection in handleQuickReply**

In `handleQuickReply`, after the `cancel_booking` handler block, add:

```typescript
// Cancel: appointment selected from list
if (value.startsWith("cancel_appt_") && booking.step === "cancel_select") {
  const appointmentId = parseInt(value.replace("cancel_appt_", ""));
  const selected = activeAppointments.find((a) => a.appointment_id === appointmentId);
  if (!selected) return;

  setBooking((prev) => ({
    ...prev,
    step: "cancel_confirm",
    appointmentId: selected.appointment_id,
    appointmentStatus: selected.status,
  }));

  addBotMessage(
    `Are you sure you want to cancel this appointment?\n\n📍 ${selected.property?.property_type ?? "Property"} at ${selected.property?.location ?? "—"}\n📅 ${selected.appointment_date} at ${selected.appointment_time}`,
    {
      quickReplies: [
        { label: "Yes, Cancel It", value: "confirm_cancel" },
        { label: "No, Keep It", value: "cancel_booking" },
      ],
    }
  );
  return;
}

// Cancel: confirmed
if (value === "confirm_cancel" && booking.step === "cancel_confirm") {
  if (!booking.appointmentId || !booking.appointmentStatus) return;

  setIsTyping(true);
  try {
    await cancelAppointment(booking.appointmentId);
    await logAppointmentStatusChange(
      booking.appointmentId.toString(),
      booking.appointmentStatus,
      "cancelled"
    );

    setBooking({ step: "idle" });
    addBotMessage(
      "✅ Appointment cancelled successfully. Would you like to book a new one?",
      {
        quickReplies: [
          { label: "Book New Appointment", value: "intent_book" },
          { label: "No Thanks", value: "dismiss" },
        ],
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    addBotMessage(`Sorry, cancellation failed: ${message}. Please try again.`);
  } finally {
    setIsTyping(false);
  }
  return;
}
```

- [ ] **Step 4: Wire shared quick-reply values (intent_book, intent_cancel, intent_reschedule, dismiss)**

In `handleQuickReply`, at the top of the function body after the `goto_login` handler, add:

```typescript
if (value === "intent_book") {
  await startBookingFlow(lastSearchResults);
  return;
}

if (value === "intent_cancel") {
  await startCancelFlow();
  return;
}

if (value === "dismiss") {
  addBotMessage("No problem! Let me know if you need anything.");
  return;
}
```

The `intent_reschedule` handler will be added in Task 8.

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "feat(chatbot): add cancel appointment flow"
```

---

## Task 8: Add Reschedule Flow

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Add startRescheduleFlow function**

After `startCancelFlow`, add:

```typescript
const startRescheduleFlow = async (): Promise<void> => {
  if (!isAuthenticated) {
    addBotMessage("You need to be logged in to manage appointments.", {
      quickReplies: [{ label: "Go to Login", value: "goto_login" }],
    });
    return;
  }
  if (!tenantId) {
    addBotMessage("Only tenant accounts can manage appointments.");
    return;
  }

  setIsTyping(true);
  try {
    const appointments = await loadActiveAppointments(tenantId);
    if (appointments.length === 0) {
      addBotMessage("You have no active appointments to reschedule.");
      return;
    }

    setBooking({ step: "reschedule_select" });
    addBotMessage("Which appointment would you like to reschedule?", {
      quickReplies: [
        ...appointments.map((a) => ({
          label: `${a.property?.property_type ?? "Property"} — ${a.appointment_date} at ${a.appointment_time}`,
          value: `reschedule_appt_${a.appointment_id}`,
        })),
        { label: "Never mind", value: "cancel_booking" },
      ],
    });
  } catch {
    addBotMessage("Sorry, I couldn't load your appointments. Please try again.");
  } finally {
    setIsTyping(false);
  }
};
```

- [ ] **Step 2: Add handleRescheduleDateInput function**

After `handleBookingDateInput`, add:

```typescript
const handleRescheduleDateInput = async (text: string): Promise<void> => {
  const result = parseDate(text);
  if ("error" in result) {
    addBotMessage(
      result.error === "past"
        ? "That date is in the past. Please pick a future date."
        : "I couldn't understand that date. Please use a format like 2026-06-15 or 'June 15'."
    );
    return;
  }
  const date = result.date;

  setIsTyping(true);
  try {
    const available = await getAvailableSlots(booking.property!.property_id, date);

    if (available.length === 0) {
      addBotMessage(
        `No available time slots on ${date} for this property. Try a different date?`,
        { quickReplies: [{ label: "Cancel", value: "cancel_booking" }] }
      );
      return;
    }

    setBooking((prev) => ({ ...prev, step: "reschedule_slot", date }));
    addBotMessage(`Available times on ${date}. Pick a slot:`, {
      quickReplies: available.map((slot) => ({
        label: slot,
        value: `rslot_${slot}`,
      })),
    });
  } catch {
    addBotMessage("Sorry, I couldn't check availability. Please try again.");
  } finally {
    setIsTyping(false);
  }
};
```

- [ ] **Step 3: Wire reschedule intent in handleSend**

In `handleSend`, after the `isCancelIntent` guard added in Task 7, add:

```typescript
if (isRescheduleIntent(inputValue) && booking.step === "idle") {
  await startRescheduleFlow();
  return;
}
```

Also update the `reschedule_date` step guard at the top of `handleSend`. After the existing `booking.step === "select_date"` block, add:

```typescript
if (booking.step === "reschedule_date") {
  await handleRescheduleDateInput(inputValue);
  return;
}
```

- [ ] **Step 4: Wire reschedule quick-reply handlers in handleQuickReply**

After the `confirm_cancel` handler block added in Task 7, add:

```typescript
// Reschedule: appointment selected from list
if (value.startsWith("reschedule_appt_") && booking.step === "reschedule_select") {
  const appointmentId = parseInt(value.replace("reschedule_appt_", ""));
  const selected = activeAppointments.find((a) => a.appointment_id === appointmentId);
  if (!selected) return;

  setBooking({
    step: "reschedule_date",
    appointmentId: selected.appointment_id,
    appointmentStatus: selected.status,
    property: {
      property_id: selected.property_id,
      property_type: selected.property?.property_type ?? "",
      location: selected.property?.location ?? "",
    },
    originalDate: selected.appointment_date,
    originalTime: selected.appointment_time,
  });

  addBotMessage(
    `Current booking: ${selected.property?.property_type ?? "Property"} at ${selected.property?.location ?? "—"}\n📅 ${selected.appointment_date} at ${selected.appointment_time}\n\nWhat new date would you like? (e.g. 2026-06-15 or 'June 15')`
  );
  return;
}

// Reschedule: time slot selected
if (value.startsWith("rslot_") && booking.step === "reschedule_slot") {
  const slot = value.replace("rslot_", "");
  setBooking((prev) => ({ ...prev, step: "reschedule_confirm", time: slot }));
  addBotMessage(
    `Please confirm your reschedule:\n\n📍 ${booking.property?.property_type} at ${booking.property?.location}\n📅 ${booking.date} at ${slot}\n\n(Previously: ${booking.originalDate} at ${booking.originalTime})`,
    {
      quickReplies: [
        { label: "Yes, Reschedule", value: "confirm_reschedule" },
        { label: "No, Cancel", value: "cancel_booking" },
      ],
    }
  );
  return;
}

// Reschedule: confirmed
if (value === "confirm_reschedule" && booking.step === "reschedule_confirm") {
  if (!booking.appointmentId || !booking.date || !booking.time || !booking.appointmentStatus) return;

  setIsTyping(true);
  try {
    await rescheduleAppointment(booking.appointmentId, booking.date, booking.time);
    await logAppointmentStatusChange(
      booking.appointmentId.toString(),
      booking.appointmentStatus,
      "pending"
    );
    notifyNewBooking(booking.appointmentId);

    setBooking({ step: "idle" });
    addBotMessage(
      `✅ Appointment rescheduled!\n\n📍 ${booking.property?.property_type} at ${booking.property?.location}\n📅 ${booking.date} at ${booking.time}\n\nYour appointment is now pending owner re-approval. You'll receive a confirmation email shortly.`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    addBotMessage(`Sorry, rescheduling failed: ${message}. Please try again.`);
  } finally {
    setIsTyping(false);
  }
  return;
}
```

- [ ] **Step 5: Wire intent_reschedule in handleQuickReply**

In the block added in Task 7 (after `intent_cancel`), add:

```typescript
if (value === "intent_reschedule") {
  await startRescheduleFlow();
  return;
}
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "feat(chatbot): add reschedule appointment flow"
```

---

## Task 9: Update UI Labels

**Files:**
- Modify: `src/components/chat/PropertyChatbot.tsx`

- [ ] **Step 1: Update input placeholder**

Replace the existing placeholder expression (around line 599):

```typescript
// Before
placeholder={
  booking.step === "select_date"
    ? "Enter a date (e.g. 2026-03-15)..."
    : "Search properties or say 'book appointment'..."
}

// After
placeholder={
  booking.step === "select_date" || booking.step === "reschedule_date"
    ? "Enter a date (e.g. 2026-06-15)..."
    : "Search properties or ask to book / cancel / reschedule..."
}
```

- [ ] **Step 2: Update booking badge in header**

Replace the existing badge expression (around line 490):

```typescript
// Before
{booking.step !== "idle" && (
  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
    Booking
  </span>
)}

// After
{booking.step !== "idle" && (
  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
    {["cancel_select", "cancel_confirm"].includes(booking.step)
      ? "Cancelling"
      : ["reschedule_select", "reschedule_date", "reschedule_slot", "reschedule_confirm"].includes(booking.step)
      ? "Rescheduling"
      : "Booking"}
  </span>
)}
```

- [ ] **Step 3: Build check + run tests**

```bash
npm run build && npm test
```

Expected: build clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/PropertyChatbot.tsx
git commit -m "feat(chatbot): update input placeholder and booking badge for cancel/reschedule steps"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new lint errors introduced. Pre-existing 53 errors are acceptable.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Manual smoke test checklist**

Start the dev server (`npm run dev`, open `http://localhost:8080`) and verify each flow:

**Duplicate fix:**
- [ ] Open chat, type "show me available list" — should see up to 5 property cards, all unique
- [ ] Type the same query again — should see same 5 cards, no duplicates in the booking quick-replies when you say "book appointment"
- [ ] Say "book appointment" — quick-reply buttons show only the most recent search, no duplicates

**Cancel flow:**
- [ ] Log in as a tenant who has at least one pending/approved appointment
- [ ] Open chat — should see contextual greeting listing that appointment
- [ ] Type "cancel appointment" — should see a list of appointments to cancel
- [ ] Select one, confirm — appointment status becomes "cancelled" in Supabase; chat offers to book a new one
- [ ] Confirm cancel worked: check Supabase `appointment` table, status = `cancelled`

**Reschedule flow:**
- [ ] Type "reschedule" — should see a list of pending/approved appointments
- [ ] Select one — bot shows current booking details, asks for new date
- [ ] Enter a future date — bot shows available slots for that date
- [ ] Select a slot — bot shows confirmation with old and new dates
- [ ] Confirm — appointment updated in Supabase with new date/time, status reset to `pending`
- [ ] Confirm email notification fired: check n8n webhook logs or Resend dashboard

**TenantAppointments page:**
- [ ] Navigate to `/tenant/appointments` — page still functions independently, cancel button still works

- [ ] **Step 5: Final commit if any fixes made**

```bash
git add -p
git commit -m "fix(chatbot): address smoke test issues"
```
