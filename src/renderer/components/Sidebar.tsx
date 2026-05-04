import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContextMenu, type MenuItem } from './ContextMenu';
import {
  useSessionState,
  useSessionDispatch,
  getProjectSessions,
} from '../store/session-context';
import { disposeTerminal } from '../hooks/useTerminal';
import { theme } from '../theme';
import { randomId } from '../utils';
import type { SessionInfo, LayoutMode } from '../../shared/types';

interface SidebarProps {
  onAddSession: (type: 'claude' | 'terminal') => void;
  onCloseSession: (id: string) => void;
  onRenameSession: (id: string, label: string) => void;
  onDeleteProject: (projectId: string) => void;
  onShowSettings: () => void;
  onShowShortcuts: () => void;
}

const statusColors: Record<SessionInfo['status'], string> = {
  running: theme.statusRunning,
  idle: theme.statusIdle,
  exited: theme.statusExited,
};

export function Sidebar({ onAddSession, onCloseSession, onRenameSession, onDeleteProject, onShowSettings, onShowShortcuts }: SidebarProps) {
  const state = useSessionState();
  const dispatch = useSessionDispatch();
  const { projects, activeProjectId, activeSessionId, sidebarCollapsed, sidebarWidth, visibleSessionIds, sessionFilter } = state;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandSignal, setExpandSignal] = useState<{ expanded: boolean; ts: number } | null>(null);
  const [allExpanded, setAllExpandedState] = useState(true);
  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpandedState(next);
    setExpandSignal({ expanded: next, ts: Date.now() });
  };
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [focusedEditing, setFocusedEditing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastShiftTime = useRef(0);

  // Auto-select first matching session or project as user types
  useEffect(() => {
    if (!searchQuery) return;
    const query = searchQuery.toLowerCase();
    // First try matching a session in the active project
    const activeSessions = getProjectSessions(state, activeProjectId);
    const sessionMatch = activeSessions.find((s) => s.label.toLowerCase().includes(query));
    if (sessionMatch) {
      dispatch({ type: 'SET_ACTIVE', id: sessionMatch.id });
      return;
    }
    // Then try matching a session in any project
    for (const project of projects) {
      const sessions = getProjectSessions(state, project.id);
      const match = sessions.find((s) => s.label.toLowerCase().includes(query));
      if (match) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id });
        dispatch({ type: 'SET_ACTIVE', id: match.id });
        return;
      }
    }
    // Finally try matching a project name — select it and show its first session
    const projectMatch = projects.find((p) => p.name.toLowerCase().includes(query));
    if (projectMatch) {
      dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: projectMatch.id });
      const sessions = getProjectSessions(state, projectMatch.id);
      if (sessions.length > 0) {
        dispatch({ type: 'SET_ACTIVE', id: sessions[0].id });
      }
    }
  }, [searchQuery]);

  // Double-shift to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) {
        const now = Date.now();
        if (now - lastShiftTime.current < 400) {
          setSearchOpen(true);
          lastShiftTime.current = 0;
        } else {
          lastShiftTime.current = now;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showFocusedProjectMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    const projectSessions = getProjectSessions(state, projectId);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        ...(projectSessions.length > 0 ? [{ label: 'Show All Panes', onClick: () => {
          const layout = String(Math.min(projectSessions.length, 8)) as LayoutMode;
          dispatch({ type: 'SET_LAYOUT', mode: layout });
        } }] : []),
        { label: 'Rename', onClick: () => setFocusedEditing(true) },
        { label: 'Add Claude Session', onClick: () => { onAddSession('claude'); } },
        { label: 'Add Terminal Session', onClick: () => { onAddSession('terminal'); } },
        ...(projectSessions.length > 0 ? [{ label: 'Close All Sessions', separator: true, onClick: async () => {
          const count = projectSessions.length;
          if (!window.confirm(`Close all ${count} session${count !== 1 ? 's' : ''} in this project?`)) return;
          for (const s of projectSessions) {
            await window.electronAPI.killSession(s.id);
            disposeTerminal(s.id);
            dispatch({ type: 'REMOVE_SESSION', id: s.id });
          }
        }, danger: true }] : []),
      ],
    });
  };

  const showProjectMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    const projectSessions = getProjectSessions(state, projectId);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Project-only View', onClick: () => { dispatch({ type: 'SET_ACTIVE_PROJECT', projectId }); setFocusedProjectId(projectId); } },
        ...(projectSessions.length > 0 ? [{ label: 'Show All Panes', onClick: () => {
          dispatch({ type: 'SET_ACTIVE_PROJECT', projectId });
          const layout = String(Math.min(projectSessions.length, 8)) as LayoutMode;
          dispatch({ type: 'SET_LAYOUT', mode: layout });
        } }] : []),
        { label: 'Rename', onClick: () => setEditingProjectId(projectId) },
        { label: 'Add Claude Session', onClick: () => { dispatch({ type: 'SET_ACTIVE_PROJECT', projectId }); onAddSession('claude'); } },
        { label: 'Add Terminal Session', onClick: () => { dispatch({ type: 'SET_ACTIVE_PROJECT', projectId }); onAddSession('terminal'); } },
        ...(projectSessions.length > 0 ? [{ label: 'Close All Sessions', separator: true, onClick: async () => {
          const count = projectSessions.length;
          if (!window.confirm(`Close all ${count} session${count !== 1 ? 's' : ''} in this project?`)) return;
          for (const s of projectSessions) {
            await window.electronAPI.killSession(s.id);
            disposeTerminal(s.id);
            dispatch({ type: 'REMOVE_SESSION', id: s.id });
          }
        }, danger: true }] : []),
        ...(projects.length > 1 ? [{ label: 'Delete Project', separator: projectSessions.length === 0, onClick: () => onDeleteProject(projectId), danger: true }] : []),
      ],
    });
  };

  const showSessionMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const otherProjects = projects.filter((p) => p.id !== session.projectId);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Rename', onClick: () => setEditingSessionId(sessionId) },
        ...(otherProjects.length > 0 ? [{
          label: 'Move to Project',
          onClick: () => {},
          submenu: otherProjects.map((p) => ({
            label: p.name,
            onClick: () => dispatch({ type: 'MOVE_SESSION', sessionId, toProjectId: p.id }),
          })),
        }] : []),
        { label: 'Close Session', separator: true, onClick: () => onCloseSession(sessionId), danger: true },
      ],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexShrink: 0 }}>
      {/* Sidebar content */}
      <div
        style={{
          width: sidebarWidth,
          background: theme.tabBarBackground,
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
        }}
      >
        {focusedProjectId ? (
          <>
            {/* Focused project header — back */}
            <div
              style={{
                height: 39, minHeight: 39, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', padding: '0 12px',
                borderBottom: `1px solid ${theme.borderSubtle}`, flexShrink: 0, gap: 6,
              }}
            >
              <span
                onClick={() => { setFocusedProjectId(null); }}
                style={{
                  fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: 0.5, color: theme.tabInactiveText,
                  fontFamily: 'system-ui', flex: 1, cursor: 'pointer',
                }}
                title="Back to all projects"
              >
                ← Projects
              </span>
            </div>

            {/* Filter + Search toolbar */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderBottom: `1px solid ${theme.borderSubtle}`, flexShrink: 0,
              }}
            >
              <FilterPill value={sessionFilter} onChange={(f) => dispatch({ type: 'SET_SESSION_FILTER', filter: f })} />
              <SidebarPill onClick={() => dispatch({ type: 'GROUP_BY_TYPE' })} label="Group" />
              <SidebarPill onClick={() => { if (searchOpen) { setSearchOpen(false); setSearchQuery(''); } else { setSearchOpen(true); } }} label="Search" />
            </div>

            {searchOpen && <SearchBar searchInputRef={searchInputRef} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSearchOpen={setSearchOpen} />}

            {/* Focused project name */}
            <div
              onContextMenu={(e) => showFocusedProjectMenu(e, focusedProjectId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 12px 10px 12px',
                borderBottom: `1px solid ${theme.borderSubtle}`,
                borderLeft: `3px solid ${theme.activeTabIndicator}`,
                background: theme.tabActiveBackground,
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              {focusedEditing ? (
                <input
                  autoFocus
                  defaultValue={projects.find((p) => p.id === focusedProjectId)?.name ?? ''}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && focusedProjectId) dispatch({ type: 'RENAME_PROJECT', projectId: focusedProjectId, name: val });
                    setFocusedEditing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setFocusedEditing(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, border: `1px solid ${theme.activeTabIndicator}`, borderRadius: 4,
                    padding: '3px 6px', fontSize: 14, fontFamily: 'system-ui', fontWeight: 600,
                    outline: 'none', background: theme.tabActiveBackground, color: theme.tabActiveText,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={() => setFocusedEditing(true)}
                  style={{
                    fontSize: 14, fontWeight: 600, color: theme.tabActiveText,
                    fontFamily: 'system-ui',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1,
                    cursor: 'pointer',
                  }}
                >
                  {projects.find((p) => p.id === focusedProjectId)?.name ?? 'Project'}
                </span>
              )}
              <span
                style={{
                  fontSize: 12, fontWeight: 500, color: theme.tabInactiveText,
                  background: theme.borderSubtle,
                  minWidth: 20, height: 20, borderRadius: 10,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 6px', fontFamily: 'system-ui',
                }}
              >
                {(() => { const t = getProjectSessions(state, focusedProjectId); return t.length; })()}
              </span>
            </div>

            {/* Focused project sessions (always expanded) */}
            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              {(() => {
                const focusedProject = projects.find((p) => p.id === focusedProjectId);
                if (!focusedProject) return null;
                const totalSessions = getProjectSessions(state, focusedProjectId);
                let allSessions = sessionFilter !== 'all' ? totalSessions.filter((s) => s.sessionType === sessionFilter) : totalSessions;
                const query = searchQuery.toLowerCase();
                const filteredSessions = query
                  ? allSessions.filter((s) => s.label.toLowerCase().includes(query))
                  : allSessions;
                return (
                  <ProjectTree
                    key={focusedProject.id}
                    project={focusedProject}
                    sessions={filteredSessions}
                    isActive={true}
                    activeSessionId={activeSessionId}
                    visibleSessionIds={visibleSessionIds}
                    onSelectProject={() => {}}
                    onSelectSession={(id) => dispatch({ type: 'SET_ACTIVE', id })}
                    onRename={(name) => dispatch({ type: 'RENAME_PROJECT', projectId: focusedProject.id, name })}
                    onDelete={() => onDeleteProject(focusedProject.id)}
                    onCloseSession={onCloseSession}
                    onRenameSession={onRenameSession}
                    onProjectContextMenu={(e) => showProjectMenu(e, focusedProject.id)}
                    onSessionContextMenu={(e, id) => showSessionMenu(e, id)}
                    editingProjectId={editingProjectId}
                    editingSessionId={editingSessionId}
                    onEditingDone={() => { setEditingProjectId(null); setEditingSessionId(null); }}
                    canDelete={projects.length > 1}
                    expandSignal={{ expanded: true, ts: 0 }}
                    hideHeader
                  />
                );
              })()}
            </div>
          </>
        ) : (
          <>
            {/* Header — PROJECTS + new project */}
            <div
              style={{
                height: 39, minHeight: 39, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', padding: '0 12px',
                borderBottom: `1px solid ${theme.borderSubtle}`, flexShrink: 0, gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: 0.5, color: theme.tabInactiveText,
                  fontFamily: 'system-ui', flex: 1,
                }}
              >
                Projects
              </span>
                  <button
                    onClick={() => {
                      const existingCount = projects.filter((p) => p.name.startsWith('New Project')).length;
                      const name = existingCount === 0 ? 'New Project' : `New Project ${existingCount + 1}`;
                      const newId = randomId();
                      dispatch({ type: 'ADD_PROJECT', project: { id: newId, name } });
                      setEditingProjectId(newId);
                    }}
                    style={{
                      background: 'transparent', border: 'none', color: theme.buttonMuted,
                      cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1,
                    }}
                    title="New project"
                  >
                    +
                  </button>
            </div>

            {/* Collapse/Expand all + filter */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderBottom: `1px solid ${theme.borderSubtle}`, flexShrink: 0,
              }}
            >
              <FilterPill value={sessionFilter} onChange={(f) => dispatch({ type: 'SET_SESSION_FILTER', filter: f })} />
              <SidebarPill onClick={toggleAll} label={allExpanded ? 'Collapse' : 'Expand'} />
              <SidebarPill onClick={() => dispatch({ type: 'GROUP_BY_TYPE' })} label="Group" />
              <SidebarPill onClick={() => { if (searchOpen) { setSearchOpen(false); setSearchQuery(''); } else { setSearchOpen(true); } }} label="Search" />
            </div>

            {searchOpen && <SearchBar searchInputRef={searchInputRef} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSearchOpen={setSearchOpen} />}

            {/* Project tree */}
            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              {projects.map((project) => {
                const totalSessions = getProjectSessions(state, project.id);
                let allSessions = sessionFilter !== 'all' ? totalSessions.filter((s) => s.sessionType === sessionFilter) : totalSessions;
                const query = searchQuery.toLowerCase();
                const sessions = query
                  ? allSessions.filter((s) => s.label.toLowerCase().includes(query) || project.name.toLowerCase().includes(query))
                  : allSessions;
                if (query && sessions.length === 0 && !project.name.toLowerCase().includes(query)) return null;
                const isActive = project.id === activeProjectId;
                return (
                  <ProjectTree
                    key={project.id}
                    project={project}
                    sessions={sessions}
                    totalCount={totalSessions.length}
                    isActive={isActive}
                    activeSessionId={activeSessionId}
                    visibleSessionIds={visibleSessionIds}
                    onSelectProject={() => {
                      dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id });
                    }}
                    onFocusProject={() => {
                      dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id });
                      setFocusedProjectId(project.id);
                    }}
                    onSelectSession={(id) => {
                      if (!isActive) dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id });
                      dispatch({ type: 'SET_ACTIVE', id });
                    }}
                    onRename={(name) => dispatch({ type: 'RENAME_PROJECT', projectId: project.id, name })}
                    onDelete={() => onDeleteProject(project.id)}
                    onCloseSession={onCloseSession}
                    onRenameSession={onRenameSession}
                    onProjectContextMenu={(e) => showProjectMenu(e, project.id)}
                    onSessionContextMenu={(e, id) => showSessionMenu(e, id)}
                    editingProjectId={editingProjectId}
                    editingSessionId={editingSessionId}
                    onEditingDone={() => { setEditingProjectId(null); setEditingSessionId(null); }}
                    canDelete={projects.length > 1}
                    expandSignal={expandSignal}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Claude status dashboard */}
        <ClaudeStatusDrawer
          sessions={state.sessions}
          projects={projects}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            const session = state.sessions.find((s) => s.id === id);
            if (session) {
              if (session.projectId !== activeProjectId) {
                dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: session.projectId });
                setFocusedProjectId(session.projectId);
              }
              dispatch({ type: 'SET_ACTIVE', id });
            }
          }}
        />

        {/* Bottom bar — settings + shortcuts */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderTop: `1px solid ${theme.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <SidebarPill onClick={onShowSettings} label="Settings" />
          <SidebarPill onClick={onShowShortcuts} label="Help" />
        </div>
      </div>

      {/* Draggable divider */}
      <DragDivider />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function DragDivider() {
  const dispatch = useSessionDispatch();
  const { sidebarWidth } = useSessionState();
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      dispatch({ type: 'SET_SIDEBAR_WIDTH', width: startWidth.current + delta });
    };
    const onMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, dispatch]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 5,
        cursor: 'col-resize',
        background: dragging ? theme.activeTabIndicator : 'transparent',
        borderRight: `1px solid ${theme.borderSubtle}`,
        transition: dragging ? 'none' : 'background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!dragging) e.currentTarget.style.background = theme.borderSubtle; }}
      onMouseLeave={(e) => { if (!dragging) e.currentTarget.style.background = 'transparent'; }}
    />
  );
}

function ProjectTree({
  project,
  sessions,
  isActive,
  activeSessionId,
  visibleSessionIds,
  onSelectProject,
  onFocusProject,
  onSelectSession,
  onRename,
  onDelete,
  onCloseSession,
  onRenameSession,
  onProjectContextMenu,
  onSessionContextMenu,
  editingProjectId,
  editingSessionId,
  onEditingDone,
  canDelete,
  expandSignal,
  hideHeader,
  totalCount,
}: {
  project: { id: string; name: string };
  sessions: SessionInfo[];
  totalCount?: number;
  isActive: boolean;
  activeSessionId: string | null;
  visibleSessionIds: string[];
  onSelectProject: () => void;
  onFocusProject?: () => void;
  onSelectSession: (id: string) => void;
  onRename: (name: string) => void;
  onRenameSession: (id: string, label: string) => void;
  onDelete: () => void;
  onCloseSession: (id: string) => void;
  onProjectContextMenu: (e: React.MouseEvent) => void;
  onSessionContextMenu: (e: React.MouseEvent, id: string) => void;
  editingProjectId: string | null;
  editingSessionId: string | null;
  onEditingDone: () => void;
  canDelete: boolean;
  expandSignal: { expanded: boolean; ts: number } | null;
  hideHeader?: boolean;
  totalCount?: number;
}) {
  const dispatch = useSessionDispatch();
  const [expanded, setExpanded] = useState(true);

  // Respond to expand/collapse all signal
  useEffect(() => {
    if (expandSignal) setExpanded(expandSignal.expanded);
  }, [expandSignal]);
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger editing from context menu
  useEffect(() => {
    if (editingProjectId === project.id) {
      setEditing(true);
      onEditingDone();
    }
  }, [editingProjectId]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSubmit = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== project.name) onRename(val);
    setEditing(false);
  };

  const handleHeaderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const sessionId = e.dataTransfer.getData('text/session-id');
    if (sessionId) {
      dispatch({ type: 'MOVE_SESSION', sessionId, toProjectId: project.id });
      setExpanded(true);
    }
  };

  const handleSessionDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const sessionId = e.dataTransfer.getData('text/session-id');
    if (sessionId) {
      dispatch({ type: 'MOVE_SESSION', sessionId, toProjectId: project.id, atIndex: index });
      setExpanded(true);
    }
  };

  return (
    <div>
      {/* Project header — drop target (hidden in focus mode) */}
      {!hideHeader && <div
        onClick={() => { onSelectProject(); setExpanded(true); }}
        onContextMenu={onProjectContextMenu}
        onDoubleClick={() => { if (onFocusProject) onFocusProject(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleHeaderDrop}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          cursor: 'pointer',
          borderLeft: isActive ? `3px solid ${theme.activeTabIndicator}` : '3px solid transparent',
          background: dragOver
            ? `${theme.activeTabIndicator}20`
            : isActive ? theme.tabActiveBackground : hovered ? theme.tabHoverBackground : 'transparent',
          outline: dragOver ? `2px dashed ${theme.activeTabIndicator}` : 'none',
          outlineOffset: -2,
          borderRadius: dragOver ? 4 : 0,
          transition: 'background 0.1s',
        }}
      >
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{
            fontSize: 12,
            color: theme.tabInactiveText,
            width: 14,
            textAlign: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>

        {editing ? (
          <input
            ref={inputRef}
            defaultValue={project.name}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              border: `1px solid ${theme.activeTabIndicator}`,
              borderRadius: 4,
              padding: '3px 6px',
              fontSize: 14,
              fontFamily: 'system-ui',
              outline: 'none',
              background: theme.tabActiveBackground,
              color: theme.tabActiveText,
            }}
          />
        ) : (
          <>
            <span
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
              style={{
                fontSize: 14,
                fontFamily: 'system-ui',
                fontWeight: 600,
                color: isActive ? theme.tabActiveText : theme.tabInactiveText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {project.name}
            </span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: theme.tabInactiveText,
                background: theme.borderSubtle,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontFamily: 'system-ui',
              }}
            >
              {totalCount ?? sessions.length}
            </span>
            {canDelete && hovered && (
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                  fontSize: 15,
                  color: theme.tabInactiveText,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </span>
            )}
          </>
        )}
      </div>}

      {/* Session list with drop zones */}
      {(hideHeader || expanded) && (
        <div style={{ marginLeft: hideHeader ? -21 : 0 }}>
          {sessions.map((session, idx) => {
            const isVisible = visibleSessionIds.includes(session.id);
            const paneColor = theme.paneIndicatorColors[session.colorIndex % theme.paneIndicatorColors.length];
            return (
              <React.Fragment key={session.id}>
                {/* Drop zone before this session */}
                <DropZone
                  active={dropIndex === idx}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(idx); }}
                  onDragLeave={() => setDropIndex(null)}
                  onDrop={(e) => handleSessionDrop(e, idx)}
                />
                <SessionItem
                  session={session}
                  isActive={session.id === activeSessionId}
                  paneColor={paneColor}
                  isVisible={isVisible}
                  onSelect={() => onSelectSession(session.id)}
                  onClose={() => onCloseSession(session.id)}
                  onRename={(label) => onRenameSession(session.id, label)}
                  onContextMenu={(e) => onSessionContextMenu(e, session.id)}
                  editingSessionId={editingSessionId}
                  onEditingDone={onEditingDone}
                />
              </React.Fragment>
            );
          })}
          {/* Drop zone after last session */}
          <DropZone
            active={dropIndex === sessions.length}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(sessions.length); }}
            onDragLeave={() => setDropIndex(null)}
            onDrop={(e) => handleSessionDrop(e, sessions.length)}
          />
        </div>
      )}
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  paneColor,
  isVisible,
  onSelect,
  onClose,
  onRename,
  onContextMenu,
  editingSessionId,
  onEditingDone,
}: {
  session: SessionInfo;
  isActive: boolean;
  paneColor: string;
  isVisible: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (label: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingSessionId: string | null;
  onEditingDone: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger editing from context menu
  useEffect(() => {
    if (editingSessionId === session.id) {
      setEditing(true);
      onEditingDone();
    }
  }, [editingSessionId]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSubmit = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== session.label) onRename(val);
    setEditing(false);
  };

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/session-id', session.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px 10px 36px',
        cursor: editing ? 'text' : 'grab',
        background: isActive ? `${paneColor}12` : hovered ? theme.tabHoverBackground : 'transparent',
        borderRadius: 0,
        margin: 0,
        fontWeight: isActive ? 500 : 400,
        transition: 'background 0.1s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: paneColor,
          flexShrink: 0,
          boxShadow: isVisible ? `0 0 0 2px ${paneColor}40` : 'none',
        }}
      />
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={session.label}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            border: `1px solid ${theme.activeTabIndicator}`,
            borderRadius: 4,
            padding: '3px 6px',
            fontSize: 14,
            fontFamily: 'system-ui',
            outline: 'none',
            background: theme.tabActiveBackground,
            color: theme.tabActiveText,
          }}
        />
      ) : (
        <>
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'system-ui',
              color: isActive ? theme.tabActiveText : theme.tabInactiveText,
              fontWeight: 'inherit',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={session.cwd}
          >
            {session.label}
          </span>
          {hovered && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                fontSize: 15,
                color: theme.tabInactiveText,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </span>
          )}
        </>
      )}
    </div>
  );
}

function NewSessionBar({ onAddSession }: { onAddSession: (type: 'claude' | 'terminal') => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      ref={menuRef}
      style={{
        height: 37,
        minHeight: 37,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: `1px solid ${theme.borderSubtle}`,
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => setMenuOpen(!menuOpen)}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: theme.tabInactiveText,
          fontFamily: 'system-ui',
          flex: 1,
        }}
      >
        New Session
      </span>
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: theme.buttonMuted,
          cursor: 'pointer',
          fontSize: 18,
          padding: '0 4px',
          lineHeight: 1,
        }}
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
      >
        +
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 8,
            marginTop: 2,
            background: theme.tabActiveBackground,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            minWidth: 180,
            zIndex: 100,
          }}
        >
          <MenuOption
            label="Claude Code"
            sublabel="AI-powered terminal"
            onClick={() => { onAddSession('claude'); setMenuOpen(false); }}
          />
          <MenuOption
            label="Terminal"
            sublabel="Standard shell session"
            onClick={() => { onAddSession('terminal'); setMenuOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

function MenuOption({ label, sublabel, onClick }: { label: string; sublabel: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 14px',
        cursor: 'pointer',
        background: hovered ? theme.tabHoverBackground : 'transparent',
      }}
    >
      <div style={{ fontSize: 14, fontFamily: 'system-ui', color: theme.tabActiveText, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontFamily: 'system-ui', color: theme.tabInactiveText, marginTop: 1 }}>
        {sublabel}
      </div>
    </div>
  );
}

function SearchBar({ searchInputRef, searchQuery, setSearchQuery, setSearchOpen }: {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: theme.appBackground,
          border: `1px solid ${theme.borderSubtle}`,
          borderRadius: 6,
        }}
      >
        <span style={{ color: theme.tabInactiveText, fontSize: 13, flexShrink: 0 }}>🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
          autoFocus
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 13,
            fontFamily: 'system-ui', background: 'transparent',
            color: theme.tabActiveText, padding: 0,
          }}
        />
        {searchQuery ? (
          <span onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
            style={{ color: theme.buttonMuted, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</span>
        ) : (
          <span onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            style={{ color: theme.buttonMuted, cursor: 'pointer', fontSize: 11, fontFamily: 'system-ui' }}>Esc</span>
        )}
      </div>
    </div>
  );
}

function ClaudeStatusDrawer({ sessions, projects, activeSessionId, onSelectSession }: {
  sessions: SessionInfo[];
  projects: Array<{ id: string; name: string }>;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const claudeSessions = sessions.filter((s) => s.sessionType === 'claude');

  // Auto-collapse when no Claude sessions
  useEffect(() => {
    if (claudeSessions.length === 0) setExpanded(false);
  }, [claudeSessions.length]);

  const runningCount = claudeSessions.filter((s) => s.status === 'running').length;
  const idleCount = claudeSessions.filter((s) => s.status === 'idle').length;

  // Group by project
  const projectGroups = projects
    .map((p) => ({ project: p, sessions: claudeSessions.filter((s) => s.projectId === p.id) }))
    .filter((g) => g.sessions.length > 0);

  return (
    <div style={{ borderTop: `1px solid ${theme.borderSubtle}`, flexShrink: 0 }}>
      <div
        onClick={() => { if (claudeSessions.length > 0) setExpanded(!expanded); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: 0.5, color: theme.tabInactiveText,
          fontFamily: 'system-ui',
        }}
      >
        <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ flex: 1 }}>Claude Sessions</span>
        <span style={{
          fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 0,
          color: theme.tabInactiveText,
        }}>
          {claudeSessions.length === 0
            ? <span style={{ color: '#e5484d' }}>None</span>
            : <>
                {runningCount > 0 && <span style={{ color: '#30a46c' }}>{runningCount} active</span>}
                {runningCount > 0 && idleCount > 0 && ' · '}
                {idleCount > 0 && <span>{idleCount} idle</span>}
              </>
          }
        </span>
      </div>
      {expanded && (
        <div style={{ paddingBottom: 6, maxHeight: 200, overflowY: 'auto' }}>
          {projectGroups.map((group) => (
            <div key={group.project.id}>
              <div style={{
                padding: '8px 12px 4px',
                fontSize: 11, fontFamily: 'system-ui', fontWeight: 600,
                color: theme.tabInactiveText,
                textTransform: 'uppercase', letterSpacing: 0.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {group.project.name}
              </div>
              {group.sessions.map((session) => {
                const statusColor = session.status === 'running' ? '#30a46c' : session.status === 'idle' ? '#e5a100' : '#e5484d';
                const statusLabel = session.status === 'running' ? 'Running' : session.status === 'idle' ? 'Idle' : 'Exited';
                const ctx = session.ctxUsedPercent;
                const ctxColor = ctx === null ? theme.tabInactiveText : ctx > 80 ? '#e5484d' : ctx > 60 ? '#e5a100' : theme.tabInactiveText;
                return (
                  <ClaudeStatusItem
                    key={session.id}
                    label={session.label}
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                    contextUsed={ctx}
                    contextColor={ctxColor}
                    isActive={session.id === activeSessionId}
                    onClick={() => onSelectSession(session.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaudeStatusItem({ label, statusLabel, statusColor, contextUsed, contextColor, isActive, onClick }: {
  label: string;
  statusLabel: string;
  statusColor: string;
  contextUsed: number | null;
  contextColor: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px 8px 24px',
        cursor: 'pointer',
        background: isActive ? `${statusColor}12` : hovered ? theme.tabHoverBackground : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: statusColor, flexShrink: 0,
      }} />
      <span style={{
        fontSize: 13, fontFamily: 'system-ui', color: theme.tabActiveText,
        fontWeight: isActive ? 500 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontFamily: 'system-ui', color: statusColor,
        fontWeight: 500, flexShrink: 0,
      }}>
        {statusLabel}
      </span>
      {contextUsed !== null && (
        <span style={{
          fontSize: 11, fontFamily: 'system-ui', color: contextColor,
          fontWeight: 500, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
          minWidth: 30, textAlign: 'right',
        }}>
          {contextUsed.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

function SidebarPill({ onClick, label }: { onClick: () => void; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? theme.tabHoverBackground : theme.borderSubtle,
        border: 'none',
        color: theme.tabInactiveText,
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: 5,
        fontSize: 12,
        fontFamily: 'system-ui',
        fontWeight: 500,
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

const filterLabels: Record<string, string> = { all: 'All Sessions', claude: 'Claude', terminal: 'Term' };

function FilterMenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '7px 14px',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'system-ui',
        color: active ? theme.activeTabIndicator : theme.tabActiveText,
        fontWeight: active ? 600 : 400,
        background: hovered ? theme.tabHoverBackground : 'transparent',
      }}
    >
      {label}
    </div>
  );
}

function FilterPill({ value, onChange }: { value: string; onChange: (f: 'all' | 'claude' | 'terminal') => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isFiltered = value !== 'all';
  const [pillHovered, setPillHovered] = useState(false);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        onMouseEnter={() => setPillHovered(true)}
        onMouseLeave={() => setPillHovered(false)}
        style={{
          background: isFiltered ? '#e5484d' : pillHovered ? theme.tabHoverBackground : theme.borderSubtle,
          border: 'none',
          color: isFiltered ? '#fff' : theme.tabInactiveText,
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 5,
          fontSize: 12,
          fontFamily: 'system-ui',
          fontWeight: 500,
          transition: 'background 0.12s, color 0.12s',
        }}
      >
        {filterLabels[value] || 'All Sessions'}
      </button>
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: theme.tabActiveBackground,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            minWidth: 130,
            zIndex: 100,
          }}
        >
          {(['all', 'claude', 'terminal'] as const).map((f) => (
            <FilterMenuItem
              key={f}
              label={f === 'all' ? 'All Sessions' : f === 'claude' ? 'Claude' : 'Term'}
              active={f === value}
              onClick={() => { onChange(f); setMenuOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropZone({
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        height: active ? 3 : 4,
        margin: active ? '0 8px 0 36px' : '0',
        borderRadius: 2,
        background: active ? theme.activeTabIndicator : 'transparent',
        transition: 'height 0.1s, background 0.1s',
      }}
    />
  );
}
