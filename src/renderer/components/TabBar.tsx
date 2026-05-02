import React, { useState } from 'react';
import { Tab } from './Tab';
import {
  useSessionState,
  useSessionDispatch,
  getProjectSessions,
  getAvailableLayouts,
} from '../store/session-context';
import type { LayoutMode } from '../../shared/types';
import { theme } from '../theme';

interface TabBarProps {
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onCycleLayout: () => void;
}

function LayoutIcon({ mode }: { mode: LayoutMode }) {
  const s = { fill: 'currentColor', rx: 1 };
  const w = 16, h = 12;
  switch (mode) {
    case 'single':
      return (
        <svg width={w} height={h} viewBox="0 0 16 12">
          <rect x="1" y="1" width="14" height="10" {...s} />
        </svg>
      );
    case 'split-2h':
      return (
        <svg width={w} height={h} viewBox="0 0 16 12">
          <rect x="1" y="1" width="6.5" height="10" {...s} />
          <rect x="8.5" y="1" width="6.5" height="10" {...s} />
        </svg>
      );
    case 'split-2v':
      return (
        <svg width={w} height={h} viewBox="0 0 16 12">
          <rect x="1" y="1" width="14" height="4.5" {...s} />
          <rect x="1" y="6.5" width="14" height="4.5" {...s} />
        </svg>
      );
    case 'split-4':
      return (
        <svg width={w} height={h} viewBox="0 0 16 12">
          <rect x="1" y="1" width="6.5" height="4.5" {...s} />
          <rect x="8.5" y="1" width="6.5" height="4.5" {...s} />
          <rect x="1" y="6.5" width="6.5" height="4.5" {...s} />
          <rect x="8.5" y="6.5" width="6.5" height="4.5" {...s} />
        </svg>
      );
  }
}

export function TabBar({ onAddTab, onCloseTab, onCycleLayout }: TabBarProps) {
  const state = useSessionState();
  const { activeSessionId, layoutMode, visibleSessionIds } = state;
  const dispatch = useSessionDispatch();
  const [addHovered, setAddHovered] = useState(false);
  const [layoutHovered, setLayoutHovered] = useState(false);

  const projectSessions = getProjectSessions(state);
  const availableLayouts = getAvailableLayouts(projectSessions.length);
  const showLayoutButton = availableLayouts.length > 1;

  return (
    <div
      style={{
        height: 44,
        background: theme.tabBarBackground,
        display: 'flex',
        alignItems: 'flex-end',
        paddingLeft: state.sidebarCollapsed ? 12 : 12,
        paddingRight: 8,
        gap: 1,
        flexShrink: 0,
        borderBottom: `1px solid ${theme.borderSubtle}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {projectSessions.map((session) => {
          const paneSlotIndex = visibleSessionIds.indexOf(session.id);
          return (
            <Tab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              paneSlotIndex={layoutMode !== 'single' && paneSlotIndex !== -1 ? paneSlotIndex : null}
              onClick={() => dispatch({ type: 'SET_ACTIVE', id: session.id })}
              onClose={() => onCloseTab(session.id)}
            />
          );
        })}
        {/* Add tab button */}
        <button
          onClick={onAddTab}
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          style={{
            background: addHovered ? theme.tabHoverBackground : 'transparent',
            border: 'none',
            color: addHovered ? theme.buttonMutedHover : theme.buttonMuted,
            fontSize: 20,
            cursor: 'pointer',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
            marginLeft: 4,
            transition: 'background 0.12s, color 0.12s',
            flexShrink: 0,
          }}
          title="New tab (Cmd+T)"
        >
          +
        </button>
      </div>
      {/* Layout toggle — only shown when there are enough tabs */}
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
            padding: '4px 10px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
            transition: 'border-color 0.12s, color 0.12s',
            flexShrink: 0,
          }}
          title="Cycle layout (Cmd+\\)"
        >
          <LayoutIcon mode={layoutMode} />
        </button>
      )}
    </div>
  );
}
