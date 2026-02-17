# Phase 1: Infrastructure & Security Foundation - Research

**Researched:** 2026-02-18
**Domain:** Docker containerization (n8n), Supabase Edge Functions, server-side encryption, credential management
**Confidence:** HIGH

## Summary

Phase 1 establishes the infrastructure foundation by deploying n8n via Docker Compose with PostgreSQL persistence, migrating AES-256 encryption from client-side (CryptoJS) to server-side (Supabase Edge Function using Web Crypto API), and implementing secure credential management. This research validates that all three components (n8n deployment, Edge Function encryption, credential security) are well-documented, production-ready patterns with clear implementation paths.

**Key findings:**
- Official n8n Docker Compose templates with PostgreSQL are production-tested and include health checks, auto-restart policies, and proper volume management
- Supabase Edge Functions support the Web Crypto API (AES-GCM) for server-side encryption with built-in secrets management via CLI and dashboard
- Docker Desktop for Windows 11 requires WSL 2, virtualization enabled in BIOS, and offers a straightforward installation process
- The encryption migration path requires careful key management—existing CryptoJS-encrypted data cannot be directly decrypted by Node.js crypto without key compatibility verification
- n8n's credentials vault with N8N_ENCRYPTION_KEY provides secure storage for service role keys and API keys

**Primary recommendation:** Use the official n8n-hosting repository's PostgreSQL Docker Compose configuration as the foundation, implement a single Supabase Edge Function with batch decrypt capability using Web Crypto API (AES-GCM), and start fresh with test data to avoid complex migration scripts.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**n8n Deployment Setup:**
- Run n8n locally via Docker Compose (no cloud deployment)
- Docker Desktop needs to be installed first (user doesn't have it yet)
- n8n on default port 5678 (React dev server on 8080, no conflict)
- docker-compose.yml in a **separate sibling folder** (e.g., `~/FYP/property-pal-n8n/`), not inside the main repo
- PostgreSQL for n8n's internal database (not SQLite)
- Basic auth enabled for n8n dashboard access
- Demo will run on user's own laptop (full control over environment)
- Timezone: Asia/Kuala_Lumpur
- Auto-restart: `restart: unless-stopped`

**Encryption Migration:**
- All existing data is test data — safe to wipe or re-encrypt
- Claude's Discretion: Choose between fresh start (simplest) or re-encrypt migration script based on implementation complexity. Fresh start is preferred given all data is test data.
- Claude's Discretion: Whether to support offline/fallback mode. Recommendation: Edge Function required (no client-side fallback) for maximum security — the whole point is removing the key from the client.
- Claude's Discretion: Whether n8n shares the encryption key. Recommendation: Edge Function only holds the key; n8n calls Edge Function if it needs decrypted data. Minimizes key exposure.

**Edge Function Design:**
- Claude's Discretion: Single function vs separate functions. Recommend single function with action parameter for simpler deployment.
- JWT required for Edge Function calls (matches existing auth pattern)
- Claude's Discretion: Direct HTTP call vs batch decrypt. Recommend batch approach for profile pages (fewer network requests).
- User has never deployed Edge Functions before — plan must include step-by-step guidance for first-time setup

**Credential Management:**
- User needs to check Supabase dashboard for service role key (may or may not have it)
- User needs to check if they have a Google Gemini API key (may need to create one)
- Claude's Discretion: .env file management approach. Recommend .env files per project (simplest for FYP).
- Plan must include step-by-step guides for obtaining Supabase service role key and Google Gemini API key
- n8n credentials vault for storing service role key and API keys (not in workflow JSON)
- .n8n/ directory must be in .gitignore

### Claude's Discretion
- **Encryption migration strategy:** Fresh start vs re-encrypt — **RECOMMENDATION: Fresh start**. Since all data is test data, wiping and re-encrypting avoids complex CryptoJS-to-Node.js key compatibility issues.
- **Edge Function structure:** Single vs separate — **RECOMMENDATION: Single function with `action` parameter** (`encrypt`, `decrypt`, `batch_decrypt`). Simpler deployment, fewer secrets to manage.
- **Batch vs direct decrypt API design:** **RECOMMENDATION: Batch decrypt**. Profile pages load multiple fields (contact_no, ic_no) — single request with array of ciphertext reduces network overhead.
- **Key sharing between Edge Function and n8n:** **RECOMMENDATION: Edge Function holds the key exclusively**. n8n workflows call the Edge Function if they need decrypted data, minimizing key exposure surface.
- **Fallback mode:** **RECOMMENDATION: No fallback**. Edge Function is required for all encrypt/decrypt operations. Removing client-side encryption entirely is the security goal.
- **.env file management approach:** **RECOMMENDATION: Per-project .env files**. One `.env` in `property-pal-n8n/` for n8n config, environment secrets managed via Supabase CLI for Edge Function.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **REQ-N8N-1** | n8n self-hosted via Docker Compose with PostgreSQL persistence. Auto-restart on failure. Timezone Asia/Kuala_Lumpur. Basic auth enabled. Webhook URL configured. | **Official n8n-hosting repository** provides production-ready docker-compose.yml with PostgreSQL 16, healthchecks, named volumes, `restart: unless-stopped` policy. Environment variables support timezone (`GENERIC_TIMEZONE`). Basic auth via `N8N_BASIC_AUTH_ACTIVE`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`. |
| **REQ-SEC-1** | Move AES-256 encryption from client-side (VITE_ENCRYPTION_KEY) to Supabase Edge Function. Frontend calls Edge Function for encrypt/decrypt. Encryption key stored as Edge Function secret. Existing encrypted data must be handled. | **Web Crypto API** in Deno Edge Functions supports AES-GCM (recommended) with `crypto.subtle.encrypt/decrypt`. Secrets management via `supabase secrets set`. Existing CryptoJS data requires fresh start or re-encryption due to key derivation differences (CryptoJS uses passphrase-based, Node.js crypto requires raw key). **Recommendation: Fresh start** since all data is test data. |
| **REQ-SEC-5** | Service role key in n8n credentials vault. Gemini API key as n8n credential. `.n8n/` in `.gitignore`. No secrets in workflow exports. n8n dashboard requires authentication. | **n8n credentials vault** secured by `N8N_ENCRYPTION_KEY` environment variable (must be set for production). Credentials never exported in workflow JSON. `.gitignore` entry prevents accidental commit. Dashboard auth via basic auth (see REQ-N8N-1). |

</phase_requirements>

---

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **n8n** | Latest (docker.n8n.io/n8nio/n8n) | AI workflow orchestration | Official Docker image, self-hosted, visual workflow editor, extensive integrations including OpenAI/Gemini |
| **PostgreSQL** | 16 | n8n persistence layer | Official n8n recommendation for production (SQLite not suitable), stable, battle-tested |
| **Docker Desktop** | Latest (Windows 11) | Container runtime | Required for Docker Compose, WSL 2 backend, Windows 11 native support |
| **Supabase CLI** | Latest | Edge Function deployment | Official tool for managing Edge Functions, secrets, local development |
| **Deno** | Bundled in Edge Functions | Edge Function runtime | Supabase Edge Functions runtime, TypeScript-first, Web Crypto API support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Web Crypto API** | Built-in (Deno) | AES-GCM encryption in Edge Functions | All encrypt/decrypt operations in Edge Function |
| **WSL 2** | Latest | Linux kernel for Docker Desktop | Required for Docker Desktop on Windows 11 |
| **n8n credentials vault** | Built-in | Secure credential storage | Storing service role key, Gemini API key, any workflow credentials |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| n8n | Zapier/Make.com | Cloud-hosted (monthly cost), no self-hosting, vendor lock-in. n8n chosen for zero cost and full control. |
| PostgreSQL | SQLite | SQLite not recommended for production n8n deployments (concurrency issues, data integrity risks). |
| Web Crypto API (AES-GCM) | CryptoJS | CryptoJS deprecated (maintenance discontinued), browser-focused. Web Crypto API is modern, cross-platform, promise-based. |
| Docker Compose | Kubernetes | Overkill for single-node FYP demo. Docker Compose simpler, no orchestration overhead. |

**Installation:**
```bash
# Docker Desktop for Windows 11 (one-time setup)
# Download from https://www.docker.com/products/docker-desktop/
# Requires: WSL 2, virtualization enabled in BIOS, Windows 11 build 22631+

# Supabase CLI (one-time setup)
npm install -g supabase

# n8n via Docker Compose (project-specific)
cd ~/FYP/property-pal-n8n/
docker-compose up -d
```

---

## Architecture Patterns

### Recommended Project Structure
```
~/FYP/
├── property-pal-main/          # Main React app (existing)
│   ├── src/
│   │   ├── utils/
│   │   │   └── security.ts     # UPDATED: Remove encryptData/decryptData, add Edge Function client
│   │   └── ...
│   ├── supabase/
│   │   └── functions/
│   │       └── crypto-service/ # NEW: Edge Function for encrypt/decrypt
│   │           └── index.ts
│   └── .env                    # EXISTING: Remove VITE_ENCRYPTION_KEY
│
└── property-pal-n8n/           # NEW: Separate n8n deployment folder
    ├── docker-compose.yml
    ├── .env                    # n8n config (DB credentials, encryption key, timezone)
    ├── .gitignore              # MUST include .n8n/
    └── init-data.sh            # PostgreSQL initialization (from n8n-hosting repo)
```

### Pattern 1: n8n Docker Compose with PostgreSQL

**What:** Two-service stack (PostgreSQL + n8n) with health checks, named volumes, and environment-based configuration.

**When to use:** All self-hosted n8n deployments requiring persistence and production reliability.

**Example:**
```yaml
# Source: https://github.com/n8n-io/n8n-hosting/blob/main/docker-compose/withPostgres/docker-compose.yml
version: '3.8'

volumes:
  db_storage:
  n8n_storage:

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_NON_ROOT_USER=${POSTGRES_NON_ROOT_USER}
      - POSTGRES_NON_ROOT_PASSWORD=${POSTGRES_NON_ROOT_PASSWORD}
    volumes:
      - db_storage:/var/lib/postgresql/data
      - ./init-data.sh:/docker-entrypoint-initdb.d/init-data.sh
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h localhost -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 5s
      timeout: 5s
      retries: 10

  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: unless-stopped
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - DB_POSTGRESDB_USER=${POSTGRES_NON_ROOT_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_NON_ROOT_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE=Asia/Kuala_Lumpur
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
    ports:
      - 5678:5678
    links:
      - postgres
    volumes:
      - n8n_storage:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
```

**Key points:**
- `restart: unless-stopped` honors manual stops (recommended over `always`)
- Health check ensures PostgreSQL is ready before n8n starts
- Named volumes (`db_storage`, `n8n_storage`) persist data across container recreation
- `init-data.sh` creates non-root PostgreSQL user for n8n

---

### Pattern 2: Supabase Edge Function with Batch Decrypt

**What:** Single Edge Function handling encrypt, decrypt, and batch_decrypt operations using Web Crypto API (AES-GCM).

**When to use:** Server-side encryption for profile pages loading multiple encrypted fields.

**Example:**
```typescript
// Source: https://supabase.com/docs/guides/functions + https://docs.deno.com/examples/aes_encryption/
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY secret not configured');
}

// Derive crypto key from secret
const keyData = new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
const cryptoKey = await crypto.subtle.importKey(
  'raw',
  keyData,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);

serve(async (req) => {
  const { action, data } = await req.json();

  if (action === 'encrypt') {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      new TextEncoder().encode(data)
    );
    return new Response(
      JSON.stringify({
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv))
      })
    );
  }

  if (action === 'decrypt' || action === 'batch_decrypt') {
    const items = Array.isArray(data) ? data : [data];
    const results = await Promise.all(items.map(async (item) => {
      if (!item.ciphertext || !item.iv) return null;

      const ciphertext = Uint8Array.from(atob(item.ciphertext), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(item.iv), c => c.charCodeAt(0));

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    }));

    return new Response(
      JSON.stringify({ data: action === 'batch_decrypt' ? results : results[0] })
    );
  }

  return new Response('Invalid action', { status: 400 });
});
```

**Key points:**
- AES-GCM requires storing IV alongside ciphertext (not CryptoJS-compatible)
- Batch decrypt reduces network requests for profile pages
- JWT verification enabled by default (requires `Authorization: Bearer <token>`)
- Secrets managed via `supabase secrets set ENCRYPTION_KEY=...`

---

### Pattern 3: Edge Function Secrets Management

**What:** Store encryption key and other secrets securely using Supabase CLI, accessible via `Deno.env.get()`.

**When to use:** All Edge Functions requiring sensitive configuration (encryption keys, API keys).

**Example:**
```bash
# Source: https://supabase.com/docs/guides/functions/secrets

# Local development (.env file)
echo "ENCRYPTION_KEY=your-32-byte-secure-key-here" > supabase/functions/.env
echo "supabase/functions/.env" >> .gitignore

# Production deployment
supabase secrets set ENCRYPTION_KEY=your-32-byte-secure-key-here

# Verify secrets were set
supabase secrets list

# Access in Edge Function
const key = Deno.env.get('ENCRYPTION_KEY');
```

**Key points:**
- Never commit `.env` files to git
- Secrets are available immediately (no redeployment needed)
- Use different `.env` files for local vs staging vs production
- `supabase secrets list` shows keys but not values (security)

---

### Pattern 4: n8n Credentials Vault for API Keys

**What:** Store Supabase service role key and Gemini API key in n8n's built-in credentials vault, encrypted by `N8N_ENCRYPTION_KEY`.

**When to use:** All n8n workflows requiring authenticated API access.

**Example:**
```bash
# In property-pal-n8n/.env
N8N_ENCRYPTION_KEY=your-persistent-encryption-key-here

# In n8n dashboard UI:
# 1. Settings → Credentials → New Credential
# 2. Select "HTTP Header Auth" for Supabase
#    - Name: Supabase Service Role
#    - Header Name: apikey
#    - Header Value: [paste service role key from Supabase dashboard]
# 3. Select "Generic Credential Type" for Gemini
#    - Name: Gemini API Key
#    - Key: GOOGLE_API_KEY
#    - Value: [paste from Google AI Studio]
```

**Key points:**
- `N8N_ENCRYPTION_KEY` must be set as environment variable (persistent across restarts)
- Credentials are encrypted at rest in PostgreSQL
- Workflow exports do NOT include credential values (only credential IDs)
- `.gitignore` must include `.n8n/` to prevent accidental secret exposure

---

### Anti-Patterns to Avoid

- **Storing encryption key in client bundle:** VITE_* environment variables are bundled into JavaScript, visible to any user inspecting the build. Never use `VITE_ENCRYPTION_KEY` for production encryption.

- **Using `restart: always` without considering manual stops:** `unless-stopped` respects manual stops (maintenance windows), while `always` restarts even after explicit `docker stop`. Use `unless-stopped` for most services.

- **Hardcoding secrets in docker-compose.yml:** Always use `.env` files for sensitive values. Never commit credentials to git.

- **Mixing CryptoJS and Node.js crypto without key conversion:** CryptoJS uses passphrase-based key derivation (similar to OpenSSL's EVP_BytesToKey). Node.js crypto requires raw keys. Direct decryption incompatibility is a common migration pitfall.

- **Deploying Edge Functions without setting secrets:** Edge Functions will fail at runtime if required environment variables are missing. Always set secrets before deployment.

- **Using SQLite for n8n in production:** SQLite lacks concurrency support needed for n8n workflows. Official docs recommend PostgreSQL for all production deployments.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Container orchestration** | Custom Docker startup scripts with manual dependency management | Docker Compose with `depends_on` + health checks | Health checks ensure PostgreSQL is ready before n8n starts. Manual scripts miss edge cases (network failures, partial restarts). |
| **Encryption key derivation** | Custom PBKDF2 or scrypt implementation | Web Crypto API's `crypto.subtle.importKey()` | Web Crypto API is audited, cross-platform, and handles key derivation edge cases (salt generation, iteration counts). |
| **n8n credential storage** | Environment variables or JSON files for API keys | n8n credentials vault with `N8N_ENCRYPTION_KEY` | Credentials vault encrypts at rest, supports credential rotation, and prevents accidental workflow export with secrets. |
| **JWT verification in Edge Functions** | Manual JWT parsing and signature validation | Supabase's built-in JWT verification (default enabled) | Supabase automatically validates JWTs using the project's JWT secret. Manual implementation risks security vulnerabilities. |
| **Log rotation for Docker containers** | Custom log cleanup scripts | Docker's built-in log driver with `max-size` and `max-file` | Prevents disk space exhaustion from long-running containers. Built-in log rotation is tested and reliable. |

**Key insight:** Infrastructure and security primitives have well-tested solutions. Custom implementations introduce security risks, edge case bugs, and maintenance burden. Use official tools and libraries for all critical infrastructure components.

---

## Common Pitfalls

### Pitfall 1: Docker Desktop Not Fully Configured

**What goes wrong:** Docker commands fail with "daemon not running" or containers crash immediately after start.

**Why it happens:** WSL 2 not installed, virtualization disabled in BIOS, or Docker Desktop service not started.

**How to avoid:**
1. **Enable virtualization in BIOS** before installing Docker Desktop (CPU setting: Intel VT-x / AMD-V)
2. **Install WSL 2** via `wsl --install` in PowerShell (Administrator)
3. **Verify installation:** `docker --version` and `docker run hello-world` before proceeding

**Warning signs:**
- `docker: command not found` (Docker Desktop not installed or not in PATH)
- `error during connect: This error may indicate that the docker daemon is not running` (Docker Desktop service not started)
- Container exits immediately with code 1 (virtualization disabled)

**Sources:**
- [Docker Desktop Windows Installation Guide](https://docs.docker.com/desktop/setup/install/windows-install/)
- [TheLinuxCode: Docker Windows 2026 Setup](https://thelinuxcode.com/how-to-install-docker-on-windows-in-2026-step-by-step-setup-wsl-2-cli-and-troubleshooting/)

---

### Pitfall 2: CryptoJS-to-Web Crypto API Data Incompatibility

**What goes wrong:** Existing CryptoJS-encrypted data cannot be decrypted by Web Crypto API (or vice versa).

**Why it happens:**
- **CryptoJS** uses passphrase-based key derivation (similar to OpenSSL's `EVP_BytesToKey` with MD5 digest, 1 iteration, no salt)
- **Web Crypto API** requires raw key material (Uint8Array)
- Different encryption modes (CryptoJS defaults to CBC with PKCS7 padding, Web Crypto API uses GCM with built-in authentication)

**How to avoid:**
- **Fresh start (RECOMMENDED):** Wipe test data and start with Web Crypto API encryption from scratch
- **Re-encryption script (if preserving data):** Read old CryptoJS data with existing frontend code, re-encrypt with Edge Function, update database

**Warning signs:**
- Decryption returns empty strings or garbled text
- `OperationError: The operation failed for an operation-specific reason` in Edge Function logs
- Frontend displays encrypted strings instead of plaintext (decryption failed silently)

**Sources:**
- [CryptoJS GitHub Issue #468: Equivalent node:crypto commands](https://github.com/brix/crypto-js/issues/468)
- [Deno AES Encryption Example](https://docs.deno.com/examples/aes_encryption/)

---

### Pitfall 3: Missing N8N_ENCRYPTION_KEY Causes Credential Loss

**What goes wrong:** After container restart, n8n credentials are lost or show "Credential data invalid" errors.

**Why it happens:**
- Without `N8N_ENCRYPTION_KEY` environment variable, n8n generates a new random key on each start
- Credentials encrypted with the old key cannot be decrypted with the new key
- n8n workflows fail with authentication errors

**How to avoid:**
1. **Always set N8N_ENCRYPTION_KEY** in `.env` file before first n8n start
2. **Generate a secure key:** `openssl rand -base64 32` or similar
3. **Back up the key** securely (password manager, encrypted vault)
4. **Never change the key** after credentials are created (requires re-entering all credentials)

**Warning signs:**
- Workflows fail with "Credential data invalid" after container restart
- n8n dashboard shows "?" icon instead of credential names
- PostgreSQL `credentials_entity` table has data, but n8n can't decrypt it

**Sources:**
- [n8n Credential Hygiene for Self-Hosted Reality](https://medium.com/@bhagyarana80/n8n-credential-hygiene-for-self-hosted-reality-cfa90ef1a114)
- [n8n External Secrets Documentation](https://docs.n8n.io/external-secrets/)

---

### Pitfall 4: Supabase Service Role Key Exposed in Client Code

**What goes wrong:** Service role key visible in browser DevTools, allowing unauthorized database access (bypasses RLS).

**Why it happens:**
- Using `SUPABASE_SERVICE_ROLE_KEY` in frontend code (React components)
- Confusing service role key with anon key

**How to avoid:**
1. **Frontend uses SUPABASE_ANON_KEY only** (respects Row Level Security)
2. **Service role key stored in:**
   - n8n credentials vault (for workflows)
   - Supabase Edge Functions (via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`)
   - Never in `VITE_*` environment variables
3. **Verify RLS policies** protect all sensitive tables

**Warning signs:**
- Service role key appears in browser Network tab headers
- `.env` file has `VITE_SUPABASE_SERVICE_ROLE_KEY` (should be `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Users can query database without authentication

**Sources:**
- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Troubleshooting: Service Role Secret](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa)

---

### Pitfall 5: Edge Function CPU Time Limit (2 seconds)

**What goes wrong:** Edge Function times out when decrypting large batches of data.

**Why it happens:**
- Supabase Edge Functions have a **2-second CPU time limit** per request
- Complex cryptographic operations (especially with large datasets) can exceed this limit

**How to avoid:**
1. **Batch decrypt in chunks** (e.g., max 50 items per request)
2. **For very large datasets, use Database Functions** (no CPU limit, executed in Postgres)
3. **Optimize encryption format** (use compact binary encoding, not base64)
4. **Consider caching** decrypted values with TTL for frequently accessed data

**Warning signs:**
- Edge Function returns 503 errors under load
- Logs show "function terminated due to excessive CPU usage"
- Profile pages load slowly or fail intermittently

**Sources:**
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Troubleshooting: Edge Function Shutdown Reasons](https://supabase.com/docs/guides/troubleshooting/edge-function-shutdown-reasons-explained)

---

### Pitfall 6: Docker Compose Port Conflicts

**What goes wrong:** n8n or PostgreSQL containers fail to start with "port already in use" errors.

**Why it happens:**
- Another application already using port 5678 (n8n) or 5432 (PostgreSQL)
- Multiple Docker Compose projects with conflicting port mappings

**How to avoid:**
1. **Check ports before deployment:** `netstat -ano | findstr :5678` (Windows)
2. **Use non-conflicting ports if needed:** Change `ports: - 5678:5678` to `ports: - 5679:5678`
3. **Stop conflicting services** or use Docker's `--port` flag

**Warning signs:**
- `Error starting userland proxy: listen tcp 0.0.0.0:5678: bind: address already in use`
- Containers show "Exited (1)" status immediately after `docker-compose up`

---

## Code Examples

Verified patterns from official sources:

### 1. Edge Function Deployment (First Time Setup)

```bash
# Source: https://supabase.com/docs/guides/functions/quickstart

# 1. Initialize Supabase project (if not already done)
supabase init

# 2. Create Edge Function
supabase functions new crypto-service

# 3. Set encryption key secret
supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32)

# 4. Link to remote project
supabase link --project-ref YOUR_PROJECT_ID

# 5. Deploy function (JWT verification enabled by default)
supabase functions deploy crypto-service

# 6. Verify deployment
curl -i --request POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/crypto-service' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"action":"encrypt","data":"test"}'
```

---

### 2. Frontend: Call Edge Function for Batch Decrypt

```typescript
// Source: Supabase client SDK + Edge Functions documentation
import { supabase } from '@/integrations/supabase/client';

interface DecryptRequest {
  ciphertext: string;
  iv: string;
}

export const batchDecrypt = async (items: DecryptRequest[]): Promise<(string | null)[]> => {
  const { data, error } = await supabase.functions.invoke('crypto-service', {
    body: {
      action: 'batch_decrypt',
      data: items
    }
  });

  if (error) {
    console.error('Batch decrypt failed:', error);
    throw error;
  }

  return data.data;
};

// Usage in profile page
const fetchProfile = async () => {
  const { data: profile } = await supabase
    .from('tenant')
    .select('contact_no, ic_no')
    .eq('user_id', user.id)
    .single();

  if (profile) {
    // Batch decrypt sensitive fields
    const [decryptedContact, decryptedIc] = await batchDecrypt([
      JSON.parse(profile.contact_no), // { ciphertext: '...', iv: '...' }
      JSON.parse(profile.ic_no)
    ]);

    setProfile({
      ...profile,
      contact_no: decryptedContact,
      ic_no: decryptedIc
    });
  }
};
```

---

### 3. Docker Compose Health Check Configuration

```yaml
# Source: https://github.com/n8n-io/n8n-hosting/blob/main/docker-compose/withPostgres/docker-compose.yml

services:
  postgres:
    image: postgres:16
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h localhost -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 5s        # Check every 5 seconds
      timeout: 5s         # Fail if check takes >5s
      retries: 10         # Retry 10 times before marking unhealthy

  n8n:
    depends_on:
      postgres:
        condition: service_healthy  # Wait for healthcheck to pass
```

**Key points:**
- `pg_isready` verifies PostgreSQL is accepting connections
- `interval: 5s` balances responsiveness vs CPU overhead
- `retries: 10` allows ~50 seconds for PostgreSQL to start (cold start + initialization)
- `condition: service_healthy` prevents n8n from starting too early (connection failures)

---

### 4. n8n Environment Variables (.env file)

```bash
# Source: https://github.com/n8n-io/n8n-hosting/blob/main/docker-compose/withPostgres/.env

# PostgreSQL Configuration
POSTGRES_USER=n8n_admin
POSTGRES_PASSWORD=your-secure-postgres-password
POSTGRES_DB=n8n_db
POSTGRES_NON_ROOT_USER=n8n_user
POSTGRES_NON_ROOT_PASSWORD=your-secure-user-password

# n8n Configuration
N8N_ENCRYPTION_KEY=your-persistent-encryption-key-here
GENERIC_TIMEZONE=Asia/Kuala_Lumpur
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-dashboard-password
```

**Security checklist:**
- [ ] Change ALL default passwords before first deployment
- [ ] Use strong passwords (min 16 characters, mixed case, numbers, symbols)
- [ ] Generate `N8N_ENCRYPTION_KEY` with `openssl rand -base64 32`
- [ ] Never commit `.env` file to git (add to `.gitignore`)
- [ ] Back up `N8N_ENCRYPTION_KEY` securely (credential loss if key lost)

---

### 5. Obtaining Google Gemini API Key

```bash
# Source: https://ai.google.dev/gemini-api/docs/api-key

# 1. Visit Google AI Studio
# URL: https://aistudio.google.com

# 2. Sign in with Google account

# 3. Click "Get API Key" → "Create API Key"

# 4. Select existing project or create new project

# 5. Copy API key (starts with "AIzaSy...")

# 6. Store in n8n credentials vault:
#    - n8n dashboard → Credentials → New Credential
#    - Type: "Generic Credential Type"
#    - Name: "Gemini API Key"
#    - Key: GOOGLE_API_KEY
#    - Value: [paste API key]

# 7. Set as environment variable (optional, for CLI access)
export GOOGLE_API_KEY=AIzaSy...
```

**Free tier limits (2026):**
- **Gemini 2.5 Flash:** 15 requests/min, 1,000 requests/day
- **Gemini 2.5 Pro:** 5 requests/min, 100 requests/day
- **Context window:** 1 million tokens
- **No credit card required**

**Sources:**
- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Free Tier Guide 2026](https://blog.laozhang.ai/en/posts/gemini-api-free-tier)

---

### 6. Finding Supabase Service Role Key

```bash
# Source: https://supabase.com/docs/guides/api/api-keys

# 1. Navigate to Supabase project dashboard
# URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

# 2. Go to Settings → API Keys

# 3. Find "service_role" key (starts with "eyJ...")
#    ⚠️ WARNING: This key bypasses Row Level Security
#    NEVER expose in client-side code or git

# 4. Copy key and store in n8n credentials vault:
#    - n8n dashboard → Credentials → New Credential
#    - Type: "HTTP Header Auth"
#    - Name: "Supabase Service Role"
#    - Header Name: apikey
#    - Header Value: [paste service role key]

# Alternative: Use new Secret Key (recommended, sb_secret_...)
# More secure than JWT-based service_role key
# Create via: API Keys dashboard → "Create new secret key"
```

**Security notes:**
- Service role key bypasses ALL Row Level Security policies
- Only use server-side (n8n workflows, Edge Functions)
- Never use in frontend code (browser DevTools would expose it)
- Consider rotating keys periodically (every 90 days)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **CryptoJS for encryption** | Web Crypto API (Deno/Node.js) | CryptoJS maintenance discontinued (2025) | Modern, promise-based, cross-platform. CryptoJS data not directly compatible. |
| **Client-side encryption with bundled keys** | Server-side encryption (Edge Functions) | Security best practice (always recommended) | Eliminates key exposure in browser. Requires network call for decrypt. |
| **SQLite for n8n persistence** | PostgreSQL for production | Long-standing n8n recommendation | Better concurrency, data integrity. SQLite still supported for development only. |
| **Docker Compose v2 syntax** | Docker Compose v3.8+ | Docker Compose 1.27.0+ (2020) | Health checks, named volumes, better restart policies. Legacy `version: '2'` deprecated. |
| **Supabase service_role JWT** | Secret Keys (`sb_secret_...`) | Announced 2025/2026 | Stronger security checks (prevents browser use), easier rotation. Legacy keys still supported. |

**Deprecated/outdated:**
- **CryptoJS:** Maintenance discontinued. Use Web Crypto API for all new projects. Existing CryptoJS data requires migration or fresh start.
- **Docker Compose v2 format:** Use v3.8+ for modern features (health checks, named volumes). v2 files still work but lack newer features.
- **Hardcoded encryption keys in code:** Always use environment variables or secrets management. Never commit keys to git.

---

## Open Questions

### 1. **Should existing CryptoJS data be migrated or wiped?**

**What we know:**
- All existing data is test data (confirmed by user)
- CryptoJS and Web Crypto API use different key derivation methods
- Migration requires complex key conversion logic

**What's unclear:**
- Exact amount of test data (number of records)
- User preference for data preservation vs simplicity

**Recommendation:**
**Fresh start (wipe and re-encrypt).** Since all data is test data and the encryption formats are incompatible, starting fresh avoids complex migration scripts and potential key conversion bugs. Re-populate test data with the new Edge Function encryption.

---

### 2. **Should n8n workflows have access to decrypted data?**

**What we know:**
- Edge Function holds the encryption key
- n8n could call Edge Function to decrypt data if workflows need it
- Minimizing key exposure is a security best practice

**What's unclear:**
- Which n8n workflows (if any) will need decrypted contact_no or ic_no
- Whether workflows only need to trigger notifications (no data access)

**Recommendation:**
**Keep encryption key exclusive to Edge Function.** If n8n workflows need decrypted data (e.g., send SMS to contact_no), they should call the Edge Function to decrypt on-demand. This minimizes the number of systems with access to the encryption key.

---

### 3. **What is the optimal batch size for batch_decrypt?**

**What we know:**
- Supabase Edge Functions have a 2-second CPU time limit
- Profile pages load 2-3 encrypted fields (contact_no, ic_no, maybe more)
- Larger batches reduce network overhead but risk CPU timeout

**What's unclear:**
- Actual decrypt performance (ms per operation)
- Whether profile pages will expand to more encrypted fields in future

**Recommendation:**
**Start with batch size of 50 items.** Profile pages typically load 2-5 fields, well under the limit. Monitor Edge Function logs for CPU usage. If timeouts occur, reduce batch size or switch to Database Functions for very large batches.

---

## Sources

### Primary (HIGH confidence)
- [n8n Docker Compose Documentation](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/)
- [n8n-hosting GitHub Repository (PostgreSQL example)](https://github.com/n8n-io/n8n-hosting/blob/main/docker-compose/withPostgres/docker-compose.yml)
- [Supabase Edge Functions Quickstart](https://supabase.com/docs/guides/functions/quickstart)
- [Supabase Edge Functions Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [Deno AES Encryption Example](https://docs.deno.com/examples/aes_encryption/)
- [Docker Desktop Windows Installation](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Google AI Studio (Gemini API)](https://aistudio.google.com)

### Secondary (MEDIUM confidence)
- [Docker Compose Restart Policies - Baeldung](https://www.baeldung.com/ops/docker-compose-restart-policies) (verified with official Docker docs)
- [n8n Credential Hygiene for Self-Hosted Reality - Medium](https://medium.com/@bhagyarana80/n8n-credential-hygiene-for-self-hosted-reality-cfa90ef1a114) (verified with official n8n docs)
- [Gemini API Free Tier 2026 Guide - LaoZhang AI Blog](https://blog.laozhang.ai/en/posts/gemini-api-free-tier) (verified with official Google AI docs)
- [Node.js Crypto Module AES-256-CBC Examples - GitHub Gists](https://gist.github.com/siwalikm/8311cf0a287b98ef67c73c1b03b47154) (verified with official Node.js docs)

### Tertiary (LOW confidence, marked for validation)
- None identified. All key findings verified with official documentation.

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH - All tools (n8n, PostgreSQL, Docker, Supabase CLI) have official documentation and production-tested examples
- **Architecture patterns:** HIGH - Docker Compose with PostgreSQL is the official n8n deployment pattern, Web Crypto API is the standard Deno encryption approach
- **Pitfalls:** MEDIUM-HIGH - Most pitfalls derived from official troubleshooting docs and community experiences (verified with official sources)

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days - stable technologies with infrequent breaking changes)

**Notes:**
- Docker Desktop for Windows requires Windows 11 build 22631+ and WSL 2
- Supabase free tier includes Edge Functions with 500K invocations/month (sufficient for FYP demo)
- n8n Docker image auto-updates to latest version (pin version tag if stability critical)
- Web Crypto API is stable (W3C standard) but implementation details may vary across Deno versions
