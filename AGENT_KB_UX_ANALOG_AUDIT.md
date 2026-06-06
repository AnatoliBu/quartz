# Agent KB UX analog audit for Quartz v5

This document decides which custom v4 UX features should be ported only if Quartz v5 does not already provide an equivalent.

## Rule

Do not port a v4 custom feature just because it exists.

Port only if one of these is true:

1. v5 has no equivalent;
2. v5 equivalent exists but is materially weaker for Agent KB navigation;
3. v5 equivalent exists but cannot express Agent KB source-of-truth semantics;
4. the feature is low-risk and directly improves authoring/review workflows.

## v5 stock capabilities observed

Quartz v5 default config includes stock plugin entries for:

- explorer;
- graph;
- search;
- backlinks;
- table of contents;
- reader mode;
- note properties;
- bases page;
- unlisted/encrypted pages;
- Obsidian-flavored Markdown;
- GitHub-flavored Markdown;
- syntax highlighting.

This means baseline navigation and graph exploration should use stock v5 first.

## Decisions

### 1. Graph v2 custom features

v4 custom features:

- graph search;
- orphan visibility;
- status/recency overlay;
- persistent positions;
- radial layout;
- folder color groups;
- local/global tuning.

v5 analog:

- stock graph plugin exists.

Decision:

- Do not port full Graph v2 immediately.
- First use stock v5 graph.
- Then port only missing Agent KB-specific features:
  - folder color groups for `references/`, `skills/`, `agents/`, `rules/`;
  - orphan visibility if useful for finding unlinked docs;
  - persistent positions only if stock graph layout is too noisy;
  - status/tier overlay only after frontmatter taxonomy exists.

Priority:

- High after baseline deploy.

### 2. Backlinks enhancements

v4 custom features:

- backlinks grouped by top-level folder;
- folder order;
- colored dots;
- status chips;
- excerpts;
- max-per-group.

v5 analog:

- stock backlinks plugin exists.

Decision:

- Do not replace stock backlinks immediately.
- Port only if stock backlinks are too flat for Agent KB.
- The most useful subset is:
  - group by top-level folder;
  - show excerpt;
  - show `tier` / `status` chip once frontmatter exists.

Priority:

- High, but after stock v5 site is visible.

### 3. WikiLinkPreview

v4 custom features:

- hover/focus/long-press preview;
- title + excerpt;
- status chip;
- replaces native full-page popovers.

v5 analog:

- Quartz has popovers/link previews when enabled.

Decision:

- Do not port custom WikiLinkPreview until stock v5 popovers are tested.
- If stock popovers are too heavy or fail to show reference-card metadata, port a lighter Agent KB preview.

Priority:

- Medium.

### 4. CommandPalette

v4 custom features:

- Ctrl+P / Ctrl+Shift+K;
- fuzzy search over pages;
- actions;
- focus trap;
- mobile fullscreen.

v5 analog:

- stock search plugin exists.

Decision:

- Do not port search-only behavior.
- Port command palette only if actions are needed, for example:
  - open graph;
  - open source on GitHub;
  - copy current path;
  - jump to references/skills/agents.

Priority:

- Low-medium.

### 5. Frontmatter-driven UI

v4 custom features:

- status/severity/update badges;
- folder page filters;
- indexed frontmatter keys;
- shared frontmatter field registry.

v5 analog:

- note properties plugin exists;
- bases page exists.

Decision:

- Do not port generic note-properties display.
- Do port Agent KB semantic badges/filters if needed:
  - `authority_tier`;
  - `status`;
  - `domain`;
  - `risk`;
  - `owner`;
  - `last_checked`.

Priority:

- Medium-high once reference cards get frontmatter.

### 6. HeadingAnchors

v4 custom features:

- hover h1-h4 to copy anchor URL.

v5 analog:

- possible anchor support may already exist through Markdown/heading processing.

Decision:

- Test v5 first.
- Port only if there is no visible/copyable heading anchor UI.

Priority:

- Low.

### 7. ReadingProgress

v4 custom features:

- progress bar;
- back-to-top button.

v5 analog:

- reader mode exists, but not necessarily reading progress.

Decision:

- Do not block migration.
- Port later only if long reference cards become annoying to read.

Priority:

- Low.

### 8. CodeEnhancements

v4 custom features:

- VitePress-style code markers;
- collapsible code blocks;
- code block title support.

v5 analog:

- stock syntax highlighting exists.

Decision:

- Do not port visual diff/code markers until Agent KB has enough code-heavy docs.
- Candidate subset for later:
  - collapsible long command blocks;
  - code block titles;
  - warning/error/focus markers for unsafe commands.

Priority:

- Medium-low.

### 9. Custom callouts

v4 custom features:

- custom callout types: `spec-issue`, `task`, `coupon`, `coverage`.

v5 analog:

- Obsidian-flavored Markdown callouts exist.

Decision:

- Do not port old callout taxonomy.
- Add Agent KB-specific callouts only:
  - `source-of-truth`;
  - `risk`;
  - `approval`;
  - `assumption`;
  - `quarantine`.

Priority:

- Medium-low.

### 10. Search enhancements

v4 custom features:

- excerpt field;
- word-aware plain-text excerpt;
- HTML entity safety;
- `search_boost` frontmatter multiplier.

v5 analog:

- stock search plugin exists.

Decision:

- Test stock v5 search first.
- Port `search_boost` only if important docs like `references/README.md`, global rules, and primary agents do not rank well.

Priority:

- Medium.

## Port queue

### Phase A — stock v5 validation

- Confirm stock graph is visible.
- Confirm stock search works.
- Confirm stock backlinks work.
- Confirm `research/`, `site/`, and `references/tooling/` are not visible.

### Phase B — no-analog or weak-analog improvements

1. Graph folder color groups / orphan visibility.
2. Backlinks grouped by folder + excerpt.
3. Agent KB semantic frontmatter badges/filters.
4. Lightweight WikiLinkPreview only if stock popovers are too heavy.
5. Agent KB-specific callouts.

### Phase C — polish

- CommandPalette with actions.
- ReadingProgress.
- HeadingAnchors if missing.
- CodeEnhancements for command/runbook-heavy docs.

## Current stance

For Agent KB, the first custom UX worth porting is not the old full v4 UX pack.

The first custom UX worth porting is:

```text
Graph folder semantics + backlinks grouping + Agent KB frontmatter semantics
```

Everything else waits until the stock v5 experience proves insufficient.
