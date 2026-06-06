# Agent KB v5 port selection

This file selects which v4 custom features are actually needed for the first Agent KB deployment.

## Current repository fact

The current `agent-kb-v5` branch is a migration branch, but the repository does not yet contain a true upstream Quartz 5 tree. `package.json` still reports Quartz `4.5.2` on the current fork line. Treat this branch as the staging branch for the v5 port, not as proven v5 runtime yet.

## Selected for phase 1

These solve real Agent KB problems now and should be applied first:

### 1. Outside-content workflow

Keep Quartz as engine/config, with content copied in by deployment.

Why:

- Agent KB content lives in `AnatoliBu/sh`.
- Quartz should not own the knowledge-base source of truth.

### 2. Curated content only

Published content should include:

- `references/`
- `agents/`
- `rules/`
- `skills/`
- `sysadmin/`
- `analytics/`
- `roadmap.md`
- `README.md`

Published content should exclude:

- `research/`
- `site/`
- `references/tooling/`
- deployment notes
- Quartz/GitHub Pages docs

Why:

- `research/` is quarantine/staging.
- tooling references are publishing infrastructure, not domain knowledge.
- the visible graph should stay focused on source-of-truth references, skills, agents, and rules.

### 3. Title/baseUrl/locale/ignorePatterns

For Agent KB deployment:

- title: `Agent KB`
- suffix: ` | Source of Truth`
- baseUrl: `anatolibu.github.io/sh`
- locale: `en-US`
- ignore: `research`, `site`, `references/tooling`

Why:

- GitHub Pages project site requires `/sh` base behavior.
- hidden/staging folders must not appear in the site graph.

### 4. Stock graph/search/explorer/backlinks

Use stock Quartz graph/search/explorer/backlinks for the first working site.

Why:

- This is enough to verify that the knowledge graph works.
- Graph v2 custom code is high-risk and should not block initial deployment.

## Deferred from v4 custom layer

Do not port these until the phase 1 build works:

- CommandPalette
- WikiLinkPreview custom replacement
- ReadingProgress
- HeadingAnchors
- Frontmatter badges/filters
- Backlinks grouping/status chips/excerpts
- Graph v2 custom features
- CodeEnhancements transformer
- custom callouts
- search_boost / excerpt index changes
- TOC scroll-spy tweaks
- SPA tweaks

## Decision

First deploy must be boring and reliable:

```text
stock Quartz graph/search/explorer/backlinks
+ curated content copy
+ correct baseUrl/title/ignorePatterns
+ no research/site/tooling in graph
```

After that, port UX features one at a time.
