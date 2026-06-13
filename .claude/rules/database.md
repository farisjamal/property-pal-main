---
paths:
  - "supabase/migrations/**"
  - "supabase/functions/**"
  - "supabase/scripts/**"
---

# Database Migrations

- **Never modify an existing migration** — always create a new migration for changes. Existing migrations may have already run in production.
- Every migration must be reversible — implement both up/forward and down/rollback where possible.
- Migration filenames follow timestamp prefix — new migrations go at the end (`YYYYMMDDHHMMSS_description.sql`).
- Never seed production data in migration files — use `supabase/scripts/` for one-off data operations.
- Never drop columns or tables without first confirming the data is no longer needed.
- Add indexes in their own migration, not bundled with schema changes.
- Every new table must have Row Level Security (RLS) enabled and at least one policy — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is not optional.
- Test migrations against the local Supabase instance (`supabase db reset`) before applying to production.
