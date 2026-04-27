# arra-oracle-skills-cli Architecture

## What it is

`arra-oracle-skills-cli` is a Bun-based CLI that installs Oracle skills into multiple AI coding agents. Its core job is packaging, discovery, profile resolution, and writing skills/commands/plugins into agent-specific target directories.

## Layout

```text
arra-oracle-skills-cli/
├── src/cli/
│   ├── index.ts          # Commander entrypoint
│   ├── installer.ts      # Main install/uninstall/list logic
│   ├── skill-source.ts   # Filesystem vs compiled-VFS abstraction
│   ├── agents.ts         # Agent metadata / install targets
│   ├── fs-utils.ts       # File operations wrapper
│   └── types.ts          # Shared CLI types
├── src/skills/           # Skill source directories with SKILL.md
├── src/profiles.ts       # standard / full / lab profile resolution
├── scripts/              # setup/compile/build support
├── docs/                 # blog, learnings, retrospectives
└── hooks/                # agent hook integration
```

## Entry points

- `src/cli/index.ts`
  - Bun shebang entrypoint
  - guards against plain Node execution unless compiled
  - registers Commander subcommands
- package bin:
  - `arra-oracle-skills -> ./src/cli/index.ts`

## Core abstractions

### 1. Installer as orchestrator

`installer.ts` is the operational heart:
- discovers skills
- resolves profile vs explicit skill filters
- resolves agent target directories
- cleans up stale previously-installed skills
- copies skill directories
- injects installer/version metadata into `SKILL.md`
- installs hook-capable skills as plugins when needed

This is useful as a pattern because it treats skills as distributable units with metadata mutation at install time rather than immutable source-only files.

### 2. Skill source abstraction

`skill-source.ts` is the most reusable design seam in the repo.

It provides one interface for:
- dev mode: read skills from disk
- compiled mode: read skills from generated VFS

That abstraction allows the same installer logic to work whether running from source or as a compiled binary. For OMX/Buu, this is relevant if absorb/export/import ever needs to ship skill bundles or form bundles without requiring raw source trees at runtime.

### 3. Profiles as stable policy

`src/profiles.ts` keeps profile logic deliberately minimal:
- `standard`: explicit include list
- `full`: exclude `labOnly`
- `lab`: everything

This is a strong pattern because it avoids over-modeling. The profile layer is a policy filter over discovered skills, not a second package manager.

## Dependencies

From `package.json`:
- `commander` for CLI structure
- `@clack/prompts` for interactive UX
- `mqtt` for some communication tooling
- Bun runtime as the primary execution environment

## Important architectural ideas for OMX/Buu

1. **Installer and runtime should be separate concerns**
   - This repo focuses on installation/distribution, not execution runtime orchestration.

2. **Use abstract source loaders**
   - `skill-source.ts` is a strong precedent for making the same feature work from source or packaged state.

3. **Profiles should stay simple**
   - Include/exclude beats over-engineered feature matrices when the real value is predictable installation behavior.

4. **Metadata injection at distribution time is powerful**
   - Installing versioned skill files with source metadata gives traceability without forcing source files themselves to stay environment-specific.
