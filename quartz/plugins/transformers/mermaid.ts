import { QuartzTransformerPlugin } from "../types"

interface Options {
  cdnUrl: string
}

const mermaidRenderer = (cdnUrl: string) => `
import mermaid from "${cdnUrl}"

const getTheme = () => document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "default"

const collectMermaidCodeBlocks = () => {
  const selectors = [
    "pre > code.language-mermaid",
    "pre > code[class~='language-mermaid']",
    "pre > code[data-language='mermaid']",
    "pre[data-language='mermaid'] > code",
  ]
  return Array.from(document.querySelectorAll(selectors.join(",")))
}

const replaceCodeBlock = (code, index) => {
  const pre = code.closest("pre")
  if (!pre || pre.dataset.mermaidProcessed === "true") return null

  const source = code.textContent ?? ""
  const container = document.createElement("div")
  container.className = "mermaid"
  container.dataset.mermaidSource = source
  container.dataset.mermaidId = "mermaid-" + Date.now().toString(36) + "-" + index
  container.textContent = source

  pre.dataset.mermaidProcessed = "true"
  pre.replaceWith(container)
  return container
}

const resetRenderedDiagrams = () => {
  for (const diagram of document.querySelectorAll(".mermaid[data-mermaid-source]")) {
    diagram.removeAttribute("data-processed")
    diagram.innerHTML = diagram.dataset.mermaidSource ?? diagram.textContent ?? ""
  }
}

const renderMermaid = async () => {
  for (const [index, code] of collectMermaidCodeBlocks().entries()) {
    replaceCodeBlock(code, index)
  }

  const diagrams = Array.from(document.querySelectorAll(".mermaid"))
  if (diagrams.length === 0) return

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: getTheme(),
  })

  try {
    await mermaid.run({ nodes: diagrams })
  } catch (error) {
    console.error("Mermaid render failed", error)
  }
}

let renderQueued = false
const queueRender = () => {
  if (renderQueued) return
  renderQueued = true
  window.requestAnimationFrame(() => {
    renderQueued = false
    renderMermaid()
  })
}

document.addEventListener("nav", queueRender)
document.addEventListener("themechange", () => {
  resetRenderedDiagrams()
  queueRender()
})

queueRender()
`

export const Mermaid: QuartzTransformerPlugin<Partial<Options>> = (opts) => {
  const cdnUrl = opts?.cdnUrl ?? "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"

  return {
    name: "Mermaid",
    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: `
.mermaid {
  max-width: 100%;
  overflow-x: auto;
  text-align: center;
  margin: 1rem 0;
}
.mermaid svg {
  max-width: 100%;
  height: auto;
}
`,
          },
        ],
        js: [
          {
            loadTime: "afterDOMReady",
            moduleType: "module",
            contentType: "inline",
            spaPreserve: true,
            script: mermaidRenderer(cdnUrl),
          },
        ],
      }
    },
  }
}
