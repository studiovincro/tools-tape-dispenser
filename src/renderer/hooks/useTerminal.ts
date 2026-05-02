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

export function useTerminal(sessionId: string | null, visible: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Create terminal once when sessionId is set
  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

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
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Delay initial fit
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    // Wire keystrokes to pty
    const onDataDisposable = terminal.onData((data) => {
      window.electronAPI.writeSession(sessionId, data);
    });

    // Wire pty output to terminal
    const unsubData = window.electronAPI.onPtyData((id, data) => {
      if (id === sessionId) {
        terminal.write(data);
      }
    });

    // Handle resize
    const onResizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.electronAPI.resizeSession(sessionId, cols, rows);
    });

    // ResizeObserver to refit terminal when container resizes
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      unsubData();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Refit when becoming visible (e.g. tab switch or layout change)
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Double RAF to ensure DOM has fully settled after layout change
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { fitAddonRef.current?.fit(); } catch {}
        });
      });
    }
  }, [visible]);

  return { containerRef };
}
