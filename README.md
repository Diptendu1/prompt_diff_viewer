# Prompt Diff Viewer (React)

A zero-dependency React component for comparing two versions of a prompt (or any text), with GitHub-style split/unified diff views and word-level change highlighting.

## Run the demo

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The demo has two editable textareas — the diff updates live.

## Integrate into your app

Copy the `src/PromptDiffViewer/` folder into your project (it has no dependencies beyond React itself), then:

```jsx
import PromptDiffViewer from './PromptDiffViewer';

<PromptDiffViewer
  oldText={promptV1}
  newText={promptV2}
  oldLabel="Version 1"
  newLabel="Version 2"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `oldText` | `string` | `''` | Previous prompt version |
| `newText` | `string` | `''` | Current prompt version |
| `oldLabel` | `string` | `'Before'` | Column header for the old side |
| `newLabel` | `string` | `'After'` | Column header for the new side |
| `defaultView` | `'split' \| 'unified'` | `'split'` | Initial layout |
| `showToolbar` | `boolean` | `true` | Show the stats + view-switch toolbar |
| `hideUnchanged` | `boolean` | `false` | Start with unchanged lines collapsed |
| `contextLines` | `number` | `2` | Unchanged lines kept around each change when collapsing |
| `className` | `string` | `''` | Extra class on the root (pass `pdv-dark` for the built-in dark theme) |

### Theming

All colors are CSS variables scoped under `.pdv` (see `PromptDiffViewer.css`). Override them on `.pdv` or any parent to match your design system, or pass `className="pdv-dark"` for the built-in dark theme.

### Using the diff engine directly

The LCS-based diff functions are exported separately if you need raw diff data (e.g., for analytics on prompt changes):

```js
import { diffLines, diffWords, diffStats } from './PromptDiffViewer';

const rows = diffLines(oldText, newText);   // line-level rows with pairing
const stats = diffStats(rows);              // { additions, deletions }
```

## Features

- **Split and unified views**, switchable at runtime
- **Word-level highlighting** inside modified lines (not just whole-line coloring)
- **Modified-line pairing** — a changed line shows as one aligned row, not a remove + add
- **Hide unchanged** toggle with configurable context lines and "N lines hidden" markers
- **+/− stats badge** in the toolbar
- **Line numbers** for both sides
- Styles fully scoped under `.pdv` — no global CSS leakage
- No runtime dependencies (no `diff`, no `lodash`), works with React 16.8+
