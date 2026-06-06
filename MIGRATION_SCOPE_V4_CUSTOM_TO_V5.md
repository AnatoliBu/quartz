# Migration scope: custom Quartz v4 -> Quartz v5

This document freezes the migration scope before porting custom v4 changes to a v5-based branch.

## Baseline

Comparison used:

```text
base: c2bea8a4c4aeba440b8a7b043d7ece6343a9d263
head: 13fd9ca43c6101775eaadbec59e7ab40d57b4953
status: ahead
custom commits ahead: 9
```

The major custom feature commit is:

```text
0fdcaa498dd78f6be4fd99c7114bcfcf97c7ab0a
feat: UX enhancements pack
```

The current branch also contains:

```text
13fd9ca43c6101775eaadbec59e7ab40d57b4953
chore: untrack content/ — vault lives outside the fork
```

## Migration rule

Do not merge v4 into v5 mechanically.

Quartz v5 changes the configuration model from TypeScript config/layout to YAML-based plugin and layout configuration. The correct approach is:

1. Use Quartz v5 as the base.
2. Port configuration and layout intent manually.
3. Port custom runtime features one by one.
4. Verify build after each feature group.
5. Only switch downstream deployments after the v5 branch builds successfully.

## Custom changes found in v4

### 1. Repository/content handling

Files:

- `content/.gitkeep` removed
- `.gitignore` / content handling changed by commits

Purpose:

- Quartz fork is treated as engine + opinionated defaults.
- Actual vault/content lives outside the fork and is copied/symlinked during deployment.

v5 port plan:

- Keep this behavior.
- Do not commit content into the Quartz repo.
- CI should copy external content into `content/` before build.

Risk:

- Low.

### 2. Dependency/package changes

Files:

- `package.json`
- `package-lock.json`

Purpose:

- dependency updates and local package state.

v5 port plan:

- Do not port v4 lockfile or dependency bumps directly.
- Use v5 `package.json`/lockfile as source of truth.
- Only add missing dependencies if a custom feature requires them.

Risk:

- Medium if copied blindly.
- Low if v5 lockfile remains authoritative.

### 3. Site configuration

Files:

- `quartz.config.ts`

Custom changes:

- `pageTitle: "apps-api-tests"`
- `pageTitleSuffix: " | QA Notes"`
- `enablePopovers: false`
- `analytics: null`
- `locale: "ru-RU"`
- `baseUrl: "localhost:8080"`
- `ignorePatterns: ["private", "templates", ".obsidian", "archive"]`
- `defaultDateType: "created"`
- added `Plugin.CodeEnhancements()`
- disabled `Plugin.CustomOgImages()` for faster/local build

v5 port plan:

- Convert these to `quartz.config.yaml`.
- For Agent KB deployment, override:
  - `pageTitle: Agent KB`
  - `pageTitleSuffix: " | Source of Truth"`
  - `locale: en-US`
  - `baseUrl: anatolibu.github.io/sh`
  - add ignore patterns: `research`, `site`, `references/tooling`
- Preserve the concept of disabling expensive/unneeded OG image generation unless explicitly needed.
- Port CodeEnhancements as a v5 plugin only after buildable baseline exists.

Risk:

- Low for simple config.
- Medium for custom transformer/plugin.

### 4. Layout changes

Files:

- `quartz.layout.ts`

Custom changes:

- added afterBody components:
  - `WikiLinkPreview()`
  - `HeadingAnchors()`
  - `ReadingProgress()`
  - `CommandPalette()`
- added `Frontmatter()` before body content
- added `FrontmatterFilters()` to folder/list pages
- customized graph options:
  - local graph tuning
  - global graph tuning
  - radial layout
  - focused hover
  - persistent positions
  - auto folder colors
  - custom color groups
- kept TOC and Backlinks on the right

v5 port plan:

- Translate built-in layout intent into v5 YAML plugin layout.
- For custom components, either:
  - port them as v5 plugins/components, or
  - temporarily defer them until core v5 build works.
- Graph custom options require schema check against v5 graph plugin.

Risk:

- Medium-high.
- Layout is conceptually portable but not copy-paste portable.

### 5. Frontmatter-driven UI

Files:

- `quartz.frontmatter-fields.ts`
- `quartz/components/Frontmatter.tsx`
- `quartz/components/FrontmatterFilters.tsx`
- `quartz/components/styles/frontmatter.scss`
- `quartz/components/styles/frontmatter-filters.scss`

Purpose:

- Single source of truth for frontmatter fields.
- Status/severity/update badges.
- Folder page filters.
- Indexed frontmatter keys for client-side filtering and overlays.

v5 port plan:

- High-value feature, but not required for first Agent KB deploy.
- Port after baseline graph/search/backlinks work.
- Re-check v5 content index data shape before porting.

Risk:

- Medium-high.

### 6. Backlinks enhancements

Files:

- `quartz/components/Backlinks.tsx`
- `quartz/components/styles/backlinks.scss`

Custom changes:

- grouped backlinks by top-level folder
- folder order
- colored dots
- status chips
- excerpts
- max-per-group support
- removed OverflowList behavior

v5 port plan:

- Keep as candidate high-value enhancement.
- First inspect v5 backlinks plugin/component structure.
- Port after confirming v5 data model for `allFiles`, `description`, `frontmatter`, `links`, and `slug`.

Risk:

- Medium.

### 7. Command palette

Files:

- `quartz/components/CommandPalette.tsx`
- `quartz/components/scripts/command-palette.inline.ts`
- `quartz/components/styles/command-palette.scss`
- `quartz/components/scripts/overlay-a11y.ts`

Custom changes:

- Ctrl+P / Ctrl+Shift+K fuzzy search
- actions list
- focus trap
- scroll lock
- mobile full-screen

v5 port plan:

- Defer until core v5 build works.
- v5 already has search and plugin model; evaluate whether command palette is still needed.
- If ported, implement as separate v5 component/plugin.

Risk:

- Medium-high.

### 8. Wiki link preview

Files:

- `quartz/components/WikiLinkPreview.tsx`
- `quartz/components/scripts/wiki-link-preview.inline.ts`
- `quartz/components/styles/wiki-link-preview.scss`

Custom changes:

- hover/focus/long-press tooltip
- title + excerpt preview
- status chip
- replaces native full-page popover behavior

v5 port plan:

- For Agent KB, likely useful.
- First check v5 popover/backlink behavior.
- Port only if native v5 preview is insufficient.

Risk:

- Medium.

### 9. Heading anchors

Files:

- `quartz/components/HeadingAnchors.tsx`
- `quartz/components/scripts/heading-anchors.inline.ts`
- `quartz/components/styles/heading-anchors.scss`

Custom changes:

- hover h1-h4 to copy anchor URL

v5 port plan:

- Low-risk feature.
- Check whether v5 already has equivalent heading anchors plugin/component.
- Port only if missing or behavior is worse.

Risk:

- Low-medium.

### 10. Reading progress

Files:

- `quartz/components/ReadingProgress.tsx`
- `quartz/components/scripts/reading-progress.inline.ts`
- `quartz/components/styles/reading-progress.scss`

Custom changes:

- reading progress bar
- back-to-top button

v5 port plan:

- Nice-to-have.
- Defer until core Agent KB deploy works.

Risk:

- Low-medium.

### 11. Graph v2

Files:

- `quartz/components/Graph.tsx`
- `quartz/components/scripts/graph.inline.ts`
- `quartz/components/styles/graph.scss`

Custom changes:

- search in graph
- orphans
- status/recency overlay
- persistent positions
- radial layout
- folder color groups
- local/global tuning

v5 port plan:

- Highest priority after baseline because Agent KB explicitly needs graph view.
- First use stock v5 graph plugin.
- Then port missing custom graph features incrementally.
- Do not block first v5 deploy on full Graph v2 parity unless stock graph is unusable.

Risk:

- High.

### 12. Search enhancements

Files:

- `quartz/components/scripts/search.inline.ts`
- `quartz/plugins/emitters/contentIndex.tsx`

Custom changes:

- excerpt field in content index
- word-aware plain-text excerpt
- HTML entity safety
- `search_boost` frontmatter multiplier

v5 port plan:

- Check v5 content index/search plugin first.
- Port `excerpt` and `search_boost` if absent.
- Useful for large knowledge bases, but not required for first deploy.

Risk:

- Medium.

### 13. Code block enhancements

Files:

- `quartz/plugins/transformers/codeEnhancements.ts`
- `quartz/plugins/transformers/index.ts`
- `quartz/components/styles/clipboard.scss`

Custom changes:

- VitePress-style markers:
  - `[!code ++]`
  - `[!code --]`
  - `[!code focus]`
  - `[!code error]`
  - `[!code warning]`
- collapsible code blocks via `collapse` / `collapse-open`
- code block titles via `title=` meta

v5 port plan:

- Valuable but not needed for source-of-truth graph.
- Port later as transformer plugin if v5 does not already support enough.

Risk:

- Medium.

### 14. TOC improvements

Files:

- `quartz/components/scripts/toc.inline.ts`
- `quartz/components/styles/toc.scss`

Custom changes:

- `is-current` scroll-spy class in addition to in-view behavior

v5 port plan:

- Low priority.
- Check v5 TOC behavior first.

Risk:

- Low.

### 15. Explorer tweaks

Files:

- `quartz/components/scripts/explorer.inline.ts`
- `quartz/components/styles/explorer.scss`

Custom changes:

- small UX/state tweaks

v5 port plan:

- Check stock v5 explorer first.
- Port only if needed.

Risk:

- Low-medium.

### 16. SPA behavior tweaks

Files:

- `quartz/components/scripts/spa.inline.ts`

Custom changes:

- small behavior change

v5 port plan:

- Do not port blindly.
- Re-test with v5 SPA.

Risk:

- Medium if copied blindly; low if re-evaluated.

### 17. Callout styles

Files:

- `quartz/styles/callouts.scss`
- `quartz/styles/custom.scss`
- `quartz/styles/base.scss`

Custom changes:

- custom Obsidian callout types:
  - `spec-issue`
  - `task`
  - `coupon`
  - `coverage`
- custom CSS tweaks
- auto-numbered h3 steps via `has_steps: true`

v5 port plan:

- Port CSS only after v5 build works.
- For Agent KB, add new callout types relevant to source review and agent safety later:
  - `source-of-truth`
  - `risk`
  - `approval`
  - `assumption`

Risk:

- Low-medium.

## Suggested migration phases

### Phase 0 — already done

- Create separate branch `agent-kb-v5` from v5 base.
- Do not touch `v4`.

### Phase 1 — minimal v5 Agent KB deploy

Goal: build and publish Agent KB with stock v5 Quartz.

Port only:

- title/baseUrl/locale/ignorePatterns
- search/explorer/backlinks/graph enabled
- layout positions
- clean content copy strategy

Do not port custom runtime code yet.

### Phase 2 — graph parity

Port or reimplement:

- folder color groups
- radial layout if supported
- persistent graph positions if supported
- graph search/orphans/status overlay if still needed

### Phase 3 — knowledge-base UX

Port or replace:

- backlinks grouping/excerpts/status chips
- wiki link preview
- heading anchors
- reading progress
- command palette if stock search is insufficient

### Phase 4 — authoring enhancements

Port:

- CodeEnhancements transformer
- custom callouts
- frontmatter badges/filters
- search boost/excerpt improvements

## Initial verdict

The v4 custom layer is meaningful and should not be discarded.

But most changes fall into two groups:

1. **Config/layout intent** — easy to port to v5 YAML.
2. **Runtime component/plugin changes** — must be ported one feature at a time after baseline v5 build works.

Do not attempt a bulk merge.
