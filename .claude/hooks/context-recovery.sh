#!/bin/bash
# Re-injects critical project rules after context compaction.
# Used as a SessionStart hook with matcher "compact".

find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] || [ -d "$dir/.git" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)

CONTEXT=""
BRANCH=$(git branch --show-current 2>/dev/null)
[ -n "$BRANCH" ] && CONTEXT="Branch: $BRANCH"

LAST_COMMIT=$(git log --oneline -1 2>/dev/null)
[ -n "$LAST_COMMIT" ] && CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"

CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d " ")
[ "$CHANGES" -gt 0 ] 2>/dev/null && CONTEXT="$CONTEXT | Uncommitted changes: $CHANGES files"

cat <<'"'"'RULES'"'"'
=== CONTEXT RECOVERED AFTER COMPACTION ===

PROJECT: PropertyPal — property rental platform (Vite + React + TypeScript + Tailwind + Supabase)

CRITICAL NON-NEGOTIABLES (do not ignore after compaction):

1. SUPABASE / DATABASE
   - Every new table MUST have RLS enabled + at least one policy. No exceptions.
   - Never modify existing migrations — create new ones.
   - Edge Function secrets stay in the Supabase dashboard, never in the repo.
   - Supabase client lives in src/integrations/supabase/client.ts — don't create a second one.

2. KYC FLOW (feature added 2026-04-24)
   - KYC verification is owner-only. Tenants do not go through KYC.
   - Documents stored in Supabase Storage (kyc-documents bucket), encrypted at rest.
   - Admin reviews/approves from AdminKYC page. Status: pending → verified | rejected.
   - KycGate component blocks owners from posting listings until verified.

3. GIT / BRANCH POLICY
   - Working branch: feature/dashboard-real-data. Do NOT commit directly to main.
   - Run `git fetch && git status` before any edit — check for remote divergence.
   - Never `git push --force` or skip hooks (`--no-verify`).

4. STACK CONSTRAINTS
   - Component library is shadcn/ui + Radix UI + Tailwind. Do not introduce competing UI libs.
   - Charts: Recharts only. Icons: Lucide only.
   - No Prettier config — ESLint only. Do not add a .prettierrc.
   - No test framework — do not add jest/vitest without explicit user approval.

5. CODE QUALITY
   - Named exports over default exports.
   - No dead code or commented-out blocks.
   - Never commit .env files or any secrets.

RULES

[ -n "$CONTEXT" ] && echo "" && echo "Current state: $CONTEXT"

if [ -f "$ROOT/CLAUDE.md" ]; then
  echo ""
  echo "=== CLAUDE.md (re-injected) ==="
  cat "$ROOT/CLAUDE.md"
fi

echo ""
echo "=== END CONTEXT RECOVERY ==="
exit 0
