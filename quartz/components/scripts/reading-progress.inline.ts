const BACK_TO_TOP_THRESHOLD = 500

let bar: HTMLElement | null = null
let btn: HTMLButtonElement | null = null
let rafPending = false

function measureProgress() {
  const doc = document.documentElement
  const max = (doc.scrollHeight - doc.clientHeight) || 1
  const pct = Math.max(0, Math.min(1, window.scrollY / max))
  if (bar) {
    bar.style.transform = `scaleX(${pct})`
  }
  if (btn) {
    const show = window.scrollY > BACK_TO_TOP_THRESHOLD
    btn.classList.toggle("is-visible", show)
    // Keep `hidden` in sync so the control leaves both the a11y tree and
    // pointer-flow when invisible — not just the CSS opacity fade.
    if (show) {
      if (btn.hidden) btn.hidden = false
    } else if (!btn.hidden) {
      // Defer to the end of the fade so the opacity transition is visible.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const delay = reduce ? 0 : 220
      window.setTimeout(() => {
        if (btn && !btn.classList.contains("is-visible")) btn.hidden = true
      }, delay)
    }
  }
}

function onScroll() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    measureProgress()
  })
}

function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
}

function onBackKeydown(this: HTMLButtonElement, ev: KeyboardEvent) {
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault()
    scrollToTop()
  }
}

document.addEventListener("nav", () => {
  bar = document.querySelector<HTMLElement>(".reading-progress-bar")
  btn = document.querySelector<HTMLButtonElement>(".back-to-top")
  if (!bar && !btn) return

  if (btn) {
    btn.addEventListener("click", scrollToTop)
    btn.addEventListener("keydown", onBackKeydown)
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)
  measureProgress()

  window.addCleanup(() => {
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    if (btn) {
      btn.removeEventListener("click", scrollToTop)
      btn.removeEventListener("keydown", onBackKeydown)
    }
  })
})
