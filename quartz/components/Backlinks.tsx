import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { resolveRelative, simplifySlug } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import type { QuartzPluginData } from "../plugins/vfile"

interface BacklinksOptions {
  hideWhenEmpty: boolean
  showExcerpt: boolean
  groupByFolder: boolean
  maxPerGroup?: number
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
  showExcerpt: true,
  groupByFolder: true,
}

// Stable display order for known folders. Anything else goes to "other".
const FOLDER_ORDER = [
  "bugs",
  "tasks",
  "spec-issues",
  "coupons",
  "coverage",
  "journey",
  "partner",
  "client",
  "payments",
  "ordering",
  "gateway",
  "auth",
  "common",
]

function folderOf(slug: string | undefined): string {
  if (!slug) return "other"
  const first = slug.split("/")[0]
  if (!first || first === slug) return "other"
  return first
}

function folderLabel(key: string): string {
  if (key === "other") return "Прочее"
  return key
}

type Group = { key: string; items: QuartzPluginData[] }

function groupBacklinks(files: QuartzPluginData[]): Group[] {
  const bucket = new Map<string, QuartzPluginData[]>()
  for (const f of files) {
    const key = folderOf(f.slug)
    if (!bucket.has(key)) bucket.set(key, [])
    bucket.get(key)!.push(f)
  }
  const ordered: Group[] = []
  for (const k of FOLDER_ORDER) {
    if (bucket.has(k)) {
      ordered.push({ key: k, items: bucket.get(k)! })
      bucket.delete(k)
    }
  }
  for (const [k, items] of bucket) {
    ordered.push({ key: k, items })
  }
  for (const g of ordered) {
    g.items.sort((a, b) => (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? ""))
  }
  return ordered
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const slug = simplifySlug(fileData.slug!)
    const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug))
    if (options.hideWhenEmpty && backlinkFiles.length === 0) {
      return null
    }

    const groups = options.groupByFolder
      ? groupBacklinks(backlinkFiles)
      : [{ key: "all", items: backlinkFiles }]

    const renderLink = (f: QuartzPluginData) => {
      const status = (f.frontmatter as any)?.status as string | undefined
      const excerpt = options.showExcerpt ? f.description : undefined
      return (
        <li class="backlink-item">
          <a href={resolveRelative(fileData.slug!, f.slug!)} class="internal backlink-link">
            <span class="backlink-title">{f.frontmatter?.title}</span>
            {status && (
              <span class="backlink-status" data-status={status}>
                {status}
              </span>
            )}
          </a>
          {excerpt && <p class="backlink-excerpt">{excerpt}</p>}
        </li>
      )
    }

    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(cfg.locale).components.backlinks.title}</h3>
        {backlinkFiles.length > 0 ? (
          groups.map((g) => {
            const limit = options.maxPerGroup
            const visibleItems = limit ? g.items.slice(0, limit) : g.items
            const extra = limit && g.items.length > limit ? g.items.length - limit : 0
            return (
              <div class="backlink-group" data-folder={g.key}>
                {options.groupByFolder && (
                  <div class="backlink-group-header">
                    <span class="backlink-group-dot" />
                    <span class="backlink-group-label">{folderLabel(g.key)}</span>
                    <span class="backlink-group-count">{g.items.length}</span>
                  </div>
                )}
                <ul class="backlink-list">{visibleItems.map(renderLink)}</ul>
                {extra > 0 && <p class="backlink-group-more">+{extra} more</p>}
              </div>
            )
          })
        ) : (
          <p class="backlink-empty">{i18n(cfg.locale).components.backlinks.noBacklinksFound}</p>
        )}
      </div>
    )
  }

  Backlinks.css = style

  return Backlinks
}) satisfies QuartzComponentConstructor
