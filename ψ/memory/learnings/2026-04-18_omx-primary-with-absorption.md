# Keep OMX Primary, Add Buu as Capability Layer

When evolving `oh-my-codex-buu`, keep `omx` as the primary operator-facing surface unless there is an explicit decision to break compatibility. The stronger move is to preserve the proven OMX runtime body and add Buu-style absorption features behind it: quarantine, provenance, cocoons, and selective fused forms.

This avoids wasting effort on cosmetic command-surface drift and keeps reinstall/update paths straightforward. The real differentiation should come from new capabilities, not from renaming the CLI too early.

## Practical Rule

- `omx` remains the main command
- Buu stays as architecture, docs, and capability design
- Only introduce a new binary or full rebrand if the human explicitly chooses a compatibility break
