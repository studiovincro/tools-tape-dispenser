export type SessionType = 'claude' | 'terminal';

export interface Project {
  id: string;
  name: string;
}

export interface SessionInfo {
  id: string;
  cwd: string;
  label: string;
  status: 'running' | 'idle' | 'exited';
  projectId: string;
  sessionType: SessionType;
  contextPercent: number | null;
  createdAt: number;
  colorIndex: number;
}

export interface CreateSessionResult {
  id: string;
  cwd: string;
  label: string;
  sessionType: SessionType;
}

export type LayoutMode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type SessionFilter = 'all' | 'claude' | 'terminal';

export interface Settings {
  minPaneWidth: number;
  terminalFontSize: number;
  defaultSessionType: SessionType;
  defaultProjectDir: string;
  subscriptionEndDate: string;
}

export const DEFAULT_SETTINGS: Settings = {
  minPaneWidth: 450,
  terminalFontSize: 13,
  defaultSessionType: 'claude',
  defaultProjectDir: '',
  subscriptionEndDate: '',
};

export interface AppState {
  projects: Project[];
  activeProjectId: string;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  visibleSessionIds: string[];
  layoutMode: LayoutMode;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sessionFilter: SessionFilter;
  settings: Settings;
}
