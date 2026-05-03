import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  SessionProvider,
  useSessionState,
  useSessionDispatch,
  getProjectSessions,
  getFilteredProjectSessions,
  getAvailableLayouts,
  DEFAULT_PROJECT_ID,
} from './store/session-context';
import { SplitLayout } from './components/SplitLayout';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { ShortcutHelp } from './components/ShortcutHelp';
import { Settings } from './components/Settings';
import { disposeTerminal } from './hooks/useTerminal';
import type { LayoutMode, SessionType, SessionFilter } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { theme } from './theme';

function AppInner() {
  const state = useSessionState();
  const dispatch = useSessionDispatch();
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const colorCounter = useRef(0);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const projectSessions = getProjectSessions(state);

  const addSession = useCallback(async (sessionType?: SessionType) => {
    const type = sessionType ?? state.settings.defaultSessionType;
    let cwd = state.settings.defaultProjectDir || null;
    if (!cwd) {
      cwd = await window.electronAPI.pickDirectory();
      if (!cwd) return;
    }
    const result = await window.electronAPI.createSession(cwd, type);
    dispatch({
      type: 'ADD_SESSION',
      session: { ...result, status: 'running', projectId: state.activeProjectId, contextPercent: null, createdAt: Date.now(), colorIndex: colorCounter.current++ },
    });
  }, [dispatch, state.activeProjectId, state.settings.defaultSessionType, state.settings.defaultProjectDir]);

  const closeSession = useCallback(async (id: string) => {
    const session = state.sessions.find((s) => s.id === id);
    const name = session?.label ?? 'this session';
    if (!window.confirm(`Close "${name}"?`)) return;
    await window.electronAPI.killSession(id);
    disposeTerminal(id);
    dispatch({ type: 'REMOVE_SESSION', id });
  }, [dispatch, state.sessions]);

  const renameSession = useCallback((id: string, label: string) => {
    dispatch({ type: 'RENAME_SESSION', id, label });
  }, [dispatch]);

  const filteredSessions = getFilteredProjectSessions(state);

  const cycleLayout = useCallback(() => {
    const available = getAvailableLayouts(filteredSessions.length);
    if (available.length <= 1) return;
    const idx = available.indexOf(state.layoutMode);
    const next = available[(idx + 1) % available.length];
    dispatch({ type: 'SET_LAYOUT', mode: next });
  }, [state.layoutMode, filteredSessions.length, dispatch]);

  const deleteProject = useCallback(async (projectId: string) => {
    const project = state.projects.find((p) => p.id === projectId);
    const sessionsToKill = state.sessions.filter((s) => s.projectId === projectId);
    const name = project?.name ?? 'this project';
    const count = sessionsToKill.length;
    const msg = count > 0
      ? `Delete "${name}"? This will close ${count} active session${count !== 1 ? 's' : ''}.`
      : `Delete "${name}"?`;
    if (!window.confirm(msg)) return;
    for (const s of sessionsToKill) {
      await window.electronAPI.killSession(s.id);
      disposeTerminal(s.id);
    }
    dispatch({ type: 'REMOVE_PROJECT', projectId });
  }, [state.sessions, state.projects, dispatch]);

  // Listen for pty activity to set status and parse context usage
  useEffect(() => {
    const unsubData = window.electronAPI.onPtyData((id, data) => {
      dispatch({ type: 'UPDATE_STATUS', id, status: 'running' });
      const existing = idleTimers.current.get(id);
      if (existing) clearTimeout(existing);
      idleTimers.current.set(
        id,
        setTimeout(() => {
          dispatch({ type: 'UPDATE_STATUS', id, status: 'idle' });
        }, 3000),
      );

      // Parse "Session: XX.X%" from Claude CLI status bar
      // Strip ANSI escape codes first since the status bar is styled
      const stripped = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      const sessionMatch = stripped.match(/Session:\s*([\d.]+)%/);
      if (sessionMatch) {
        const percent = parseFloat(sessionMatch[1]);
        if (!isNaN(percent)) {
          dispatch({ type: 'UPDATE_CONTEXT', id, contextPercent: percent });
        }
      }
    });

    const unsubExit = window.electronAPI.onPtyExit((id) => {
      dispatch({ type: 'UPDATE_STATUS', id, status: 'exited' });
      const existing = idleTimers.current.get(id);
      if (existing) clearTimeout(existing);
    });

    return () => {
      unsubData();
      unsubExit();
      idleTimers.current.forEach((t) => clearTimeout(t));
    };
  }, [dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === 'b') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      } else if (meta && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        addSession('terminal');
      } else if (meta && e.key === 'n') {
        e.preventDefault();
        addSession('claude');
      } else if (meta && e.key === ',') {
        e.preventDefault();
        setShowSettings((v) => !v);
      } else if (meta && e.key === '?') {
        e.preventDefault();
        setShowShortcutHelp((v) => !v);
      } else if (e.key === 'Escape' && showSettings) {
        e.preventDefault();
        setShowSettings(false);
      } else if (e.key === 'Escape' && showShortcutHelp) {
        e.preventDefault();
        setShowShortcutHelp(false);
      } else if (meta && e.key === 'w') {
        e.preventDefault();
        if (state.activeSessionId) closeSession(state.activeSessionId);
      } else if (meta && e.key === '\\') {
        e.preventDefault();
        cycleLayout();
      } else if (meta && e.shiftKey && e.key === ']') {
        e.preventDefault();
        navigateSession(1);
      } else if (meta && e.shiftKey && e.key === '[') {
        e.preventDefault();
        navigateSession(-1);
      } else if (meta && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < projectSessions.length) {
          dispatch({ type: 'SET_ACTIVE', id: projectSessions[idx].id });
        }
      }
    };

    function navigateSession(direction: number) {
      if (!state.activeSessionId || projectSessions.length === 0) return;
      const idx = projectSessions.findIndex((s) => s.id === state.activeSessionId);
      const next = (idx + direction + projectSessions.length) % projectSessions.length;
      dispatch({ type: 'SET_ACTIVE', id: projectSessions[next].id });
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.activeSessionId, projectSessions, state.layoutMode, addSession, closeSession, cycleLayout, dispatch, showShortcutHelp, showSettings]);

  // Restore sessions on launch, or create a default one
  useEffect(() => {
    (async () => {
      try {
        const persisted = await window.electronAPI.loadState();
        if (persisted.projects && persisted.projects.length > 0) {
          for (const project of persisted.projects) {
            if (project.id !== DEFAULT_PROJECT_ID) {
              dispatch({ type: 'ADD_PROJECT', project });
            } else {
              dispatch({ type: 'RENAME_PROJECT', projectId: DEFAULT_PROJECT_ID, name: project.name });
            }
          }
          if (persisted.activeProjectId) {
            dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: persisted.activeProjectId });
          }
          const createdIds: string[] = [];
          for (const { cwd, projectId, sessionType, label, colorIndex } of persisted.sessions as Array<{ cwd: string; projectId?: string; sessionType?: string; label?: string; colorIndex?: number }>) {
            const ci = colorIndex ?? colorCounter.current++;
            if (ci >= colorCounter.current) colorCounter.current = ci + 1;
            const result = await window.electronAPI.createSession(cwd, (sessionType as SessionType) || 'claude');
            dispatch({
              type: 'ADD_SESSION',
              restoring: true,
              session: { ...result, label: label || result.label, status: 'running', projectId: projectId || DEFAULT_PROJECT_ID, contextPercent: null, createdAt: Date.now(), colorIndex: ci },
            });
            createdIds.push(result.id);
          }
          if (persisted.sidebarCollapsed) {
            dispatch({ type: 'TOGGLE_SIDEBAR' });
          }
          if (persisted.sidebarWidth) {
            dispatch({ type: 'SET_SIDEBAR_WIDTH', width: persisted.sidebarWidth });
          }
          // Restore view state in one shot to avoid rebuild thrashing
          const restoreLayout = persisted.layoutMode && /^[1-8]$/.test(persisted.layoutMode)
            ? persisted.layoutMode as LayoutMode : '1';
          const restoreFilter = (persisted.sessionFilter || 'all') as SessionFilter;
          const restoreVisible = (persisted.visibleSessionIndices && Array.isArray(persisted.visibleSessionIndices))
            ? (persisted.visibleSessionIndices as number[]).map((i) => createdIds[i]).filter(Boolean)
            : [];
          dispatch({
            type: 'RESTORE_VIEW',
            layoutMode: restoreLayout,
            sessionFilter: restoreFilter,
            visibleSessionIds: restoreVisible,
            activeSessionId: restoreVisible.length > 0 ? restoreVisible[0] : null,
          });
          if (persisted.settings) {
            dispatch({ type: 'SET_SETTINGS', settings: { ...DEFAULT_SETTINGS, ...persisted.settings } });
          }
        } else if (persisted.sessions && persisted.sessions.length > 0) {
          for (const { cwd } of persisted.sessions) {
            const result = await window.electronAPI.createSession(cwd);
            dispatch({
              type: 'ADD_SESSION',
              session: { ...result, status: 'running', projectId: DEFAULT_PROJECT_ID, contextPercent: null, createdAt: Date.now(), colorIndex: colorCounter.current++ },
            });
          }
          if (persisted.layoutMode) {
            const mode = /^[1-8]$/.test(persisted.layoutMode) ? persisted.layoutMode as LayoutMode : '1';
            dispatch({ type: 'SET_LAYOUT', mode });
          }
        } else {
          const result = await window.electronAPI.createSession('/Users/vroman');
          dispatch({
            type: 'ADD_SESSION',
            session: { ...result, status: 'running', projectId: DEFAULT_PROJECT_ID },
          });
        }
      } catch (err) {
        console.error('Failed to restore sessions:', err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save state on beforeunload
  useEffect(() => {
    const handler = () => {
      window.electronAPI.saveState({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        sessions: state.sessions.map((s) => ({ cwd: s.cwd, projectId: s.projectId, sessionType: s.sessionType, label: s.label, colorIndex: s.colorIndex })),
        layoutMode: state.layoutMode,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        sessionFilter: state.sessionFilter,
        settings: state.settings,
        // Save visible pane order as session indices within the full session list
        visibleSessionIndices: state.visibleSessionIds.map((id) => state.sessions.findIndex((s) => s.id === id)).filter((i) => i !== -1),
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.projects, state.activeProjectId, state.sessions, state.layoutMode, state.sidebarCollapsed, state.sidebarWidth, state.settings]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.appBackground,
      }}
    >
      {/* Titlebar — full width drag region for macOS traffic lights */}
      <div
        style={{
          height: 38,
          flexShrink: 0,
          WebkitAppRegion: 'drag' as unknown as string,
          background: theme.tabBarBackground,
          borderBottom: `1px solid ${theme.borderSubtle}`,
        }}
      />
      {/* Middle: sidebar + terminals */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <Sidebar
          onAddSession={addSession}
          onCloseSession={closeSession}
          onRenameSession={renameSession}
          onDeleteProject={deleteProject}
          onShowSettings={() => setShowSettings(true)}
          onShowShortcuts={() => setShowShortcutHelp(true)}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SplitLayout />
        </div>
      </div>
      {/* Footer — full width below everything */}
      <Footer onCycleLayout={cycleLayout} />
      {showShortcutHelp && <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />}
      {showSettings && (
        <Settings
          settings={state.settings}
          onSave={(s) => dispatch({ type: 'SET_SETTINGS', settings: s })}
          onClose={() => setShowSettings(false)}
          onPickDirectory={() => window.electronAPI.pickDirectory()}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppInner />
    </SessionProvider>
  );
}
