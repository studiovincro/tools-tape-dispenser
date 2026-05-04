# Tools Multi-Agent — Roadmap

Product backlog and roadmap for features, improvements, and hardening. Pick from this list as needed — nothing here is committed until it's in progress.

---

## Feature Roadmap

### High Impact

- [ ] **Notification drawer** — Sidebar panel tracking session events (running->idle, exited). Latest notification shown above Settings/Help, count badge, click to navigate to session. Also fire macOS notification when app is in background.
- [ ] **Jira ticket sidebar / Markdown spec viewer** — Side panel showing project tickets (from Jira API or local markdown files) that can be used to prompt Claude sessions. Manage specs/TODO per project. Could be a collapsible drawer or split view. Start with local markdown (no auth needed), add Jira later as optional integration.
- [ ] **Pane pagination** — When a project has more sessions than the current layout fits, add prev/next page controls to cycle through sessions in batches matching the layout size (e.g., 4 panes -> page 1 shows sessions 1-4, page 2 shows 5-8). Footer pill or pane header arrows. Keyboard: Cmd+Left/Right to page. Persisted per-project.
- [ ] **Session activity indicator pills** — Replace small status dots with readable text pills ("Running", "Idle", "Exited") at 13-14px for accessibility.
- [ ] **Global minimum UI text size** — Settings option to enforce 14px minimum across all UI elements (some labels currently 11-12px).

### Medium Impact

- [ ] **Pane zoom/focus toggle** — Cmd+Enter to toggle between focused single pane and previous multi-pane layout.
- [ ] **Export/copy session output** — Right-click to copy all visible output or save to file.
- [ ] **Session duration/idle time display** — Show "Idle 2m", "Running 45m" next to sessions in sidebar for quick scanning.
- [ ] **High contrast mode** — WCAG AAA compliant color toggle for better readability on any monitor.
- [ ] **Session preview popover** — Hover sidebar session 1s to see type, project, cwd, status, context usage in a popover.
- [ ] **Session notes/tags** — Small edit field per session for custom tags ("main", "debugging", "on hold") with full-text search.
- [ ] **Error/warning toast notifications** — Sticky toast pills (15px+) for critical events: "Session exited", "Context limit reached".

### Lower Impact

- [ ] **Configurable keyboard shortcuts** — Rebindable keys for power users.
- [ ] **Session templates** — Save project session configs as reusable templates.
- [ ] **Multi-monitor layout selector** — Text-based pill menu for organizing sessions across displays.
- [ ] **Session alias mode** — Double-click session label to set a custom short name instead of auto-generated cwd.
- [ ] **Auto-collapse sidebar on terminal focus** — Optional setting to maximise pane space.

### Parked — revisit after extended use

- [ ] **Session tabs in pane headers** — Quick switch between sessions within a pane slot. Demoted: UI space is tight, existing sidebar/search/layout tools may be sufficient. Reconsider after using the app for a while.

---

## Security Hardening

### Critical

- [ ] **Symlink traversal in CWD** — `pty-manager.ts` uses `path.resolve()` not `fs.realpathSync()`; allows spawning PTY in arbitrary directories via symlinks. Fix: resolve symlinks to canonical path before spawning.
- [ ] **Shell whitelist for execSync** — `main.ts` uses `$SHELL` without validating it's a known shell. Fix: whitelist `/bin/zsh`, `/bin/bash`, `/bin/sh`, `/bin/fish` etc.

### High

- [ ] **Session ID validation in IPC handlers** — `ipc-handlers.ts` doesn't call `hasSession()` before writing/resizing/killing. Fix: add boundary checks in all handlers.
- [ ] **session:write size validation** — No max size check on data parameter; could cause memory exhaustion. Fix: reject data > 64KB.
- [ ] **store:save property whitelist** — Accepts arbitrary extra session properties. Fix: whitelist allowed keys explicitly.

### Medium

- [ ] **OSC 7 path validation** — Decoded paths not validated as absolute before sending to renderer. Fix: check `startsWith('/')`.
- [ ] **Weak randomId fallback** — `Math.random()` fallback in renderer `utils.ts`. Fix: remove fallback or use `crypto.getRandomValues()`.
- [ ] **CSP hardening** — Add `frame-ancestors 'none'`, `object-src 'none'` to `index.html`.
- [ ] **IPC rate limiting** — No throttling on resize/write calls. Fix: add rate limits in preload or handlers.

### Low

- [ ] **Label/name length validation** — No max length on session labels or project names.
- [ ] **Referrer-Policy header** — Add `no-referrer` meta tag to `index.html`.
- [ ] **ASAR unpacking trust** — `node-pty` unpacked from ASAR; verify native module builds from trusted sources.

---

## Done

- [x] **Session output search (Cmd+F)** — xterm addon-search
- [x] **Drag to reorder panes** — Draggable pane headers
- [x] **Session status in sidebar** — Coloured dots with visibility rings
- [x] **Session grouping by type** — Group pill
- [x] **Session auto-naming from cwd** — OSC 7 tracking + type suffix
- [x] **Pin sessions to pane slots** — Per-project layout persistence
- [x] **Claude status dashboard** — Sidebar drawer with status, context usage, clickable navigation
- [x] **Command palette (Cmd+Shift+P)** — Create sessions, switch projects, jump by name, run actions
