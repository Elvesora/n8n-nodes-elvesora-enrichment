# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Elvesora Enrichment credential and company-domain enrichment node.
- Non-billable credential verification through `/api/v1/enrichment/ping`.
- Simplified and complete API response modes.
- Normal workflow output for HTTP 400 business results.
- Optional 24-hour API idempotency support and conflicting-key validation.
- Sequential multi-item execution, item pairing, and Continue On Fail support.
- Fixed production API origin, redirect blocking, and a 130-second request timeout.
- Package documentation, contribution guidance, security policy, and an importable example workflow.
