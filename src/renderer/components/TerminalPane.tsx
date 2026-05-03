import React, { useState } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { theme } from '../theme';

interface TerminalPaneProps {
  sessionId: string | null;
  visible?: boolean;
  sessionType?: string;
  status?: string;
  onRestart?: () => void;
  onClose?: () => void;
}

export function TerminalPane({ sessionId, visible = true, sessionType = 'claude', status, onRestart, onClose }: TerminalPaneProps) {
  const { containerRef } = useTerminal(sessionId, visible, sessionType);
  const isExited = status === 'exited';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        padding: '8px 0 8px 8px',
        background: theme.terminal.background,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          opacity: isExited ? 0.3 : 1,
        }}
      />
      {isExited && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: 'system-ui',
              color: theme.tabActiveText,
              background: theme.tabBarBackground,
              padding: '8px 20px',
              borderRadius: 8,
            }}
          >
            Session ended
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onRestart && (
              <button
                onClick={onRestart}
                style={{
                  background: theme.activeTabIndicator,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: 'system-ui',
                  padding: '6px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Restart
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: theme.borderSubtle,
                  border: 'none',
                  color: theme.tabActiveText,
                  fontSize: 14,
                  fontFamily: 'system-ui',
                  padding: '6px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
