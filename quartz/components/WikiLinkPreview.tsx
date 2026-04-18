import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/wiki-link-preview.inline"
import style from "./styles/wiki-link-preview.scss"

const WikiLinkPreview: QuartzComponent = () => null

WikiLinkPreview.afterDOMLoaded = script
WikiLinkPreview.css = style

export default (() => WikiLinkPreview) satisfies QuartzComponentConstructor
