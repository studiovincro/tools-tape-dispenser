import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        background: theme.tabActiveBackground,
        border: `1px solid ${theme.borderSubtle}`,
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '4px 0',
        minWidth: 180,
        zIndex: 1000,
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && (
            <div style={{ height: 1, background: theme.borderSubtle, margin: '4px 0' }} />
          )}
          <ContextMenuItem
            item={item}
            isSubmenuOpen={openSubmenu === i}
            onHover={() => setOpenSubmenu(item.submenu ? i : null)}
            onClose={onClose}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function ContextMenuItem({
  item,
  isSubmenuOpen,
  onHover,
  onClose,
}: {
  item: MenuItem;
  isSubmenuOpen: boolean;
  onHover: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!item.submenu) {
          item.onClick();
          onClose();
        }
      }}
      onMouseEnter={() => { setHovered(true); onHover(); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 14px',
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: item.danger ? theme.statusExited : theme.tabActiveText,
        cursor: 'pointer',
        background: hovered ? theme.tabHoverBackground : 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {item.label}
      {item.submenu && <span style={{ color: theme.tabInactiveText, fontSize: 12 }}>▶</span>}
      {item.submenu && isSubmenuOpen && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: -4,
            background: theme.tabActiveBackground,
            border: `1px solid ${theme.borderSubtle}`,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '4px 0',
            minWidth: 160,
            zIndex: 1001,
          }}
        >
          {item.submenu.map((sub, j) => (
            <div
              key={j}
              onClick={(e) => { e.stopPropagation(); sub.onClick(); onClose(); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.tabHoverBackground)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              style={{
                padding: '8px 14px',
                fontSize: 14,
                fontFamily: 'system-ui',
                color: theme.tabActiveText,
                cursor: 'pointer',
              }}
            >
              {sub.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
