import React, { useState, useCallback, useRef, useEffect, type RefCallback } from 'react';
import { TerminalPane } from './TerminalPane';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { useSessionState, useSessionDispatch } from '../store/session-context';
import { disposeTerminal, searchTerminal, clearTerminalSearch } from '../hooks/useTerminal';
import type { LayoutMode, SessionInfo } from '../../shared/types';
import { theme } from '../theme';

function getGridCols(paneCount: number, containerWidth: number, minPaneWidth: number, gridColumns: number | null): number {
  if (paneCount <= 1) return 1;
  if (gridColumns !== null) return Math.min(gridColumns, paneCount);
  const maxCols = Math.max(1, Math.floor(containerWidth / minPaneWidth));
  return Math.min(maxCols, paneCount);
}

function getGridStyle(paneCount: number, containerWidth: number, minPaneWidth: number, gridColumns: number | null): React.CSSProperties {
  if (paneCount <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  const cols = getGridCols(paneCount, containerWidth, minPaneWidth, gridColumns);
  const rows = Math.ceil(paneCount / cols);
  return {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: Array(rows).fill('1fr').join(' '),
  };
}

function isLastPaneAlone(paneCount: number, containerWidth: number, minPaneWidth: number, gridColumns: number | null): boolean {
  if (paneCount <= 1) return false;
  const cols = getGridCols(paneCount, containerWidth, minPaneWidth, gridColumns);
  return paneCount % cols !== 0;
}

const statusColors: Record<SessionInfo['status'], string> = {
  running: theme.statusRunning,
  idle: theme.statusIdle,
  exited: theme.statusExited,
};

const statusLabels: Record<SessionInfo['status'], string> = {
  running: 'Running',
  idle: 'Idle',
  exited: 'Exited',
};

export function SplitLayout() {
  const state = useSessionState();
  const { sessions, visibleSessionIds: rawVisibleIds, layoutMode, gridColumns, projects, activeSessionId, sessionFilter, settings, activeProjectId } = state;
  const dispatch = useSessionDispatch();

  // Only show sessions belonging to the active project
  const projectSessionIds = new Set(sessions.filter((s) => s.projectId === activeProjectId).map((s) => s.id));
  const visibleSessionIds = rawVisibleIds.filter((id) => projectSessionIds.has(id));
  const isMultiPane = visibleSessionIds.length > 1;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [paneSearchId, setPaneSearchId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Cmd+F to search in active pane
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (activeSessionId && visibleSessionIds.includes(activeSessionId)) {
          setPaneSearchId((prev) => prev === activeSessionId ? null : activeSessionId);
        }
      }
      if (e.key === 'Escape' && paneSearchId) {
        e.preventDefault();
        clearTerminalSearch(paneSearchId);
        setPaneSearchId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSessionId, visibleSessionIds, paneSearchId]);

  const containerRef: RefCallback<HTMLDivElement> = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      setContainerWidth(node.clientWidth);
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  const showPaneMenu = useCallback((e: React.MouseEvent, id: string, index: number) => {
    e.preventDefault();
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    // Other visible panes for swapping positions
    const otherPanes = visibleSessionIds
      .map((vid, i) => ({ id: vid, index: i, session: sessions.find((s) => s.id === vid) }))
      .filter((p) => p.id !== id && p.session);

    // Off-stage sessions from the active project for replacing this pane
    const projectSessions = sessions.filter((s) => s.projectId === session.projectId);
    const offStage = projectSessions.filter((s) => !visibleSessionIds.includes(s.id));

    const swapItems: MenuItem[] = [
      ...otherPanes.map((p) => ({
        label: p.session!.label,
        onClick: () => {
          const visible = [...visibleSessionIds];
          visible[index] = p.id;
          visible[p.index] = id;
          dispatch({ type: 'SET_VISIBLE', ids: visible });
          dispatch({ type: 'SET_ACTIVE', id: p.id });
        },
      })),
      ...offStage.map((s) => ({
        label: s.label,
        onClick: () => {
          dispatch({ type: 'SET_VISIBLE_SLOT', index, sessionId: s.id });
          dispatch({ type: 'SET_ACTIVE', id: s.id });
        },
      })),
    ];

    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Focus', onClick: () => { dispatch({ type: 'SET_LAYOUT', mode: '1' }); dispatch({ type: 'SET_ACTIVE', id }); } },
        ...(isMultiPane ? [{ label: 'Remove from Stage', onClick: () => dispatch({ type: 'REMOVE_FROM_STAGE', id }) }] : []),
        ...(swapItems.length > 0 ? [{
          label: 'Replace with',
          onClick: () => {},
          submenu: swapItems,
        }] : []),
        { label: 'Rename', onClick: () => {
          const name = window.prompt('Session name:', session.label);
          if (name) dispatch({ type: 'RENAME_SESSION', id, label: name });
        }},
        { label: 'Restart Session', separator: true, danger: true, onClick: async () => {
          if (!window.confirm(`Restart "${session.label}"? This will kill the current session and start a new one.`)) return;
          const result = await window.electronAPI.createSession(session.cwd, session.sessionType);
          dispatch({
            type: 'ADD_SESSION',
            restoring: true,
            session: { ...result, label: session.label, status: 'running', projectId: session.projectId, contextPercent: null, ctxUsedPercent: null, createdAt: Date.now(), colorIndex: session.colorIndex },
          });
          dispatch({ type: 'SET_VISIBLE_SLOT', index, sessionId: result.id });
          disposeTerminal(id);
          dispatch({ type: 'REMOVE_SESSION', id });
        }},
        { label: 'Close Session', danger: true, onClick: () => {
          if (window.confirm(`Close "${session.label}"?`)) {
            window.electronAPI.killSession(id);
            disposeTerminal(id);
            dispatch({ type: 'REMOVE_SESSION', id });
          }
        }},
      ],
    });
  }, [sessions, visibleSessionIds, isMultiPane, dispatch]);

  const focusPane = (id: string) => {
    if (isMultiPane) {
      dispatch({ type: 'SET_LAYOUT', mode: '1' });
      dispatch({ type: 'SET_ACTIVE', id });
    }
  };

  if (visibleSessionIds.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: theme.appBackground,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: theme.buttonMuted,
            background: theme.tabBarBackground,
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          {sessionFilter === 'claude' ? 'No active Claude sessions'
            : sessionFilter === 'terminal' ? 'No active Terminal sessions'
            : 'No active sessions'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          ...getGridStyle(visibleSessionIds.length, containerWidth, settings?.minPaneWidth || 450, gridColumns),
          gap: isMultiPane ? 2 : 0,
          background: isMultiPane ? theme.borderSubtle : theme.appBackground,
        }}
      >
        {visibleSessionIds.map((id, index) => {
          const session = sessions.find((s) => s.id === id);
          const paneColor = theme.paneIndicatorColors[(session?.colorIndex ?? index) % theme.paneIndicatorColors.length];
          const isFocused = id === activeSessionId;
          return (
            <PaneSlot
              key={`slot-${index}`}
              index={index}
              spanFullWidth={index === visibleSessionIds.length - 1 && isLastPaneAlone(visibleSessionIds.length, containerWidth, settings?.minPaneWidth || 450, gridColumns)}
              isFocused={isFocused}
              isMultiPane={isMultiPane}
              paneColor={paneColor}
              onClick={() => dispatch({ type: 'SET_ACTIVE', id })}
              onDrop={(sessionId) => dispatch({ type: 'SET_VISIBLE_SLOT', index, sessionId })}
            >
              {session && (
                <PaneHeader
                  session={session}
                  projectName={projects.find((p) => p.id === session.projectId)?.name ?? ''}
                  color={paneColor}
                  showClose={isMultiPane}
                  onClose={() => dispatch({ type: 'REMOVE_FROM_STAGE', id })}
                  onDoubleClick={() => focusPane(id)}
                  onContextMenu={(e) => showPaneMenu(e, id, index)}
                />
              )}
              {paneSearchId === id && (
                <PaneSearchBar
                  sessionId={id}
                  onClose={() => { clearTerminalSearch(id); setPaneSearchId(null); }}
                />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <TerminalPane
                  sessionId={id}
                  visible
                  sessionType={session?.sessionType}
                  status={session?.status}
                  fontSize={settings.terminalFontSize}
                  onRestart={session ? async () => {
                    const result = await window.electronAPI.createSession(session.cwd, session.sessionType);
                    dispatch({
                      type: 'ADD_SESSION',
                      restoring: true,
                      session: { ...result, label: session.label, status: 'running', projectId: session.projectId, contextPercent: null, ctxUsedPercent: null, createdAt: Date.now(), colorIndex: session.colorIndex },
                    });
                    dispatch({ type: 'SET_VISIBLE_SLOT', index, sessionId: result.id });
                    disposeTerminal(id);
                    dispatch({ type: 'REMOVE_SESSION', id });
                  } : undefined}
                  onClose={() => { disposeTerminal(id); dispatch({ type: 'REMOVE_SESSION', id }); }}
                />
              </div>
            </PaneSlot>
          );
        })}
      </div>

      {sessions
        .filter((s) => s.projectId === activeProjectId && !visibleSessionIds.includes(s.id))
        .map((s) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: -9999,
              top: -9999,
              width: 800,
              height: 600,
              overflow: 'hidden',
              visibility: 'hidden',
            }}
          >
            <TerminalPane sessionId={s.id} visible={false} sessionType={s.sessionType} fontSize={settings.terminalFontSize} />
          </div>
        ))}
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

function PaneHeader({
  session,
  projectName,
  color,
  showClose,
  onClose,
  onDoubleClick,
  onContextMenu,
}: {
  projectName: string;
  onContextMenu: (e: React.MouseEvent) => void;
  session: SessionInfo;
  color: string;
  showClose: boolean;
  onClose: () => void;
  onDoubleClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/session-id', session.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        height: 37,
        cursor: 'grab',
        minHeight: 37,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        background: showClose
          ? `linear-gradient(to right, ${color}12, ${theme.tabBarBackground} 40%)`
          : theme.tabBarBackground,
        borderBottom: `1px solid ${theme.borderSubtle}`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 4,
          height: 16,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          color: theme.tabActiveText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
        title={session.cwd}
      >
        {projectName} - {session.label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontFamily: 'system-ui',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          color: session.sessionType === 'claude' ? theme.activeTabIndicator : theme.tabInactiveText,
          background: session.sessionType === 'claude' ? theme.activeTabIndicator + '18' : theme.borderSubtle,
          padding: '2px 6px',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        {session.sessionType === 'claude' ? 'Claude' : 'Term'}
      </span>
      {showClose && hovered && (
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            fontSize: 16,
            color: theme.tabInactiveText,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}

function PaneSlot({
  index,
  spanFullWidth,
  isFocused,
  isMultiPane,
  paneColor,
  onClick,
  onDrop,
  children,
}: {
  index: number;
  spanFullWidth: boolean;
  isFocused: boolean;
  isMultiPane: boolean;
  paneColor: string;
  onClick: () => void;
  onDrop: (sessionId: string) => void;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const sessionId = e.dataTransfer.getData('text/session-id');
        if (sessionId) onDrop(sessionId);
      }}
      style={{
        overflow: 'hidden',
        background: theme.appBackground,
        display: 'flex',
        flexDirection: 'column',
        gridColumn: spanFullWidth ? '1 / -1' : undefined,
        border: `2px solid ${dragOver ? theme.activeTabIndicator : isFocused ? paneColor : theme.borderSubtle}`,
        borderRadius: 6,
        outline: dragOver ? `2px dashed ${theme.activeTabIndicator}` : 'none',
        outlineOffset: -4,
        transition: 'border-color 0.15s',
      }}
    >
      {children}
    </div>
  );
}

function PaneSearchBar({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (term) {
      searchTerminal(sessionId, term, true);
    } else {
      clearTerminalSearch(sessionId);
    }
  }, [term, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && term) {
      e.preventDefault();
      searchTerminal(sessionId, term, !e.shiftKey);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px',
        background: theme.tabBarBackground,
        borderBottom: `1px solid ${theme.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      <span style={{ color: theme.tabInactiveText, fontSize: 12, flexShrink: 0 }}>🔍</span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in terminal..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1, border: 'none', outline: 'none', fontSize: 13,
          fontFamily: 'system-ui', background: 'transparent',
          color: theme.tabActiveText, padding: '2px 0',
        }}
      />
      <span style={{ fontSize: 11, color: theme.tabInactiveText, flexShrink: 0 }}>
        ↵ next · ⇧↵ prev
      </span>
      <span
        onClick={onClose}
        style={{ color: theme.buttonMuted, cursor: 'pointer', fontSize: 11, fontFamily: 'system-ui', flexShrink: 0 }}
      >
        Esc
      </span>
    </div>
  );
}
