# HanTerm

A multi-agent terminal application built with Electron + xterm.js + React. Designed for monitoring and managing multiple CLI agents (e.g., Claude Code) simultaneously in a single window.

## Features

- **Multi-Tab** — Create, close, rename, and drag-to-reorder tabs
- **Split / Stack Layout** — Tile all tabs side-by-side or switch between them one at a time
- **Draggable Dividers** — Resize panels by dragging the dividers between them
- **Clipboard Image Paste** — Cmd+V to paste images from clipboard; saves to `~/.hanterm/images/` and inserts the file path into the terminal
- **Dark / Light Theme** — Toggle between two themes at runtime
- **Tab-Panel Linking** — Click a tab to focus the panel; click a panel to highlight the tab
- **Keyboard Shortcuts**
  - `Cmd+T` — New tab
  - `Cmd+W` — Close tab
  - `Cmd+\` — Toggle split/stack layout
  - `Cmd+1-9` — Switch to tab by index

## Screenshot

```
┌──────────────────────────────────────────────┐
│                   HanTerm                    │
├──────┬───────────────┬───────────────────────┤
│ Tab1 │  Terminal 1   │  Terminal 2           │
│ Tab2 │  $ ls         │  $ npm test           │
│ Tab3 │  src/ dist/   │  PASS all tests       │
│ Tab4 │               │                       │
│      ├───────────────┼───────────────────────┤
│      │  Terminal 3   │  Terminal 4           │
│      │  $ git log    │  $ claude             │
│      │  abc1234 ...  │  > Working on task... │
├──────┴───────────────┴───────────────────────┤
│  [Split]  [Dark]                             │
└──────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js >= 18
- macOS (uses `/bin/zsh` as default shell)

### Install

```bash
git clone https://github.com/han2007happy/hanterm.git
cd hanterm
npm install
npx electron-rebuild -f -w node-pty
```

### Run

```bash
# Build and start
npm run build
npm start

# With options
npx electron dist/main/main.js --layout=split --theme=dark
```

### Development

```bash
# Start Vite dev server + compile main process
npm run dev

# Then in another terminal, start Electron in dev mode
npx electron dist/main/main.js --dev
```

## CLI Arguments

| Argument | Values | Default | Description |
|----------|--------|---------|-------------|
| `--layout` | `split`, `stack` | `stack` | Panel layout mode |
| `--theme` | `dark`, `light` | `dark` | Color theme |
| `--dev` | — | — | Connect to Vite dev server |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Electron 30 |
| Terminal | xterm.js 5 |
| PTY | node-pty |
| UI | React 18 |
| Build | Vite 5 + TypeScript |

## Project Structure

```
src/
├── main/
│   ├── main.ts          # Electron main process, PTY management
│   └── preload.ts       # IPC bridge
└── renderer/
    ├── components/
    │   ├── App.tsx       # Root component, state management
    │   ├── Sidebar.tsx   # Tab list
    │   ├── PanelArea.tsx # Grid layout, drag resize
    │   └── TerminalPanel.tsx  # xterm.js wrapper
    ├── styles/
    │   ├── global.css    # Theme variables, titlebar
    │   ├── sidebar.css   # Tab styling
    │   └── panels.css    # Terminal panel styling
    ├── types.ts          # TypeScript definitions
    ├── main.tsx          # Entry point
    └── index.html
```

## Roadmap

- [ ] MCP Server for agent communication
- [ ] Architect agent for task distribution
- [ ] Agent status display in panel headers
- [ ] Config file based launch (`hanterm start --config project.json`)
- [ ] File lock mechanism for concurrent agent editing

## License

MIT
