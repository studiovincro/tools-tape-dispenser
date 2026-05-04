# Tools Multi-Agent

A desktop app for managing multiple Claude Code and terminal sessions in a single window. Organise sessions into projects, split panes to view them side by side, and switch between them instantly.

## Features

- **Multiple session types** - Claude Code (AI-powered) and standard terminal sessions
- **Project organisation** - Group related sessions into projects, drag sessions between them
- **Responsive split panes** - View 1 to 8 sessions side by side; columns adapt to window width with configurable minimum pane width
- **Session persistence** - Layout, pane order, session names, colours, and settings restored on restart
- **Terminal content preservation** - xterm instances survive pane swaps and project moves without losing content
- **Settings panel** - Configure min pane width, terminal font size, default session type, default directory, and subscription date (Cmd+,)
- **Command palette** - Cmd+Shift+P to search sessions, switch projects, and run actions instantly
- **Terminal search** - Cmd+F to search output within the focused pane with match navigation
- **Claude status dashboard** - Collapsible sidebar drawer showing all Claude sessions with live status and context window usage
- **Footer dashboard** - Subscription renewal countdown, session reset timer, context capacity gauge — all with traffic light colour coding
- **Pane layout menu** - Choose pane count, show all, and pick column arrangements from a single menu
- **Project focus mode** - Double-click a project to enter single-project view with dedicated toolbar
- **Search** - Sidebar search to filter sessions and projects by name
- **Context menus** - Right-click projects, sessions, or pane headers for quick actions (including Close All Sessions, Restart Session)
- **Drag and drop** - Reorder sessions in the sidebar, drag pane headers to swap positions
- **Session filtering** - All Sessions / Claude / Terminal filter with red indicator when active
- **Keyboard shortcuts** - Full keyboard control (Cmd+? to see all shortcuts)
- **Security hardened** - Sandboxed renderer, env allowlist, validated IPC, Electron Fuses

## Prerequisites

- macOS
- Node.js 18+
- Yarn
- Claude Code CLI installed and authenticated (`claude` available in PATH)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/studiovincro/tools-multi-agent.git
cd tools-multi-agent

# Install dependencies and rebuild native modules
yarn install
npx @electron/rebuild

# Start the app in development mode
yarn start
```

## Usage

### Creating sessions

Press **Cmd+N** for a Claude session or **Cmd+Shift+N** for a terminal. Pick a working directory (or set a default in Settings to skip the picker) and the session opens in a new pane. You can also right-click a project and choose Add Claude/Terminal Session.

### Organising projects

- Click **+** next to PROJECTS to create a new project
- Double-click a project or session name to rename it
- Drag sessions between projects to reorganise
- Use **Expand all** / **Collapse all** pills to toggle project trees
- Right-click for more options (rename, close all sessions, delete project)

### Managing panes

- Sessions auto-fill panes as you add them
- Click the **layout button** in the footer to cycle pane count
- The grid is responsive — panes wrap to new rows based on the min pane width setting
- When there's an odd number of panes, the last one spans the full width
- Drag a session from the sidebar onto a specific pane to place it
- Double-click a pane header to focus it (single pane view)
- Click **x** on a pane header to remove it from the stage (session stays alive)
- Right-click a pane header to swap, rename, focus, or close

### Settings

Open via the **Settings** pill in the sidebar or **Cmd+,**:

- **Min pane width** — when panes wrap to a new row (200–1000px)
- **Terminal font size** — applies live to all terminals (10–24px)
- **Default session type** — Claude or Terminal for new sessions
- **Default project directory** — skip the directory picker
- **Subscription start date** — monthly renewal tracking in the footer

### Footer dashboard

- **Subscription pill** — days until next monthly renewal (green/amber/red)
- **Timer pill** — click to set a countdown (30m–5h) for session reset tracking
- **Capacity pill** — session context remaining (green >40%, amber 20–40%, red <20%)

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd+Shift+P | Command palette |
| Cmd+N | New Claude session |
| Cmd+Shift+N | New terminal session |
| Cmd+W | Close active session |
| Cmd+F | Search in terminal |
| Cmd+\\ | Cycle layout |
| Cmd+1-9 | Jump to session |
| Cmd+Shift+] / [ | Next / previous session |
| Cmd+B | Toggle sidebar |
| Cmd+, | Open settings |
| Cmd+? | Show shortcuts help |
| Esc | Close search / menus / modals |

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
