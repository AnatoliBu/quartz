import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/heading-anchors.inline"
import style from "./styles/heading-anchors.scss"

const HeadingAnchors: QuartzComponent = () => null

HeadingAnchors.afterDOMLoaded = script
HeadingAnchors.css = style

export default (() => HeadingAnchors) satisfies QuartzComponentConstructor
