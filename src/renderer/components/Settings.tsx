import React, { useState } from 'react';
import type { Settings as SettingsType } from '../../shared/types';
import { theme } from '../theme';

interface SettingsProps {
  settings: SettingsType;
  onSave: (s: Partial<SettingsType>) => void;
  onClose: () => void;
  onPickDirectory: () => Promise<string | null>;
}

function SettingsRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '14px 0', borderBottom: `1px solid ${theme.borderSubtle}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontFamily: 'system-ui', color: theme.tabActiveText, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, fontFamily: 'system-ui', color: theme.tabInactiveText, marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function Settings({ settings, onSave, onClose, onPickDirectory }: SettingsProps) {
  const [minPaneWidth, setMinPaneWidth] = useState(settings.minPaneWidth);
  const [terminalFontSize, setTerminalFontSize] = useState(settings.terminalFontSize);
  const [defaultSessionType, setDefaultSessionType] = useState(settings.defaultSessionType);
  const [defaultProjectDir, setDefaultProjectDir] = useState(settings.defaultProjectDir);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(settings.subscriptionEndDate);

  const handleSave = () => {
    onSave({ minPaneWidth, terminalFontSize, defaultSessionType, defaultProjectDir, subscriptionEndDate });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 14,
    fontFamily: 'system-ui',
    background: theme.appBackground,
    color: theme.tabActiveText,
    outline: 'none',
    width: 80,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontFamily: 'system-ui',
    color: theme.tabActiveText,
    fontWeight: 500,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: 'system-ui',
    color: theme.tabInactiveText,
    marginTop: 2,
  };

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
          minWidth: 400,
          maxWidth: 500,
        }}
      >
        <h2 style={{
          fontSize: 18,
          fontFamily: 'system-ui',
          fontWeight: 600,
          color: theme.tabActiveText,
          margin: '0 0 20px 0',
        }}>
          Settings
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Min pane width */}
          <SettingsRow label="Min pane width (px)" desc="Minimum width before panes wrap to a new row">
            <input
              type="number"
              min={200}
              max={1000}
              step={50}
              value={minPaneWidth}
              onChange={(e) => setMinPaneWidth(Math.max(200, Math.min(1000, Number(e.target.value) || 450)))}
              style={inputStyle}
            />
          </SettingsRow>

          {/* Terminal font size */}
          <SettingsRow label="Terminal font size (px)" desc="Font size for all terminal panes">
            <input
              type="number"
              min={10}
              max={24}
              step={1}
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(Math.max(10, Math.min(24, Number(e.target.value) || 13)))}
              style={inputStyle}
            />
          </SettingsRow>

          {/* Default session type */}
          <SettingsRow label="Default session type" desc="Type used when creating new sessions">
            <div style={{ display: 'flex', background: theme.borderSubtle, borderRadius: 5, padding: 2, gap: 1 }}>
              {(['claude', 'terminal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDefaultSessionType(t)}
                  style={{
                    background: defaultSessionType === t ? theme.tabActiveBackground : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: 13,
                    fontFamily: 'system-ui',
                    color: defaultSessionType === t ? theme.tabActiveText : theme.tabInactiveText,
                    fontWeight: defaultSessionType === t ? 500 : 400,
                    cursor: 'pointer',
                    boxShadow: defaultSessionType === t ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t === 'claude' ? 'Claude' : 'Terminal'}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Default project directory */}
          <div style={{ padding: '14px 0' }}>
            <div style={labelStyle}>Default project directory</div>
            <div style={descStyle}>Skip the directory picker when creating sessions</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <input
                type="text"
                value={defaultProjectDir}
                onChange={(e) => setDefaultProjectDir(e.target.value)}
                placeholder="None — always ask"
                style={{
                  ...inputStyle,
                  width: undefined,
                  flex: 1,
                }}
              />
              <button
                onClick={async () => {
                  const dir = await onPickDirectory();
                  if (dir) setDefaultProjectDir(dir);
                }}
                style={{
                  background: theme.borderSubtle,
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontFamily: 'system-ui',
                  color: theme.tabActiveText,
                  cursor: 'pointer',
                }}
              >
                Browse
              </button>
              {defaultProjectDir && (
                <button
                  onClick={() => setDefaultProjectDir('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 16,
                    color: theme.tabInactiveText,
                    cursor: 'pointer',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Subscription start date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '14px 0', borderTop: `1px solid ${theme.borderSubtle}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={labelStyle}>Subscription start date</div>
              <div style={descStyle}>Monthly renewal date for your subscription</div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <input
                type="date"
                value={subscriptionEndDate}
                onChange={(e) => setSubscriptionEndDate(e.target.value)}
                style={{
                  ...inputStyle,
                  width: 150,
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              background: theme.borderSubtle,
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontFamily: 'system-ui',
              color: theme.tabActiveText,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: theme.activeTabIndicator,
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontFamily: 'system-ui',
              color: '#fff',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
