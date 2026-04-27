# arra-oracle-skills-cli Learning Index

## Source

- **Origin**: [origin](./origin)
- **GitHub**: https://github.com/Soul-Brews-Studio/arra-oracle-skills-cli

## Explorations

### 2026-04-21 2051 (default)

- [2026-04-21/2051_ARCHITECTURE.md](./2026-04-21/2051_ARCHITECTURE.md)
- [2026-04-21/2051_CODE-SNIPPETS.md](./2026-04-21/2051_CODE-SNIPPETS.md)
- [2026-04-21/2051_QUICK-REFERENCE.md](./2026-04-21/2051_QUICK-REFERENCE.md)

**Key insights**

- The repo is a Bun-first installer/distribution system for Oracle skills, not just a pile of prompts.
- `skill-source.ts` is the key portability seam: it abstracts filesystem vs compiled-VFS skill loading.
- Profiles are intentionally simple include/exclude layers, which keeps cross-agent installation predictable.
