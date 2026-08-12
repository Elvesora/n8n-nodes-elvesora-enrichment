# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
