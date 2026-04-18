import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import type { FullSlug } from "../../util/path"
import { createOverlay, type OverlayController } from "./overlay-a11y"

type Index = Record<string, ContentDetails>

type ActionItem = {
  kind: "action"
  id: string
  title: string
  hint?: string
  run: () => void
  score?: number
}

type PageItem = {
  kind: "page"
  id: string
  slug: FullSlug
  title: string
  subtitle?: string
  folder: string
  score?: number
}

type Item = ActionItem | PageItem

const MAX_RESULTS = 12

let paletteEl: HTMLElement | null = null
let inputEl: HTMLInputElement | null = null
let listEl: HTMLUListElement | null = null
let overlay: OverlayController | null = null
let detachOverlay: (() => void) | null = null
let activeIndex = 0
let allItems: Item[] = []
let filteredItems: Item[] = []
let isOpen = false

function buildPageItems(data: Index): PageItem[] {
  return Object.entries(data).map(([slug, details]) => ({
    kind: "page" as const,
    id: `page:${slug}`,
    slug: slug as FullSlug,
    title: details.title || slug,
    subtitle: details.excerpt?.slice(0, 120),
    folder: slug.includes("/") ? slug.split("/")[0] : "root",
  }))
}

function buildActionItems(): ActionItem[] {
  return [
    {
      kind: "action",
      id: "action:toggle-theme",
      title: "Toggle dark mode",
      hint: "Theme",
      run: () => {
        const btn = document.querySelector<HTMLButtonElement>(".darkmode button#darkmode-toggle")
        btn?.click()
      },
    },
    {
      kind: "action",
      id: "action:toggle-reader",
      title: "Toggle reader mode",
      hint: "Layout",
      run: () => {
        const btn = document.querySelector<HTMLButtonElement>(".readermode button#readermode-toggle")
        btn?.click()
      },
    },
    {
      kind: "action",
      id: "action:open-global-graph",
      title: "Open global graph",
      hint: "Graph",
      run: () => {
        const icon = document.querySelector<HTMLButtonElement>(".global-graph-icon")
        icon?.click()
      },
    },
    {
      kind: "action",
      id: "action:home",
      title: "Go to Home",
      hint: "Navigate",
      run: () => {
        if (typeof (window as any).spaNavigate === "function") {
          ;(window as any).spaNavigate(new URL("/", window.location.toString()))
        } else {
          window.location.href = "/"
        }
      },
    },
  ]
}

// Tiny fuzzy-ish scoring: substring match weighted by early-position, with
// word-boundary bonus. Cheap and predictable for a 100-note vault.
function score(item: Item, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const title = item.title.toLowerCase()
  const sub = item.kind === "page" ? (item.subtitle ?? "").toLowerCase() : (item.hint ?? "").toLowerCase()
  const folder = item.kind === "page" ? item.folder.toLowerCase() : ""

  let s = 0
  const tIdx = title.indexOf(q)
  if (tIdx >= 0) {
    s += 100 - tIdx
    // Word-boundary bonus.
    if (tIdx === 0 || /[\s/-]/.test(title[tIdx - 1])) s += 20
  }
  if (folder && folder.startsWith(q)) s += 15
  if (sub.includes(q)) s += 5

  // Token-by-token matching for multi-word queries.
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    let matched = 0
    for (const tok of tokens) {
      if (title.includes(tok) || sub.includes(tok) || folder.includes(tok)) matched++
    }
    s += matched * 6
  }

  return s
}

function render() {
  if (!listEl) return
  listEl.innerHTML = ""
  filteredItems.forEach((item, i) => {
    const li = document.createElement("li")
    li.className = "cmd-palette-item"
    li.id = `cmd-item-${i}`
    li.dataset.index = String(i)
    li.setAttribute("role", "option")
    li.setAttribute("aria-selected", i === activeIndex ? "true" : "false")
    if (i === activeIndex) li.classList.add("is-active")

    const kindClass = item.kind === "action" ? "is-action" : "is-page"
    li.classList.add(kindClass)

    const primary = document.createElement("span")
    primary.className = "cmd-palette-primary"

    const title = document.createElement("span")
    title.className = "cmd-palette-title"
    title.textContent = item.title
    primary.appendChild(title)

    if (item.kind === "page") {
      const folder = document.createElement("span")
      folder.className = "cmd-palette-folder"
      folder.dataset.folder = item.folder
      folder.textContent = item.folder
      primary.appendChild(folder)
    } else if (item.hint) {
      const hint = document.createElement("span")
      hint.className = "cmd-palette-hintlabel"
      hint.textContent = item.hint
      primary.appendChild(hint)
    }

    li.appendChild(primary)

    const subtitle =
      item.kind === "page" && item.subtitle ? item.subtitle : item.kind === "action" ? "Action" : ""
    if (subtitle) {
      const sub = document.createElement("span")
      sub.className = "cmd-palette-subtitle"
      sub.textContent = subtitle
      li.appendChild(sub)
    }

    li.addEventListener("click", () => selectItem(i))
    li.addEventListener("mouseenter", () => {
      activeIndex = i
      syncActive()
    })
    listEl!.appendChild(li)
  })
  if (inputEl) {
    const id = filteredItems.length > 0 ? `cmd-item-${activeIndex}` : ""
    inputEl.setAttribute("aria-activedescendant", id)
  }
  if (filteredItems.length === 0) {
    const empty = document.createElement("li")
    empty.className = "cmd-palette-empty"
    empty.textContent = "No matches"
    listEl.appendChild(empty)
  }
}

function syncActive() {
  if (!listEl) return
  listEl.querySelectorAll(".cmd-palette-item").forEach((el, i) => {
    const match = i === activeIndex
    el.classList.toggle("is-active", match)
    el.setAttribute("aria-selected", match ? "true" : "false")
  })
  const activeEl = listEl.querySelector<HTMLElement>(".cmd-palette-item.is-active")
  activeEl?.scrollIntoView({ block: "nearest" })
  if (inputEl) {
    inputEl.setAttribute(
      "aria-activedescendant",
      filteredItems.length > 0 ? `cmd-item-${activeIndex}` : "",
    )
  }
}

function filter(query: string) {
  const q = query.trim()
  if (!q) {
    // Default list: actions first, then first N pages alphabetically.
    const actions = allItems.filter((i) => i.kind === "action") as ActionItem[]
    const pages = (allItems.filter((i) => i.kind === "page") as PageItem[])
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, MAX_RESULTS - actions.length)
    filteredItems = [...actions, ...pages]
  } else {
    filteredItems = allItems
      .map((i) => ({ ...i, score: score(i, q) }))
      .filter((i) => (i.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, MAX_RESULTS)
  }
  activeIndex = 0
  render()
}

function selectItem(index: number) {
  const item = filteredItems[index]
  if (!item) return
  if (item.kind === "action") {
    close()
    // Defer the action until after close so focus restore happens first.
    setTimeout(() => item.run(), 0)
  } else {
    close()
    const url = new URL("/" + item.slug, window.location.toString())
    if (typeof (window as any).spaNavigate === "function") {
      ;(window as any).spaNavigate(url)
    } else {
      window.location.href = url.toString()
    }
  }
}

function open() {
  if (!paletteEl || isOpen) return
  isOpen = true
  paletteEl.hidden = false
  paletteEl.classList.add("is-open")
  filter("")
  if (!overlay) {
    overlay = createOverlay(paletteEl, {
      onClose: close,
      initialFocus: () => inputEl,
    })
  }
  detachOverlay = overlay.attach()
  if (inputEl) {
    inputEl.value = ""
    requestAnimationFrame(() => inputEl?.focus())
  }
}

function close() {
  if (!paletteEl || !isOpen) return
  isOpen = false
  paletteEl.classList.remove("is-open")
  paletteEl.hidden = true
  detachOverlay?.()
  detachOverlay = null
}

function toggle() {
  isOpen ? close() : open()
}

function onGlobalKey(ev: KeyboardEvent) {
  // Ctrl+P or Ctrl+Shift+K — either works, neither conflicts with Ctrl+K Search.
  const isToggle =
    ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === "p") ||
    ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === "k")
  if (!isToggle) return
  ev.preventDefault()
  toggle()
}

function onInputKey(ev: KeyboardEvent) {
  if (ev.key === "ArrowDown") {
    ev.preventDefault()
    if (filteredItems.length === 0) return
    activeIndex = (activeIndex + 1) % filteredItems.length
    syncActive()
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault()
    if (filteredItems.length === 0) return
    activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length
    syncActive()
  } else if (ev.key === "Enter") {
    ev.preventDefault()
    selectItem(activeIndex)
  } else if (ev.key === "Home") {
    ev.preventDefault()
    activeIndex = 0
    syncActive()
  } else if (ev.key === "End") {
    ev.preventDefault()
    activeIndex = Math.max(0, filteredItems.length - 1)
    syncActive()
  }
}

function onBackdropClick(ev: MouseEvent) {
  const target = ev.target as HTMLElement
  if (target.classList.contains("cmd-palette-backdrop")) close()
}

function onInputType(ev: Event) {
  filter((ev.target as HTMLInputElement).value)
}

async function setup() {
  paletteEl = document.querySelector<HTMLElement>(".command-palette")
  if (!paletteEl) return
  inputEl = paletteEl.querySelector<HTMLInputElement>(".cmd-palette-input")
  listEl = paletteEl.querySelector<HTMLUListElement>(".cmd-palette-list")

  const data = (await fetchData) as Index
  allItems = [...buildActionItems(), ...buildPageItems(data)]

  // afterBody is part of Quartz's morph target, so the palette DOM persists
  // across SPA nav while listeners get torn down by addCleanup. Capture
  // references so cleanup can remove them precisely.
  const capturedInput = inputEl
  const capturedPalette = paletteEl

  document.addEventListener("keydown", onGlobalKey)
  capturedInput?.addEventListener("input", onInputType)
  capturedInput?.addEventListener("keydown", onInputKey)
  capturedPalette.addEventListener("click", onBackdropClick)

  window.addCleanup(() => {
    document.removeEventListener("keydown", onGlobalKey)
    capturedInput?.removeEventListener("input", onInputType)
    capturedInput?.removeEventListener("keydown", onInputKey)
    capturedPalette.removeEventListener("click", onBackdropClick)
    close()
  })
}

document.addEventListener("nav", () => {
  setup().catch((err) => console.error("command-palette", err))
})
