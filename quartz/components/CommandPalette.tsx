import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/command-palette.inline"
import style from "./styles/command-palette.scss"

const CommandPalette: QuartzComponent = () => (
  <div
    class="command-palette"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cmd-palette-label"
    hidden
  >
    <div class="cmd-palette-backdrop" aria-hidden="true" />
    <div class="cmd-palette-shell" role="document">
      <label id="cmd-palette-label" class="cmd-palette-label" for="cmd-palette-input">
        Command palette
      </label>
      <div class="cmd-palette-inputrow">
        <svg
          class="cmd-palette-icon"
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
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="cmd-palette-input"
          class="cmd-palette-input"
          type="text"
          autocomplete="off"
          spellcheck={false}
          placeholder="Search pages or run action…"
          aria-controls="cmd-palette-list"
          aria-activedescendant=""
        />
        <kbd class="cmd-palette-hint">Esc</kbd>
      </div>
      <ul
        id="cmd-palette-list"
        class="cmd-palette-list"
        role="listbox"
        aria-label="Command palette results"
      ></ul>
      <div class="cmd-palette-footer" aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          navigate
        </span>
        <span>
          <kbd>Enter</kbd>
          open
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd>
          toggle
        </span>
      </div>
    </div>
  </div>
)

CommandPalette.afterDOMLoaded = script
CommandPalette.css = style

export default (() => CommandPalette) satisfies QuartzComponentConstructor
