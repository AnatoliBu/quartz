# Agent KB deploy branch

## Active branch

`agent-kb-v5`

This is the active deployment branch used by `AnatoliBu/sh` for building the Agent KB Quartz site.

## Current status

This branch is a staging branch for the v5 migration. It currently keeps the deployment boring and reliable:

- external content is copied in during CI;
- Agent KB title/baseUrl/locale/ignorePatterns are configured;
- stock Quartz graph/search/explorer/backlinks are used first;
- risky v4 UX customizations are deferred.

## Important clarification

Do not assume that `agent-kb-v5` is already a true upstream Quartz 5 tree just because of the branch name.

Before calling it a real v5 port, verify `package.json` and the config model:

- true v5 should report Quartz 5.x;
- true v5 should use the v5 plugin/config model;
- the Agent KB build must pass with copied external content.

## Downstream usage

`AnatoliBu/sh` uses this branch via:

```bash
QUARTZ_BRANCH=agent-kb-v5
```

## Promotion rule

Only promote or retarget downstream deployment after:

1. smoke workflow passes in this repository;
2. `AnatoliBu/sh` Agent KB workflow passes;
3. the published Pages site shows the expected curated graph;
4. `research/`, `site/`, and `references/tooling/` are not visible in the published graph.
