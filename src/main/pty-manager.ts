import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { CreateSessionResult } from '../shared/types';

export type SessionType = 'claude' | 'terminal';

interface ManagedSession {
  pty: pty.IPty;
  cwd: string;
}

export class PtyManager {
  private sessions = new Map<string, ManagedSession>();
  private win: BrowserWindow | null = null;

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  createSession(cwd: string, sessionType: SessionType = 'claude', cols = 80, rows = 24): CreateSessionResult {
    const id = randomUUID();
    const command = sessionType === 'claude' ? 'claude' : process.env.SHELL || '/bin/zsh';
    const shell = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
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

    this.sessions.set(id, { pty: shell, cwd });

    return {
      id,
      cwd,
      label: path.basename(cwd),
      sessionType,
    };
  }

  writeToSession(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resizeSession(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows);
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
