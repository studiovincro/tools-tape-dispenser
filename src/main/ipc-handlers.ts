import { ipcMain, dialog, BrowserWindow } from 'electron';
import { app } from 'electron';
import { PtyManager } from './pty-manager';
import { saveState, loadState } from './session-store';
import type { LayoutMode, SessionType } from '../shared/types';

export function registerIpcHandlers(ptyManager: PtyManager): void {
  ipcMain.handle('session:create', (_event, { cwd, sessionType, cols, rows }: { cwd: string; sessionType?: SessionType; cols?: number; rows?: number }) => {
    return ptyManager.createSession(cwd, sessionType || 'claude', cols, rows);
  });

  ipcMain.on('session:write', (_event, { id, data }: { id: string; data: string }) => {
    ptyManager.writeToSession(id, data);
  });

  ipcMain.on('session:resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptyManager.resizeSession(id, cols, rows);
  });

  ipcMain.handle('session:kill', (_event, { id }: { id: string }) => {
    ptyManager.killSession(id);
  });

  ipcMain.handle('session:buffer', (_event, { id }: { id: string }) => {
    return ptyManager.getBuffer(id);
  });

  ipcMain.handle('dialog:pick-directory', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Choose project directory',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('store:save', (_event, payload: Record<string, unknown>) => {
    // Validate payload shape before persisting
    if (!Array.isArray(payload.projects) || !Array.isArray(payload.sessions)) {
      console.warn('store:save: invalid payload shape');
      return;
    }
    if (typeof payload.activeProjectId !== 'string' || typeof payload.layoutMode !== 'string') {
      console.warn('store:save: invalid payload types');
      return;
    }
    if (!/^[1-8]$/.test(payload.layoutMode)) {
      console.warn('store:save: invalid layoutMode');
      return;
    }
    for (const s of payload.sessions) {
      if (!s || typeof s !== 'object' || typeof (s as any).cwd !== 'string') {
        console.warn('store:save: invalid session entry');
        return;
      }
    }
    const win = BrowserWindow.getFocusedWindow();
    const bounds = win?.getBounds() ?? null;
    saveState({
      projects: payload.projects,
      activeProjectId: payload.activeProjectId,
      sessions: payload.sessions,
      layoutMode: payload.layoutMode,
      sidebarCollapsed: !!payload.sidebarCollapsed,
      sidebarWidth: typeof payload.sidebarWidth === 'number' ? payload.sidebarWidth : undefined,
      sessionFilter: typeof payload.sessionFilter === 'string' ? payload.sessionFilter : undefined,
      visibleSessionIndices: Array.isArray(payload.visibleSessionIndices) ? payload.visibleSessionIndices : undefined,
      settings: payload.settings && typeof payload.settings === 'object'
        ? {
            minPaneWidth: Math.max(200, Math.min(1000, Number((payload.settings as any).minPaneWidth) || 450)),
            terminalFontSize: Math.max(10, Math.min(24, Number((payload.settings as any).terminalFontSize) || 13)),
            defaultSessionType: (payload.settings as any).defaultSessionType === 'terminal' ? 'terminal' : 'claude',
            defaultProjectDir: typeof (payload.settings as any).defaultProjectDir === 'string' ? (payload.settings as any).defaultProjectDir : '',
            subscriptionEndDate: typeof (payload.settings as any).subscriptionEndDate === 'string' ? (payload.settings as any).subscriptionEndDate : '',
          }
        : undefined,
      windowBounds: bounds,
    } as any);
  });

  ipcMain.handle('store:load', () => {
    return loadState();
  });

}
