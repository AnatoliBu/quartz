// Single source of truth for frontmatter-driven UI (Frontmatter badges,
// FolderContent filters, graph overlays). Imported by:
//   - quartz/components/Frontmatter.tsx  — article-header metadata
//   - quartz/components/FrontmatterFilters.tsx  — filter UI on folder pages
//   - quartz/plugins/emitters/contentIndex.tsx  — extend serialized index
//     with frontmatter values used for filtering/overlay
//
// Keep this file framework-free (no JSX, no Preact imports) so emitters can
// import it without pulling component runtime.

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
    key: "status",
    label: "Status",
    style: "badge",
    colorMap: {
      OPEN: "#e5484d",
      REPORTED: "#e5484d",
      "IN PROGRESS": "#f5a623",
      IN_PROGRESS: "#f5a623",
      BLOCKED: "#8b5cf6",
      TODO: "#9333ea",
      DONE: "#46a758",
      RESOLVED: "#46a758",
      "WON'T FIX": "#6b7280",
      CLOSED: "#6b7280",
    },
  },
  {
    key: "severity",
    label: "Severity",
    style: "badge",
    colorMap: { P0: "#e5484d", P1: "#f5a623", P2: "#9ca3af", P3: "#9ca3af" },
  },
  { key: "updated_at", label: "Updated", format: "relative" },
  { key: "resolved_at", label: "Resolved", format: "date" },
]

// Keys emitted into static/contentIndex.json for client-side filtering/overlay.
// Derived from frontmatterFields plus additional non-UI keys (e.g. search_boost).
export const extraIndexedKeys: string[] = ["search_boost", "has_steps"]

export const indexedFrontmatterKeys: string[] = [
  ...frontmatterFields.map((f) => f.key),
  ...extraIndexedKeys,
]
