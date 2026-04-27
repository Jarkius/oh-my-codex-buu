# arra-oracle-skills-cli Code Snippets

## 1. Bun runtime guard in the CLI entrypoint

`src/cli/index.ts` starts by checking whether it is running under Bun or compiled mode.

Why it matters:
- gives a clearer failure mode than mysterious runtime errors
- separates source-runtime expectations from compiled-distribution expectations

Pattern:
- detect compiled mode via a build-time define
- only enforce Bun presence when not compiled

This is a good pattern for OMX/Buu if future packaged lanes need a different runtime from development mode.

## 2. Commander-based command registration

The CLI entrypoint stays thin:
- import package version
- create `program`
- register commands one by one
- parse

This keeps command implementations isolated and makes discoverability easier.

For OMX/Buu, the equivalent lesson is to keep `src/cli/index.ts` as the router and keep feature-specific behavior in dedicated command modules like `adapt.ts` and `absorb.ts`.

## 3. Source abstraction for skills

`src/cli/skill-source.ts` exposes:
- `discoverSkills()`
- `readSkillFile()`
- `listSkillFiles()`
- `writeSkillToDir()`
- `skillHasHooks()`

Why it is interesting:
- dev mode and compiled mode share the same installer logic
- only the source backend changes

This is probably the most reusable snippet-level insight from the repo.

## 4. Install-time metadata mutation

`installer.ts` modifies installed `SKILL.md` files to add:
- installer version
- origin
- scoped description markers

That means the installed artifact becomes self-describing.

For OMX/Buu, this suggests a future pattern:
- exported `seed` / `reloaded` packages should stamp origin/version/policy metadata directly into generated artifacts

## 5. Profile resolution is intentionally low-complexity

`src/profiles.ts`:
- defines `labOnly`
- maps profiles via include/exclude
- resolves a final skill list

This works because the model is easy to reason about.

For OMX/Buu, named form profiles like:
- `matrix-core`
- `cell-gate`
- `oracle-commander`
- `full-power`

should probably stay at roughly this complexity unless real runtime pressure proves they need more.

## 6. Stale install cleanup before copy

`installer.ts` removes orphaned previously-installed skills that:
- were installed by the same tool
- no longer exist in source

This is a healthy lifecycle pattern:
- track ownership
- clean only owned artifacts
- move to a recovery/trash location when possible

That ownership-aware cleanup is directly relevant to OMX/Buu import/apply/package flows.
