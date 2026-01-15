'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useDevMode } from '@/contexts/DevModeContext';

// ============================================================================
// DEV BADGE COMPONENT
// Wraps UI elements and displays a unique ID badge when Developer Mode is ON
// ============================================================================

interface DevBadgeProps {
    children: React.ReactNode;
    type: 'button' | 'table' | 'filter' | 'card' | 'input' | 'modal' | 'section' | 'dropdown' | 'link' | 'panel';
    label?: string; // Optional descriptive label (e.g., "Submit", "DomainFilter")
    className?: string;
}

// Color mapping for different element types
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    button: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6', text: '#ffffff' },    // Blue
    table: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e', text: '#ffffff' },      // Green
    filter: { bg: 'rgba(249, 115, 22, 0.9)', border: '#f97316', text: '#ffffff' },    // Orange
    card: { bg: 'rgba(168, 85, 247, 0.9)', border: '#a855f7', text: '#ffffff' },      // Purple
    input: { bg: 'rgba(20, 184, 166, 0.9)', border: '#14b8a6', text: '#ffffff' },     // Teal
    modal: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444', text: '#ffffff' },      // Red
    section: { bg: 'rgba(107, 114, 128, 0.9)', border: '#6b7280', text: '#ffffff' },  // Gray
    dropdown: { bg: 'rgba(236, 72, 153, 0.9)', border: '#ec4899', text: '#ffffff' },  // Pink
    link: { bg: 'rgba(99, 102, 241, 0.9)', border: '#6366f1', text: '#ffffff' },      // Indigo
    panel: { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b', text: '#ffffff' },     // Amber
};

// Element type prefixes for ID generation
const TYPE_PREFIXES: Record<string, string> = {
    button: 'BTN',
    table: 'TBL',
    filter: 'FLT',
    card: 'CRD',
    input: 'INP',
    modal: 'MDL',
    section: 'SEC',
    dropdown: 'DRP',
    link: 'LNK',
    panel: 'PNL',
};

export function DevBadge({ children, type, label, className = '' }: DevBadgeProps) {
    const { isDevMode, registerElement } = useDevMode();
    const idRef = useRef<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Generate ID only once per component instance
    useEffect(() => {
        if (idRef.current === null) {
            idRef.current = registerElement(type, label);
        }
        setMounted(true);
    }, [type, label, registerElement]);

    // Don't show badge if dev mode is off or not yet mounted
    if (!isDevMode || !mounted) {
        return <>{children}</>;
    }

    const colors = TYPE_COLORS[type] || TYPE_COLORS.section;
    const prefix = TYPE_PREFIXES[type] || type.toUpperCase().slice(0, 3);
    const displayId = idRef.current || `${prefix}-???`;

    return (
        <div className={`relative inline-block ${className}`} style={{ position: 'relative' }}>
            {children}
            <span
                style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: '9px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    lineHeight: '1.2',
                }}
                title={`Element ID: ${displayId}\nType: ${type}${label ? `\nLabel: ${label}` : ''}`}
            >
                [{displayId}]
            </span>
        </div>
    );
}

// ============================================================================
// CONVENIENCE WRAPPER COMPONENTS
// Pre-configured DevBadge for common element types
// ============================================================================

export function DevButton({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="button" label={label} className={className}>{children}</DevBadge>;
}

export function DevTable({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="table" label={label} className={className}>{children}</DevBadge>;
}

export function DevFilter({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="filter" label={label} className={className}>{children}</DevBadge>;
}

export function DevCard({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="card" label={label} className={className}>{children}</DevBadge>;
}

export function DevInput({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="input" label={label} className={className}>{children}</DevBadge>;
}

export function DevModal({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="modal" label={label} className={className}>{children}</DevBadge>;
}

export function DevSection({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="section" label={label} className={className}>{children}</DevBadge>;
}

export function DevDropdown({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="dropdown" label={label} className={className}>{children}</DevBadge>;
}

export function DevPanel({ children, label, className }: Omit<DevBadgeProps, 'type'>) {
    return <DevBadge type="panel" label={label} className={className}>{children}</DevBadge>;
}
