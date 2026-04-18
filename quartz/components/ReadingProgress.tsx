import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/reading-progress.inline"
import style from "./styles/reading-progress.scss"

const ReadingProgress: QuartzComponent = () => (
  <>
    <div class="reading-progress" aria-hidden="true">
      <div class="reading-progress-bar" />
    </div>
    <button class="back-to-top" type="button" aria-label="Back to top" hidden>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  </>
)

ReadingProgress.afterDOMLoaded = script
ReadingProgress.css = style

export default (() => ReadingProgress) satisfies QuartzComponentConstructor
