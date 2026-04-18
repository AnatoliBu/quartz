import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { JSX } from "preact"
import style from "./styles/frontmatter.scss"
import {
  FrontmatterField,
  frontmatterFields as defaultFields,
} from "../../quartz.frontmatter-fields"

interface FrontmatterOptions {
  fields: FrontmatterField[]
}

const defaultOptions: FrontmatterOptions = { fields: defaultFields }

const formatDate = (raw: string, locale: string): string => {
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return raw
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(t),
  )
}

const formatRelative = (raw: string, locale: string): string => {
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return raw
  const diffMs = t - Date.now()
  const abs = Math.abs(diffMs)
  const day = 86_400_000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (abs < day) return rtf.format(Math.round(diffMs / 3_600_000), "hour")
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day")
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), "month")
  return rtf.format(Math.round(diffMs / (365 * day)), "year")
}

const renderValue = (raw: unknown, field: FrontmatterField, locale: string): string => {
  if (raw == null) return ""
  const s = raw instanceof Date ? raw.toISOString() : String(raw)
  if (!s.trim()) return ""
  switch (field.format) {
    case "date":
      return formatDate(s, locale)
    case "relative":
      return formatRelative(s, locale)
    default:
      return s
  }
}

export default ((opts?: Partial<FrontmatterOptions>) => {
  const options: FrontmatterOptions = { ...defaultOptions, ...opts }

  function Frontmatter({ fileData, cfg, displayClass }: QuartzComponentProps) {
    const fm = fileData.frontmatter as Record<string, unknown> | undefined
    if (!fm) return null

    const items: JSX.Element[] = []
    for (const field of options.fields) {
      const value = renderValue(fm[field.key], field, cfg.locale)
      if (!value) continue

      const label = field.label ?? field.key
      const fieldStyle = field.style ?? "text"
      const keyUpper = String(fm[field.key] ?? "").toUpperCase()
      const color = field.colorMap?.[keyUpper] ?? field.colorMap?.[String(fm[field.key])]

      if (fieldStyle === "badge") {
        items.push(
          <span class="frontmatter-item" key={field.key}>
            <span class="frontmatter-label">{label}:</span>
            <span
              class="frontmatter-badge"
              style={color ? `background:${color};border-color:${color}` : undefined}
            >
              {value}
            </span>
          </span>,
        )
      } else {
        items.push(
          <span class="frontmatter-item" key={field.key}>
            <span class="frontmatter-label">{label}:</span>
            <span class="frontmatter-value">{value}</span>
          </span>,
        )
      }
    }

    if (items.length === 0) return null

    return <div class={classNames(displayClass, "frontmatter")}>{items}</div>
  }

  Frontmatter.css = style

  return Frontmatter
}) satisfies QuartzComponentConstructor
