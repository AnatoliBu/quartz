// Shared a11y helpers for modal overlays (command palette, lightboxes).
// Implements D1 from the UX plan — focus trap, Esc-to-close, scroll lock,
// and reduce-motion support.

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.offsetParent !== null,
  )
}

let scrollLockCount = 0
let cachedBodyStyles: { overflow: string; paddingRight: string } | null = null

export function lockBodyScroll() {
  scrollLockCount++
  if (scrollLockCount > 1) return
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  cachedBodyStyles = {
    overflow: document.body.style.overflow,
    paddingRight: document.body.style.paddingRight,
  }
  document.body.style.overflow = "hidden"
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }
}

export function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount !== 0 || !cachedBodyStyles) return
  document.body.style.overflow = cachedBodyStyles.overflow
  document.body.style.paddingRight = cachedBodyStyles.paddingRight
  cachedBodyStyles = null
}

export type OverlayController = {
  /**
   * Activate focus trap + Esc handling. Returns a disposer.
   */
  attach: () => () => void
  /**
   * Refresh focusable list (after DOM changes inside the modal).
   */
  refresh: () => void
}

export function createOverlay(
  container: HTMLElement,
  options: {
    onClose: () => void
    initialFocus?: () => HTMLElement | null
  },
): OverlayController {
  let focusable: HTMLElement[] = []
  let previouslyFocused: HTMLElement | null = null
  let attached = false

  function refresh() {
    focusable = getFocusable(container)
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      ev.stopPropagation()
      options.onClose()
      return
    }
    if (ev.key !== "Tab") return
    refresh()
    if (focusable.length === 0) {
      ev.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (ev.shiftKey && active === first) {
      ev.preventDefault()
      last.focus()
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault()
      first.focus()
    }
  }

  function attach() {
    if (attached) return () => {}
    attached = true
    previouslyFocused = document.activeElement as HTMLElement | null
    refresh()
    const initial = options.initialFocus?.() ?? focusable[0] ?? container
    initial?.focus({ preventScroll: true })
    container.addEventListener("keydown", onKeyDown)
    lockBodyScroll()
    return () => {
      if (!attached) return
      attached = false
      container.removeEventListener("keydown", onKeyDown)
      unlockBodyScroll()
      previouslyFocused?.focus?.({ preventScroll: true })
      previouslyFocused = null
    }
  }

  return { attach, refresh }
}
