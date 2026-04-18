import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  const hasSteps = Boolean(fileData.frontmatter?.has_steps)
  return (
    <article class={classString} data-has-steps={hasSteps || undefined}>
      {content}
    </article>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
