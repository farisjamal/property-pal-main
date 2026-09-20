# PropertyPal documentation

This directory separates current operating guidance from historical implementation
records. The source code, migrations, and deployed configuration remain the final source
of truth when a historical document differs from current behaviour.

## Current reference

| Document | Purpose |
| --- | --- |
| [System diagrams](DIAGRAMS.md) | Entity relationships and user flows |
| [Security implementation](SECURITY_IMPLEMENTATION.md) | Implemented controls, deployment notes, and verification checks |
| [Contributing guide](../CONTRIBUTING.md) | Local setup, development workflow, and review checklist |
| [Security policy](../SECURITY.md) | Vulnerability reporting and secret-handling rules |
| [n8n setup](../n8n/SETUP.md) | Optional event-driven workflow setup |
| [n8n reminder setup](../n8n/REMINDER_SETUP.md) | Optional scheduled-reminder workflow setup |

## Verification records

- [Registration fix summary](REGISTRATION_FIX_SUMMARY.md)
- [Registration fix verification](REGISTRATION_FIX_VERIFICATION.md)

These documents describe a specific migration and verification exercise. Review the
latest migrations before applying any command from a historical record.

## Design and implementation history

The files under `superpowers/specs/` and `superpowers/plans/` capture past design decisions
and implementation plans. They are retained for traceability, not as current setup guides.

## Documentation rules

- Keep setup instructions reproducible and free of machine-specific paths.
- Use placeholders for project identifiers, URLs, account names, and credentials.
- Never paste `.env` contents, private keys, service-role keys, database passwords, or
  provider API keys into documentation.
- State whether a document is current guidance or a historical record.
- Update this index whenever a maintained document is added, renamed, or removed.
