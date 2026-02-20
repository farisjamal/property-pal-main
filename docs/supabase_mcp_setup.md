# Supabase MCP Server Setup Guide

This guide will help you connect the Supabase MCP (Model Context Protocol) server to enable AI interaction with your PropertyPal Supabase backend.

## Prerequisites

- Node.js installed (v18 or higher)
- Access to your Supabase project
- Claude Desktop or compatible MCP client

## Your Supabase Credentials

**Project ID:** `<YOUR_PROJECT_ID>`

**Project URL:** `<YOUR_SUPABASE_URL>`

**Anon Key (Public):** `<YOUR_SUPABASE_ANON_KEY>`

## Setup Methods

### Method 1: Claude Desktop Configuration (Recommended)

#### Step 1: Install Supabase MCP Server

```bash
npm install -g @modelcontextprotocol/server-supabase
```

#### Step 2: Configure Claude Desktop

1. **Locate Claude Desktop config file:**
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. **Add Supabase MCP server configuration:**

Open the config file and add this to the `mcpServers` section:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase",
        "<YOUR_SUPABASE_URL>",
        "<YOUR_SUPABASE_ANON_KEY>"
      ]
    }
  }
}
```

**If you already have other MCP servers configured, your config might look like:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\TUF\\OneDrive\\FYP\\property-pal-main"]
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase",
        "<YOUR_SUPABASE_URL>",
        "<YOUR_SUPABASE_ANON_KEY>"
      ]
    }
  }
}
```

3. **Restart Claude Desktop** to apply the changes.

#### Step 3: Verify Connection

In Claude Desktop, you should now be able to:
- Query database tables
- Read table schemas
- Execute queries
- View audit logs

**Test with these commands:**
```
"Can you list all tables in my Supabase database?"
"Show me the schema for the tenant table"
"How many users are in the audit_log table?"
```

---

### Method 2: Environment Variable Configuration (Alternative)

If you prefer using environment variables:

1. **Set environment variables:**

```bash
# Windows (PowerShell)
$env:SUPABASE_URL = "<YOUR_SUPABASE_URL>"
$env:SUPABASE_ANON_KEY = "<YOUR_SUPABASE_ANON_KEY>"

# Linux/macOS
export SUPABASE_URL="<YOUR_SUPABASE_URL>"
export SUPABASE_ANON_KEY="<YOUR_SUPABASE_ANON_KEY>"
```

2. **Update Claude Desktop config to use environment variables:**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

---

## Available MCP Tools

Once connected, the Supabase MCP server provides these tools:

### 1. **supabase_list_resources**
Lists all available database resources (tables, views, functions)

**Example usage:**
```
"List all tables in my database"
"Show me all available resources"
```

### 2. **supabase_read_resource**
Reads the schema and metadata of a specific resource

**Example usage:**
```
"Show me the schema for the audit_log table"
"What columns does the tenant table have?"
"Describe the property_owner table"
```

### 3. **supabase_execute_query**
Executes SQL queries on your database

**Example usage:**
```
"How many tenants are in the database?"
"Show me the last 10 audit log entries"
"Count the number of properties by owner"
```

**⚠️ Security Note:** The anon key has limited permissions based on your RLS policies. This is safe for read operations on non-sensitive data.

---

## Security Considerations

### Row Level Security (RLS)

Your database has RLS enabled on all tables. The MCP server uses the **anon key**, which means:

✅ **Safe to query:**
- Public tables (properties, users - basic info)
- Your own user data (when authenticated)
- Audit logs (if you're an admin)

❌ **Cannot access:**
- Other users' sensitive data (protected by RLS)
- Encrypted fields (IC numbers, contact numbers) - will show as ciphertext
- Admin-only data (unless you're logged in as admin)

### Best Practices

1. **Never share your anon key publicly** - It's included in this doc for setup only
2. **Use service_role key ONLY server-side** - Never expose in client or MCP
3. **RLS policies protect your data** - Even with the anon key, access is restricted
4. **Encrypted data stays encrypted** - MCP can't decrypt your IC numbers or contact info

---

## Useful Queries for PropertyPal

### Database Statistics

```sql
-- Count users by role
SELECT r.role, COUNT(ur.user_id) as user_count
FROM roles r
LEFT JOIN user_roles ur ON r.role_id = ur.role_id
GROUP BY r.role;

-- Count properties by status
SELECT status, COUNT(*) as count
FROM property
GROUP BY status;

-- Recent audit log activity
SELECT action_type, resource_type, COUNT(*) as event_count
FROM audit_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY action_type, resource_type
ORDER BY event_count DESC;
```

### Security Monitoring

```sql
-- Failed login attempts (last 24 hours)
SELECT user_email, COUNT(*) as failed_attempts, MAX(timestamp) as last_attempt
FROM audit_log
WHERE action_type = 'FAILED_LOGIN'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_email
ORDER BY failed_attempts DESC;

-- Sensitive data access (today)
SELECT user_email, resource_type, COUNT(*) as access_count
FROM audit_log
WHERE action_type = 'READ'
AND metadata ? 'fields_accessed'
AND timestamp::date = CURRENT_DATE
GROUP BY user_email, resource_type;

-- Recent user deletions
SELECT description, timestamp, user_email
FROM audit_log
WHERE action_type = 'DELETE'
AND resource_type IN ('TENANT', 'OWNER')
ORDER BY timestamp DESC
LIMIT 10;
```

### Application Metrics

```sql
-- Active appointments by status
SELECT status, COUNT(*) as count
FROM appointment
GROUP BY status;

-- Properties by type and location
SELECT property_type, location, COUNT(*) as count
FROM property
GROUP BY property_type, location
ORDER BY count DESC;

-- User registration trend (last 30 days)
SELECT DATE(created_at) as signup_date, COUNT(*) as signups
FROM tenant
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY signup_date;
```

---

## Troubleshooting

### Connection Issues

**Problem:** MCP server won't connect

**Solutions:**
1. Verify Supabase project is active (visit project URL in browser)
2. Check that anon key hasn't been rotated in Supabase dashboard
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for errors

**Logs location:**
- Windows: `%APPDATA%\Claude\logs\`
- macOS: `~/Library/Logs/Claude/`
- Linux: `~/.config/Claude/logs/`

### Permission Errors

**Problem:** "Permission denied" or "RLS policy violation"

**Solutions:**
1. Verify you're querying tables you have access to
2. Check RLS policies in Supabase dashboard
3. Use admin authentication if you need elevated access
4. Remember: Encrypted fields will show as ciphertext

### Query Errors

**Problem:** SQL query syntax errors

**Solutions:**
1. Use Supabase SQL Editor to test queries first
2. Check PostgreSQL 14 syntax compatibility
3. Verify table and column names exist
4. Use single quotes for string literals

---

## Advanced Configuration

### Using Service Role Key (Server-Side Only)

**⚠️ WARNING:** Service role key bypasses RLS. Use ONLY for:
- Server-side scripts
- Automated admin tasks
- Database migrations

**NEVER** use service role key in:
- Client applications
- MCP servers (use anon key instead)
- Version control

To get your service role key:
1. Go to Supabase Dashboard
2. Settings > API
3. Copy "service_role" key (not shown in this doc for security)

---

## Verification Checklist

After setup, verify these work:

- [ ] `supabase_list_resources` returns table list
- [ ] `supabase_read_resource` shows table schema
- [ ] Can query public tables (properties, users)
- [ ] RLS prevents accessing other users' data
- [ ] Audit logs are visible (if admin)
- [ ] Encrypted fields show as ciphertext (expected)

---

## Next Steps

1. **Set up the MCP server** using Method 1 or Method 2
2. **Restart Claude Desktop**
3. **Test the connection** with "List all tables in my database"
4. **Explore your data** with the example queries above
5. **Monitor security** using audit log queries

---

## Support Resources

- **Supabase MCP Server Docs:** https://github.com/modelcontextprotocol/servers/tree/main/src/supabase
- **Supabase Dashboard:** <YOUR_SUPABASE_URL>
- **PropertyPal Security Guide:** [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)
- **Database Schema Reference:** [CLAUDE.md](CLAUDE.md)

---

## Security Reminder

🔒 **This document contains sensitive credentials:**
- Do NOT commit to version control
- Do NOT share publicly
- Store securely (password manager recommended)
- Rotate keys if exposed

The anon key is safe for client use but should still be protected.

---

**Last Updated:** January 17, 2026
**Project:** PropertyPal - Property Management Platform
**Supabase Project ID:** <YOUR_PROJECT_ID>
