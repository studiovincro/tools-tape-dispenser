import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSessionState, useSessionDispatch, getProjectSessions } from '../store/session-context';
import { theme } from '../theme';
import { randomId } from '../utils';
import type { SessionInfo, LayoutMode } from '../../shared/types';

interface CommandPaletteProps {
  onClose: () => void;
  onAddSession: (type: 'claude' | 'terminal') => void;
  onShowSettings: () => void;
  onShowShortcuts: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: string;
  hint?: string;
  action: () => void;
}

export function CommandPalette({ onClose, onAddSession, onShowSettings, onShowShortcuts }: CommandPaletteProps) {
  const state = useSessionState();
  const dispatch = useSessionDispatch();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Sessions — jump to session
    for (const session of state.sessions) {
      const project = state.projects.find((p) => p.id === session.projectId);
      items.push({
        id: `session-${session.id}`,
        label: session.label,
        category: project?.name ?? 'Project',
        hint: session.sessionType === 'claude' ? 'Claude' : 'Terminal',
        action: () => {
          if (session.projectId !== state.activeProjectId) {
            dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: session.projectId });
          }
          dispatch({ type: 'SET_ACTIVE', id: session.id });
          onClose();
        },
      });
    }

    // Projects — switch to project
    for (const project of state.projects) {
      const count = getProjectSessions(state, project.id).length;
      items.push({
        id: `project-${project.id}`,
        label: project.name,
        category: 'Switch Project',
        hint: `${count} session${count !== 1 ? 's' : ''}`,
        action: () => {
          dispatch({ type: 'SET_ACTIVE_PROJECT', projectId: project.id });
          onClose();
        },
      });
    }

    // Actions
    items.push({
      id: 'new-claude',
      label: 'New Claude Session',
      category: 'Action',
      hint: 'Cmd+N',
      action: () => { onClose(); onAddSession('claude'); },
    });
    items.push({
      id: 'new-terminal',
      label: 'New Terminal Session',
      category: 'Action',
      hint: 'Cmd+Shift+N',
      action: () => { onClose(); onAddSession('terminal'); },
    });
    items.push({
      id: 'settings',
      label: 'Open Settings',
      category: 'Action',
      hint: 'Cmd+,',
      action: () => { onClose(); onShowSettings(); },
    });
    items.push({
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      category: 'Action',
      hint: 'Cmd+?',
      action: () => { onClose(); onShowShortcuts(); },
    });
    items.push({
      id: 'new-project',
      label: 'New Project',
      category: 'Action',
      action: () => {
        const existingCount = state.projects.filter((p) => p.name.startsWith('New Project')).length;
        const name = existingCount === 0 ? 'New Project' : `New Project ${existingCount + 1}`;
        dispatch({ type: 'ADD_PROJECT', project: { id: randomId(), name } });
        onClose();
      },
    });
    items.push({
      id: 'show-all',
      label: 'Show All Panes',
      category: 'Action',
      action: () => {
        const filtered = state.sessions.filter((s) => s.projectId === state.activeProjectId);
        const layout = String(Math.min(filtered.length, 8)) as LayoutMode;
        dispatch({ type: 'SET_LAYOUT', mode: layout });
        onClose();
      },
    });

    return items;
  }, [state.sessions, state.projects, state.activeProjectId, dispatch, onClose, onAddSession, onShowSettings, onShowShortcuts]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.hint && c.hint.toLowerCase().includes(q))
    );
  }, [commands, query]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.tabActiveBackground,
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          width: 500,
          maxHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.borderSubtle}`,
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search sessions, projects, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontFamily: 'system-ui',
              background: 'transparent',
              color: theme.tabActiveText,
              padding: 0,
            }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{
              padding: '20px 16px',
              fontSize: 13,
              fontFamily: 'system-ui',
              color: theme.tabInactiveText,
              textAlign: 'center',
            }}>
              No results
            </div>
          )}
          {filtered.map((item, i) => {
            const isSelected = i === selectedIndex;
            const showCategory = i === 0 || filtered[i - 1].category !== item.category;
            return (
              <React.Fragment key={item.id}>
                {showCategory && (
                  <div style={{
                    padding: '8px 16px 4px',
                    fontSize: 11,
                    fontFamily: 'system-ui',
                    fontWeight: 600,
                    color: theme.tabInactiveText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {item.category}
                  </div>
                )}
                <div
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: isSelected ? theme.tabHoverBackground : 'transparent',
                    borderLeft: isSelected ? `3px solid ${theme.activeTabIndicator}` : '3px solid transparent',
                  }}
                >
                  <span style={{
                    fontSize: 14,
                    fontFamily: 'system-ui',
                    color: theme.tabActiveText,
                    fontWeight: isSelected ? 500 : 400,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </span>
                  {item.hint && (
                    <span style={{
                      fontSize: 12,
                      fontFamily: 'system-ui',
                      color: theme.tabInactiveText,
                      flexShrink: 0,
                    }}>
                      {item.hint}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
