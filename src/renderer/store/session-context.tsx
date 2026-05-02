import React, { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { AppState, SessionInfo, LayoutMode, Project, SessionFilter } from '../../shared/types';

const DEFAULT_PROJECT_ID = 'default';

type Action =
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'REMOVE_PROJECT'; projectId: string }
  | { type: 'RENAME_PROJECT'; projectId: string; name: string }
  | { type: 'SET_ACTIVE_PROJECT'; projectId: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SESSION_FILTER'; filter: SessionFilter }
  | { type: 'SET_SIDEBAR_WIDTH'; width: number }
  | { type: 'ADD_SESSION'; session: SessionInfo }
  | { type: 'REMOVE_SESSION'; id: string }
  | { type: 'RENAME_SESSION'; id: string; label: string }
  | { type: 'MOVE_SESSION'; sessionId: string; toProjectId: string; atIndex?: number }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'SET_LAYOUT'; mode: LayoutMode }
  | { type: 'SET_VISIBLE'; ids: string[] }
  | { type: 'UPDATE_STATUS'; id: string; status: SessionInfo['status'] }
  | { type: 'UPDATE_CONTEXT'; id: string; contextPercent: number }
  | { type: 'RESTORE'; state: AppState };

const initialState: AppState = {
  projects: [{ id: DEFAULT_PROJECT_ID, name: 'General' }],
  activeProjectId: DEFAULT_PROJECT_ID,
  sessions: [],
  activeSessionId: null,
  visibleSessionIds: [],
  layoutMode: '1',
  sidebarCollapsed: false,
  sidebarWidth: 240,
  sessionFilter: 'all',
};

// Helper: get sessions for a specific project
export function getProjectSessions(state: AppState, projectId?: string): SessionInfo[] {
  const pid = projectId ?? state.activeProjectId;
  return state.sessions.filter((s) => s.projectId === pid);
}

// Helper: get filtered sessions for the active project
export function getFilteredProjectSessions(state: AppState): SessionInfo[] {
  const sessions = getProjectSessions(state);
  if (state.sessionFilter === 'all') return sessions;
  return sessions.filter((s) => s.sessionType === state.sessionFilter);
}

// Helper: available layouts based on session count (1 up to min(sessionCount, 8))
export function getAvailableLayouts(sessionCount: number): LayoutMode[] {
  const max = Math.min(sessionCount, 8);
  const all: LayoutMode[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
  return all.slice(0, max);
}

function maxPanes(mode: LayoutMode): number {
  return parseInt(mode, 10);
}

function clampLayout(mode: LayoutMode, sessionCount: number): LayoutMode {
  const available = getAvailableLayouts(sessionCount);
  if (available.includes(mode)) return mode;
  return available[available.length - 1];
}

function replaceLastVisible(visible: string[], newId: string, max: number): string[] {
  if (visible.length < max) return [...visible, newId];
  const updated = [...visible];
  updated[updated.length - 1] = newId;
  return updated;
}

function rebuildVisible(state: AppState, layoutMode: LayoutMode): string[] {
  const projectSessions = getFilteredProjectSessions(state);
  const max = maxPanes(layoutMode);
  if (layoutMode === '1') {
    return state.activeSessionId && projectSessions.some((s) => s.id === state.activeSessionId)
      ? [state.activeSessionId]
      : projectSessions.length > 0 ? [projectSessions[0].id] : [];
  }
  return projectSessions.map((s) => s.id).slice(0, max);
}

// Alias for SET_SESSION_FILTER
function rebuildFilteredVisible(state: AppState, layoutMode: LayoutMode): string[] {
  return rebuildVisible(state, layoutMode);
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // --- Project actions ---
    case 'ADD_PROJECT': {
      return {
        ...state,
        projects: [...state.projects, action.project],
        activeProjectId: action.project.id,
        visibleSessionIds: [],
        activeSessionId: null,
        layoutMode: '1',
      };
    }
    case 'REMOVE_PROJECT': {
      const projects = state.projects.filter((p) => p.id !== action.projectId);
      if (projects.length === 0) return state; // can't delete last project
      const sessions = state.sessions.filter((s) => s.projectId !== action.projectId);
      const activeProjectId = state.activeProjectId === action.projectId
        ? projects[0].id
        : state.activeProjectId;
      const newState = { ...state, projects, sessions, activeProjectId };
      const projectSessions = getProjectSessions(newState);
      const layoutMode = clampLayout(state.layoutMode, projectSessions.length);
      return {
        ...newState,
        layoutMode,
        activeSessionId: projectSessions.length > 0 ? projectSessions[0].id : null,
        visibleSessionIds: rebuildVisible(newState, layoutMode),
      };
    }
    case 'RENAME_PROJECT': {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, name: action.name } : p,
        ),
      };
    }
    case 'RENAME_SESSION': {
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.id ? { ...s, label: action.label } : s,
        ),
      };
    }
    case 'MOVE_SESSION': {
      const session = state.sessions.find((s) => s.id === action.sessionId);
      if (!session || (session.projectId === action.toProjectId && action.atIndex === undefined)) return state;
      // Remove from current position
      const without = state.sessions.filter((s) => s.id !== action.sessionId);
      const moved = { ...session, projectId: action.toProjectId };
      let newSessions: SessionInfo[];
      if (action.atIndex !== undefined) {
        const targetSessions = without.filter((s) => s.projectId === action.toProjectId);
        const otherSessions = without.filter((s) => s.projectId !== action.toProjectId);
        const idx = Math.min(action.atIndex, targetSessions.length);
        targetSessions.splice(idx, 0, moved);
        newSessions = [...otherSessions, ...targetSessions];
      } else {
        newSessions = [...without, moved];
      }
      // Rebuild visible panes for the active project
      const newState = { ...state, sessions: newSessions };
      const projectSessions = getProjectSessions(newState);
      const layoutMode = clampLayout(state.layoutMode, projectSessions.length);
      const visibleSessionIds = state.visibleSessionIds
        .filter((id) => projectSessions.some((s) => s.id === id));
      // Backfill if we lost visible sessions
      if (visibleSessionIds.length === 0 && projectSessions.length > 0) {
        visibleSessionIds.push(projectSessions[0].id);
      }
      const activeSessionId = state.activeSessionId && projectSessions.some((s) => s.id === state.activeSessionId)
        ? state.activeSessionId
        : projectSessions.length > 0 ? projectSessions[0].id : null;
      return {
        ...newState,
        layoutMode,
        visibleSessionIds: rebuildVisible({ ...newState, activeSessionId }, layoutMode),
        activeSessionId,
      };
    }
    case 'SET_ACTIVE_PROJECT': {
      const newState = { ...state, activeProjectId: action.projectId };
      const projectSessions = getProjectSessions(newState);
      const layoutMode = clampLayout(state.layoutMode, projectSessions.length);
      const activeSessionId = projectSessions.length > 0 ? projectSessions[0].id : null;
      return {
        ...newState,
        layoutMode,
        activeSessionId,
        visibleSessionIds: rebuildVisible({ ...newState, activeSessionId }, layoutMode),
      };
    }
    case 'TOGGLE_SIDEBAR': {
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    }
    case 'SET_SESSION_FILTER': {
      const newState = { ...state, sessionFilter: action.filter };
      const filtered = getFilteredProjectSessions(newState);
      const layoutMode = clampLayout(state.layoutMode, filtered.length);
      const activeSessionId = filtered.length > 0 ? filtered[0].id : null;
      return {
        ...newState,
        layoutMode,
        activeSessionId,
        visibleSessionIds: rebuildFilteredVisible(newState, layoutMode),
      };
    }
    case 'SET_SIDEBAR_WIDTH': {
      return { ...state, sidebarWidth: Math.max(160, Math.min(500, action.width)) };
    }

    // --- Session actions ---
    case 'ADD_SESSION': {
      const sessions = [...state.sessions, action.session];
      const newState = { ...state, sessions };
      const projectSessions = getProjectSessions(newState);
      const layoutMode = state.layoutMode;
      return {
        ...newState,
        activeSessionId: action.session.id,
        visibleSessionIds: layoutMode === '1'
          ? [action.session.id]
          : [...state.visibleSessionIds, action.session.id].slice(0, maxPanes(layoutMode)),
      };
    }
    case 'REMOVE_SESSION': {
      const sessions = state.sessions.filter((s) => s.id !== action.id);
      const newState = { ...state, sessions };
      const projectSessions = getProjectSessions(newState);
      const layoutMode = clampLayout(state.layoutMode, projectSessions.length);
      const visibleSessionIds = state.visibleSessionIds.filter((id) => id !== action.id);
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === action.id) {
        activeSessionId = projectSessions.length > 0 ? projectSessions[projectSessions.length - 1].id : null;
      }
      if (visibleSessionIds.length === 0 && activeSessionId) {
        visibleSessionIds.push(activeSessionId);
      }
      return { ...newState, sessions, activeSessionId, visibleSessionIds, layoutMode };
    }
    case 'SET_ACTIVE': {
      const visibleSessionIds = state.layoutMode === '1'
        ? [action.id]
        : state.visibleSessionIds.includes(action.id)
          ? state.visibleSessionIds
          : replaceLastVisible(state.visibleSessionIds, action.id, maxPanes(state.layoutMode));
      return { ...state, activeSessionId: action.id, visibleSessionIds };
    }
    case 'SET_LAYOUT': {
      const newState = { ...state, layoutMode: action.mode };
      return {
        ...newState,
        visibleSessionIds: rebuildVisible(newState, action.mode),
      };
    }
    case 'SET_VISIBLE': {
      return { ...state, visibleSessionIds: action.ids };
    }
    case 'UPDATE_STATUS': {
      const sessions = state.sessions.map((s) =>
        s.id === action.id ? { ...s, status: action.status } : s,
      );
      return { ...state, sessions };
    }
    case 'UPDATE_CONTEXT': {
      const sessions = state.sessions.map((s) =>
        s.id === action.id ? { ...s, contextPercent: action.contextPercent } : s,
      );
      return { ...state, sessions };
    }
    case 'RESTORE': {
      return action.state;
    }
    default:
      return state;
  }
}

const SessionContext = createContext<AppState>(initialState);
const SessionDispatchContext = createContext<Dispatch<Action>>(() => {});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <SessionContext.Provider value={state}>
      <SessionDispatchContext.Provider value={dispatch}>
        {children}
      </SessionDispatchContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSessionState() {
  return useContext(SessionContext);
}

export function useSessionDispatch() {
  return useContext(SessionDispatchContext);
}

export { DEFAULT_PROJECT_ID };
