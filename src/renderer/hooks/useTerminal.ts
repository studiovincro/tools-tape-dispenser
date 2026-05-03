import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ElectronAPI } from '../../preload/preload';
import { theme } from '../theme';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Terminal registry — keeps xterm instances alive across React mounts.
// When a session moves between pane slots or projects, the terminal
// DOM element is detached and reattached instead of being destroyed.
const registry = new Map<string, {
  terminal: Terminal;
  fitAddon: FitAddon;
  element: HTMLElement;
  cleanup: () => void;
}>();

/** Permanently dispose a terminal when its session is removed. */
export function disposeTerminal(sessionId: string): void {
  const entry = registry.get(sessionId);
  if (entry) {
    entry.cleanup();
    entry.terminal.dispose();
    registry.delete(sessionId);
  }
}

export function useTerminal(sessionId: string | null, visible: boolean = true, sessionType: string = 'claude') {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    const container = containerRef.current;
    let entry = registry.get(sessionId);

    if (entry) {
      // Reattach existing terminal to this container
      container.appendChild(entry.element);
      fitAddonRef.current = entry.fitAddon;
      requestAnimationFrame(() => {
        try { entry!.fitAddon.fit(); } catch {}
      });
    } else {
      // Create new terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: theme.terminal.background,
          foreground: theme.terminal.foreground,
          cursor: theme.terminal.cursor,
          selectionBackground: theme.terminal.selectionBackground,
        },
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      fitAddonRef.current = fitAddon;

      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch {}
      });

      // Wire keystrokes to pty (permanent — lives with the terminal)
      terminal.onData((data) => {
        window.electronAPI.writeSession(sessionId, data);
      });

      // Wire pty output to terminal (permanent)
      const unsubData = window.electronAPI.onPtyData((id, data) => {
        if (id === sessionId) {
          terminal.write(data);
        }
      });

      // Wire resize (permanent)
      terminal.onResize(({ cols, rows }) => {
        window.electronAPI.resizeSession(sessionId, cols, rows);
      });

      // Cmd+K to clear terminal (only for non-Claude sessions)
      if (sessionType !== 'claude') {
        terminal.attachCustomKeyEventHandler((e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k' && e.type === 'keydown') {
            terminal.clear();
            return false;
          }
          return true;
        });
      }

      const element = container.querySelector('.xterm') as HTMLElement;
      entry = { terminal, fitAddon, element, cleanup: unsubData };
      registry.set(sessionId, entry);
    }

    // ResizeObserver scoped to this container mount
    const currentEntry = entry;
    const resizeObserver = new ResizeObserver(() => {
      try { currentEntry.fitAddon.fit(); } catch {}
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      fitAddonRef.current = null;
      // Detach terminal DOM from container but keep it alive in registry
      const reg = registry.get(sessionId);
      if (reg && reg.element.parentNode === container) {
        container.removeChild(reg.element);
      }
    };
  }, [sessionId]);

  // Refit when becoming visible (e.g. tab switch or layout change)
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { fitAddonRef.current?.fit(); } catch {}
        });
      });
    }
  }, [visible]);

  return { containerRef };
}
