import type { FrontmatterField } from "../../../quartz.frontmatter-fields"
import type { ContentDetails } from "../../plugins/emitters/contentIndex"

type FilterCfg = { fields: FrontmatterField[] }

async function renderFilters() {
  const host = document.querySelector<HTMLElement>(".frontmatter-filters")
  if (!host) return

  const cfgRaw = host.dataset["cfg"]
  if (!cfgRaw) return
  const cfg = JSON.parse(cfgRaw) as FilterCfg

  // Collect list items on this page
  const items = [...document.querySelectorAll<HTMLElement>(".section-li")]
  if (items.length === 0) {
    host.innerHTML = ""
    return
  }

  // Fetch contentIndex once (browser will cache it across SPA navigations)
  let index: Record<string, ContentDetails>
  try {
    const res = await fetch(new URL("/static/contentIndex.json", location.origin).toString())
    index = (await res.json()) as Record<string, ContentDetails>
  } catch (_e) {
    // If we can't load index, bail silently — filters just won't render.
    host.innerHTML = ""
    return
  }

  const slugFromLink = (a: HTMLAnchorElement): string | null => {
    try {
      const u = new URL(a.href, location.origin)
      // Strip leading/trailing slash; ignore hash/query.
      return u.pathname.replace(/^\/+|\/+$/g, "")
    } catch {
      return null
    }
  }

  const itemMeta = items
    .map((li) => {
      const a = li.querySelector<HTMLAnchorElement>("a.internal")
      if (!a) return null
      const slug = slugFromLink(a)
      if (!slug) return null
      const details = index[slug]
      const values = details?.frontmatterValues ?? {}
      return { li, slug, values }
    })
    .filter((x): x is { li: HTMLElement; slug: string; values: Record<string, string> } => !!x)

  // --- Per-file badges: inject colored pills into each li's .meta row ---
  const badgeFields = cfg.fields.filter((f) => f.style === "badge")
  for (const m of itemMeta) {
    // Idempotent: remove any badge containers from previous renders
    m.li.querySelectorAll(".frontmatter-file-badges").forEach((el) => el.remove())
    if (badgeFields.length === 0) continue

    const host = document.createElement("span")
    host.className = "frontmatter-file-badges"
    let added = 0
    for (const field of badgeFields) {
      const value = m.values[field.key]
      if (!value) continue
      const color =
        field.colorMap?.[value.toUpperCase()] ?? field.colorMap?.[value] ?? undefined
      const badge = document.createElement("span")
      badge.className = "frontmatter-file-badge"
      badge.textContent = value
      badge.title = (field.label ?? field.key) + ": " + value
      if (color) {
        badge.style.background = color
        badge.style.borderColor = color
      }
      host.appendChild(badge)
      added++
    }
    if (added === 0) continue

    const meta = m.li.querySelector(".meta")
    if (meta) {
      meta.appendChild(host)
    } else {
      // fallback: stick it on section
      const section = m.li.querySelector(".section") ?? m.li
      section.insertBefore(host, section.firstChild)
    }
  }

  // Decide which fields qualify as filters: explicit `filterable` wins, else
  // default true for badge+colorMap fields (discrete domain), false otherwise.
  const filterFields = cfg.fields.filter((f) => {
    if (typeof f.filterable === "boolean") return f.filterable
    return f.style === "badge" && !!f.colorMap
  })

  // activeFilters: field.key -> allowed values (empty Set = no filter)
  const activeFilters = new Map<string, Set<string>>()

  host.innerHTML = ""

  for (const field of filterFields) {
    const unique = new Set<string>()
    for (const m of itemMeta) {
      const v = m.values[field.key]
      if (v) unique.add(v)
    }
    if (unique.size === 0) continue

    const fieldDiv = document.createElement("div")
    fieldDiv.className = "frontmatter-filter-field"

    const label = document.createElement("span")
    label.className = "frontmatter-filter-label"
    label.textContent = (field.label ?? field.key) + ":"
    fieldDiv.appendChild(label)

    const valueSet = new Set<string>()
    activeFilters.set(field.key, valueSet)

    const sorted = [...unique].sort((a, b) => a.localeCompare(b))
    for (const value of sorted) {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "frontmatter-filter-chip"
      chip.textContent = value
      const color =
        field.colorMap?.[value.toUpperCase()] ??
        field.colorMap?.[value] ??
        null
      if (color) {
        chip.style.setProperty("--chip-color", color)
      }
      chip.addEventListener("click", () => {
        if (valueSet.has(value)) {
          valueSet.delete(value)
          chip.classList.remove("active")
        } else {
          valueSet.add(value)
          chip.classList.add("active")
        }
        applyFilter()
      })
      fieldDiv.appendChild(chip)
    }

    host.appendChild(fieldDiv)
  }

  // Count readout
  const counter = document.createElement("span")
  counter.className = "frontmatter-filter-count"
  host.appendChild(counter)

  const applyFilter = () => {
    let visibleCount = 0
    for (const m of itemMeta) {
      let visible = true
      for (const [key, allowed] of activeFilters) {
        if (allowed.size === 0) continue
        const v = m.values[key]
        if (!v || !allowed.has(v)) {
          visible = false
          break
        }
      }
      m.li.style.display = visible ? "" : "none"
      if (visible) visibleCount++
    }
    counter.textContent = `${visibleCount}/${itemMeta.length}`
  }

  applyFilter()
}

document.addEventListener("nav", () => {
  void renderFilters()
})

// Also run on initial load — Quartz may emit `nav` before our listener is
// attached on the very first page render.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void renderFilters())
} else {
  void renderFilters()
}
