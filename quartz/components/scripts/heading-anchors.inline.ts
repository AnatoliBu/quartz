const HEADING_SELECTOR = "article :is(h1, h2, h3, h4)[id]"
const ANCHOR_CLASS = "heading-anchor"
const COPIED_CLASS = "is-copied"

function buildAnchor(): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = ANCHOR_CLASS
  btn.setAttribute("aria-label", "Copy link to this section")
  btn.innerHTML = `
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2"/>
      <path d="M15 7h2a5 5 0 1 1 0 10h-2"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  `
  return btn
}

function copyLink(id: string, btn: HTMLButtonElement) {
  const url = `${location.origin}${location.pathname}#${id}`
  const showCopied = () => {
    btn.classList.add(COPIED_CLASS)
    window.setTimeout(() => btn.classList.remove(COPIED_CLASS), 1500)
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(showCopied, (err) => {
      console.warn("heading-anchor: clipboard failed", err)
    })
  } else {
    // Fallback for insecure context / older browsers.
    const input = document.createElement("textarea")
    input.value = url
    document.body.appendChild(input)
    input.select()
    try {
      document.execCommand("copy")
      showCopied()
    } finally {
      document.body.removeChild(input)
    }
  }
}

function attachHeadings() {
  const headings = document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)
  headings.forEach((heading) => {
    if (heading.dataset.headingAnchor === "ready") return
    const id = heading.id
    if (!id) return
    // Skip if Quartz's rehype-autolink-headings already wrapped this heading
    // with a child anchor — we only need one affordance.
    if (heading.querySelector(`.${ANCHOR_CLASS}`)) return
    const btn = buildAnchor()
    btn.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      copyLink(id, btn)
    })
    heading.appendChild(btn)
    heading.dataset.headingAnchor = "ready"
    window.addCleanup(() => {
      try {
        btn.remove()
      } catch {
        /* noop */
      }
      delete heading.dataset.headingAnchor
    })
  })
}

document.addEventListener("nav", attachHeadings)
