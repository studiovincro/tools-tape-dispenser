# Tools Multi-Agent

An Electron desktop app for managing multiple Claude Code and terminal sessions in a single window with split pane layouts, project-based organisation, and session persistence.

## Tech Stack

- **Electron** (v41) with electron-forge + Vite plugin
- **React 19** renderer with TypeScript
- **node-pty** for spawning pseudo-terminal sessions (Claude Code or shell)
- **xterm.js** + FitAddon for terminal rendering
- **electron-store** for persisting state across restarts

## Architecture

```
src/
  main/           # Electron main process
    main.ts        Entry point, window creation, lifecycle
    pty-manager.ts  Spawns and manages node-pty instances (claude or shell)
    ipc-handlers.ts IPC bridge between main and renderer
    session-store.ts Persistence via electron-store
  preload/
    preload.ts      contextBridge API exposing IPC to renderer
  renderer/        # React app
    App.tsx          Root component, keyboard shortcuts, session lifecycle
    store/
      session-context.tsx  React context + useReducer state management
    components/
      Sidebar.tsx     Project tree, session list, search, drag-and-drop, expand/collapse, context menus
      SplitLayout.tsx  Responsive pane grid, drop targets, pane headers, context menus
      TerminalPane.tsx xterm.js mount wrapper
      Footer.tsx       Subscription pill, countdown timer, session capacity, filter toggle, layout controls
      Settings.tsx     Settings modal (min pane width, font size, defaults, subscription date)
      ShortcutHelp.tsx Keyboard shortcuts overlay
      ContextMenu.tsx  Reusable right-click context menu with submenu support
    hooks/
      useTerminal.ts   xterm.js lifecycle with terminal registry for content preservation
    theme.ts          Light theme color tokens (48 pane indicator colors)
    utils.ts          randomId helper using crypto.randomUUID
    styles/
      global.css       Base styles
  shared/
    types.ts          TypeScript types and Settings interface shared across main/renderer
```

## Key Concepts

### Projects and Sessions
- **Projects** group related sessions (e.g. frontend + API for the same product)
- **Sessions** are either `claude` (Claude Code CLI) or `terminal` (user's default shell)
- Each session has a persistent color assigned at creation (48 colors available)
- Sessions can be dragged between projects and reordered within projects
- "Close All Sessions" available via project context menu (kills all sessions, keeps project)

### Stage (Pane Layout)
- The main area displays 1-8 panes in a responsive CSS grid
- Grid columns are calculated from container width and configurable min pane width
- When the last pane is alone on its row (odd count), it spans all columns
- Panes show sessions from the active project, filtered by the All/Claude/Terminal toggle
- Sessions can be dragged from sidebar onto specific pane slots
- The pane header x removes from stage (hides); closing sessions is done from the sidebar

### Terminal Registry
- xterm.js instances are kept alive in a module-level registry outside React's lifecycle
- When sessions move between pane slots or projects, the terminal DOM element is detached and reattached — no content loss
- IPC listeners (pty data, resize, keystrokes) stay active even when detached
- `disposeTerminal()` must be called alongside `REMOVE_SESSION` to clean up

### State Management
- All app state lives in `session-context.tsx` via React context + useReducer
- Key actions: ADD_SESSION, REMOVE_SESSION, MOVE_SESSION, SET_VISIBLE_SLOT, REMOVE_FROM_STAGE, SET_SETTINGS, RESTORE_VIEW
- `ADD_SESSION` auto-grows the pane count; `restoring` flag skips this during restore
- `SET_ACTIVE` validates session exists before modifying visible list (prevents zombie panes)
- `getFilteredProjectSessions()` applies the All/Claude/Terminal filter
- Settings (min pane width, font size, defaults, subscription date) stored in state and persisted

### Persistence
- State saved on `beforeunload` via IPC to electron-store
- Persisted: projects, sessions (cwd, label, type, colorIndex), layout mode, visible pane indices, session filter, sidebar width, window bounds, settings
- IPC payload validated at the boundary (shape checks, value clamping) before saving
- On restore, sessions are recreated with `restoring: true` to avoid rebuild thrashing, then `RESTORE_VIEW` sets the final layout atomically

### Settings
- Configurable via Settings modal (gear button in sidebar or Cmd+,)
- **Min pane width (px)**: controls when panes wrap to a new row (200–1000)
- **Terminal font size (px)**: applies live to all terminals (10–24)
- **Default session type**: claude or terminal for new sessions
- **Default project directory**: skip the directory picker when set
- **Subscription start date**: monthly renewal tracking shown as traffic light pill in footer

### Footer
- **Subscription pill**: days to next monthly renewal (green >7d, amber 3–7d, red <3d)
- **Countdown timer**: click to set 30m–5h timer for session reset tracking (traffic light colors, persists across restarts)
- **Session capacity pill**: context usage remaining (green >40%, amber 20–40%, red <20%)
- **Pane layout menu**: single button with popup for pane count (1–15), show all, and column arrangement picker

### Claude Status Dashboard
- Collapsible drawer in sidebar showing all Claude sessions across all projects
- Shows status (Running/Idle/Exited) with coloured dots, context window used %
- Grouped by project, click to jump to session
- Shows "None" in red when no Claude sessions exist

### Command Palette
- **Cmd+Shift+P** opens searchable overlay
- Search sessions by name, switch projects, run actions
- Arrow keys to navigate, Enter to select, Esc to close
- Actions: new session, settings, shortcuts, show all panes

## Commands

```bash
yarn start       # Dev mode with hot reload
yarn package     # Package for distribution
yarn make        # Create distributable (dmg/zip)
```

## Session Types

- `claude` sessions spawn the `claude` CLI directly via node-pty
- `terminal` sessions spawn the user's default shell (`$SHELL` or `/bin/zsh`)
- Both get full xterm.js rendering with 256-color support
- Claude session context usage (Session: XX.X%) is parsed from pty output and shown in the footer
- PTY environment uses an allowlist to prevent leaking API keys/tokens

## Keyboard Shortcuts

- Cmd+Shift+P: Command palette
- Cmd+N: New Claude session
- Cmd+Shift+N: New terminal session
- Cmd+W: Close active session (with confirmation)
- Cmd+F: Search in terminal (focused pane)
- Cmd+\\: Cycle layout (pane count)
- Cmd+1-9: Jump to session N
- Cmd+Shift+]/[: Next/previous session
- Cmd+B: Toggle sidebar
- Cmd+,: Open settings
- Cmd+?: Show shortcuts help
- Double-Shift: Open sidebar search
- Esc: Close search/menus/modals

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Navigation and window.open blocked in renderer
- Electron Fuses: RunAsNode disabled, ASAR integrity validation, OnlyLoadAppFromAsar
- PTY env allowlist prevents API key/token leakage to spawned sessions
- IPC payloads validated at boundary before persistence
- DevTools gated behind `!app.isPackaged`

## Git

- SSH keys are not configured; use `gh` CLI (HTTPS) for push/pull operations
- Remote URL must be HTTPS format: `https://github.com/studiovincro/tools-tape-dispenser.git`

## Conventions

- Use yarn, not npm
- All text should be 13-14px minimum for accessibility (user has poor eyesight)
- Light theme only (no dark mode)
- macOS target with hiddenInset titlebar
- Inline styles throughout (no CSS modules or styled-components)
- Session colors are persistent across restarts and follow the session, not the pane slot
- Always call `disposeTerminal(id)` when dispatching `REMOVE_SESSION`
- Use `stopPropagation()` on overlay buttons to prevent event bubbling to parent click handlers
