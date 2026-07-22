# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0, breaking changes are signalled by a minor version bump.

## [0.1.0] - 2026-07-22

First publish. The shared substrate for the RCF Lite tooling suite, extracted from `@stravica-ai/rcf-build-lite` so that build and verify read and write the same RCF chain and speak the same MCP protocol shell.

### Added

- **`@stravica-ai/rcf-lite-core/store`** — the RCF-chain store (read + write) for the on-disk document chain, extracted from build-lite ([#47](https://github.com/Stravica/rcf-lite/pull/47)).
- **`@stravica-ai/rcf-lite-core/errors`** — the structured `RcfError` type shared across the suite ([#47](https://github.com/Stravica/rcf-lite/pull/47)).
- **`@stravica-ai/rcf-lite-core/mcp-shell`** — the RCF-agnostic MCP protocol shell both tools mount their toolsets on ([#47](https://github.com/Stravica/rcf-lite/pull/47)).
- **`@stravica-ai/rcf-lite-core/isolation`** — the §7.3 verifier isolation-env recipe: the environment a fresh-context `rcf-verify` subprocess is spawned under, so it starts cold with zero build context ([#48](https://github.com/Stravica/rcf-lite/pull/48)).
