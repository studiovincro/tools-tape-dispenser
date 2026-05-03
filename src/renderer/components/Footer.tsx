import React, { useState, useEffect, useRef } from 'react';
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

export function Footer({ onCycleLayout }: FooterProps) {
  const state = useSessionState();
  const dispatch = useSessionDispatch();
  const { layoutMode, sessionFilter, sidebarWidth, sidebarCollapsed, settings } = state;
  const projectSessions = getProjectSessions(state);
  const filteredSessions = getFilteredProjectSessions(state);
  const showLayoutButton = filteredSessions.length > 0;
  const [layoutHovered, setLayoutHovered] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const mainWidth = windowWidth - (sidebarCollapsed ? 0 : sidebarWidth + 6);
  const maxCols = Math.max(1, Math.floor(mainWidth / (settings?.minPaneWidth || 450)));

  return (
    <div
      style={{
        height: 40,
        minHeight: 40,
        boxSizing: 'border-box',
        flexShrink: 0,
        background: theme.tabBarBackground,
        borderTop: `1px solid ${theme.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: theme.tabInactiveText,
      }}
    >
      {/* Left: subscription + timer + capacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SubscriptionPill endDate={settings.subscriptionEndDate} />
        <SessionTimer />
        <SessionCapacity sessions={state.sessions} />
      </div>

      {/* Right: filter + layout toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <FilterToggle
          value={sessionFilter}
          counts={{
            all: projectSessions.length,
            claude: projectSessions.filter((s) => s.sessionType === 'claude').length,
            terminal: projectSessions.filter((s) => s.sessionType === 'terminal').length,
          }}
          onChange={(f) => dispatch({ type: 'SET_SESSION_FILTER', filter: f })}
        />
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


function SessionCapacity({ sessions }: { sessions: SessionInfo[] }) {
  const claudeSessions = sessions.filter((s) => s.sessionType === 'claude');
  const contextPercents = claudeSessions
    .map((s) => s.contextPercent)
    .filter((p): p is number => p !== null);
  const maxContext = contextPercents.length > 0 ? Math.max(...contextPercents) : null;
  const remaining = maxContext !== null ? Math.max(0, 100 - maxContext) : null;

  if (remaining === null) return null;

  const bg = remaining > 40 ? '#30a46c' : remaining > 20 ? '#e5a100' : '#e5484d';

  return (
    <span style={{
      background: bg,
      color: '#fff',
      fontSize: 12,
      fontFamily: 'system-ui',
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 5,
    }}>
      {remaining.toFixed(0)}% left
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

const TIMER_OPTIONS = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '2.5h', minutes: 150 },
  { label: '3h', minutes: 180 },
  { label: '3.5h', minutes: 210 },
  { label: '4h', minutes: 240 },
  { label: '4.5h', minutes: 270 },
  { label: '5h', minutes: 300 },
];

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SessionTimer() {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tick every second
  useEffect(() => {
    if (endTime === null) return;
    const tick = () => {
      const left = endTime - Date.now();
      setTimeLeft(Math.max(0, left));
      if (left <= 0) setEndTime(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isRunning = endTime !== null && timeLeft > 0;
  const isExpired = endTime !== null && timeLeft <= 0;

  const startTimer = (minutes: number) => {
    setEndTime(Date.now() + minutes * 60 * 1000);
    setMenuOpen(false);
  };

  const stopTimer = () => {
    setEndTime(null);
    setTimeLeft(0);
    setMenuOpen(false);
  };

  // Traffic light: green < 1h remaining, amber < 2h, red >= 2h
  const pillBg = !isRunning && !isExpired ? theme.borderSubtle
    : isExpired ? '#e5484d'
    : timeLeft < 60 * 60 * 1000 ? '#30a46c'
    : timeLeft < 2 * 60 * 60 * 1000 ? '#e5a100'
    : '#e5484d';
  const pillText = !isRunning && !isExpired ? theme.tabInactiveText : '#fff';
  const [hovered, setHovered] = useState(false);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: isRunning || isExpired ? pillBg : hovered ? theme.tabHoverBackground : theme.borderSubtle,
          border: 'none',
          color: pillText,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'system-ui',
          fontVariantNumeric: 'tabular-nums',
          padding: '4px 10px',
          borderRadius: 5,
          fontWeight: 500,
          transition: 'background 0.12s, color 0.12s',
        }}
      >
        {isRunning ? formatTimeLeft(timeLeft) : isExpired ? 'Reset due' : '0:00:00'}
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            background: theme.tabActiveBackground,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            minWidth: 120,
            zIndex: 100,
          }}
        >
          {isRunning && (
            <TimerMenuItem label="Stop timer" onClick={stopTimer} danger />
          )}
          {TIMER_OPTIONS.map((opt) => (
            <TimerMenuItem
              key={opt.minutes}
              label={opt.label}
              onClick={() => startTimer(opt.minutes)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TimerMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
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
        color: danger ? theme.statusExited : theme.tabActiveText,
        background: hovered ? theme.tabHoverBackground : 'transparent',
      }}
    >
      {label}
    </div>
  );
}

function getNextRenewalDays(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const renewalDay = start.getDate();

  // Try this month's anniversary
  let next = new Date(now.getFullYear(), now.getMonth(), renewalDay);
  // If today is past it, move to next month
  if (next <= now) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, renewalDay);
  }
  // Handle months where renewalDay exceeds month length (e.g. 31st in Feb)
  if (next.getDate() !== renewalDay) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of prev month
    if (next <= now) {
      next = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    }
  }

  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function SubscriptionPill({ endDate }: { endDate: string }) {
  if (!endDate) return null;

  const daysLeft = getNextRenewalDays(endDate);
  const bg = daysLeft <= 3 ? '#e5484d' : daysLeft <= 7 ? '#e5a100' : '#30a46c';

  return (
    <span style={{
      background: bg,
      color: '#fff',
      fontSize: 12,
      fontFamily: 'system-ui',
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 5,
    }}>
      {daysLeft}d to renewal
    </span>
  );
}
