import Store from 'electron-store';

interface PersistedState {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  sessions: Array<{ cwd: string; projectId: string; sessionType?: string; label?: string; colorIndex?: number }>;
  layoutMode: string;
  sidebarCollapsed: boolean;
  sidebarWidth?: number;
  sessionFilter?: string;
  visibleSessionIndices?: number[];
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
    sidebarWidth: 240,
    sessionFilter: 'all',
    visibleSessionIndices: [],
    windowBounds: null,
  },
});

export function saveState(state: Omit<PersistedState, 'windowBounds'> & { windowBounds?: PersistedState['windowBounds'] }): void {
  store.set('projects', state.projects);
  store.set('activeProjectId', state.activeProjectId);
  store.set('sessions', state.sessions);
  store.set('layoutMode', state.layoutMode);
  store.set('sidebarCollapsed', state.sidebarCollapsed);
  if (state.sidebarWidth !== undefined) store.set('sidebarWidth', state.sidebarWidth);
  if (state.sessionFilter !== undefined) store.set('sessionFilter', state.sessionFilter);
  if (state.visibleSessionIndices !== undefined) store.set('visibleSessionIndices', state.visibleSessionIndices);
  if (state.windowBounds !== undefined) store.set('windowBounds', state.windowBounds);
}

export function loadState(): PersistedState {
  return {
    projects: store.get('projects'),
    activeProjectId: store.get('activeProjectId'),
    sessions: store.get('sessions'),
    layoutMode: store.get('layoutMode'),
    sidebarCollapsed: store.get('sidebarCollapsed'),
    sidebarWidth: store.get('sidebarWidth'),
    sessionFilter: store.get('sessionFilter'),
    visibleSessionIndices: store.get('visibleSessionIndices'),
    windowBounds: store.get('windowBounds'),
  };
}
