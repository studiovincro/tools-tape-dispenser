import React, { useState, useEffect } from 'react';
import {
  useSessionState,
  useSessionDispatch,
  getProjectSessions,
  getFilteredProjectSessions,
  getAvailableLayouts,
} from '../store/session-context';
import type { LayoutMode, SessionInfo, SessionFilter } from '../../shared/types';
import { theme } from '../theme';

interface FooterProps {
  onCycleLayout: () => void;
  onShowShortcuts: () => void;
}

function LayoutIcon({ count, maxCols }: { count: number; maxCols: number }) {
  // Draw a grid matching the responsive layout
  const cols = count === 1 ? 1 : Math.min(maxCols, count);
  const rows = Math.ceil(count / cols);
  const w = 18, h = 14;
  const gap = 1.5;
  const cellW = (w - 2 - (cols - 1) * gap) / cols;
  const cellH = (h - 2 - (rows - 1) * gap) / rows;
  const rects: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push(
      <rect
        key={i}
        x={1 + col * (cellW + gap)}
        y={1 + row * (cellH + gap)}
        width={cellW}
        height={cellH}
        fill="currentColor"
        rx={1}
      />
    );
  }
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{rects}</svg>;
}

const MIN_PANE_WIDTH = 420;

export function Footer({ onCycleLayout, onShowShortcuts }: FooterProps) {
  const state = useSessionState();
  const dispatch = useSessionDispatch();
  const { layoutMode, sessionFilter, sidebarWidth, sidebarCollapsed } = state;
  const projectSessions = getProjectSessions(state);
  const filteredSessions = getFilteredProjectSessions(state);
  const showLayoutButton = filteredSessions.length > 0;
  const [layoutHovered, setLayoutHovered] = useState(false);
  // Estimate main area width for the layout icon
  const mainWidth = typeof window !== 'undefined'
    ? window.innerWidth - (sidebarCollapsed ? 0 : sidebarWidth + 6)
    : 1200;
  const maxCols = Math.max(1, Math.floor(mainWidth / MIN_PANE_WIDTH));

  return (
    <div
      style={{
        height: 33,
        minHeight: 33,
        boxSizing: 'border-box',
        flexShrink: 0,
        background: theme.tabBarBackground,
        borderTop: `1px solid ${theme.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: theme.tabInactiveText,
      }}
    >
      {/* Left: session counts + capacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SessionStats sessions={state.sessions} />
      </div>

      {/* Right: shortcuts + layout toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FilterToggle
          value={sessionFilter}
          counts={{
            all: projectSessions.length,
            claude: projectSessions.filter((s) => s.sessionType === 'claude').length,
            terminal: projectSessions.filter((s) => s.sessionType === 'terminal').length,
          }}
          onChange={(f) => dispatch({ type: 'SET_SESSION_FILTER', filter: f })}
        />
        <button
          onClick={onShowShortcuts}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.buttonMuted,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'system-ui',
            padding: '2px 6px',
            borderRadius: 4,
          }}
          title="Keyboard shortcuts (Cmd+?)"
        >
          ⌘?
        </button>
        {showLayoutButton && (
          <button
            onClick={onCycleLayout}
            onMouseEnter={() => setLayoutHovered(true)}
            onMouseLeave={() => setLayoutHovered(false)}
            style={{
              background: 'transparent',
              border: layoutHovered ? `1px solid ${theme.borderSubtle}` : '1px solid transparent',
              color: layoutHovered ? theme.buttonMutedHover : theme.buttonMuted,
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'border-color 0.12s, color 0.12s',
            }}
            title="Cycle layout (Cmd+\\)"
          >
            <LayoutIcon count={state.visibleSessionIds.length || 1} maxCols={maxCols} />
            <span style={{ fontSize: 13 }}>{state.visibleSessionIds.length || 1} pane{(state.visibleSessionIds.length || 1) !== 1 ? 's' : ''}</span>
          </button>
        )}
      </div>
    </div>
  );
}


const divider = (key: string) => (
  <span
    key={key}
    style={{
      color: theme.tabInactiveText,
      flexShrink: 0,
      userSelect: 'none',
    }}
  >
    -
  </span>
);

function SessionStats({ sessions }: { sessions: SessionInfo[] }) {
  const claudeSessions = sessions.filter((s) => s.sessionType === 'claude');
  const terminalSessions = sessions.filter((s) => s.sessionType === 'terminal');

  // Find the max context usage across all Claude sessions
  const contextPercents = claudeSessions
    .map((s) => s.contextPercent)
    .filter((p): p is number => p !== null);
  const maxContext = contextPercents.length > 0 ? Math.max(...contextPercents) : null;
  const remaining = maxContext !== null ? Math.max(0, 100 - maxContext) : null;

  // Color the capacity — subtle unless critical
  const capacityColor = maxContext === null
    ? theme.tabInactiveText
    : maxContext > 80
      ? theme.statusExited
      : theme.tabInactiveText;

  const sections: React.ReactNode[] = [];

  // Session counts with badges
  if (claudeSessions.length > 0) {
    sections.push(
      <span key="claude" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        Claude
        <span style={{
          background: theme.borderSubtle,
          color: theme.tabActiveText,
          fontSize: 12,
          fontWeight: 500,
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
        }}>
          {claudeSessions.length}
        </span>
      </span>
    );
  }
  if (terminalSessions.length > 0) {
    sections.push(
      <span key="term" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        Terminals
        <span style={{
          background: theme.borderSubtle,
          color: theme.tabActiveText,
          fontSize: 12,
          fontWeight: 500,
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
        }}>
          {terminalSessions.length}
        </span>
      </span>
    );
  }

  // Capacity section
  if (remaining !== null) {
    sections.push(
      <span key="cap">{remaining.toFixed(0)}% session left</span>
    );
  }

  if (sections.length === 0) return null;

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {sections.map((section, i) => (
        <React.Fragment key={i}>
          {i > 0 && divider(`div-${i}`)}
          {section}
        </React.Fragment>
      ))}
    </span>
  );
}

const filterOptions: { value: SessionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claude', label: 'Claude' },
  { value: 'terminal', label: 'Terminal' },
];

function FilterToggle({ value, counts, onChange }: { value: SessionFilter; counts: Record<SessionFilter, number>; onChange: (f: SessionFilter) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: theme.borderSubtle,
        borderRadius: 5,
        padding: 2,
        gap: 1,
      }}
    >
      {filterOptions.map((opt) => {
        const count = counts[opt.value];
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              background: isActive ? theme.tabActiveBackground : 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              fontFamily: 'system-ui',
              color: isActive ? theme.tabActiveText : theme.tabInactiveText,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'background 0.12s, color 0.12s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {opt.label}
            <span style={{ opacity: 0.6 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
