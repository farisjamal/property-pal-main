# Stack Research: n8n + Claude API + React Chat Integration

## n8n Self-Hosted Setup

### Deployment Options for FYP
| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Docker Compose (local) | Simple, free, full control | Must be running during demo | **Best for FYP** |
| Railway/Render | Always-on, free tier available | Resource limits, cold starts | Backup option |
| VPS (DigitalOcean/Hetzner) | Full control, always-on | Monthly cost ($5-12/mo) | If budget allows |
| npm global install | Simplest setup | No persistence guarantees | Dev only |

### Docker Compose Configuration (Recommended)
```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=<secure-password>
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_ENCRYPTION_KEY=<random-key>
      - GENERIC_TIMEZONE=Asia/Kuala_Lumpur
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

### Key n8n Concepts for This Project
- **Webhook Node**: Receives HTTP POST from React frontend, returns response
- **HTTP Request Node**: Calls Claude API (messages endpoint)
- **Supabase Node**: Not available natively — use HTTP Request with Supabase REST API + service role key
- **Switch Node**: Routes conversation flow (search vs book vs clarify)
- **Set Node**: Transforms data between nodes
- **Code Node**: Custom JavaScript for complex logic (date parsing, slot calculation)

### n8n Webhook Behavior
- Production webhooks: `https://<host>/webhook/<path>`
- Test webhooks: `https://<host>/webhook-test/<path>` (only active while workflow editor is open)
- **Important**: Must use production webhook path for React integration
- Webhook can return data synchronously via "Respond to Webhook" node
- Default timeout: 30 seconds — sufficient for Claude API roundtrip
- CORS: n8n handles CORS headers automatically for webhook responses

### n8n + Supabase Integration Pattern
Since n8n doesn't have a native Supabase node, use HTTP Request nodes:
```
Base URL: https://<project-ref>.supabase.co/rest/v1/
Headers:
  apikey: <service-role-key>  // NOT the anon key — need full access
  Authorization: Bearer <service-role-key>
  Content-Type: application/json
  Prefer: return=representation
```

Query examples via PostgREST:
- Search properties: `GET /property?type=eq.Apartment&rent_price=lte.2000&select=*`
- Check appointments: `GET /appointment?property_id=eq.123&appointment_date=eq.2026-03-01&select=*`
- Create appointment: `POST /appointment` with JSON body
- Filter by multiple criteria: `GET /property?or=(type.eq.Apartment,type.eq.Condo)&rent_price=lte.2000`

### PostgREST Operators (Supabase REST API)
| Operator | Meaning | Example |
|----------|---------|---------|
| eq | Equals | `?rent_price=eq.1500` |
| lte | Less than or equal | `?rent_price=lte.2000` |
| gte | Greater than or equal | `?bedrooms=gte.2` |
| like | Pattern match | `?location=like.*Kuala Lumpur*` |
| ilike | Case-insensitive match | `?location=ilike.*petaling jaya*` |
| in | In list | `?type=in.(Apartment,Condo)` |
| is | Is null/not null | `?status=is.null` |

## Claude API Integration via n8n

### API Configuration
```
Endpoint: https://api.anthropic.com/v1/messages
Method: POST
Headers:
  x-api-key: <ANTHROPIC_API_KEY>
  anthropic-version: 2023-06-01
  content-type: application/json
```

### Message Format for Property Search
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "system": "You are a property booking assistant for PropertyPal Malaysia. Extract structured search criteria from tenant messages. Always respond with a JSON tool call.",
  "tools": [
    {
      "name": "search_properties",
      "description": "Search for properties matching tenant criteria",
      "input_schema": {
        "type": "object",
        "properties": {
          "property_type": { "type": "string", "enum": ["Apartment", "Condo", "House", "Room"] },
          "max_rent": { "type": "number" },
          "min_bedrooms": { "type": "integer" },
          "location": { "type": "string" },
          "preferred_date": { "type": "string", "format": "date" },
          "preferred_time": { "type": "string" }
        }
      }
    },
    {
      "name": "book_appointment",
      "description": "Book a viewing appointment for a selected property",
      "input_schema": {
        "type": "object",
        "properties": {
          "property_id": { "type": "integer" },
          "appointment_date": { "type": "string", "format": "date" },
          "appointment_time": { "type": "string" },
          "tenant_id": { "type": "integer" }
        },
        "required": ["property_id", "appointment_date", "appointment_time", "tenant_id"]
      }
    }
  ],
  "messages": [
    { "role": "user", "content": "I'm looking for a 2-bedroom apartment in KL under RM2000" }
  ]
}
```

### Tool Use Flow in n8n
1. Frontend sends user message → n8n webhook
2. n8n sends message + tools to Claude API
3. Claude returns `tool_use` response with structured parameters
4. n8n Switch node routes based on tool name:
   - `search_properties` → Query Supabase property table → Format results → Return to Claude for natural language response
   - `book_appointment` → Check slot availability → Create appointment → Confirm to user
5. n8n returns final response to frontend via "Respond to Webhook"

### Claude API Cost Estimation
- Sonnet: ~$3/million input tokens, ~$15/million output tokens
- Average conversation: ~2000 input + 500 output tokens per turn
- 5 turns per booking session: ~$0.05 per complete session
- FYP demo with 20 sessions: ~$1.00 total

### Error Handling in n8n
- Use "Error Trigger" node for workflow-level error handling
- HTTP Request node has built-in retry (configure: 2 retries, 1s delay)
- Claude API rate limits: 50 requests/minute on free tier — more than sufficient
- Always return a user-friendly error message, never expose internal errors

## React Frontend Chat Integration

### Recommended Chat UI Approach
Since the project uses shadcn/ui, build the chat interface with existing components:

**Components needed:**
- `ScrollArea` — for message history with auto-scroll
- `Input` + `Button` — for message input
- `Card` — for property result cards within chat
- `Badge` — for property tags (type, bedrooms, price)
- `Skeleton` — for loading states during AI response
- `Alert` — for error messages

**No external chat library needed** — shadcn components + Tailwind are sufficient.

### Chat State Management
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  properties?: Property[];  // When AI returns search results
  booking?: BookingConfirmation;  // When appointment is booked
  timestamp: Date;
}

// Use React state (not React Query) for chat messages
// React Query for initial data fetch (tenant profile, etc.)
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isLoading, setIsLoading] = useState(false);
```

### Frontend → n8n Communication
```typescript
const sendMessage = async (message: string) => {
  const response = await fetch('http://localhost:5678/webhook/property-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}` // Pass Supabase JWT
    },
    body: JSON.stringify({
      message,
      tenant_id: tenantProfile.tenant_id,
      conversation_history: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  });

  return response.json();
};
```

### Conversation History Management
- Send last 10 messages as context (avoid token overflow)
- Store full history in React state (client-side only, no persistence needed for FYP)
- Clear conversation option via button
- Conversation resets on page reload (acceptable for FYP scope)

## Authentication Flow: Frontend → n8n → Supabase

### JWT Validation in n8n
The frontend sends the Supabase JWT. n8n should validate it:

1. **Option A — Simple (Recommended for FYP)**: Extract tenant_id from JWT claims in n8n Code node, trust the token since it comes from same-origin frontend
2. **Option B — Proper**: Use n8n HTTP Request to call Supabase Auth API (`/auth/v1/user`) with the JWT to validate

For FYP, Option A is sufficient:
```javascript
// n8n Code Node — Extract user from JWT
const token = $input.first().json.headers.authorization?.replace('Bearer ', '');
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
const userId = payload.sub; // Supabase auth user ID
return [{ json: { userId, ...($input.first().json.body) } }];
```

### n8n → Supabase Authentication
- Use **service role key** (not anon key) for n8n → Supabase queries
- Service role key bypasses RLS — n8n handles authorization logic
- Store service role key as n8n credential (encrypted at rest)
- **Never expose service role key to frontend**

## Environment & Configuration Summary

### n8n Environment Variables
| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access |
| `N8N_BASIC_AUTH_USER` | n8n dashboard login |
| `N8N_BASIC_AUTH_PASSWORD` | n8n dashboard password |
| `N8N_ENCRYPTION_KEY` | Encrypts stored credentials |
| `GENERIC_TIMEZONE` | Asia/Kuala_Lumpur |

### Frontend Environment Variables (additional)
| Variable | Purpose |
|----------|---------|
| `VITE_N8N_WEBHOOK_URL` | n8n webhook base URL |

### CORS Configuration
- n8n webhooks handle CORS automatically
- For local dev: frontend on `localhost:8080`, n8n on `localhost:5678`
- No additional CORS configuration needed in n8n
- For production: configure `WEBHOOK_URL` environment variable to match actual domain

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n not running during demo | AI features completely broken | Docker auto-restart + pre-demo checklist |
| Claude API key exhausted | No AI responses | Monitor usage, set spending limit, have demo recording as backup |
| Webhook timeout (>30s) | Chat appears hung | Loading indicator, timeout message after 25s |
| CORS issues in production | Frontend can't reach n8n | Test CORS configuration before demo |
| n8n workflow breaks mid-demo | Partial AI responses | Error handling returns friendly message, manual booking fallback |

## Version Compatibility

| Component | Recommended Version | Notes |
|-----------|-------------------|-------|
| n8n | 1.x (latest stable) | Breaking changes between 0.x and 1.x |
| Claude API | 2023-06-01 | anthropic-version header |
| Claude Model | claude-sonnet-4-5-20250929 | Best balance of speed/quality for chat |
| Docker | 24+ | For n8n hosting |
| Docker Compose | v2+ | Uses `docker compose` (no hyphen) |
