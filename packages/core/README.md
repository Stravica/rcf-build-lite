# @stravica-ai/rcf-lite-core

Shared internals for the **RCF Lite** tooling suite. This package is the common
substrate consumed by [`@stravica-ai/rcf-build-lite`](https://www.npmjs.com/package/@stravica-ai/rcf-build-lite)
and [`@stravica-ai/rcf-verify-lite`](https://www.npmjs.com/package/@stravica-ai/rcf-verify-lite),
extracted so both tools read and write the same RCF chain the same way and speak
the same MCP protocol shell.

> **You almost certainly don't install this directly.** It is a workspace
> dependency of the build and verify tools and is pulled in transitively. Install
> `@stravica-ai/rcf-build-lite` (and `@stravica-ai/rcf-verify-lite`) instead.

## What's inside

Consumed via subpath exports — nothing is exported from the package root:

| Export | Purpose |
|---|---|
| `@stravica-ai/rcf-lite-core/store` | The RCF-chain store: read + write access to the document chain (PRD → REQ → US → AC → TS → TC and friends) on disk. |
| `@stravica-ai/rcf-lite-core/errors` | The structured `RcfError` type — typed, coded errors shared across the suite. |
| `@stravica-ai/rcf-lite-core/mcp-shell` | The RCF-agnostic MCP protocol shell that both tools mount their toolsets on. |
| `@stravica-ai/rcf-lite-core/isolation` | The verifier isolation-env recipe (§7.3): the environment a fresh-context `rcf-verify` subprocess is spawned under, so it starts cold with zero build context. |

## Compatibility

- Node.js **>= 24**.
- Versioned with the rest of the suite; pre-1.0, breaking changes are signalled
  by a minor version bump. Pin accordingly if you depend on it directly.

## License

Apache-2.0. See [LICENSE](./LICENSE).
