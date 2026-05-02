import Store from 'electron-store';
import type { LayoutMode } from '../shared/types';

interface PersistedState {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  sessions: Array<{ cwd: string; projectId: string }>;
  layoutMode: LayoutMode;
  sidebarCollapsed: boolean;
  windowBounds: { x: number; y: number; width: number; height: number } | null;
}

const store = new Store<PersistedState>({
  name: 'session-state',
  defaults: {
    projects: [],
    activeProjectId: 'default',
    sessions: [],
    layoutMode: '1',
    sidebarCollapsed: false,
    windowBounds: null,
  },
});

export function saveState(state: Omit<PersistedState, 'windowBounds'> & { windowBounds?: PersistedState['windowBounds'] }): void {
  store.set('projects', state.projects);
  store.set('activeProjectId', state.activeProjectId);
  store.set('sessions', state.sessions);
  store.set('layoutMode', state.layoutMode);
  store.set('sidebarCollapsed', state.sidebarCollapsed);
  if (state.windowBounds !== undefined) {
    store.set('windowBounds', state.windowBounds);
  }
}

export function loadState(): PersistedState {
  return {
    projects: store.get('projects'),
    activeProjectId: store.get('activeProjectId'),
    sessions: store.get('sessions'),
    layoutMode: store.get('layoutMode'),
    sidebarCollapsed: store.get('sidebarCollapsed'),
    windowBounds: store.get('windowBounds'),
  };
}
