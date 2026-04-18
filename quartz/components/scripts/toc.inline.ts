const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const slug = entry.target.id
    const tocEntryElements = document.querySelectorAll(`a[data-for="${slug}"]`)
    const windowHeight = entry.rootBounds?.height
    if (windowHeight && tocEntryElements.length > 0) {
      if (entry.boundingClientRect.y < windowHeight) {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.add("in-view"))
      } else {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.remove("in-view"))
      }
    }
  }
  // After the batch is processed, recompute which entry is "current" — the
  // bottom-most heading whose top has passed the viewport top. Gives the
  // classic scroll-spy "you are here" marker on top of Quartz's existing
  // accumulating .in-view highlight.
  updateCurrentTocEntry()
})

function updateCurrentTocEntry() {
  const tocs = document.querySelectorAll(".toc, details.toc")
  tocs.forEach((toc) => {
    const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>("a[data-for]"))
    if (links.length === 0) return
    // Walk links in document order; current is the last one with .in-view
    // whose corresponding heading's rect.top ≤ viewport.top + offset.
    const offset = 48
    let current: HTMLAnchorElement | null = null
    for (const link of links) {
      const id = link.dataset.for
      if (!id) continue
      const target = document.getElementById(id)
      if (!target) continue
      const rect = target.getBoundingClientRect()
      if (rect.top - offset <= 0) {
        current = link
      } else {
        break
      }
    }
    links.forEach((link) => link.classList.toggle("is-current", link === current))
  })
}

let scrollFrame: number | null = null
function onScrollSpy() {
  if (scrollFrame !== null) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    updateCurrentTocEntry()
  })
}

function toggleToc(this: HTMLElement) {
  this.classList.toggle("collapsed")
  this.setAttribute(
    "aria-expanded",
    this.getAttribute("aria-expanded") === "true" ? "false" : "true",
  )
  const content = this.nextElementSibling as HTMLElement | undefined
  if (!content) return
  content.classList.toggle("collapsed")
}

function setupToc() {
  for (const toc of document.getElementsByClassName("toc")) {
    const button = toc.querySelector(".toc-header")
    const content = toc.querySelector(".toc-content")
    if (!button || !content) return
    button.addEventListener("click", toggleToc)
    window.addCleanup(() => button.removeEventListener("click", toggleToc))
  }
}

document.addEventListener("nav", () => {
  setupToc()

  // update toc entry highlighting
  observer.disconnect()
  const headers = document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")
  headers.forEach((header) => observer.observe(header))
  // Kick off scroll-spy listener for current entry detection.
  window.addEventListener("scroll", onScrollSpy, { passive: true })
  window.addEventListener("resize", onScrollSpy)
  updateCurrentTocEntry()
  window.addCleanup(() => {
    window.removeEventListener("scroll", onScrollSpy)
    window.removeEventListener("resize", onScrollSpy)
  })
})
