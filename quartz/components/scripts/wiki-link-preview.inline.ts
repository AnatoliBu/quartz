import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import type { FullSlug } from "../../util/path"

type Index = Record<string, ContentDetails>

const OPEN_DELAY_MS = 300
const CLOSE_DELAY_MS = 250
const LONG_PRESS_MS = 500
const LONG_PRESS_CANCEL_PX = 12
const GAP_PX = 10
const VIEWPORT_PAD = 16

let overlay: HTMLElement | null = null
let overlayTitle: HTMLElement | null = null
let overlayExcerpt: HTMLElement | null = null
let overlayMeta: HTMLElement | null = null
let activeLink: HTMLAnchorElement | null = null
let openTimer: number | null = null
let closeTimer: number | null = null

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay
  const el = document.createElement("div")
  el.className = "wiki-link-preview"
  el.setAttribute("role", "tooltip")
  el.setAttribute("aria-hidden", "true")
  el.setAttribute("aria-live", "polite")
  el.innerHTML = `
    <div class="wlp-title"></div>
    <div class="wlp-excerpt"></div>
    <div class="wlp-meta"></div>
  `
  document.body.appendChild(el)
  overlay = el
  overlayTitle = el.querySelector(".wlp-title")
  overlayExcerpt = el.querySelector(".wlp-excerpt")
  overlayMeta = el.querySelector(".wlp-meta")

  el.addEventListener("mouseenter", cancelClose)
  el.addEventListener("mouseleave", scheduleClose)

  return el
}

function cancelOpen() {
  if (openTimer !== null) {
    window.clearTimeout(openTimer)
    openTimer = null
  }
}

function cancelClose() {
  if (closeTimer !== null) {
    window.clearTimeout(closeTimer)
    closeTimer = null
  }
}

function scheduleClose() {
  cancelOpen()
  cancelClose()
  closeTimer = window.setTimeout(hidePreview, CLOSE_DELAY_MS)
}

function hidePreview() {
  cancelOpen()
  cancelClose()
  if (activeLink) {
    activeLink.removeAttribute("aria-describedby")
  }
  activeLink = null
  if (overlay) {
    overlay.classList.remove("is-visible")
    overlay.setAttribute("aria-hidden", "true")
  }
}

function positionOverlay(link: HTMLElement) {
  if (!overlay) return
  const rect = link.getBoundingClientRect()
  const overlayRect = overlay.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight

  let x = rect.left
  let y = rect.bottom + GAP_PX
  let placement: "bottom" | "top" = "bottom"

  if (y + overlayRect.height + VIEWPORT_PAD > vh) {
    const above = rect.top - GAP_PX - overlayRect.height
    if (above >= VIEWPORT_PAD) {
      y = above
      placement = "top"
    } else {
      y = Math.max(VIEWPORT_PAD, vh - overlayRect.height - VIEWPORT_PAD)
    }
  }
  if (x + overlayRect.width + VIEWPORT_PAD > vw) {
    x = Math.max(VIEWPORT_PAD, vw - overlayRect.width - VIEWPORT_PAD)
  }
  if (x < VIEWPORT_PAD) x = VIEWPORT_PAD

  overlay.style.transform = `translate(${x}px, ${y}px)`
  overlay.dataset.placement = placement
}

function formatDate(raw: string | undefined): string {
  if (!raw) return ""
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString(document.documentElement.lang || "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return ""
  }
}

function slugFromHref(link: HTMLAnchorElement): string | null {
  try {
    const url = new URL(link.href, window.location.origin)
    if (url.origin !== window.location.origin) return null
    let path = decodeURIComponent(url.pathname)
    if (path.startsWith("/")) path = path.slice(1)
    if (path.endsWith("/")) path = path + "index"
    if (path.endsWith(".html")) path = path.slice(0, -5)
    return path
  } catch {
    return null
  }
}

function resolveDetails(link: HTMLAnchorElement, data: Index) {
  const dataSlug = link.dataset.slug as FullSlug | undefined
  if (dataSlug && data[dataSlug]) return data[dataSlug]
  const fallback = slugFromHref(link)
  if (fallback && data[fallback as FullSlug]) return data[fallback as FullSlug]
  return null
}

function showPreviewFor(link: HTMLAnchorElement, data: Index) {
  const raw = resolveDetails(link, data)
  if (!raw) return

  const el = ensureOverlay()
  const excerpt = (raw.excerpt ?? raw.description ?? "").toString()
  const fm = raw.frontmatterValues ?? {}
  const status = fm.status
  const updated = formatDate(fm.updated_at ?? fm.updated) || formatDate(raw.updated)

  if (overlayTitle) overlayTitle.textContent = raw.title || link.textContent || raw.slug
  if (overlayExcerpt) {
    overlayExcerpt.textContent = excerpt
    overlayExcerpt.classList.toggle("is-empty", excerpt.length === 0)
  }
  if (overlayMeta) {
    overlayMeta.innerHTML = ""
    if (status) {
      const chip = document.createElement("span")
      chip.className = "wlp-chip wlp-status"
      chip.dataset.status = status
      chip.textContent = status
      overlayMeta.appendChild(chip)
    }
    if (updated) {
      const chip = document.createElement("span")
      chip.className = "wlp-chip wlp-updated"
      chip.textContent = `upd ${updated}`
      overlayMeta.appendChild(chip)
    }
    overlayMeta.style.display = overlayMeta.childNodes.length ? "" : "none"
  }

  el.classList.add("is-visible")
  el.setAttribute("aria-hidden", "false")
  const tooltipId = "wiki-link-preview-tooltip"
  el.id = tooltipId
  link.setAttribute("aria-describedby", tooltipId)

  // Position needs to run after layout — RAF ensures geometry is settled.
  requestAnimationFrame(() => positionOverlay(link))
  activeLink = link
}

function isTooltipCandidate(a: HTMLAnchorElement | null): a is HTMLAnchorElement {
  if (!a) return false
  if (!a.classList.contains("internal")) return false
  if (a.classList.contains("broken")) return false
  if (a.classList.contains("tag-link")) return false
  if (a.classList.contains("transclude-src")) return false
  if (a.dataset.noPopover === "true") return false
  // Skip bare anchor fragments and headline anchors.
  const href = a.getAttribute("href") ?? ""
  if (href.startsWith("#")) return false
  return true
}

async function attach() {
  const data = (await fetchData) as Index
  if (!data) return

  function onMouseOver(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null
    const link = target?.closest?.("a") as HTMLAnchorElement | null
    if (!isTooltipCandidate(link)) return
    if (link === activeLink) {
      cancelClose()
      return
    }
    cancelClose()
    cancelOpen()
    openTimer = window.setTimeout(() => {
      try {
        showPreviewFor(link, data)
      } catch (err) {
        console.error("wiki-link-preview", err)
      }
    }, OPEN_DELAY_MS)
  }

  function onMouseOut(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null
    const link = target?.closest?.("a") as HTMLAnchorElement | null
    if (!link || !isTooltipCandidate(link)) return
    const toEl = (ev.relatedTarget as HTMLElement | null) ?? null
    if (toEl && overlay && overlay.contains(toEl)) return
    cancelOpen()
    scheduleClose()
  }

  function onFocusIn(ev: FocusEvent) {
    const target = ev.target as HTMLElement | null
    const link = target?.closest?.("a") as HTMLAnchorElement | null
    if (!isTooltipCandidate(link)) return
    cancelClose()
    showPreviewFor(link, data)
  }

  function onFocusOut() {
    scheduleClose()
  }

  // Keyboard explicit trigger: Space or ? on focused link opens preview
  // without navigating. Useful for screen-reader / keyboard-only users.
  function onKeyActivate(ev: KeyboardEvent) {
    if (ev.key !== "?" && ev.key !== " ") return
    const active = document.activeElement as HTMLAnchorElement | null
    if (!isTooltipCandidate(active)) return
    // Space on a link would normally do nothing; prevent potential scroll.
    if (ev.key === " ") ev.preventDefault()
    cancelClose()
    showPreviewFor(active, data)
  }

  // Touch long-press: 500 ms press opens preview. Single tap navigates.
  let longPressTimer: number | null = null
  let longPressLink: HTMLAnchorElement | null = null
  let longPressStart: { x: number; y: number } | null = null

  function clearLongPress() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer)
      longPressTimer = null
    }
    longPressLink = null
    longPressStart = null
  }

  function onTouchStart(ev: TouchEvent) {
    if (ev.touches.length !== 1) return
    const target = ev.target as HTMLElement | null
    const link = target?.closest?.("a") as HTMLAnchorElement | null
    if (!isTooltipCandidate(link)) return
    const t = ev.touches[0]
    longPressLink = link
    longPressStart = { x: t.clientX, y: t.clientY }
    longPressTimer = window.setTimeout(() => {
      if (longPressLink) {
        try {
          showPreviewFor(longPressLink, data)
        } catch (err) {
          console.error("wiki-link-preview touch", err)
        }
      }
      longPressTimer = null
    }, LONG_PRESS_MS)
  }

  function onTouchMove(ev: TouchEvent) {
    if (!longPressStart) return
    const t = ev.touches[0]
    if (!t) return
    const dx = Math.abs(t.clientX - longPressStart.x)
    const dy = Math.abs(t.clientY - longPressStart.y)
    if (dx > LONG_PRESS_CANCEL_PX || dy > LONG_PRESS_CANCEL_PX) clearLongPress()
  }

  // Track the specific link whose click must be swallowed — only the anchor
  // that just long-pressed, not any subsequent tap.
  let suppressClickLink: HTMLAnchorElement | null = null

  function onTouchEnd() {
    // If the long-press timer already fired and showed a preview for this
    // link, swallow the synthetic click that follows touchend on that exact
    // anchor.
    if (longPressTimer === null && longPressLink && overlay?.classList.contains("is-visible")) {
      suppressClickLink = longPressLink
      // Safety: if the click doesn't arrive (e.g. user moved finger), clear
      // the flag on the next event loop turn so it can't leak.
      window.setTimeout(() => {
        if (suppressClickLink === longPressLink) suppressClickLink = null
      }, 500)
    }
    clearLongPress()
  }

  function onLinkClick(ev: MouseEvent) {
    if (!suppressClickLink) return
    const target = ev.target as HTMLElement | null
    const link = target?.closest?.("a") as HTMLAnchorElement | null
    if (link !== suppressClickLink) return
    ev.preventDefault()
    suppressClickLink = null
  }

  function onScroll() {
    if (activeLink) positionOverlay(activeLink)
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape" && activeLink) {
      hidePreview()
    }
  }

  document.addEventListener("mouseover", onMouseOver)
  document.addEventListener("mouseout", onMouseOut)
  document.addEventListener("focusin", onFocusIn)
  document.addEventListener("focusout", onFocusOut)
  document.addEventListener("keydown", onKeyDown)
  document.addEventListener("keydown", onKeyActivate)
  document.addEventListener("touchstart", onTouchStart, { passive: true })
  document.addEventListener("touchmove", onTouchMove, { passive: true })
  document.addEventListener("touchend", onTouchEnd)
  document.addEventListener("touchcancel", clearLongPress)
  document.addEventListener("click", onLinkClick, true)
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)

  window.addCleanup(() => {
    document.removeEventListener("mouseover", onMouseOver)
    document.removeEventListener("mouseout", onMouseOut)
    document.removeEventListener("focusin", onFocusIn)
    document.removeEventListener("focusout", onFocusOut)
    document.removeEventListener("keydown", onKeyDown)
    document.removeEventListener("keydown", onKeyActivate)
    document.removeEventListener("touchstart", onTouchStart)
    document.removeEventListener("touchmove", onTouchMove)
    document.removeEventListener("touchend", onTouchEnd)
    document.removeEventListener("touchcancel", clearLongPress)
    document.removeEventListener("click", onLinkClick, true)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    clearLongPress()
    hidePreview()
  })
}

document.addEventListener("nav", () => {
  attach().catch((err) => console.error("wiki-link-preview setup", err))
})

document.addEventListener("prenav", hidePreview)
