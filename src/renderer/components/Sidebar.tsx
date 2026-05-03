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
import type { SessionInfo } from '../../shared/types';

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
  const { projects, activeProjectId, activeSessionId, sidebarCollapsed, sidebarWidth, visibleSessionIds } = state;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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

  const showProjectMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    const projectSessions = getProjectSessions(state, projectId);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Rename', onClick: () => setEditingProjectId(projectId) },
        { label: 'Add Claude Session', onClick: () => { dispatch({ type: 'SET_ACTIVE_PROJECT', projectId }); onAddSession('claude'); } },
        { label: 'Add Terminal Session', onClick: () => { dispatch({ type: 'SET_ACTIVE_PROJECT', projectId }); onAddSession('terminal'); } },
        ...(projectSessions.length > 0 ? [{ label: 'Close All Sessions', onClick: async () => {
          const count = projectSessions.length;
          if (!window.confirm(`Close all ${count} session${count !== 1 ? 's' : ''} in this project?`)) return;
          for (const s of projectSessions) {
            await window.electronAPI.killSession(s.id);
            disposeTerminal(s.id);
            dispatch({ type: 'REMOVE_SESSION', id: s.id });
          }
        }, danger: true }] : []),
        ...(projects.length > 1 ? [{ label: 'Delete Project', onClick: () => onDeleteProject(projectId), danger: true }] : []),
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
        { label: 'Close Session', onClick: () => onCloseSession(sessionId), danger: true },
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
        {/* Header — toggles between PROJECTS and search input */}
        <div
          style={{
            height: 37,
            minHeight: 37,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            borderBottom: `1px solid ${theme.borderSubtle}`,
            flexShrink: 0,
            gap: 6,
            background: searchOpen ? theme.tabActiveBackground : 'transparent',
          }}
        >
          {searchOpen ? (
            <>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                }}
                autoFocus
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  fontFamily: 'system-ui',
                  background: 'transparent',
                  color: theme.tabActiveText,
                  padding: 0,
                }}
              />
              {searchQuery && (
                <span
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  style={{ color: theme.buttonMuted, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                >
                  ×
                </span>
              )}
              <span
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                style={{ color: theme.buttonMuted, cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui' }}
              >
                Esc
              </span>
            </>
          ) : (
            <>
              <span
                onClick={() => setSearchOpen(true)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.tabInactiveText,
                  fontFamily: 'system-ui',
                  flex: 1,
                  cursor: 'pointer',
                }}
              >
                Projects
              </span>
              <button
                onClick={() => {
                  const existingCount = projects.filter((p) => p.name.startsWith('New Project')).length;
                  const name = existingCount === 0 ? 'New Project' : `New Project ${existingCount + 1}`;
                  dispatch({
                    type: 'ADD_PROJECT',
                    project: { id: randomId(), name },
                  });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.buttonMuted,
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
                title="New project"
              >
                +
              </button>
            </>
          )}
        </div>

        {/* New Session bar with dropdown */}
        <NewSessionBar onAddSession={onAddSession} />

        {/* Project tree */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {projects.map((project) => {
            const allSessions = getProjectSessions(state, project.id);
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
                isActive={isActive}
                activeSessionId={activeSessionId}
                visibleSessionIds={visibleSessionIds}
                onSelectProject={() => dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id })}
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
              />
            );
          })}
        </div>

        {/* Bottom bar — settings + shortcuts */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '8px 10px',
            borderTop: `1px solid ${theme.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <SidebarIconButton
            onClick={onShowSettings}
            title="Settings (Cmd+,)"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 1.5h3l.4 1.6.5.2 1.5-.8 2.1 2.1-.8 1.5.2.5 1.6.4v3l-1.6.4-.2.5.8 1.5-2.1 2.1-1.5-.8-.5.2-.4 1.6h-3l-.4-1.6-.5-.2-1.5.8-2.1-2.1.8-1.5-.2-.5L1.5 9.5v-3l1.6-.4.2-.5-.8-1.5 2.1-2.1 1.5.8.5-.2.4-1.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>}
          />
          <SidebarIconButton
            onClick={onShowShortcuts}
            title="Keyboard shortcuts (Cmd+?)"
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4.5" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><line x1="4" y1="7.5" x2="4" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="7" y1="7.5" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="10" y1="7.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5.5" y1="10" x2="10.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
          />
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
}: {
  project: { id: string; name: string };
  sessions: SessionInfo[];
  isActive: boolean;
  activeSessionId: string | null;
  visibleSessionIds: string[];
  onSelectProject: () => void;
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
}) {
  const dispatch = useSessionDispatch();
  const [expanded, setExpanded] = useState(true);
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
      {/* Project header — drop target */}
      <div
        onClick={() => { onSelectProject(); setExpanded(true); }}
        onContextMenu={onProjectContextMenu}
        onDoubleClick={() => setEditing(true)}
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
              style={{
                flex: 1,
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
              {sessions.length}
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
      </div>

      {/* Session list with drop zones */}
      {expanded && (
        <div style={{ paddingLeft: 0 }}>
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

function SidebarIconButton({ onClick, title, icon }: { onClick: () => void; title: string; icon: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        background: hovered ? theme.tabHoverBackground : 'transparent',
        border: 'none',
        color: theme.buttonMuted,
        cursor: 'pointer',
        padding: '5px 7px',
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.12s',
      }}
    >
      {icon}
    </button>
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
