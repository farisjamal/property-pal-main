#!/bin/bash
# Finds and runs the matching test file after Claude edits a source file.
# Used as a PostToolUse hook for Edit|Write operations.
# Skips test files themselves, config files, and non-testable extensions.

# Requires jq for JSON parsing
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")
EXTENSION="${BASENAME##*.}"
NAME="${BASENAME%.*}"
DIR=$(dirname "$FILE_PATH")

# ──────────────────────────────────────────────
# Skip non-testable files
# ──────────────────────────────────────────────

# Skip if the edited file IS a test file
case "$BASENAME" in
  *.test.*|*.spec.*|*_test.*|*_spec.*|test_*|spec_*) exit 0 ;;
esac

# Skip config, style, and non-code files
case "$EXTENSION" in
  json|yaml|yml|toml|ini|cfg|env|md|txt|css|scss|less|svg|png|jpg|ico|html) exit 0 ;;
esac

# Skip files in non-testable directories
case "$FILE_PATH" in
  */.claude/*|*/public/*|*/static/*|*/assets/*|*/__mocks__/*) exit 0 ;;
esac

# ──────────────────────────────────────────────
# Find project root
# ──────────────────────────────────────────────

find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] || [ -f "$dir/pyproject.toml" ] || [ -f "$dir/Cargo.toml" ] || [ -f "$dir/go.mod" ] || [ -d "$dir/.git" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)

# ──────────────────────────────────────────────
# Strip common suffixes for test file matching
# ──────────────────────────────────────────────

# Remove secondary extensions like .component, .service, .controller
STEM="$NAME"

# ──────────────────────────────────────────────
# Search for matching test file
# ──────────────────────────────────────────────

find_test_file() {
  local stem="$1"
  local ext="$2"
  local search_dir="$3"

  # Common test file patterns, ordered by convention prevalence
  local patterns=(
    "${stem}.test.${ext}"
    "${stem}.spec.${ext}"
    "${stem}_test.${ext}"
    "${stem}_spec.${ext}"
    "test_${stem}.${ext}"
  )

  # Search in same directory first
  for pattern in "${patterns[@]}"; do
    if [ -f "${DIR}/${pattern}" ]; then
      echo "${DIR}/${pattern}"
      return
    fi
  done

  # Search in __tests__ subdirectory (Jest convention)
  for pattern in "${patterns[@]}"; do
    if [ -f "${DIR}/__tests__/${pattern}" ]; then
      echo "${DIR}/__tests__/${pattern}"
      return
    fi
  done

  # Search in parallel test directory structure
  # e.g., src/utils/foo.ts → tests/utils/foo.test.ts or test/utils/foo.test.ts
  local rel_dir="${DIR#$ROOT/}"
  # Replace leading src/ with tests/ or test/
  local test_rel_dir
  for test_root in "tests" "test" "__tests__" "spec"; do
    test_rel_dir=$(echo "$rel_dir" | sed "s|^src/|${test_root}/|;s|^lib/|${test_root}/|")
    for pattern in "${patterns[@]}"; do
      if [ -f "${ROOT}/${test_rel_dir}/${pattern}" ]; then
        echo "${ROOT}/${test_rel_dir}/${pattern}"
        return
      fi
    done
  done

  # Broad search as last resort (limited depth to stay fast)
  local found
  for pattern in "${patterns[@]}"; do
    found=$(find "$ROOT" -maxdepth 5 -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" -print -quit 2>/dev/null)
    if [ -n "$found" ]; then
      echo "$found"
      return
    fi
  done
}

TEST_FILE=$(find_test_file "$STEM" "$EXTENSION")

if [ -z "$TEST_FILE" ]; then
  # No matching test file found — not an error
  exit 0
fi

# ──────────────────────────────────────────────
# Run the test
# ──────────────────────────────────────────────

# Make test path relative to project root for cleaner output
REL_TEST="${TEST_FILE#$ROOT/}"

case "$EXTENSION" in
  # JavaScript / TypeScript
  js|jsx|ts|tsx|mjs|cjs)
    if [ -f "$ROOT/node_modules/.bin/vitest" ]; then
      cd "$ROOT" && npx vitest run "$REL_TEST" --reporter=verbose 2>&1
    elif [ -f "$ROOT/node_modules/.bin/jest" ]; then
      cd "$ROOT" && npx jest "$REL_TEST" --verbose 2>&1
    elif [ -f "$ROOT/node_modules/.bin/mocha" ]; then
      cd "$ROOT" && npx mocha "$REL_TEST" 2>&1
    else
      # Try npm test with the file path
      cd "$ROOT" && npm test -- "$REL_TEST" 2>&1
    fi
    ;;

  # Python
  py)
    if command -v pytest >/dev/null 2>&1; then
      cd "$ROOT" && pytest "$REL_TEST" -v 2>&1
    elif command -v python3 >/dev/null 2>&1; then
      cd "$ROOT" && python3 -m unittest "$REL_TEST" 2>&1
    elif command -v python >/dev/null 2>&1; then
      cd "$ROOT" && python -m unittest "$REL_TEST" 2>&1
    fi
    ;;

  # Go
  go)
    cd "$DIR" && go test -v -run "." ./... 2>&1
    ;;

  # Rust
  rs)
    cd "$ROOT" && cargo test 2>&1
    ;;
esac

exit 0
