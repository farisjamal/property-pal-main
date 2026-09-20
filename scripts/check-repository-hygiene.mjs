import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
}).split("\0").filter(Boolean);

const forbiddenPaths = [
  {
    test: (path) => /(^|\/)\.env($|\.)/.test(path) && path !== ".env.example",
    reason: "environment files must not be tracked",
  },
  {
    test: (path) => path.startsWith(".vercel/"),
    reason: "local Vercel metadata must not be tracked",
  },
  {
    test: (path) => path.startsWith(".claude/"),
    reason: "local agent configuration must not be tracked",
  },
  {
    test: (path) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(path),
    reason: "private key or certificate material must not be tracked",
  },
  {
    test: (path) => /(^|\/)(credentials|secrets)[^/]*\.json$/i.test(path),
    reason: "credential files must not be tracked",
  },
];

const secretPatterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{20,}/],
  ["OpenAI-style secret key", /sk-[A-Za-z0-9]{20,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["live Stripe secret", /(?:sk|rk)_live_[0-9A-Za-z]{16,}/],
  ["Resend API key", /re_[0-9A-Za-z_-]{16,}/],
  ["database URL with password", /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/],
];

const violations = [];

for (const path of trackedFiles) {
  for (const rule of forbiddenPaths) {
    if (rule.test(path)) violations.push(`${path}: ${rule.reason}`);
  }

  if (path === "package-lock.json") continue;

  let contents;
  try {
    contents = readFileSync(path);
  } catch {
    continue;
  }

  if (contents.includes(0)) continue;
  const text = contents.toString("utf8");

  for (const [name, pattern] of secretPatterns) {
    if (pattern.test(text)) violations.push(`${path}: possible ${name}`);
  }
}

if (violations.length > 0) {
  console.error("Repository hygiene check failed:\n");
  for (const violation of [...new Set(violations)].sort()) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Repository hygiene check passed (${trackedFiles.length} tracked files scanned).`);
