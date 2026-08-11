# Security Policy

## Supported versions

Security fixes are applied to the latest published version. Users should update to the newest
available release before reporting an issue that may already be resolved. Unreleased development
code on the default branch can change without notice.

## Report a vulnerability

Do not open a public GitHub issue for a suspected vulnerability.

Email `support@elvesora.com` with the subject:

```text
[SECURITY] n8n-nodes-elvesora-enrichment
```

Include only the information needed to reproduce and assess the issue:

- Affected package version and n8n version
- Deployment type, such as n8n Cloud or self-hosted
- Clear reproduction steps or a minimal proof of concept
- Expected and observed behavior
- Security impact
- Relevant logs with credentials, tokens, cookies, domains, and customer data removed

Do not send a working API token. If a token may have been exposed, regenerate it immediately in
Elvesora under **Integrations > API**, replace the credential in n8n, and stop sharing the old value.

Please allow the maintainers time to investigate before publishing technical details. The project
does not promise a fixed response or remediation time.

## Security boundaries

This package stores the API token as an n8n credential and sends it as a bearer token only to the
fixed Elvesora Enrichment production API origin. Redirects are disabled. Protection of credentials
at rest, access to executions, and retention of workflow data are controlled by the n8n deployment
and its configuration.

Workflow results can contain company data and account credit metadata. Restrict access to n8n
executions and redact output before sending it to logs, tickets, chat systems, or other third-party
services.

For service availability, billing, abuse, or account-access incidents that are not vulnerabilities
in this package, contact `support@elvesora.com`.
