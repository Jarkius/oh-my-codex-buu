# arra-oracle-skills-cli Quick Reference

## One-line summary

A Bun-first multi-agent skill installer that packages Oracle skills, profiles, commands, and plugin-capable hook bundles for 18 coding agents.

## Install examples

From README:

```bash
npx arra-oracle-skills@3.6.1 install -g -y --agent claude-code
npx arra-oracle-skills@3.6.1 install -g -y -p full --agent claude-code
npx arra-oracle-skills@3.6.1 install -g -y --agent codex --with-commands
```

## Main concepts

- **Skills**: directories under `src/skills/*`
- **Profiles**: `standard`, `full`, `lab`
- **Commands**: CLI subcommands registered in `src/cli/index.ts`
- **Agents**: target-specific install destinations and capabilities
- **Compiled mode**: VFS-backed skill loading instead of filesystem reads

## Supported agents

The README lists 18 supported agents, including:
- Claude Code
- Codex
- OpenCode
- Cursor
- Gemini CLI
- OpenClaw
- Cline
- Aider
- Continue
- Zed

## Core CLI commands

```text
install [options]
uninstall [options]
select [options]
list [options]
profiles [name]
agents
about
```

## Key reusable ideas

### For OMX/Buu

1. **Ship source + packaged behavior through one abstraction**
   - `skill-source.ts` is the clearest model.

2. **Use simple profiles**
   - explicit include/exclude is enough until reality forces more.

3. **Stamp install artifacts**
   - installation is a transformation boundary; make artifacts self-describing there.

4. **Clean only what you own**
   - orphan cleanup should be ownership-aware, not global.

## Why this repo matters for Buu

It is not the same kind of system as OMX runtime, but it is a strong upstream pattern source for:
- skill distribution
- profile selection
- packaged/source duality
- install-time metadata injection
- artifact ownership discipline
