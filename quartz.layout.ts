import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.WikiLinkPreview(),
    Component.HeadingAnchors(),
    Component.ReadingProgress(),
    Component.CommandPalette(),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.Frontmatter(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    Component.Graph({
      localGraph: {
        showTags: false,
        fontSize: 0.55,
        repelForce: 1.0,
        centerForce: 0.3,
        linkDistance: 50,
        opacityScale: 4,
      },
      globalGraph: {
        showTags: false,
        fontSize: 0.5,
        scale: 1.2,
        repelForce: 3,
        centerForce: 0,
        linkDistance: 150,
        opacityScale: 2,
        focusOnHover: true,
        enableRadial: true,
        highlightColor: "#ff8c42",
        persistPositions: true,
        autoColorFolders: true,
        colorGroups: {
          "bugs/": "#e06666",
          "tasks/": "#4a90e2",
          "spec-issues/": "#a86ec9",
          "coupons/": "#6aa84f",
          "coverage/": "#f1c232",
        },
      },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.FrontmatterFilters(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
