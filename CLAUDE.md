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
      Sidebar.tsx     Project tree, session list, search, drag-and-drop, context menus
      SplitLayout.tsx  Pane grid, drop targets, pane headers, context menus
      TerminalPane.tsx xterm.js mount wrapper
      Footer.tsx       Stats, filter toggle, layout controls, shortcuts button
      ShortcutHelp.tsx Keyboard shortcuts overlay
      ContextMenu.tsx  Reusable right-click context menu with submenu support
      Tab.tsx          Legacy tab component (unused)
      TabBar.tsx       Legacy tab bar (unused)
    hooks/
      useTerminal.ts   xterm.js lifecycle, IPC wiring, resize handling
    theme.ts          Light theme color tokens (48 pane indicator colors)
    utils.ts          randomId helper using crypto.randomUUID
    styles/
      global.css       Base styles
  shared/
    types.ts          TypeScript types shared across main/renderer
```

## Key Concepts

### Projects and Sessions
- **Projects** group related sessions (e.g. frontend + API for the same product)
- **Sessions** are either `claude` (Claude Code CLI) or `terminal` (user's default shell)
- Each session has a persistent color assigned at creation (48 colors available)
- Sessions can be dragged between projects and reordered within projects

### Stage (Pane Layout)
- The main area displays 1-8 panes in a 2-column grid
- Panes show sessions from the active project, filtered by the All/Claude/Terminal toggle
- Pane order is independent of sidebar order
- Sessions can be dragged from sidebar onto specific pane slots
- The pane header x removes from stage (hides); closing sessions is done from the sidebar

### State Management
- All app state lives in `session-context.tsx` via React context + useReducer
- Key actions: ADD_SESSION, REMOVE_SESSION, MOVE_SESSION, SET_VISIBLE_SLOT, REMOVE_FROM_STAGE, RESTORE_VIEW
- `ADD_SESSION` auto-grows the pane count; `restoring` flag skips this during restore
- `getFilteredProjectSessions()` applies the All/Claude/Terminal filter

### Persistence
- State saved on `beforeunload` via IPC to electron-store
- Persisted: projects, sessions (cwd, label, type, colorIndex), layout mode, visible pane indices, session filter, sidebar width, window bounds
- On restore, sessions are recreated with `restoring: true` to avoid rebuild thrashing, then `RESTORE_VIEW` sets the final layout atomically

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

## Keyboard Shortcuts

- Cmd+N: New Claude session
- Cmd+Shift+N: New terminal session
- Cmd+W: Close active session (with confirmation)
- Cmd+\\: Cycle layout (pane count)
- Cmd+1-9: Jump to session N
- Cmd+Shift+]/[: Next/previous session
- Cmd+B: Toggle sidebar
- Cmd+?: Show shortcuts help
- Double-Shift: Open sidebar search
- Esc: Close search/menus

## Git

- SSH keys are not configured; use `gh` CLI (HTTPS) for push/pull operations
- Remote URL must be HTTPS format: `https://github.com/studiovincro/tools-multi-agent.git`

## Conventions

- Use yarn, not npm
- All text should be 13-14px minimum for accessibility (user has poor eyesight)
- Light theme only (no dark mode)
- macOS target with hiddenInset titlebar
- Inline styles throughout (no CSS modules or styled-components)
- Session colors are persistent across restarts and follow the session, not the pane slot
