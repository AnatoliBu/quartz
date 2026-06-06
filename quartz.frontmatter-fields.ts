// Single source of truth for Agent KB frontmatter-driven UI.
// Imported by:
//   - quartz/components/Frontmatter.tsx — article-header metadata
//   - quartz/components/FrontmatterFilters.tsx — filter UI on folder pages
//   - quartz/plugins/emitters/contentIndex.tsx — extend serialized index
//     with frontmatter values used for filtering/overlay
//
// Keep this file framework-free so emitters can import it without pulling component runtime.

export type FrontmatterFieldStyle = "badge" | "text"
export type FrontmatterFieldFormat = "raw" | "date" | "relative"

export interface FrontmatterField {
  key: string
  label?: string
  style?: FrontmatterFieldStyle
  format?: FrontmatterFieldFormat
  colorMap?: Record<string, string>
  /**
   * Whether to expose this field as a filter on folder/list pages.
   * Default: true for `style: "badge"` with `colorMap`, false otherwise.
   */
  filterable?: boolean
}

export const frontmatterFields: FrontmatterField[] = [
  {
    key: "authority_tier",
    label: "Tier",
    style: "badge",
    colorMap: {
      "Tier A": "#4a90e2",
      "Tier B": "#6aa84f",
      "Tier C": "#f1c232",
      "Tier D": "#9ca3af",
    },
  },
  {
    key: "status",
    label: "Status",
    style: "badge",
    colorMap: {
      foundation: "#4a90e2",
      "foundation-context": "#4a90e2",
      "useful-after-audit": "#6aa84f",
      "cheat-sheet-only": "#f1c232",
      "moodboard-only": "#9ca3af",
      rejected: "#e06666",
      draft: "#9ca3af",
      quarantine: "#f5a623",
      accepted: "#46a758",
    },
  },
  {
    key: "domain",
    label: "Domain",
    style: "badge",
    colorMap: {
      sysadmin: "#e06666",
      sre: "#e06666",
      network: "#76a5af",
      analytics: "#6aa84f",
      product: "#6aa84f",
      tooling: "#9ca3af",
    },
  },
  {
    key: "artifact_type",
    label: "Type",
    style: "badge",
    colorMap: {
      reference: "#4a90e2",
      skill: "#76a5af",
      agent: "#a86ec9",
      rule: "#f1c232",
      research: "#9ca3af",
    },
  },
  { key: "owner", label: "Owner" },
  { key: "last_checked", label: "Checked", format: "date" },
]

// Keys emitted into static/contentIndex.json for client-side filtering/overlay.
// Derived from frontmatterFields plus additional non-UI keys.
export const extraIndexedKeys: string[] = ["search_boost", "source_url"]

export const indexedFrontmatterKeys: string[] = [
  ...frontmatterFields.map((f) => f.key),
  ...extraIndexedKeys,
]
