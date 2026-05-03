import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CreateSessionResult } from '../shared/types';

export type SessionType = 'claude' | 'terminal';

interface ManagedSession {
  pty: pty.IPty;
  cwd: string;
}

// Environment variables safe to pass through to spawned sessions.
// Keeps secrets (API keys, tokens) out of terminal sessions.
const PTY_ENV_ALLOWLIST = [
  'HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'TERM_PROGRAM', 'EDITOR', 'VISUAL', 'PAGER', 'TMPDIR',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR',
  'SSH_AUTH_SOCK', 'DISPLAY', 'COLORTERM',
  // macOS specific
  '__CF_USER_TEXT_ENCODING', 'COMMAND_MODE',
  // Common dev tools that need env to locate configs
  'NVM_DIR', 'VOLTA_HOME', 'RUSTUP_HOME', 'CARGO_HOME', 'GOPATH', 'GOROOT',
  'PYENV_ROOT', 'RBENV_ROOT', 'FNM_DIR',
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

export class PtyManager {
  private sessions = new Map<string, ManagedSession>();
  private win: BrowserWindow | null = null;

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  createSession(cwd: string, sessionType: SessionType = 'claude', cols = 80, rows = 24): CreateSessionResult {
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

    const id = randomUUID();
    const command = sessionType === 'claude' ? 'claude' : process.env.SHELL || '/bin/zsh';
    const shell = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: resolved,
      env: buildPtyEnv(),
    });

    shell.onData((data: string) => {
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

    this.sessions.set(id, { pty: shell, cwd: resolved });

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
    session.pty.resize(cols, rows);
  }

  killSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}
