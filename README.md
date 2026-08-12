# Elvesora Enrichment for n8n

Use the Elvesora Company Enrichment API in n8n workflows. The node accepts a company
website domain and returns either an enriched company profile or a non-billable business
result such as `NOT_FOUND`.

This package is an n8n community node maintained by Elvesora. It is not an n8n built-in
node, and this documentation does not claim n8n verification or endorsement.

## Features

- Enrich one company domain for every incoming n8n item.
- Authenticate with an Elvesora team API token stored as an n8n credential.
- Verify credentials without consuming an enrichment credit.
- Return a concise, simplified result or the complete API response.
- Preserve HTTP 400 business outcomes as workflow data instead of failing the node.
- Support Elvesora's 24-hour idempotency contract for safe request replay.
- Preserve n8n item pairing and support Continue On Fail.
- Use a fixed production API origin and reject redirects.

## Installation

Install the package as an n8n community node using this package name:

```text
n8n-nodes-elvesora-enrichment
```

Follow the [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
for the installation method supported by your n8n deployment. Community package availability
depends on the configuration and policies of the n8n instance.

Restart self-hosted n8n after installation if your deployment does not reload community nodes
automatically.

## Compatibility

The minimum supported n8n version is 2.16.0. Compatibility has been verified with:

- n8n 2.16.0: package discovery and complete node and credential UI rendering in the editor.
- n8n 2.34.5: clean community-package installation, registration, startup, and health check.

Older n8n versions have not been tested and are not claimed as supported.

## Credentials

1. Sign in to [Elvesora Enrichment](https://enrichment.elvesora.com).
2. Open **Integrations**, then **API**.
3. Generate or copy the active team API token.
4. In n8n, create an **Elvesora Enrichment API** credential.
5. Paste only the token value into **API Token**. Do not add the `Bearer` prefix.
6. Save the credential. n8n tests it with the non-billable
   `GET https://enrichment.elvesora.com/api/v1/enrichment/ping` endpoint.

The API origin is intentionally fixed to:

```text
https://enrichment.elvesora.com/api/v1
```

The credential cannot redirect requests to a custom host.

## Use the node

1. Add **Elvesora Enrichment** to a workflow.
2. Select the Elvesora credential.
3. Enter a **Domain**, for example `example.com`.
4. Choose whether to enable **Simplify Response**.
5. Optionally add an **Idempotency Key** under **Options**.
6. Execute the workflow.

### Parameters

| Parameter                 | Required | Default | Behavior                                                                                                     |
| ------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Domain                    | Yes      | Empty   | Company website domain without a protocol or path. The node trims and lowercases it. Maximum 255 characters. |
| Simplify Response         | Yes      | `true`  | Returns selected commonly used fields. Disable it to return the complete API payload.                        |
| Options > Idempotency Key | No       | Empty   | Stable key for one logical request. Maximum 255 characters; control characters are rejected.                 |

The node sends one request for each incoming item, in input order, with a 130-second client
timeout. It does not perform hidden or automatic retries.

## Output modes

### Simplified output

With **Simplify Response** enabled, the node returns available values from this set:

- `result_type`
- `message`
- `idempotency_status`
- `company_name`
- `domain`
- `website_url`
- `industry`
- `employee_count`
- `hq_country`
- `credits_remaining`

Fields that are absent from the API response are omitted. A business result still includes its
status, for example `result_type: NOT_FOUND`, and its API message.

### Raw output

Disable **Simplify Response** when downstream steps need the complete company profile, credit metadata,
or the exact API response. A successful response has this general shape:

```json
{
	"success": true,
	"result_type": "ENRICHED",
	"message": "Company enrichment completed successfully",
	"data": {
		"result_type": "ENRICHED",
		"company_name": "Example Company",
		"domain": "example.com"
	},
	"credits": {
		"limit": 100,
		"used": 6,
		"remaining": 94,
		"consumed_by_request": 1,
		"period_started_at": "2026-08-01",
		"period_ends_at": "2026-09-01"
	},
	"remaining": 94,
	"limit": 100
}
```

The company `data` object can contain additional fields. Treat the example as illustrative rather
than as a fixed response schema.

When the API includes an `Idempotency-Status` response header, a response emitted as raw workflow
data also includes a lowercase `idempotency_status` field. Replays use `replayed`; a `conflict`
value can appear in Continue On Fail error output.

## Business outcomes and errors

Elvesora uses HTTP 400 for understood, non-billable domain outcomes. The node deliberately
returns those responses as normal output so a workflow can branch on `result_type`.

Known business result types include:

- `NOT_FOUND`
- `FREE_EMAIL_PROVIDER`
- `DISPOSABLE`
- `INVALID_DOMAIN`

Only `ENRICHED` consumes an enrichment credit. Inspect `credits.consumed_by_request` in raw mode
when billing details matter.

| HTTP status               | Node behavior                                   | Retry guidance                                       |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| 200                       | Returns data                                    | No retry needed                                      |
| 400                       | Returns the business result as data             | Do not retry automatically                           |
| 401                       | Fails with an authentication error              | Check or regenerate the API token                    |
| 409                       | Fails with an idempotency conflict              | Use the original domain or a new logical-request key |
| 422                       | Fails with a request validation error           | Correct the domain or input expression               |
| 429 with `LIMIT_EXCEEDED` | Fails because the credit allowance is exhausted | Do not retry; wait for renewal or change plan        |
| 5xx                       | Fails as temporarily unavailable                | Retry later only with the same idempotency key       |

If **Continue On Fail** is enabled, genuine HTTP errors are returned for the affected item and
later input items continue. HTTP 400 business results are normal output regardless of that setting.

## Idempotency and retry safety

An idempotency key is optional, but it is strongly recommended whenever a request might be
retried after a timeout, lost connection, or unknown execution result.

- Reuse the same key with the same normalized domain to replay the stored response without
  consuming another credit.
- The API retains replayable responses for 24 hours.
- Reusing a key with a different domain returns HTTP 409.
- The node rejects one key mapped to different normalized domains within the same execution.
- A replayed response can contain the credit snapshot from the original request.
- A new random key is a new logical request and does not protect against duplicate credit use.

The node does not generate an idempotency key and does not retry automatically. If n8n's
**Retry On Fail** setting or custom workflow logic is used, provide a key whose resolved value
remains unchanged for every attempt of that logical request.

## Example workflow

Import [`Elvesora-company-enrichment.workflow.json`](examples/Elvesora-company-enrichment.workflow.json)
from this repository into n8n, select your credential, and execute it manually. The example uses
`example.com` and a fixed demonstration idempotency key. Change the domain and key together when
adapting it to a real workflow.

## API documentation

- [Elvesora Enrichment OpenAPI document](https://enrichment.elvesora.com/docs/enrichment-openapi.yaml)
- [Elvesora Enrichment Postman collection](https://enrichment.elvesora.com/docs/elvesora-enrichment.postman_collection.json)

## Development

Use Node.js 22.22.x or the current Node.js 24 LTS line. Those are the versions verified in CI;
unsupported non-LTS or later development runtimes may require native build tools for n8n's
development-only dependencies.

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security and support

- Report security issues privately as described in [SECURITY.md](SECURITY.md).
- Report reproducible package bugs through
  [GitHub Issues](https://github.com/Elvesora/n8n-nodes-elvesora-enrichment/issues).
- For Elvesora account or API service help, contact `support@elvesora.com`.

Never include API tokens, credential exports, or unredacted request headers in an issue.

## License

[MIT](LICENSE.md)
