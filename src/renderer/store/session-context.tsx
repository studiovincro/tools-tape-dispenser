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
  | { type: 'ADD_SESSION'; session: SessionInfo; restoring?: boolean }
  | { type: 'REMOVE_SESSION'; id: string }
  | { type: 'RENAME_SESSION'; id: string; label: string }
  | { type: 'MOVE_SESSION'; sessionId: string; toProjectId: string; atIndex?: number }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'SET_LAYOUT'; mode: LayoutMode }
  | { type: 'SET_VISIBLE'; ids: string[] }
  | { type: 'SET_VISIBLE_SLOT'; index: number; sessionId: string }
  | { type: 'REMOVE_FROM_STAGE'; id: string }
  | { type: 'UPDATE_STATUS'; id: string; status: SessionInfo['status'] }
  | { type: 'UPDATE_CONTEXT'; id: string; contextPercent: number }
  | { type: 'RESTORE'; state: AppState }
  | { type: 'RESTORE_VIEW'; layoutMode: LayoutMode; sessionFilter: SessionFilter; visibleSessionIds: string[]; activeSessionId: string | null };

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
      // Show all matching sessions, up to 8
      const desiredPanes = Math.min(filtered.length, 8);
      const layoutMode = String(Math.max(desiredPanes, 1)) as LayoutMode;
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
      const newState = { ...state, sessions, activeSessionId: action.session.id };
      if (action.restoring) {
        // During restore, just add the session without changing layout/visible
        return newState;
      }
      const filtered = getFilteredProjectSessions(newState);
      // Grow layout to include the new session, up to max 8
      const desiredPanes = Math.min(filtered.length, 8);
      const layoutMode = String(desiredPanes) as LayoutMode;
      return {
        ...newState,
        layoutMode,
        visibleSessionIds: rebuildVisible(newState, layoutMode),
      };
    }
    case 'REMOVE_SESSION': {
      const sessions = state.sessions.filter((s) => s.id !== action.id);
      const newState = { ...state, sessions };
      const filtered = getFilteredProjectSessions(newState);
      // Remove from visible and shrink layout
      const visible = state.visibleSessionIds.filter((id) => id !== action.id);
      // If visible is empty but we have sessions, show one
      if (visible.length === 0 && filtered.length > 0) {
        visible.push(filtered[0].id);
      }
      const layoutMode = String(Math.max(visible.length, filtered.length > 0 ? 1 : 0) || 1) as LayoutMode;
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === action.id) {
        activeSessionId = visible.length > 0 ? visible[0] : null;
      }
      return { ...newState, sessions, activeSessionId, visibleSessionIds: visible, layoutMode };
    }
    case 'SET_ACTIVE': {
      // Ignore if session doesn't exist (e.g. removed session via bubbled click)
      if (!state.sessions.some((s) => s.id === action.id)) return state;
      const visibleSessionIds = state.layoutMode === '1'
        ? [action.id]
        : state.visibleSessionIds.includes(action.id)
          ? state.visibleSessionIds
          : replaceLastVisible(state.visibleSessionIds, action.id, maxPanes(state.layoutMode));
      return { ...state, activeSessionId: action.id, visibleSessionIds };
    }
    case 'SET_LAYOUT': {
      const newState = { ...state, layoutMode: action.mode };
      const max = maxPanes(action.mode);
      const filtered = getFilteredProjectSessions(newState);
      // Preserve existing order — trim if shrinking, add from filtered if growing
      let visible = [...state.visibleSessionIds].filter((id) => filtered.some((s) => s.id === id));
      if (visible.length > max) {
        visible = visible.slice(0, max);
      } else if (visible.length < max) {
        for (const s of filtered) {
          if (visible.length >= max) break;
          if (!visible.includes(s.id)) visible.push(s.id);
        }
      }
      if (visible.length === 0 && filtered.length > 0) {
        visible = [filtered[0].id];
      }
      return { ...newState, visibleSessionIds: visible };
    }
    case 'SET_VISIBLE': {
      return { ...state, visibleSessionIds: action.ids };
    }
    case 'REMOVE_FROM_STAGE': {
      const visible = state.visibleSessionIds.filter((id) => id !== action.id);
      const layoutMode = String(Math.max(visible.length, 1)) as LayoutMode;
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === action.id) {
        activeSessionId = visible.length > 0 ? visible[0] : null;
      }
      return { ...state, visibleSessionIds: visible, layoutMode, activeSessionId };
    }
    case 'SET_VISIBLE_SLOT': {
      const visible = [...state.visibleSessionIds];
      // Remove the session from its current slot if it's already visible
      const existingIdx = visible.indexOf(action.sessionId);
      if (existingIdx !== -1 && existingIdx !== action.index) {
        // Swap: put whatever was in the target slot into the old slot
        visible[existingIdx] = visible[action.index];
      }
      visible[action.index] = action.sessionId;
      return { ...state, visibleSessionIds: visible, activeSessionId: action.sessionId };
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
    case 'RESTORE_VIEW': {
      return {
        ...state,
        layoutMode: action.layoutMode,
        sessionFilter: action.sessionFilter,
        visibleSessionIds: action.visibleSessionIds,
        activeSessionId: action.activeSessionId,
      };
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
