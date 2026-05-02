import React, { useState } from 'react';
import type { SessionInfo } from '../../shared/types';
import { theme } from '../theme';

interface TabProps {
  session: SessionInfo;
  isActive: boolean;
  paneSlotIndex: number | null;
  onClick: () => void;
  onClose: () => void;
}

const statusColors: Record<SessionInfo['status'], string> = {
  running: theme.statusRunning,
  idle: theme.statusIdle,
  exited: theme.statusExited,
};

export function Tab({ session, isActive, paneSlotIndex, onClick, onClose }: TabProps) {
  const [hovered, setHovered] = useState(false);

  const paneColor = paneSlotIndex !== null ? theme.paneIndicatorColors[paneSlotIndex] : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: '8px 8px 0 0',
        background: isActive
          ? theme.tabActiveBackground
          : hovered
            ? theme.tabHoverBackground
            : theme.tabInactiveBackground,
        color: isActive ? theme.tabActiveText : theme.tabInactiveText,
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: isActive ? 500 : 400,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        borderTop: isActive
          ? `2px solid ${theme.activeTabIndicator}`
          : '2px solid transparent',
        position: 'relative',
        minWidth: 80,
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {/* Pane indicator pip */}
      {paneColor && (
        <span
          style={{
            width: 4,
            height: 14,
            borderRadius: 2,
            background: paneColor,
            flexShrink: 0,
          }}
        />
      )}
      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusColors[session.status],
          flexShrink: 0,
        }}
      />
      {/* Label */}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 180,
        }}
        title={session.cwd}
      >
        {session.label}
      </span>
      {/* Close button */}
      <CloseButton onClick={onClose} />
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginLeft: 2,
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        fontSize: 13,
        lineHeight: 1,
        color: theme.tabInactiveText,
        background: hovered ? theme.closeButtonHover : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      ×
    </span>
  );
}
