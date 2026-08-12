# Contributing

Thank you for helping improve the Elvesora Enrichment community node for n8n.

## Before you start

- Search existing GitHub issues before opening a new one.
- Use an issue to discuss behavior changes that alter credentials, API requests, billing,
  idempotency, or workflow output.
- Never include an Elvesora API token, n8n credential export, session cookie, or unredacted
  authorization header in an issue, test fixture, screenshot, commit, or pull request.
- Report suspected vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Development setup

Requirements:

- Node.js 22.22.x or Node.js 24 LTS
- npm
- A local n8n development environment for interactive node testing

Install dependencies and run the verification commands:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm pack --dry-run
```

Do not use live customer tokens in automated tests. Mock API responses for success, business
outcomes, validation errors, exhausted credits, idempotency conflicts, malformed responses,
timeouts, and server failures.

## Implementation expectations

Changes must preserve these API and workflow invariants unless the production API contract and
documentation are intentionally updated at the same time:

- Authentication uses an n8n credential and `httpRequestWithAuthentication`.
- Requests go only to the fixed Elvesora Enrichment production API origin.
- Redirects remain disabled.
- Company enrichment uses `POST /api/v1/enrichment/company` with a JSON `domain` value.
- HTTP 400 domain business outcomes remain normal node output.
- Only `ENRICHED` is documented as consuming a credit.
- The node does not add hidden automatic retries.
- Retry guidance always requires reuse of the same idempotency key.
- Multiple items retain `pairedItem` linkage and deterministic input order.
- Continue On Fail remains item-scoped.
- Raw mode preserves the complete API response.
- Errors and logs must not expose bearer tokens.

Prefer n8n's public node APIs and types. Do not access environment variables, the filesystem,
process execution, or unencrypted custom secret stores from runtime node code.

## Documentation changes

Update the README when user-visible parameters, output fields, error handling, or prerequisites
change. Add an entry to `CHANGELOG.md` for every release-worthy change. Keep examples free of
credentials and personal or customer data.

## Pull requests

A pull request should:

1. Explain the user-visible problem and the chosen solution.
2. Link any relevant issue.
3. Include focused automated tests.
4. Confirm all verification commands pass.
5. Update documentation and the changelog when behavior changes.
6. Avoid unrelated formatting or generated-file changes.

Package versioning, npm publication, tags, and release notes are handled by project maintainers.
Do not publish test builds under the production package name.

## Maintainer release process

Releases must come from the public GitHub repository through
`.github/workflows/publish.yml`. Do not run `npm publish` from a local machine: n8n requires
GitHub Actions provenance for community-node submissions.

Trusted Publishing setup:

1. Make the GitHub repository public and protect its default branch.
2. Configure npm Trusted Publishing for the `Elvesora/n8n-nodes-elvesora-enrichment`
   repository and the `publish.yml` workflow, with no GitHub environment selected and
   `npm publish` selected as the allowed action.
3. Do not configure an `NPM_TOKEN` GitHub secret. The workflow publishes through short-lived
   GitHub OIDC credentials and fails unless its npm version supports Trusted Publishing.

For each release, start from a clean, reviewed `main` branch and run `npm run release` locally.
The n8n release command updates the version and changelog, creates and pushes the Git tag, and
the tag triggers the GitHub workflow. The workflow repeats all verification gates, publishes with
provenance, waits for npm visibility, and requires the n8n community-package scanner to print its
success result.
