# ADR 0001: Buu Absorption Model

## Status

Accepted

## Decision

Build `oh-my-codex-buu` on top of the `oh-my-codex` runtime body, and add a two-layer ingestion model:

- Cell layer for quarantine and digestion
- Buu layer for cocooned whole-capability absorption

## Drivers

- `oh-my-codex` already provides the right Codex-native body
- `oh-my-qwen` contributes strong philosophy and workflow concepts
- direct whole-repo copying would hide provenance and compatibility risk

## Alternatives Considered

### Port `oh-my-qwen` directly

Rejected because it starts from the wrong body and would require a large runtime translation back into Codex-native assumptions.

### Build greenfield

Rejected because it would discard mature OMX runtime work and reintroduce solved problems.

## Consequences

- safer and faster initial build
- cleaner future absorption model
- some compatibility aliases and translation layers will exist during the early phases
