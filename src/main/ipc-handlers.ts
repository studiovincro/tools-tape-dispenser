import { ipcMain, dialog, BrowserWindow } from 'electron';
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

  ipcMain.handle('store:save', (_event, payload: {
    projects: Array<{ id: string; name: string }>;
    activeProjectId: string;
    sessions: Array<{ cwd: string; projectId: string; sessionType?: string }>;
    layoutMode: LayoutMode;
    sidebarCollapsed: boolean;
  }) => {
    const win = BrowserWindow.getFocusedWindow();
    const bounds = win?.getBounds() ?? null;
    saveState({ ...payload, windowBounds: bounds });
  });

  ipcMain.handle('store:load', () => {
    return loadState();
  });
}
