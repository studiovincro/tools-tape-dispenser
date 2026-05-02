import React from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { theme } from '../theme';

interface TerminalPaneProps {
  sessionId: string | null;
  visible?: boolean;
}

export function TerminalPane({ sessionId, visible = true }: TerminalPaneProps) {
  const { containerRef } = useTerminal(sessionId, visible);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        padding: '8px 0 8px 8px',
        background: theme.terminal.background,
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
