# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-08-12

### Added

- Added Simplified, Raw, and Selected Fields output modes when the node is used as an AI Agent tool.
- Added granular company, firmographic, idempotency, and credit-field selection while always preserving the domain identifier.

### Changed

- Made node version 2 the default while preserving the version 1 `simplify` setting for existing workflows.
- Aligned the normal-workflow `Simplify` label with n8n's current UX guideline.
- Updated package validation, automated tests, documentation, and the importable workflow for the version 2 behavior.

## [0.1.2] - 2026-08-12

### Changed

- Added a CI smoke test that executes the compiled node entry point and validates its request and business-result output contract.
- Made the post-release CI package check independent of whether the current version already exists on npm.
- Documented the tested n8n compatibility floor and verification versions.
- Pinned GitHub Actions to immutable verified commits, removed persisted checkout credentials, and disabled release dependency caching.
- Kept dependency vulnerability alerts enabled while disabling automated dependency branches and pull requests to preserve the direct-to-main workflow.
- Switched npm publication to OIDC-only Trusted Publishing so no long-lived npm credential is exposed to the release job.
- Added bounded retries around the required post-publication n8n security scan to tolerate transient registry or network failures.

## [0.1.1] - 2026-08-12

### Changed

- Enforced LF line endings through `.gitattributes` so verification is reproducible on Windows.
- Added Windows to the Node.js 22.22 and 24 CI verification matrix.
- Updated the n8n CLI and release toolchain to current stable, patched versions.
- Updated GitHub Actions to their Node.js 24-based major versions and pinned releases to Node.js 24.
- Made the official Elvesora Enrichment artwork canvas square for n8n icon compatibility.
- Normalized the npm repository URL to avoid publication-time metadata correction.
- Aligned the npm description with the public GitHub repository metadata.
- Aligned the node subtitle and response-simplification label with n8n UX conventions.
- Declared the Node.js 22.22 and 24 runtime lines that are continuously verified in CI.

## [0.1.0] - 2026-08-12

### Added

- Initial Elvesora Enrichment credential and company-domain enrichment node.
- Non-billable credential verification through `/api/v1/enrichment/ping`.
- Simplified and complete API response modes.
- Normal workflow output for HTTP 400 business results.
- Optional 24-hour API idempotency support and conflicting-key validation.
- Sequential multi-item execution, item pairing, and Continue On Fail support.
- Fixed production API origin, redirect blocking, and a 130-second request timeout.
- Package documentation, contribution guidance, security policy, and an importable example workflow.
