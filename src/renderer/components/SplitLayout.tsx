import React, { useState, useCallback } from 'react';
import { TerminalPane } from './TerminalPane';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { useSessionState, useSessionDispatch } from '../store/session-context';
import type { LayoutMode, SessionInfo } from '../../shared/types';
import { theme } from '../theme';

function getGridStyle(paneCount: number): React.CSSProperties {
  if (paneCount <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  const rows = Math.ceil(paneCount / 2);
  return {
    gridTemplateColumns: paneCount === 1 ? '1fr' : '1fr 1fr',
    gridTemplateRows: Array(rows).fill('1fr').join(' '),
  };
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
  const { sessions, visibleSessionIds, layoutMode, projects, activeSessionId } = useSessionState();
  const dispatch = useSessionDispatch();
  const isMultiPane = visibleSessionIds.length > 1;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

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
        { label: 'Close Session', onClick: () => {
          if (window.confirm(`Close "${session.label}"?`)) {
            window.electronAPI.killSession(id);
            dispatch({ type: 'REMOVE_SESSION', id });
          }
        }, danger: true },
      ],
    });
  }, [sessions, visibleSessionIds, isMultiPane, dispatch]);

  if (visibleSessionIds.length === 0) {
    return (
      <div
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
          No active sessions
        </span>
      </div>
    );
  }

  const focusPane = (id: string) => {
    if (isMultiPane) {
      dispatch({ type: 'SET_LAYOUT', mode: '1' });
      dispatch({ type: 'SET_ACTIVE', id });
    }
  };

  return (
    <div
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
          ...getGridStyle(visibleSessionIds.length),
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
              isFocused={isFocused}
              isMultiPane={isMultiPane}
              paneColor={paneColor}
              onClick={() => { if (isMultiPane) dispatch({ type: 'SET_ACTIVE', id }); }}
              onDrop={(sessionId) => dispatch({ type: 'SET_VISIBLE_SLOT', index, sessionId })}
            >
              {session && (
                <PaneHeader
                  session={session}
                  projectName={projects.find((p) => p.id === session.projectId)?.name ?? ''}
                  color={isMultiPane ? paneColor : theme.tabInactiveText}
                  showClose={isMultiPane}
                  onClose={() => dispatch({ type: 'REMOVE_FROM_STAGE', id })}
                  onDoubleClick={() => focusPane(id)}
                  onContextMenu={(e) => showPaneMenu(e, id, index)}
                />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <TerminalPane sessionId={id} visible />
              </div>
            </PaneSlot>
          );
        })}
      </div>

      {sessions
        .filter((s) => !visibleSessionIds.includes(s.id))
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
            <TerminalPane sessionId={s.id} visible={false} />
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        height: 37,
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
        cursor: showClose ? 'pointer' : 'default',
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
  isFocused,
  isMultiPane,
  paneColor,
  onClick,
  onDrop,
  children,
}: {
  index: number;
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
        border: isMultiPane
          ? `2px solid ${dragOver ? theme.activeTabIndicator : isFocused ? paneColor : theme.borderSubtle}`
          : 'none',
        borderRadius: isMultiPane ? 6 : 0,
        outline: dragOver ? `2px dashed ${theme.activeTabIndicator}` : 'none',
        outlineOffset: -4,
        transition: 'border-color 0.15s',
      }}
    >
      {children}
    </div>
  );
}
