import React, { useState } from 'react';
import { TerminalPane } from './TerminalPane';
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

interface SplitLayoutProps {
  onCloseSession: (id: string) => void;
}

export function SplitLayout({ onCloseSession }: SplitLayoutProps) {
  const { sessions, visibleSessionIds, layoutMode, projects } = useSessionState();
  const dispatch = useSessionDispatch();
  const isMultiPane = visibleSessionIds.length > 1;

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
          return (
            <div
              key={`slot-${index}`}
              style={{
                overflow: 'hidden',
                background: theme.appBackground,
                display: 'flex',
                flexDirection: 'column',
                border: isMultiPane ? `2px solid ${theme.borderSubtle}` : 'none',
                borderRadius: isMultiPane ? 6 : 0,
              }}
            >
              {session && (
                <PaneHeader
                  session={session}
                  projectName={projects.find((p) => p.id === session.projectId)?.name ?? ''}
                  color={isMultiPane ? paneColor : theme.tabInactiveText}
                  showClose={isMultiPane}
                  onClose={() => onCloseSession(id)}
                  onDoubleClick={() => focusPane(id)}
                />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <TerminalPane sessionId={id} visible />
              </div>
            </div>
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
}: {
  projectName: string;
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
