import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore — inline script, bundled by Quartz loader
import script from "./scripts/frontmatter-filters.inline"
import style from "./styles/frontmatter-filters.scss"
import { classNames } from "../util/lang"
import {
  FrontmatterField,
  frontmatterFields as defaultFields,
} from "../../quartz.frontmatter-fields"

interface FrontmatterFiltersOptions {
  fields: FrontmatterField[]
}

const defaultOptions: FrontmatterFiltersOptions = { fields: defaultFields }

export default ((opts?: Partial<FrontmatterFiltersOptions>) => {
  const options: FrontmatterFiltersOptions = { ...defaultOptions, ...opts }

  const FrontmatterFilters: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const cfg = JSON.stringify({ fields: options.fields })
    return (
      <div
        class={classNames(displayClass, "frontmatter-filters")}
        data-cfg={cfg}
      />
    )
  }

  FrontmatterFilters.css = style
  FrontmatterFilters.afterDOMLoaded = script

  return FrontmatterFilters
}) satisfies QuartzComponentConstructor
