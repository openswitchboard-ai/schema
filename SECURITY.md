# Security

Report a vulnerability by email to info@openswitchboard.ai rather than in a
public issue. Include what you found, how to reproduce it, and what an
attacker could get from it. You will get a human reply within a few days.

The hosted service and its server code are covered by the server repository's
security policy:
https://github.com/openswitchboard-ai/server/blob/main/SECURITY.md. This
repository is in scope too: a schema, fixture or SDK change that lets a
listing carry personal data past validation, or a redaction helper that leaks
a counterparty's private field, is a security bug here.
