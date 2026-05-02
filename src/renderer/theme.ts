export const theme = {
  appBackground: '#f5f5f5',
  tabBarBackground: '#e8e8ec',
  tabActiveBackground: '#ffffff',
  tabInactiveBackground: 'transparent',
  tabActiveText: '#1e1e2e',
  tabInactiveText: '#6e6e82',
  tabHoverBackground: '#dcdce4',
  closeButtonHover: '#c8c8d0',
  buttonMuted: '#8888a0',
  buttonMutedHover: '#1e1e2e',
  statusRunning: '#2da44e',
  statusIdle: '#8888a0',
  statusExited: '#cf222e',
  borderSubtle: '#d4d4d8',
  activeTabIndicator: '#6366f1',
  paneIndicatorColors: [
    // Row 1: saturated primaries
    '#6366f1', // indigo
    '#f59e0b', // amber
    '#10b981', // emerald
    '#f43f5e', // rose
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ea580c', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#14b8a6', // teal
    '#a855f7', // purple
    '#eab308', // yellow
    '#0ea5e9', // sky
    '#d946ef', // fuchsia
    '#22c55e', // green
    '#e11d48', // crimson
    // Row 2: deeper/darker variants
    '#4338ca', // deep indigo
    '#b45309', // deep amber
    '#047857', // deep emerald
    '#be123c', // deep rose
    '#6d28d9', // deep violet
    '#0891b2', // deep cyan
    '#c2410c', // deep orange
    '#4d7c0f', // deep lime
    '#be185d', // deep pink
    '#0f766e', // deep teal
    '#7e22ce', // deep purple
    '#a16207', // deep yellow
    '#0369a1', // deep sky
    '#a21caf', // deep fuchsia
    '#15803d', // deep green
    '#9f1239', // deep crimson
    // Row 3: lighter/softer variants
    '#818cf8', // light indigo
    '#fbbf24', // light amber
    '#34d399', // light emerald
    '#fb7185', // light rose
    '#a78bfa', // light violet
    '#22d3ee', // light cyan
    '#fb923c', // light orange
    '#a3e635', // light lime
    '#f472b6', // light pink
    '#2dd4bf', // light teal
    '#c084fc', // light purple
    '#facc15', // light yellow
    '#38bdf8', // light sky
    '#e879f9', // light fuchsia
    '#4ade80', // light green
    '#fb7185', // light crimson
  ] as const,
  terminal: {
    background: '#fafafa',
    foreground: '#1e1e2e',
    cursor: '#1e1e2e',
    selectionBackground: '#b4d5fe',
  },
} as const;
