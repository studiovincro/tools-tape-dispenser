import React from 'react';
import { theme } from '../theme';

interface ShortcutHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: '⌘ N', action: 'New Claude session' },
  { keys: '⌘ ⇧ N', action: 'New terminal session' },
  { keys: '⌘ W', action: 'Close active session' },
  { keys: '⌘ B', action: 'Toggle sidebar' },
  { keys: '⌘ \\', action: 'Cycle layout' },
  { keys: '⌘ ⇧ ]', action: 'Next session' },
  { keys: '⌘ ⇧ [', action: 'Previous session' },
  { keys: '⌘ 1–9', action: 'Jump to session' },
  { keys: '⌘ ?', action: 'Show this help' },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.tabActiveBackground,
          borderRadius: 12,
          padding: '24px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: `1px solid ${theme.borderSubtle}`,
          minWidth: 340,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'system-ui',
            color: theme.tabActiveText,
            marginBottom: 16,
          }}
        >
          Keyboard Shortcuts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shortcuts.map(({ keys, action }) => (
            <div
              key={keys}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontFamily: 'system-ui',
                  color: theme.tabInactiveText,
                }}
              >
                {action}
              </span>
              <kbd
                style={{
                  fontSize: 12,
                  fontFamily: 'system-ui',
                  color: theme.tabActiveText,
                  background: theme.tabBarBackground,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 11,
            color: theme.tabInactiveText,
            fontFamily: 'system-ui',
            textAlign: 'center',
          }}
        >
          Press Esc or click outside to close
        </div>
      </div>
    </div>
  );
}
