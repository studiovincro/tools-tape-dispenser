# Tools Multi-Agent

A desktop app for managing multiple Claude Code and terminal sessions in a single window. Organise sessions into projects, split panes to view them side by side, and switch between them instantly.

## Features

- **Multiple session types** - Claude Code (AI-powered) and standard terminal sessions
- **Project organisation** - Group related sessions into projects, drag sessions between them
- **Split pane layouts** - View 1 to 8 sessions side by side in a 2-column grid
- **Session persistence** - Layout, pane order, session names, and colours restored on restart
- **Search** - Double-tap Shift or click PROJECTS to search across all sessions
- **Context menus** - Right-click projects, sessions, or pane headers for quick actions
- **Drag and drop** - Reorder sessions in the sidebar or drag them onto specific panes
- **Session filtering** - Toggle between All, Claude, and Terminal views
- **Keyboard shortcuts** - Full keyboard control (Cmd+? to see all shortcuts)

## Prerequisites

- macOS
- Node.js 18+
- Yarn
- Claude Code CLI installed and authenticated (`claude` available in PATH)

## Getting Started

```bash
# Clone the repo
git clone git@github.com:studiovincro/tools-multi-agent.git
cd tools-multi-agent

# Install dependencies and rebuild native modules
yarn install
npx @electron/rebuild

# Start the app in development mode
yarn start
```

## Usage

### Creating sessions

Click **NEW SESSION +** in the sidebar and choose **Claude Code** or **Terminal**. Pick a working directory and the session opens in a new pane.

### Organising projects

- Click **+** next to PROJECTS to create a new project
- Double-click a project or session name to rename it
- Drag sessions between projects to reorganise
- Right-click for more options (rename, delete, move)

### Managing panes

- Sessions auto-fill panes as you add them
- Click the **layout button** in the footer to cycle pane count
- Drag a session from the sidebar onto a specific pane to place it
- Double-click a pane header to focus it (single pane view)
- Click **x** on a pane header to remove it from the stage (session stays alive)
- Right-click a pane header to swap, rename, focus, or close

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd+N | New Claude session |
| Cmd+Shift+N | New terminal session |
| Cmd+W | Close active session |
| Cmd+\\ | Cycle layout |
| Cmd+1-9 | Jump to session |
| Cmd+Shift+] / [ | Next / previous session |
| Cmd+B | Toggle sidebar |
| Cmd+? | Show shortcuts help |
| Double-Shift | Open search |
| Esc | Close search / menus |

## Build

```bash
# Package the app
yarn package

# Create distributable (dmg/zip)
yarn make
```

## Tech Stack

Electron, React 19, TypeScript, node-pty, xterm.js, electron-store, Vite, electron-forge.

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.
