import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
  baseAlpha: number
}

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  const visited = getVisited()
  removeAllChildren(graph)
  const isGlobalGraph = graph.classList.contains("global-graph-container")

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    opacityScale,
    removeTags,
    showTags,
    focusOnHover,
    enableRadial,
    highlightColor,
    colorGroups,
    autoColorFolders,
    persistPositions,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  const tweens = new Map<string, TweenNode>()
  for (const [source, details] of data.entries()) {
    const outgoing = details.links ?? []

    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source: source, target: dest })
      }
    }

    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))

      tags.push(...localTags.filter((tag) => !tags.includes(tag)))

      for (const tag of localTags) {
        links.push({ source: source, target: tag })
      }
    }
  }

  const neighbourhood = new Set<SimpleSlug>()
  const wl: (SimpleSlug | "__SENTINEL")[] = [slug, "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbourhood.add(cur)
        const outgoing = links.filter((l) => l.source === cur)
        const incoming = links.filter((l) => l.target === cur)
        wl.push(...outgoing.map((l) => l.target), ...incoming.map((l) => l.source))
      }
    }
  } else {
    validLinks.forEach((id) => neighbourhood.add(id))
    if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
  }

  const nodes = [...neighbourhood].map((url) => {
    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)
    return {
      id: url,
      text,
      tags: data.get(url)?.tags ?? [],
    }
  })
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: links
      .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
      .map((l) => ({
        source: nodes.find((n) => n.id === l.source)!,
        target: nodes.find((n) => n.id === l.target)!,
      })),
  }

  // Precompute degree (used by node size formula, stats panel, orphan filter, tooltip)
  const degreeById = new Map<string, number>()
  for (const l of graphData.links) {
    const s = (l.source as unknown as NodeData).id ?? (l.source as unknown as string)
    const t = (l.target as unknown as NodeData).id ?? (l.target as unknown as string)
    degreeById.set(s as string, (degreeById.get(s as string) ?? 0) + 1)
    degreeById.set(t as string, (degreeById.get(t as string) ?? 0) + 1)
  }

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // Persistent positions: restore cached layout to avoid re-computing on every page load
  const storageKey = persistPositions
    ? `qg-positions-${depth === -1 ? "global" : `local-${fullSlug}`}`
    : null
  if (storageKey) {
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey) || "null") as Record<
        string,
        { x: number; y: number }
      > | null
      if (cached) {
        for (const n of graphData.nodes) {
          const p = cached[n.id]
          if (p) {
            ;(n as unknown as { x: number; y: number; vx: number; vy: number }).x = p.x
            ;(n as unknown as { x: number; y: number; vx: number; vy: number }).y = p.y
            ;(n as unknown as { x: number; y: number; vx: number; vy: number }).vx = 0
            ;(n as unknown as { x: number; y: number; vx: number; vy: number }).vy = 0
          }
        }
      }
    } catch {}
  }

  // we virtualize the simulation and use pixi to actually render it
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", forceManyBody().strength(-100 * repelForce))
    .force("center", forceCenter().strength(centerForce))
    .force("link", forceLink(graphData.links).distance(linkDistance))
    .force("collide", forceCollide<NodeData>((n) => nodeRadius(n)).iterations(3))

  // Save positions once simulation stabilizes (throttled)
  if (storageKey) {
    let saveTimer: number | null = null
    simulation.on("tick.persist", () => {
      if (simulation.alpha() > 0.05) return
      if (saveTimer) return
      saveTimer = window.setTimeout(() => {
        const snapshot: Record<string, { x: number; y: number }> = {}
        for (const n of graphData.nodes) {
          const nn = n as unknown as { x: number; y: number }
          if (nn.x != null && nn.y != null) snapshot[n.id] = { x: nn.x, y: nn.y }
        }
        try {
          localStorage.setItem(storageKey, JSON.stringify(snapshot))
        } catch {}
        saveTimer = null
      }, 500)
    })
  }

  const radius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(radius).strength(0.2))

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--secondary",
    "--tertiary",
    "--gray",
    "--light",
    "--lightgray",
    "--dark",
    "--darkgray",
    "--bodyFont",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // djb2 hash → HSL color (deterministic, same folder always gets same hue)
  const hashColor = (s: string) => {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return `hsl(${Math.abs(h) % 360}, 65%, 60%)`
  }

  // calculate color
  const color = (d: NodeData) => {
    const isCurrent = d.id === slug
    if (isCurrent) {
      return computedStyleMap["--secondary"]
    }
    if (colorGroups) {
      for (const [prefix, c] of Object.entries(colorGroups)) {
        if (d.id.startsWith(prefix)) return c
      }
    }
    if (d.id.startsWith("tags/")) {
      return computedStyleMap["--tertiary"]
    }
    if (autoColorFolders) {
      const slash = d.id.indexOf("/")
      if (slash > 0) return hashColor(d.id.slice(0, slash))
    }
    if (visited.has(d.id)) {
      return computedStyleMap["--tertiary"]
    }
    return computedStyleMap["--gray"]
  }

  function nodeRadius(d: NodeData) {
    const degree = degreeById.get(d.id) ?? 0
    const baseR = 3
    const k = 2.2
    return Math.min(baseR + k * Math.log1p(degree), 12)
  }

  let hoveredNodeId: string | null = null
  let hoveredNeighbours: Set<string> = new Set()
  // Latest zoom-driven label opacity — used by renderLabels as the fallback when
  // no hover is active, so labels revert correctly after hover-leave.
  let baseLabelAlpha = 0
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    hoveredNodeId = newHoveredId

    const tip = graph.querySelector(".graph-hover-info") as HTMLElement | null
    if (tip) {
      if (newHoveredId === null) {
        tip.classList.remove("visible")
        tip.textContent = ""
      } else {
        const node = graphData.nodes.find((n) => n.id === newHoveredId)
        const deg = degreeById.get(newHoveredId) ?? 0
        if (node) {
          tip.textContent = `${node.text} · ${deg} connection${deg === 1 ? "" : "s"}`
          tip.classList.add("visible")
        }
      }
    }

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set()
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2
      }

      l.color = l.active
        ? (highlightColor ?? computedStyleMap["--gray"])
        : computedStyleMap["--lightgray"]
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.id

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else if (hoveredNodeId !== null && focusOnHover && !hoveredNeighbours.has(nodeId)) {
        // Hide labels of non-neighbor nodes when focusing on a constellation
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 0,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      } else if (hoveredNodeId !== null && hoveredNeighbours.has(nodeId)) {
        // 1-hop neighbour during hover — show its label regardless of zoom-driven alpha
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: baseLabelAlpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      let alpha = n.baseAlpha

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && focusOnHover) {
        alpha = n.active ? 1 : 0.2
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  // Returns the group label a node belongs to (for legend/filtering)
  const nodeGroup = (id: string): string | null => {
    if (id.startsWith("tags/")) return null
    if (colorGroups) {
      for (const prefix of Object.keys(colorGroups)) {
        if (id.startsWith(prefix)) return prefix.replace(/\/$/, "")
      }
    }
    if (autoColorFolders) {
      const slash = id.indexOf("/")
      if (slash > 0) return id.slice(0, slash)
    }
    return null
  }

  const activeFilters = new Set<string>()
  let searchQuery = ""
  let hideOrphans = false

  const applyFilter = () => {
    const anyGroupFilter = activeFilters.size > 0
    const q = searchQuery.trim().toLowerCase()
    const nodeVisible = new Map<string, boolean>()
    for (const n of nodeRenderData) {
      const id = n.simulationData.id
      const g = nodeGroup(id)
      const groupOk = !anyGroupFilter || (g !== null && activeFilters.has(g))
      const searchOk = !q || n.simulationData.text.toLowerCase().includes(q)
      const deg = degreeById.get(id) ?? 0
      const orphanOk = !hideOrphans || deg > 0
      const visible = groupOk && searchOk && orphanOk
      n.gfx.visible = visible
      n.label.visible = visible
      nodeVisible.set(id, visible)
    }
    for (const l of linkRenderData) {
      const sId = (l.simulationData.source as NodeData).id
      const tId = (l.simulationData.target as NodeData).id
      l.gfx.visible = !!nodeVisible.get(sId) && !!nodeVisible.get(tId)
    }
  }

  // Color-group legend overlay (interactive: click to filter)
  if (colorGroups || autoColorFolders) {
    const usedGroups = new Map<string, string>() // label -> color
    for (const n of graphData.nodes) {
      if (n.id === slug) continue
      const g = nodeGroup(n.id)
      if (!g) continue
      if (usedGroups.has(g)) continue
      if (colorGroups) {
        const explicit = Object.entries(colorGroups).find(([p]) => n.id.startsWith(p))
        if (explicit) {
          usedGroups.set(g, explicit[1])
          continue
        }
      }
      usedGroups.set(g, hashColor(g))
    }
    if (usedGroups.size > 0) {
      const legend = document.createElement("div")
      legend.className = "graph-legend"
      for (const [label, col] of usedGroups) {
        const row = document.createElement("div")
        row.className = "graph-legend-row"
        row.dataset.group = label
        const dot = document.createElement("span")
        dot.className = "graph-legend-dot"
        dot.style.background = col
        const name = document.createElement("span")
        name.textContent = label
        row.appendChild(dot)
        row.appendChild(name)
        row.addEventListener("click", () => {
          if (activeFilters.has(label)) {
            activeFilters.delete(label)
            row.classList.remove("active")
          } else {
            activeFilters.add(label)
            row.classList.add("active")
          }
          legend.classList.toggle("has-filter", activeFilters.size > 0)
          applyFilter()
        })
        legend.appendChild(row)
      }
      graph.appendChild(legend)

      // --- Search input (v2) — only on global graph, too cramped for the sidebar ---
      if (isGlobalGraph) {
        const searchInput = document.createElement("input")
        searchInput.type = "search"
        searchInput.placeholder = "Search…"
        searchInput.className = "graph-legend-search"
        searchInput.addEventListener("input", () => {
          searchQuery = searchInput.value
          applyFilter()
        })
        legend.prepend(searchInput)
      }
    }
  }

  // --- Stats panel (v2) — only on global graph (overlaps the 250px sidebar thumbnail) ---
  if (isGlobalGraph) {
  // Count components via BFS on undirected adjacency
  const countComponents = (): number => {
    const adj = new Map<string, string[]>()
    for (const n of graphData.nodes) adj.set(n.id, [])
    for (const l of graphData.links) {
      const s = (l.source as unknown as NodeData).id ?? (l.source as unknown as string)
      const t = (l.target as unknown as NodeData).id ?? (l.target as unknown as string)
      adj.get(s as string)?.push(t as string)
      adj.get(t as string)?.push(s as string)
    }
    const seen = new Set<string>()
    let count = 0
    for (const n of graphData.nodes) {
      if (seen.has(n.id)) continue
      count++
      const queue: string[] = [n.id]
      while (queue.length) {
        const cur = queue.shift()!
        if (seen.has(cur)) continue
        seen.add(cur)
        queue.push(...(adj.get(cur) ?? []))
      }
    }
    return count
  }

  {
    const N = graphData.nodes.length
    const E = graphData.links.length
    const density = N > 1 ? ((E / (N * (N - 1) * 0.5)) * 100).toFixed(2) : "0"
    let sumDeg = 0
    let maxDeg = 0
    let orphanCount = 0
    for (const n of graphData.nodes) {
      const d = degreeById.get(n.id) ?? 0
      sumDeg += d
      if (d > maxDeg) maxDeg = d
      if (d === 0) orphanCount++
    }
    const avgDeg = N > 0 ? (sumDeg / N).toFixed(2) : "0"
    const hubs = [...graphData.nodes]
      .map((n) => ({ text: n.text, d: degreeById.get(n.id) ?? 0 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 5)

    const stats = document.createElement("div")
    stats.className = "graph-stats"

    const addRow = (text: string) => {
      const row = document.createElement("div")
      row.className = "graph-stats-row"
      row.textContent = text
      stats.appendChild(row)
    }

    addRow(`Nodes: ${N} · Edges: ${E}`)
    addRow(`Density: ${density}%`)
    addRow(`Avg degree: ${avgDeg} · Max: ${maxDeg}`)
    addRow(`Components: ${countComponents()}`)
    addRow(`Orphans: ${orphanCount}`)

    const hubsTitle = document.createElement("div")
    hubsTitle.className = "graph-stats-row graph-stats-heading"
    hubsTitle.textContent = "Top hubs:"
    stats.appendChild(hubsTitle)
    for (const h of hubs) {
      const row = document.createElement("div")
      row.className = "graph-stats-row graph-stats-hub"
      row.textContent = `${h.text} (${h.d})`
      stats.appendChild(row)
    }

    // Action buttons
    const actions = document.createElement("div")
    actions.className = "graph-stats-actions"

    const orphanBtn = document.createElement("button")
    orphanBtn.type = "button"
    orphanBtn.className = "graph-stats-btn"
    const renderOrphanLabel = () =>
      (orphanBtn.textContent = hideOrphans
        ? `Show orphans (${orphanCount})`
        : `Hide orphans (${orphanCount})`)
    renderOrphanLabel()
    orphanBtn.addEventListener("click", () => {
      hideOrphans = !hideOrphans
      orphanBtn.classList.toggle("active", hideOrphans)
      renderOrphanLabel()
      applyFilter()
    })
    actions.appendChild(orphanBtn)

    const resetBtn = document.createElement("button")
    resetBtn.type = "button"
    resetBtn.className = "graph-stats-btn"
    resetBtn.textContent = "Reset layout"
    resetBtn.addEventListener("click", () => {
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey)
        } catch {}
      }
      for (const n of graphData.nodes) {
        const nn = n as unknown as { fx: number | null; fy: number | null }
        nn.fx = null
        nn.fy = null
      }
      simulation.alpha(1).restart()
    })
    actions.appendChild(resetBtn)

    stats.appendChild(actions)
    graph.appendChild(stats)
  }
  }

  // --- Hover-info tooltip (v2) ---
  const hoverInfoEl = document.createElement("div")
  hoverInfoEl.className = "graph-hover-info"
  graph.appendChild(hoverInfoEl)

  // --- Status / recency classification (v2) ---
  const OPEN_STATUSES = new Set([
    "OPEN",
    "REPORTED",
    "IN PROGRESS",
    "IN_PROGRESS",
    "TODO",
    "BLOCKED",
  ])
  const NOW = Date.now()
  const DAY_MS = 86_400_000
  const parseTs = (s: string | undefined): number | null => {
    if (!s) return null
    const t = Date.parse(s)
    return Number.isNaN(t) ? null : t
  }
  type NodeStatusInfo = {
    isOpen: boolean
    isRecent: boolean
    isStale: boolean
  }
  const statusInfo = new Map<string, NodeStatusInfo>()
  for (const n of graphData.nodes) {
    const d = data.get(n.id)
    const st = (d?.status ?? "").toUpperCase().trim()
    const updatedTs = parseTs(d?.updated) ?? parseTs(d?.created)
    const ageDays = updatedTs != null ? (NOW - updatedTs) / DAY_MS : null
    const isOpen = st.length > 0 && OPEN_STATUSES.has(st)
    const isRecent = ageDays != null && ageDays <= 7
    const isStale = st === "TODO" && ageDays != null && ageDays > 30
    statusInfo.set(n.id, { isOpen, isRecent, isStale })
  }

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  const nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      alpha: 0,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: fontSize * 15,
        fill: computedStyleMap["--dark"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: window.devicePixelRatio * 4,
    })
    label.scale.set(1 / scale)

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .circle(0, 0, nodeRadius(n))
      .fill({ color: isTagNode ? computedStyleMap["--light"] : color(n) })
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        if (!dragging) {
          renderPixiFromD3()
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
        }
      })

    const si = statusInfo.get(nodeId)
    if (isTagNode) {
      gfx.stroke({ width: 2, color: computedStyleMap["--tertiary"] })
    } else if (si?.isOpen) {
      // Open / reported issues — red outline
      gfx.stroke({ width: 2, color: "#e5484d" })
    }

    // Recency glow — extra wider, semi-transparent stroke (drawn after fill/stroke)
    if (si?.isRecent && !isTagNode) {
      gfx
        .circle(0, 0, nodeRadius(n) + 2)
        .stroke({ width: 2, color: "#4477ff", alpha: 0.55 })
    }

    const baseAlpha = si?.isStale ? 0.35 : 1
    gfx.alpha = baseAlpha

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
      baseAlpha,
    }

    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--lightgray"],
      alpha: 1,
      active: false,
    }

    linkRenderData.push(linkRenderDatum)
  }

  let currentTransform = zoomIdentity
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          // Obsidian-like drag: only 1-hop neighbors move, rest is pinned.
          if (!event.active) simulation.alphaTarget(0.1).restart()
          const draggedId = event.subject.id
          const neighbors = new Set<string>([draggedId])
          for (const l of graphData.links) {
            const s = (l.source as unknown as NodeData).id ?? (l.source as unknown as string)
            const t = (l.target as unknown as NodeData).id ?? (l.target as unknown as string)
            if (s === draggedId) neighbors.add(t as string)
            if (t === draggedId) neighbors.add(s as string)
          }
          for (const n of graphData.nodes) {
            if (!neighbors.has(n.id)) {
              n.fx = n.x
              n.fy = n.y
            }
          }
          event.subject.__radialWasOn = !!simulation.force("radial")
          if (event.subject.__radialWasOn) simulation.force("radial", null)
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0)
          for (const n of graphData.nodes) {
            n.fx = null
            n.fy = null
          }
          if (event.subject.__radialWasOn) {
            const r = (Math.min(width, height) / 2) * 0.8
            simulation.force("radial", forceRadial(r).strength(0.2))
          }
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 500) {
            const node = graphData.nodes.find((n) => n.id === event.subject.id) as NodeData
            const targ = resolveRelative(fullSlug, node.id)
            window.spaNavigate(new URL(targ, window.location.toString()))
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        const targ = resolveRelative(fullSlug, node.simulationData.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          currentTransform = transform
          stage.scale.set(transform.k, transform.k)
          stage.position.set(transform.x, transform.y)

          // zoom adjusts opacity of labels too
          const scale = transform.k * opacityScale
          let scaleOpacity = Math.max((scale - 1) / 3.75, 0)
          baseLabelAlpha = scaleOpacity
          const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label)

          for (const label of labelsContainer.children) {
            if (!activeNodes.includes(label)) {
              label.alpha = scaleOpacity
            }
          }
        }),
    )
  }

  let stopAnimation = false
  function animate(time: number) {
    if (stopAnimation) return
    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData
      if (!x || !y) continue
      n.gfx.position.set(x + width / 2, y + height / 2)
      if (n.label) {
        n.label.position.set(x + width / 2, y + height / 2)
      }
    }

    for (const l of linkRenderData) {
      const linkData = l.simulationData
      l.gfx.clear()
      l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
      l.gfx
        .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
    }

    tweens.forEach((t) => t.update(time))
    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    app.destroy()
  }
}

let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []

function cleanupLocalGraphs() {
  for (const cleanup of localGraphCleanups) {
    cleanup()
  }
  localGraphCleanups = []
}

function cleanupGlobalGraphs() {
  for (const cleanup of globalGraphCleanups) {
    cleanup()
  }
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocalGraph() {
    cleanupLocalGraphs()
    const localGraphContainers = document.getElementsByClassName("graph-container")
    for (const container of localGraphContainers) {
      localGraphCleanups.push(await renderGraph(container as HTMLElement, slug))
    }
  }

  await renderLocalGraph()
  const handleThemeChange = () => {
    void renderLocalGraph()
  }

  document.addEventListener("themechange", handleThemeChange)
  window.addCleanup(() => {
    document.removeEventListener("themechange", handleThemeChange)
  })

  const containers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]
  async function renderGlobalGraph() {
    const slug = getFullSlug(window)
    for (const container of containers) {
      container.classList.add("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = "1"
      }

      const graphContainer = container.querySelector(".global-graph-container") as HTMLElement
      registerEscapeHandler(container, hideGlobalGraph)
      if (graphContainer) {
        globalGraphCleanups.push(await renderGraph(graphContainer, slug))
      }
    }
  }

  function hideGlobalGraph() {
    cleanupGlobalGraphs()
    for (const container of containers) {
      container.classList.remove("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = ""
      }
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const anyGlobalGraphOpen = containers.some((container) =>
        container.classList.contains("active"),
      )
      anyGlobalGraphOpen ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const containerIcons = document.getElementsByClassName("global-graph-icon")
  Array.from(containerIcons).forEach((icon) => {
    icon.addEventListener("click", renderGlobalGraph)
    window.addCleanup(() => icon.removeEventListener("click", renderGlobalGraph))
  })

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcutHandler)
    cleanupLocalGraphs()
    cleanupGlobalGraphs()
  })
})
