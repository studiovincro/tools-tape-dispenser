import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CreateSessionResult } from '../shared/types';

export type SessionType = 'claude' | 'terminal';

const MAX_BUFFER_SIZE = 128 * 1024; // 128KB scrollback buffer per session

interface ManagedSession {
  pty: pty.IPty;
  cwd: string;
  outputBuffer: string;
}

// Environment variables safe to pass through to spawned sessions.
// Keeps secrets (API keys, tokens) out of terminal sessions.
const PTY_ENV_ALLOWLIST = [
  'HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'TERM_PROGRAM', 'EDITOR', 'VISUAL', 'PAGER', 'TMPDIR',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR',
  'SSH_AUTH_SOCK', 'DISPLAY', 'COLORTERM',
  // macOS specific
  '__CF_USER_TEXT_ENCODING', 'COMMAND_MODE', 'TERM_SESSION_ID',
  // Common dev tools that need env to locate configs
  'NVM_DIR', 'VOLTA_HOME', 'RUSTUP_HOME', 'CARGO_HOME', 'GOPATH', 'GOROOT',
  'PYENV_ROOT', 'RBENV_ROOT', 'FNM_DIR',
  // Conda/Anaconda
  'CONDA_DEFAULT_ENV', 'CONDA_PREFIX', 'CONDA_EXE', 'CONDA_PYTHON_EXE',
  'CONDA_SHLVL', '_CE_CONDA', '_CE_M',
  // Homebrew
  'HOMEBREW_PREFIX', 'HOMEBREW_CELLAR', 'HOMEBREW_REPOSITORY',
];

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = { TERM: 'xterm-256color' };
  for (const key of PTY_ENV_ALLOWLIST) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }
  return env;
}

const ALLOWED_SHELLS = ['/bin/bash', '/bin/zsh', '/bin/sh', '/bin/fish', '/usr/local/bin/fish', '/opt/homebrew/bin/fish'];
const MAX_SESSIONS = 16;
const MAX_COLS = 500;
const MAX_ROWS = 200;

export class PtyManager {
  private sessions = new Map<string, ManagedSession>();
  private win: BrowserWindow | null = null;

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  createSession(cwd: string, sessionType: SessionType = 'claude', cols = 80, rows = 24): CreateSessionResult {
    // Cap concurrent sessions
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`Maximum ${MAX_SESSIONS} concurrent sessions reached`);
    }

    // Validate cwd is a real, accessible directory
    const resolved = path.resolve(cwd);
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${resolved}`);
      }
    } catch (err) {
      throw new Error(`Invalid session directory: ${resolved}`);
    }

    // Validate sessionType to prevent arbitrary command injection
    if (sessionType !== 'claude' && sessionType !== 'terminal') {
      throw new Error(`Invalid session type: ${sessionType}`);
    }

    // Clamp cols/rows to safe bounds
    const safeCols = Math.max(1, Math.min(MAX_COLS, Math.floor(cols) || 80));
    const safeRows = Math.max(1, Math.min(MAX_ROWS, Math.floor(rows) || 24));

    const id = randomUUID();
    let command: string;
    if (sessionType === 'claude') {
      command = 'claude';
    } else {
      const userShell = process.env.SHELL || '/bin/zsh';
      command = ALLOWED_SHELLS.includes(userShell) ? userShell : '/bin/zsh';
    }
    const shell = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols: safeCols,
      rows: safeRows,
      cwd: resolved,
      env: buildPtyEnv(),
    });

    const managed: ManagedSession = { pty: shell, cwd: resolved, outputBuffer: '' };

    shell.onData((data: string) => {
      // Buffer output for replay when terminal reconnects (e.g. after project move)
      managed.outputBuffer += data;
      if (managed.outputBuffer.length > MAX_BUFFER_SIZE) {
        managed.outputBuffer = managed.outputBuffer.slice(-MAX_BUFFER_SIZE);
      }
      // Track cwd via OSC 7 escape sequences (emitted by macOS zsh on every cd)
      // Format: \x1b]7;file://hostname/path\x07  or  \x1b]7;file://hostname/path\x1b\\
      const osc7Match = data.match(/\x1b\]7;file:\/\/[^/]*(.+?)(?:\x07|\x1b\\)/);
      if (osc7Match) {
        try {
          const newCwd = decodeURIComponent(osc7Match[1]);
          if (newCwd !== managed.cwd) {
            managed.cwd = newCwd;
            if (this.win && !this.win.isDestroyed()) {
              this.win.webContents.send('pty:cwd', id, newCwd);
            }
          }
        } catch {}
      }
      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send('pty:data', id, data);
      }
    });

    shell.onExit(({ exitCode }: { exitCode: number }) => {
      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send('pty:exit', id, exitCode);
      }
      this.sessions.delete(id);
    });

    this.sessions.set(id, managed);

    return {
      id,
      cwd: resolved,
      label: path.basename(resolved),
      sessionType,
    };
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  getBuffer(id: string): string {
    return this.sessions.get(id)?.outputBuffer ?? '';
  }

  getCwd(id: string): string | null {
    return this.sessions.get(id)?.cwd ?? null;
  }

  writeToSession(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      console.warn(`writeToSession: unknown session ${id}`);
      return;
    }
    session.pty.write(data);
  }

  resizeSession(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) {
      console.warn(`resizeSession: unknown session ${id}`);
      return;
    }
    const safeCols = Math.max(1, Math.min(MAX_COLS, Math.floor(cols) || 80));
    const safeRows = Math.max(1, Math.min(MAX_ROWS, Math.floor(rows) || 24));
    session.pty.resize(safeCols, safeRows);
  }

  killSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      // Send SIGTERM first so the shell can flush history, then SIGKILL after a brief delay
      try { process.kill(session.pty.pid, 'SIGTERM'); } catch {}
      setTimeout(() => {
        try { session.pty.kill(); } catch {}
      }, 300);
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      try { session.pty.kill(); } catch {}
    }
    this.sessions.clear();
  }
}
