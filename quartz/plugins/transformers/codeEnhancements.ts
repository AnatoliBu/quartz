import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import type { Root as MdastRoot, Code } from "mdast"
import type { Root as HastRoot, Element, Text } from "hast"

// Map code-annotation markers to CSS class names on the enclosing line span.
//   [!code ++]         -> line-added
//   [!code --]         -> line-removed
//   [!code focus]      -> line-focus (+ parent gets has-focus)
//   [!code error]      -> line-error
//   [!code warning]    -> line-warning
//   [!code highlight]  -> line-highlight (generic)
const MARKER_CLASS: Record<string, string> = {
  "++": "line-added",
  "--": "line-removed",
  focus: "line-focus",
  error: "line-error",
  warning: "line-warning",
  highlight: "line-highlight",
}

// Require a line-comment or HTML-comment prefix so that literal `[!code ...]`
// inside strings / prose is left alone. We also eat the prefix so the visible
// line doesn't end with an orphan `//` after stripping.
//   //  [!code focus]
//   #   [!code ++]
//   <!-- [!code error] -->
//   --  [!code warning]   (sql/haskell/lua)
//   ;   [!code --]        (ini/lisp/asm)
const MARKER_PATTERN =
  /(?:\/\/|#|--|;|<!--)\s*\[!code\s+(\+\+|--|focus|error|warning|highlight)\s*\]\s*(?:-->)?/g

// Opt-in collapsible code blocks via fenced-block meta flag:
//   ```ts collapse          — wraps figure in <details>, collapsed by default
//   ```ts collapse-open     — wraps figure in <details open>
//
// rehype-pretty-code strips extra attributes from code/pre nodes, so we
// can't rely on hProperties surviving the syntax highlighting step. Instead
// we capture the flag at the mdast stage, store the block's index in
// `file.data.collapsibles`, and re-apply by index after rehype has run.

type CollapseRecord = {
  index: number
  open: boolean
  lineCount: number
  language?: string
}

function hasFlag(meta: string | null | undefined, flag: string): boolean {
  if (!meta) return false
  const pattern = new RegExp(`(^|\\s)${flag}(\\s|$)`)
  return pattern.test(meta)
}

function countLines(code: string): number {
  if (!code) return 0
  return code.split("\n").length
}

// Collect all markers present in a line, stripping them from text nodes and
// dropping any now-empty comment spans. Returns the set of marker keywords.
//
// Shiki emits comments as colour-styled spans (inline style, no classname), so
// we can't reliably rely on CSS classes. Instead: any span whose text content
// becomes a bare comment-prefix after stripping is treated as orphan and
// removed from its parent.
const EMPTY_COMMENT_RE = /^[\s/#\-<>!]*$/

function findMarkers(line: Element): Set<string> {
  const found = new Set<string>()
  const walk = (node: Element) => {
    const children = node.children
    if (!children) return
    // Reverse iteration so splices don't shift unvisited indices.
    for (let i = children.length - 1; i >= 0; i--) {
      const child: any = children[i]
      if (child.type === "text") {
        const t: Text = child
        const original = t.value ?? ""
        MARKER_PATTERN.lastIndex = 0
        if (MARKER_PATTERN.test(original)) {
          MARKER_PATTERN.lastIndex = 0
          t.value = original.replace(MARKER_PATTERN, (_, keyword: string) => {
            found.add(keyword)
            return ""
          })
        }
      } else if (child.type === "element") {
        walk(child)
        if (child.tagName === "span") {
          const text = collectText(child)
          if (EMPTY_COMMENT_RE.test(text)) {
            children.splice(i, 1)
          }
        }
      }
    }
  }
  walk(line)
  // Trim trailing whitespace from the last text descendant on the line — some
  // languages leave a " " before the marker that becomes trailing whitespace.
  trimTrailingWhitespace(line)
  return found
}

function trimTrailingWhitespace(node: Element) {
  const children = node.children
  if (!children || children.length === 0) return
  for (let i = children.length - 1; i >= 0; i--) {
    const c: any = children[i]
    if (c.type === "text") {
      c.value = (c.value ?? "").replace(/\s+$/, "")
      if (c.value === "") {
        children.splice(i, 1)
        continue
      }
      return
    }
    if (c.type === "element") {
      trimTrailingWhitespace(c)
      const txt = collectText(c)
      if (txt === "") {
        children.splice(i, 1)
        continue
      }
      return
    }
  }
}

function collectText(el: Element): string {
  let out = ""
  for (const c of el.children ?? []) {
    if (c.type === "text") out += (c as Text).value
    else if (c.type === "element") out += collectText(c as Element)
  }
  return out
}

export const CodeEnhancements: QuartzTransformerPlugin = () => ({
  name: "CodeEnhancements",
  markdownPlugins() {
    return [
      () => (tree: MdastRoot, file: any) => {
        const records: CollapseRecord[] = []
        let idx = 0
        visit(tree, "code", (node: Code) => {
          const meta = node.meta ?? ""
          const collapseOpen = hasFlag(meta, "collapse-open")
          const collapse = collapseOpen || hasFlag(meta, "collapse")
          if (collapse) {
            records.push({
              index: idx,
              open: collapseOpen,
              lineCount: countLines(node.value),
              language: node.lang ?? undefined,
            })
          }
          idx++
        })
        if (records.length > 0) {
          file.data = file.data ?? {}
          file.data.collapsibles = records
        }
      },
    ]
  },
  htmlPlugins() {
    return [
      // A2 — annotate lines whose comments contain [!code ...] markers, and
      // strip the markers from the visible output.
      () => (tree: HastRoot) => {
        visit(tree, { type: "element", tagName: "figure" }, (figure: Element) => {
          const props = (figure.properties ?? {}) as Record<string, unknown>
          const isPrettyFigure =
            "data-rehype-pretty-code-figure" in props ||
            "dataRehypePrettyCodeFigure" in props
          if (!isPrettyFigure) return

          let hasFocusedLine = false
          visit(figure, { type: "element", tagName: "span" }, (line: Element) => {
            const lineProps = (line.properties ?? {}) as Record<string, unknown>
            // rehype-pretty-code emits `<span data-line>` for each code line.
            const isLine =
              "data-line" in lineProps ||
              "dataLine" in lineProps ||
              (Array.isArray(lineProps.className) &&
                (lineProps.className as string[]).includes("line"))
            if (!isLine) return

            const matches = findMarkers(line)
            if (matches.size === 0) return

            const existingClasses: string[] = Array.isArray(lineProps.className)
              ? (lineProps.className as string[])
              : []
            const classes = new Set<string>(existingClasses)
            for (const marker of matches) {
              const cls = MARKER_CLASS[marker]
              if (cls) classes.add(cls)
              if (marker === "focus") hasFocusedLine = true
            }
            lineProps.className = Array.from(classes)
          })

          if (hasFocusedLine) {
            const figClasses = new Set<string>(
              (Array.isArray(props.className) ? (props.className as string[]) : []) ?? [],
            )
            figClasses.add("has-focus")
            props.className = Array.from(figClasses)
          }
        })
      },
      // A4 — wrap collapsible figures (records collected in markdownPlugins).
      () => (tree: HastRoot, file: any) => {
        const records: CollapseRecord[] | undefined = file?.data?.collapsibles
        if (!records || records.length === 0) return
        const byIndex = new Map(records.map((r) => [r.index, r]))

        // Walk figure nodes emitted by rehype-pretty-code in encounter order
        // and wrap each one whose index matches a mdast `collapse` record.
        let count = 0
        visit(tree, { type: "element", tagName: "figure" }, (node: Element, index, parent) => {
          const props = (node.properties ?? {}) as Record<string, unknown>
          const isPrettyFigure =
            "data-rehype-pretty-code-figure" in props ||
            "dataRehypePrettyCodeFigure" in props
          if (!isPrettyFigure) return
          const record = byIndex.get(count)
          count++
          if (!record || !parent || typeof index !== "number") return

          const language = record.language ?? "code"
          const summary: Element = {
            type: "element",
            tagName: "summary",
            properties: { className: ["code-collapse-summary"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["ccs-lang"] },
                children: [{ type: "text", value: language }],
              },
              {
                type: "element",
                tagName: "span",
                properties: { className: ["ccs-count"] },
                children: [{ type: "text", value: `${record.lineCount} lines` }],
              },
            ],
          }

          const wrapper: Element = {
            type: "element",
            tagName: "details",
            properties: {
              className: ["code-collapse"],
              ...(record.open ? { open: true } : {}),
            },
            children: [summary, node],
          }

          ;(parent as any).children[index] = wrapper
        })
      },
    ]
  },
})
