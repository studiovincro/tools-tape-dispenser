import { contextBridge, ipcRenderer } from 'electron';

interface SaveStatePayload {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  sessions: Array<{ cwd: string; projectId: string; sessionType?: string; label?: string; colorIndex?: number }>;
  layoutMode: string;
  sidebarCollapsed: boolean;
  sidebarWidth?: number;
  sessionFilter?: string;
  visibleSessionIndices?: number[];
}

interface LoadStateResult {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  sessions: Array<{ cwd: string; projectId?: string; sessionType?: string; label?: string; colorIndex?: number }>;
  layoutMode: string;
  sidebarCollapsed: boolean;
  sidebarWidth?: number;
  sessionFilter?: string;
  visibleSessionIndices?: number[];
  windowBounds: { x: number; y: number; width: number; height: number } | null;
}

export interface ElectronAPI {
  createSession(cwd: string, sessionType?: string, cols?: number, rows?: number): Promise<{ id: string; cwd: string; label: string; sessionType: string }>;
  writeSession(id: string, data: string): void;
  resizeSession(id: string, cols: number, rows: number): void;
  killSession(id: string): Promise<void>;
  pickDirectory(): Promise<string | null>;
  onPtyData(callback: (id: string, data: string) => void): () => void;
  onPtyExit(callback: (id: string, code: number) => void): () => void;
  saveState(payload: SaveStatePayload): Promise<void>;
  loadState(): Promise<LoadStateResult>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  createSession(cwd: string, sessionType?: string, cols?: number, rows?: number) {
    return ipcRenderer.invoke('session:create', { cwd, sessionType, cols, rows });
  },

  writeSession(id: string, data: string) {
    ipcRenderer.send('session:write', { id, data });
  },

  resizeSession(id: string, cols: number, rows: number) {
    ipcRenderer.send('session:resize', { id, cols, rows });
  },

  killSession(id: string) {
    return ipcRenderer.invoke('session:kill', { id });
  },

  pickDirectory() {
    return ipcRenderer.invoke('dialog:pick-directory');
  },

  onPtyData(callback: (id: string, data: string) => void) {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data);
    ipcRenderer.on('pty:data', handler);
    return () => ipcRenderer.removeListener('pty:data', handler);
  },

  onPtyExit(callback: (id: string, code: number) => void) {
    const handler = (_event: Electron.IpcRendererEvent, id: string, code: number) => callback(id, code);
    ipcRenderer.on('pty:exit', handler);
    return () => ipcRenderer.removeListener('pty:exit', handler);
  },

  saveState(payload: SaveStatePayload) {
    return ipcRenderer.invoke('store:save', payload);
  },

  loadState() {
    return ipcRenderer.invoke('store:load');
  },
} satisfies ElectronAPI);
