# Architecture Research: n8n + React + Supabase AI Chatbot

**Research Date:** 2026-02-18
**Project:** PropertyPal AI Booking Assistant
**Context:** Adding n8n workflow backend to existing React + Supabase SPA

---

## Executive Summary

This document outlines the architectural integration of n8n workflow automation into PropertyPal's existing React SPA with Supabase backend. The integration adds an AI-powered chatbot booking assistant that uses Claude API for natural language understanding while maintaining the existing direct Supabase access patterns for read-only operations.

**Key Architectural Decision:** Hybrid model where:
- Read operations continue using direct Supabase client access
- Write operations (appointments) flow through n8n for AI orchestration
- n8n acts as a stateless workflow orchestrator, not an API gateway

---

## Current Architecture (Baseline)

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React SPA (Vite + TS)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Components Layer                                      │ │
│  │  - Admin/Owner/Tenant Role-based Routes               │ │
│  │  - ProtectedRoute (RBAC)                              │ │
│  │  - PropertyChatbot (existing UI component)            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  State Management                                      │ │
│  │  - @tanstack/react-query (server state caching)       │ │
│  │  - useAuth hook (session + role state)                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Supabase Client (@supabase/supabase-js)              │ │
│  │  - Direct PostgreSQL queries via PostgREST            │ │
│  │  - Real-time subscriptions                            │ │
│  │  - Auth session management (localStorage)             │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (REST + WebSocket)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                 Supabase Cloud Platform                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Auth Service (GoTrue)                                 │ │
│  │  - JWT-based authentication                            │ │
│  │  - User session management                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                   │ │
│  │  - Row Level Security (RLS) policies                   │ │
│  │  - Encrypted data (AES-256): ic_no, contact_no        │ │
│  │  - Tables: users, roles, user_roles, property,        │ │
│  │    appointment, tenant, property_owner, admin          │ │
│  │  - Audit log system (trigger-based)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgREST API                                         │ │
│  │  - Auto-generated REST API from schema                 │ │
│  │  - RLS enforcement at query time                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Realtime Server                                       │ │
│  │  - WebSocket for DB change subscriptions              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Characteristics

1. **No API Server Layer:** React SPA queries Supabase directly via PostgREST
2. **Security:** RLS policies enforce data access at database level
3. **Authentication:** Supabase Auth (JWT tokens) with role-based access
4. **Data Encryption:** Sensitive fields encrypted client-side before storage
5. **State Management:** React Query handles caching, optimistic updates
6. **Type Safety:** Auto-generated TypeScript types from Supabase schema

---

## Target Architecture (With n8n Integration)

### Component Boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│                        React SPA (Frontend)                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  PropertyChatbot Component (Enhanced)                           │ │
│  │  - Message UI (existing)                                        │ │
│  │  - NEW: n8n webhook client                                      │ │
│  │  - NEW: Conversation state management                           │ │
│  │  - NEW: Appointment confirmation flow                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Existing Components (Unchanged)                                │ │
│  │  - Direct Supabase queries for property browsing                │ │
│  │  - Direct Supabase queries for appointment viewing              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────┬───────────────┘
             │                                         │
             │ HTTPS POST (n8n webhook)                │ HTTPS (Supabase)
             │ /webhook/chat                           │ (unchanged)
             ↓                                         ↓
┌─────────────────────────────────────┐    ┌──────────────────────────┐
│        n8n Workflow Engine          │    │    Supabase Platform     │
│  (Self-hosted or Cloud)             │    │    (unchanged)           │
│  ┌───────────────────────────────┐  │    │  - Auth                  │
│  │  Webhook Trigger Node         │  │    │  - PostgreSQL + RLS      │
│  │  - Receives tenant message    │  │    │  - PostgREST API         │
│  │  - Validates JWT              │  │    │  - Realtime              │
│  └───────────────────────────────┘  │    └────────┬─────────────────┘
│             ↓                        │             ↑
│  ┌───────────────────────────────┐  │             │
│  │  Claude API Node              │  │             │
│  │  - Structured output          │  │             │
│  │  - Requirement extraction     │  │             │
│  └───────────────────────────────┘  │             │
│             ↓                        │             │
│  ┌───────────────────────────────┐  │    HTTPS    │
│  │  Supabase Node                │  │    (service │
│  │  - Query properties           │◄─┼────role key)│
│  │  - Check appointments         │  │             │
│  │  - Create appointment         │──┼─────────────┘
│  └───────────────────────────────┘  │
│             ↓                        │
│  ┌───────────────────────────────┐  │
│  │  Response Formatter Node      │  │
│  │  - Return matched properties  │  │
│  │  - Return booking options     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         │ HTTPS Response (JSON)
         ↓
┌─────────────────────────────────────┐
│  External Service                   │
│  ┌───────────────────────────────┐  │
│  │  Anthropic Claude API         │  │
│  │  - Model: claude-3-5-sonnet   │  │
│  │  - Structured JSON output     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Data Flow: Full Booking Conversation Lifecycle

#### Phase 1: Initial Query (Tenant sends requirements)

```
1. Tenant → PropertyChatbot UI
   Input: "I need a 3-bedroom apartment in Kuala Lumpur under RM2000"

2. PropertyChatbot → n8n Webhook
   POST /webhook/chat
   Headers:
     Authorization: Bearer <supabase-jwt>
   Body: {
     "message": "I need a 3-bedroom apartment...",
     "userId": "uuid",
     "conversationId": "uuid",
     "action": "search"
   }

3. n8n Webhook Node → JWT Validation
   - Decode Supabase JWT
   - Extract user_id, role
   - Verify role === 'tenant' (roleId: 3)
   - Store in workflow context

4. n8n → Claude API Node
   POST https://api.anthropic.com/v1/messages
   Body: {
     "model": "claude-3-5-sonnet-20241022",
     "messages": [{
       "role": "user",
       "content": "Extract property requirements from: ..."
     }],
     "tools": [{
       "name": "property_search",
       "description": "Search for properties...",
       "input_schema": {
         "type": "object",
         "properties": {
           "bedrooms": {"type": "number"},
           "location": {"type": "string"},
           "max_price": {"type": "number"},
           "property_type": {"type": "string"}
         }
       }
     }]
   }

5. Claude API → n8n (Structured Response)
   Response: {
     "content": [{
       "type": "tool_use",
       "name": "property_search",
       "input": {
         "bedrooms": 3,
         "location": "Kuala Lumpur",
         "max_price": 2000,
         "property_type": "apartment"
       }
     }]
   }

6. n8n → Supabase Node (Query Properties)
   Using Supabase Service Role Key:

   const { data: properties } = await supabase
     .from('property')
     .select(`
       property_id,
       title,
       location,
       price,
       bedrooms,
       bathrooms,
       property_type,
       description,
       photo_url,
       property_owner(name, contact_no)
     `)
     .eq('status', 'available')
     .eq('bedrooms', 3)
     .ilike('location', '%Kuala Lumpur%')
     .lte('price', 2000)
     .limit(5);

7. n8n → Supabase Node (Check Availability)
   For each property, check appointment conflicts:

   const { data: appointments } = await supabase
     .from('appointment')
     .select('appointment_date, time_slot')
     .eq('property_id', propertyId)
     .gte('appointment_date', today)
     .order('appointment_date', { ascending: true });

8. n8n Response Formatter → PropertyChatbot
   Response: {
     "message": "I found 3 properties matching your requirements",
     "properties": [
       {
         "property_id": "uuid",
         "title": "Modern 3BR Apartment",
         "location": "KLCC, Kuala Lumpur",
         "price": 1800,
         "bedrooms": 3,
         "availableSlots": [
           {"date": "2026-02-20", "times": ["10:00", "14:00"]},
           {"date": "2026-02-21", "times": ["09:00", "11:00", "15:00"]}
         ]
       },
       // ... more properties
     ],
     "conversationState": {
       "stage": "property_selection",
       "searchCriteria": { ... }
     }
   }

9. PropertyChatbot → UI Render
   - Display property cards with photos
   - Show available time slots
   - Enable "Book Viewing" buttons
```

#### Phase 2: Appointment Booking (Tenant confirms selection)

```
10. Tenant → PropertyChatbot UI
    Action: Click "Book Viewing" on property
    Selects: Date: 2026-02-20, Time: 14:00

11. PropertyChatbot → n8n Webhook
    POST /webhook/chat
    Headers:
      Authorization: Bearer <supabase-jwt>
    Body: {
      "action": "book_appointment",
      "propertyId": "uuid",
      "selectedDate": "2026-02-20",
      "selectedTime": "14:00",
      "userId": "uuid",
      "conversationId": "uuid"
    }

12. n8n → Supabase Node (Conflict Check)
    Double-check availability (prevent race conditions):

    const { data: conflict } = await supabase
      .from('appointment')
      .select('appointment_id')
      .eq('property_id', propertyId)
      .eq('appointment_date', '2026-02-20')
      .eq('time_slot', '14:00')
      .single();

    if (conflict) {
      return { error: "Time slot no longer available" };
    }

13. n8n → Supabase Node (Create Appointment)
    const { data: appointment } = await supabase
      .from('appointment')
      .insert({
        property_id: propertyId,
        tenant_id: tenantId,
        appointment_date: '2026-02-20',
        time_slot: '14:00',
        status: 'pending',
        created_by_ai: true,
        conversation_id: conversationId
      })
      .select()
      .single();

14. n8n → Supabase Node (Notify Owner)
    const { data: notification } = await supabase
      .from('notifications')
      .insert({
        user_id: propertyOwnerId,
        type: 'new_appointment',
        title: 'New Viewing Request',
        message: `Tenant ${tenantName} booked viewing for ${propertyTitle}`,
        reference_id: appointment.appointment_id,
        reference_type: 'appointment'
      });

15. n8n Response → PropertyChatbot
    Response: {
      "success": true,
      "message": "Appointment confirmed!",
      "appointment": {
        "appointment_id": "uuid",
        "property_title": "Modern 3BR Apartment",
        "date": "2026-02-20",
        "time": "14:00",
        "owner_name": "John Doe",
        "owner_contact": "encrypted_value",
        "location": "KLCC, Kuala Lumpur"
      },
      "conversationState": {
        "stage": "booking_complete"
      }
    }

16. PropertyChatbot → UI Update
    - Show confirmation message
    - Display appointment details
    - Provide calendar add button
    - Offer "Book Another Property" option
```

---

## n8n Workflow Structure

### Workflow 1: Property Search & Booking (Main Workflow)

**Trigger:** Webhook (POST /webhook/chat)

**Nodes:**

1. **Webhook Trigger**
   - Method: POST
   - Path: `/webhook/chat`
   - Authentication: Bearer Token (validates Supabase JWT)
   - Input Schema:
     ```json
     {
       "message": "string",
       "userId": "string (uuid)",
       "conversationId": "string (uuid)",
       "action": "search | book_appointment"
     }
     ```

2. **JWT Validator (Function Node)**
   - Language: JavaScript
   - Purpose: Decode and validate Supabase JWT
   - Extracts: `user_id`, `role`, `exp`
   - Validates: Token not expired, role === 'tenant'

3. **Router (Switch Node)**
   - Routes based on `action` field:
     - `action === 'search'` → Branch A (Property Search)
     - `action === 'book_appointment'` → Branch B (Booking)

#### Branch A: Property Search Flow

4. **Claude API (HTTP Request Node)**
   - Method: POST
   - URL: `https://api.anthropic.com/v1/messages`
   - Authentication: Header `x-api-key: ${ANTHROPIC_API_KEY}`
   - Body Template:
     ```json
     {
       "model": "claude-3-5-sonnet-20241022",
       "max_tokens": 1024,
       "tools": [{
         "name": "property_search",
         "description": "Extract structured search criteria",
         "input_schema": {
           "type": "object",
           "properties": {
             "bedrooms": {"type": "integer", "minimum": 1},
             "bathrooms": {"type": "integer", "minimum": 1},
             "location": {"type": "string"},
             "max_price": {"type": "number"},
             "min_price": {"type": "number"},
             "property_type": {
               "type": "string",
               "enum": ["apartment", "condo", "house", "studio"]
             }
           },
           "required": ["location"]
         }
       }],
       "messages": [{
         "role": "user",
         "content": "Extract property search requirements from: {{$json.message}}"
       }]
     }
     ```

5. **Extract Search Params (Function Node)**
   - Parse Claude's tool_use response
   - Extract structured parameters
   - Set defaults for missing fields

6. **Query Properties (Supabase Node)**
   - Operation: `select`
   - Table: `property`
   - Filters (dynamic based on Claude output):
     ```javascript
     const filters = [];
     if (bedrooms) filters.push({ column: 'bedrooms', operator: 'eq', value: bedrooms });
     if (location) filters.push({ column: 'location', operator: 'ilike', value: `%${location}%` });
     if (max_price) filters.push({ column: 'price', operator: 'lte', value: max_price });
     filters.push({ column: 'status', operator: 'eq', value: 'available' });
     ```
   - Fields: `*,property_owner(name,contact_no)`
   - Limit: 10

7. **Check Availability (Loop Node → Supabase)**
   - For each property:
     - Query `appointment` table
     - Get next 7 days of availability
     - Filter out booked slots
   - Output: Properties with `availableSlots[]` array

8. **Format Response (Function Node)**
   - Build user-friendly message
   - Structure property cards data
   - Set conversation state

#### Branch B: Appointment Booking Flow

9. **Conflict Check (Supabase Node)**
   - Table: `appointment`
   - Filter:
     ```javascript
     {
       property_id: propertyId,
       appointment_date: selectedDate,
       time_slot: selectedTime
     }
     ```
   - Expected: 0 rows (no conflict)

10. **IF Condition (Conflict Found)**
    - True: Return error response (slot taken)
    - False: Proceed to booking

11. **Create Appointment (Supabase Node)**
    - Operation: `insert`
    - Table: `appointment`
    - Data:
      ```json
      {
        "property_id": "{{propertyId}}",
        "tenant_id": "{{userId}}",
        "appointment_date": "{{selectedDate}}",
        "time_slot": "{{selectedTime}}",
        "status": "pending",
        "created_by_ai": true,
        "conversation_id": "{{conversationId}}"
      }
      ```

12. **Get Property Owner (Supabase Node)**
    - Query property to get owner details
    - Needed for notification

13. **Create Notification (Supabase Node)**
    - Operation: `insert`
    - Table: `notifications`
    - Notify property owner of new appointment

14. **Format Success Response (Function Node)**
    - Include appointment details
    - Provide owner contact (for frontend decryption)

15. **Merge Branches (Merge Node)**
    - Combine outputs from both branches

16. **Response (Webhook Response Node)**
    - Return formatted JSON
    - Status code: 200 (success) or 400 (error)

### Workflow 2: Appointment Cancellation (Optional)

Similar structure for handling cancellations via chatbot.

---

## n8n ↔ Supabase Authentication

### Pattern: Service Role Key for Backend Operations

**Challenge:** n8n needs to bypass RLS policies to perform administrative operations (querying all properties, creating appointments on behalf of users).

**Solution:** Use Supabase Service Role Key with security guards.

### Implementation

#### 1. Supabase Credentials in n8n

**Credential Type:** `supabaseApi`

```json
{
  "host": "https://xxxxxxxxxxxx.supabase.co",
  "serviceRole": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- `serviceRole`: Service role key (full access, bypasses RLS)
- `apiKey`: Public anon key (for read-only operations if needed)

**Security Considerations:**

1. **Never expose service role key to frontend**
2. Store in n8n credentials vault (encrypted at rest)
3. Rotate periodically (quarterly)
4. Use environment variables in n8n Cloud

#### 2. Supabase Node Configuration

```javascript
// In n8n Supabase node settings
{
  "authentication": "serviceRole",
  "resource": "database",
  "operation": "select",
  "table": "property",
  "returnAll": false,
  "limit": 10,
  "filters": {
    "conditions": [
      {
        "column": "status",
        "operator": "eq",
        "value": "available"
      }
    ]
  },
  "options": {
    "select": "*,property_owner(name,contact_no)"
  }
}
```

#### 3. Authorization Guard (Custom Function Node)

**Purpose:** Validate that the request came from an authenticated tenant, even though n8n uses service role key.

```javascript
// Function Node: "Validate Tenant Authorization"
const jwt = require('jsonwebtoken');

// Get Supabase JWT from webhook headers
const authHeader = $input.first().headers['authorization'];
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new Error('Unauthorized: Missing Bearer token');
}

const token = authHeader.split(' ')[1];

// Decode JWT (Supabase uses HMAC secret)
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
const decoded = jwt.verify(token, supabaseJwtSecret);

// Validate claims
if (!decoded.sub) {
  throw new Error('Invalid token: Missing user ID');
}

if (!decoded.user_metadata?.role_id || decoded.user_metadata.role_id !== 3) {
  throw new Error('Forbidden: Only tenants can book appointments');
}

// Pass validated user data to next node
return {
  userId: decoded.sub,
  userEmail: decoded.email,
  roleId: decoded.user_metadata.role_id,
  validated: true
};
```

#### 4. RLS Policy Interaction

**Problem:** n8n uses service role → RLS policies don't apply → potential security bypass

**Solution Layers:**

1. **Application-level authorization** (JWT validation in workflow)
2. **Database triggers** for audit logging (track all changes)
3. **Database CHECK constraints** (prevent invalid data)
4. **Separate read-only service role** (optional, for extra paranoia)

**Example: Read-only Service Role (Advanced)**

```sql
-- Create restricted role for n8n property queries
CREATE ROLE n8n_property_reader;

GRANT USAGE ON SCHEMA public TO n8n_property_reader;
GRANT SELECT ON public.property TO n8n_property_reader;
GRANT SELECT ON public.appointment TO n8n_property_reader;
GRANT SELECT ON public.property_owner TO n8n_property_reader;

-- For writes, still use service role but log via trigger
GRANT INSERT ON public.appointment TO n8n_property_reader;
```

---

## Component Dependencies & Build Order

### Phase 1: Infrastructure Setup (1-2 days)

**Objective:** Get n8n running and connected to Supabase

**Tasks:**

1. **Deploy n8n instance**
   - Option A: Self-hosted (Docker Compose)
   - Option B: n8n Cloud (recommended for simplicity)
   - Configure environment variables
   - Set up SSL certificate

2. **Configure Supabase credentials in n8n**
   - Add Service Role Key
   - Test connection with simple SELECT query
   - Verify RLS bypass works

3. **Set up Anthropic API credentials**
   - Create API key in Anthropic Console
   - Add to n8n credentials
   - Test with sample request

**Dependencies:** None (can start immediately)

**Deliverables:**
- n8n instance accessible at `https://n8n.yourapp.com`
- Supabase connection working
- Claude API connection working

---

### Phase 2: Backend Workflow Development (3-5 days)

**Objective:** Build and test n8n workflow

**Tasks:**

1. **Create webhook endpoint**
   - Configure n8n webhook trigger
   - Test with Postman/curl
   - Document request/response schema

2. **Implement JWT validation**
   - Write Function Node for token decoding
   - Test with valid/invalid tokens
   - Handle error cases

3. **Build property search flow**
   - Connect Claude API node
   - Implement tool use parsing
   - Query Supabase for properties
   - Check appointment availability
   - Format response

4. **Build appointment booking flow**
   - Conflict detection logic
   - Appointment creation
   - Notification generation

5. **Testing & Error Handling**
   - Test all edge cases (no results, invalid dates, conflicts)
   - Add error responses
   - Implement logging

**Dependencies:** Phase 1 complete

**Deliverables:**
- Functional n8n workflow
- Postman collection for testing
- Documented API contract

---

### Phase 3: Frontend Integration (2-3 days)

**Objective:** Connect PropertyChatbot to n8n webhook

**Tasks:**

1. **Create webhook client utility**
   ```typescript
   // src/utils/n8nClient.ts
   export async function sendChatMessage(
     message: string,
     action: 'search' | 'book_appointment',
     additionalParams?: any
   ) {
     const { data: { session } } = await supabase.auth.getSession();

     const response = await fetch(`${N8N_WEBHOOK_URL}/webhook/chat`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${session?.access_token}`
       },
       body: JSON.stringify({
         message,
         action,
         userId: session?.user?.id,
         conversationId: generateConversationId(),
         ...additionalParams
       })
     });

     return response.json();
   }
   ```

2. **Enhance PropertyChatbot component**
   - Add message state management
   - Integrate n8n client
   - Render property cards from response
   - Handle booking confirmation flow
   - Add loading states

3. **Update environment variables**
   ```env
   VITE_N8N_WEBHOOK_URL=https://n8n.yourapp.com
   ```

4. **Testing**
   - E2E test: Search → Results → Booking
   - Test error scenarios
   - Test with different user roles

**Dependencies:** Phase 2 complete

**Deliverables:**
- Enhanced PropertyChatbot component
- Functional booking flow
- User documentation

---

### Phase 4: Database Enhancements (1 day)

**Objective:** Support AI booking workflow

**Tasks:**

1. **Extend appointment table**
   ```sql
   ALTER TABLE appointment
   ADD COLUMN created_by_ai BOOLEAN DEFAULT false,
   ADD COLUMN conversation_id UUID REFERENCES conversations(id);
   ```

2. **Create conversations table (optional)**
   ```sql
   CREATE TABLE conversations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID REFERENCES tenant(tenant_id),
     created_at TIMESTAMP DEFAULT now(),
     last_message_at TIMESTAMP DEFAULT now(),
     status TEXT DEFAULT 'active'
   );
   ```

3. **Add indexes for performance**
   ```sql
   CREATE INDEX idx_appointment_property_date
   ON appointment(property_id, appointment_date);

   CREATE INDEX idx_property_search
   ON property(status, bedrooms, price, location);
   ```

**Dependencies:** Can run in parallel with Phase 2

**Deliverables:**
- Migration files
- Updated TypeScript types

---

### Phase 5: Monitoring & Optimization (Ongoing)

**Objective:** Ensure reliability and performance

**Tasks:**

1. **n8n Monitoring**
   - Enable workflow execution logs
   - Set up error notifications
   - Monitor API rate limits (Claude API)

2. **Performance Optimization**
   - Add caching for property queries
   - Optimize Supabase queries
   - Reduce Claude API token usage

3. **Audit Logging**
   - Log all AI-created appointments
   - Track conversation analytics

**Dependencies:** All phases complete

---

## Security Considerations

### 1. JWT Token Handling

**Risk:** Stolen JWT token could allow unauthorized bookings

**Mitigations:**
- Short token expiry (1 hour)
- Validate token on every request
- Check user role matches operation (tenant can only book, not cancel others' appointments)
- Log all booking attempts (audit log)

### 2. Service Role Key Exposure

**Risk:** If leaked, attacker has full database access

**Mitigations:**
- Store in n8n credentials vault (encrypted)
- Rotate quarterly
- Use network-level restrictions (n8n IP whitelist in Supabase)
- Consider separate limited-privilege role for n8n

### 3. Rate Limiting

**Risk:** API abuse (spam bookings, Claude API cost)

**Mitigations:**
- Implement rate limiting in n8n (per user)
- Supabase rate limiting on webhook endpoint
- Monitor Claude API usage
- Add CAPTCHA for suspicious activity

### 4. Data Validation

**Risk:** Malicious input could break workflow or inject SQL

**Mitigations:**
- Validate all webhook inputs (JSON schema)
- Use Supabase parameterized queries (built-in SQL injection protection)
- Sanitize user messages before sending to Claude
- Set Claude output constraints (structured output only)

### 5. Audit Trail

**Requirement:** Track all AI bookings for compliance

**Implementation:**
- Existing audit_log table captures all DB changes
- Add application-level logging in n8n:
  ```javascript
  // Function Node: Log AI Booking
  await supabase.from('audit_log').insert({
    user_id: userId,
    action: 'ai_booking_created',
    resource_type: 'APPOINTMENT',
    resource_id: appointmentId,
    details: {
       conversation_id: conversationId,
       property_searched: searchCriteria,
       claude_response: claudeOutput
    }
  });
  ```

---

## Performance Considerations

### Expected Load

- **Users:** 100-500 tenants browsing properties
- **Chatbot Usage:** 20-30% of tenants use AI booking
- **Requests/hour:** ~10-50 search requests, ~5-20 booking requests

### Bottlenecks & Solutions

#### 1. Claude API Latency (~2-5 seconds)

**Impact:** Slow chatbot responses

**Solutions:**
- Show "AI is thinking..." loader
- Stream Claude responses (use SSE instead of webhook for real-time)
- Cache common queries ("3-bedroom apartment in KL" → pre-built search params)

#### 2. Property Query Performance

**Impact:** Slow search results when filtering 1000+ properties

**Solutions:**
- Add database indexes (Phase 4)
- Limit results to 10 properties max
- Use Supabase full-text search (GIN index on location, description)
- Consider materialized view for popular searches

#### 3. Appointment Conflict Checks

**Impact:** Race conditions (two users book same slot simultaneously)

**Solutions:**
- Database-level uniqueness constraint:
  ```sql
  CREATE UNIQUE INDEX unique_appointment_slot
  ON appointment(property_id, appointment_date, time_slot)
  WHERE status != 'cancelled';
  ```
- Optimistic locking (check-before-insert in transaction)

#### 4. n8n Workflow Execution

**Impact:** Workflow timeouts for complex searches

**Solutions:**
- Set reasonable webhook timeout (30 seconds)
- Offload long-running tasks to async workflows
- Use n8n Queue mode for high concurrency

---

## Alternative Architectures (Considered & Rejected)

### Option 1: Claude API Direct from Frontend

**Pros:**
- Simpler architecture (no n8n)
- Lower latency

**Cons:**
- Expose Anthropic API key to frontend (security risk)
- No centralized booking logic (harder to enforce business rules)
- Cannot use service role for database operations

**Verdict:** Rejected due to security concerns

---

### Option 2: Custom Node.js/Express API Layer

**Pros:**
- Full control over logic
- Can use traditional ORM (Prisma, TypeORM)

**Cons:**
- More code to maintain
- Need to deploy separate server
- Longer development time
- Loses n8n's visual workflow benefits (easier to modify flow)

**Verdict:** Rejected in favor of n8n for faster iteration

---

### Option 3: Supabase Edge Functions

**Pros:**
- Serverless (auto-scaling)
- Same environment as existing Supabase infra
- Can use Deno/TypeScript

**Cons:**
- No visual workflow editor (harder for non-developers to modify)
- Limited debugging tools
- Cold start latency
- Less flexible than n8n for complex orchestration

**Verdict:** Rejected due to complexity of orchestration logic

---

## Architectural Constraints & Trade-offs

### 1. Hybrid Data Access Pattern

**Decision:** Keep direct Supabase access for reads, route writes through n8n

**Trade-offs:**
- **Pro:** Maintains existing performance (no added latency for browsing)
- **Pro:** Easier migration (frontend changes isolated to chatbot)
- **Con:** Two data access patterns to maintain
- **Con:** Frontend still needs Supabase client (can't remove dependency)

**Rationale:** Minimizes risk, allows gradual migration

---

### 2. Stateless Workflow (No Conversation Memory)

**Decision:** Each webhook request is independent (no conversation history storage)

**Trade-offs:**
- **Pro:** Simpler workflow logic
- **Pro:** No state management in n8n
- **Con:** Cannot handle follow-up questions ("Show me cheaper options")
- **Con:** User must repeat requirements in new chat session

**Rationale:** Simplicity for MVP, can add conversation memory later

**Future Enhancement:**
- Store conversation history in Supabase `conversations` table
- Pass conversation_id in webhook requests
- Claude can reference previous messages

---

### 3. Service Role Key Usage

**Decision:** Use Supabase service role key in n8n (bypasses RLS)

**Trade-offs:**
- **Pro:** Can perform admin operations (query all properties)
- **Pro:** Simpler query logic (no RLS policy conflicts)
- **Con:** Requires extra validation layer (JWT checks)
- **Con:** Higher security risk if key leaks

**Rationale:** Necessary for AI agent to query across all data, mitigated by JWT validation

---

## Environment Variables

### Frontend (.env)

```env
# Existing
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ENCRYPTION_KEY=32_byte_encryption_key

# New for n8n integration
VITE_N8N_WEBHOOK_URL=https://n8n.yourapp.com
VITE_CHATBOT_ENABLED=true
```

### n8n (.env or Cloud settings)

```env
# n8n Configuration
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=random_32_char_key

# Supabase Integration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret

# Anthropic Integration
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# Rate Limiting
MAX_REQUESTS_PER_USER_PER_HOUR=20
```

---

## Quality Gate Checklist

- [x] **Component boundaries clearly defined**
  - Frontend (PropertyChatbot), n8n (Workflow Orchestrator), Supabase (Database), Claude (AI)

- [x] **Data flow direction explicit for full conversation lifecycle**
  - Phase 1: Search flow documented (16 steps)
  - Phase 2: Booking flow documented (7 steps)

- [x] **n8n ↔ Supabase authentication pattern documented**
  - Service role key usage explained
  - JWT validation layer specified
  - Security guards detailed

- [x] **Build order implications noted**
  - 5 phases with dependencies mapped
  - Parallel work identified (Phase 4 can run with Phase 2)

---

## Next Steps

1. **Review this architecture document** with team
2. **Choose n8n deployment option** (self-hosted vs. cloud)
3. **Set up development environment** (Phase 1)
4. **Create detailed workflow diagram in n8n** (visual flow)
5. **Define API contract** (OpenAPI spec for webhook)
6. **Begin Phase 2 implementation** (backend workflow)

---

## References

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Supabase Integration](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/messages_post)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api#the-service_role-key)
- [PropertyPal CLAUDE.md](../CLAUDE.md) (Project context)
- [PropertyPal Security Implementation](../docs/SECURITY_IMPLEMENTATION.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-18
**Author:** Research Agent (gsd-project-researcher)