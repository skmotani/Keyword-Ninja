'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useDevMode } from '@/contexts/DevModeContext';

// ============================================================================
// AUTO DEV OVERLAY
// Automatically scans the DOM and adds ID badges to interactive elements
// No manual wrapping required - works site-wide
// ============================================================================

interface OverlayBadge {
    id: string;
    type: string;
    rect: DOMRect;
    element: Element;
    label: string;
}

// Element type detection and styling
const ELEMENT_CONFIG: Record<string, { prefix: string; color: string; bg: string }> = {
    button: { prefix: 'BTN', color: '#ffffff', bg: 'rgba(59, 130, 246, 0.95)' },
    submit: { prefix: 'BTN', color: '#ffffff', bg: 'rgba(59, 130, 246, 0.95)' },
    table: { prefix: 'TBL', color: '#ffffff', bg: 'rgba(34, 197, 94, 0.95)' },
    select: { prefix: 'FLT', color: '#ffffff', bg: 'rgba(249, 115, 22, 0.95)' },
    input: { prefix: 'INP', color: '#ffffff', bg: 'rgba(20, 184, 166, 0.95)' },
    textarea: { prefix: 'TXT', color: '#ffffff', bg: 'rgba(20, 184, 166, 0.95)' },
    link: { prefix: 'LNK', color: '#ffffff', bg: 'rgba(99, 102, 241, 0.95)' },
    card: { prefix: 'CRD', color: '#ffffff', bg: 'rgba(168, 85, 247, 0.95)' },
    dropdown: { prefix: 'DRP', color: '#ffffff', bg: 'rgba(236, 72, 153, 0.95)' },
    section: { prefix: 'SEC', color: '#ffffff', bg: 'rgba(107, 114, 128, 0.95)' },
    panel: { prefix: 'PNL', color: '#ffffff', bg: 'rgba(245, 158, 11, 0.95)' },
    modal: { prefix: 'MDL', color: '#ffffff', bg: 'rgba(239, 68, 68, 0.95)' },
    header: { prefix: 'HDR', color: '#ffffff', bg: 'rgba(75, 85, 99, 0.95)' },
};

function getElementType(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type')?.toLowerCase() || '';
    const role = el.getAttribute('role')?.toLowerCase() || '';
    const className = el.className?.toString?.() || '';

    // Buttons
    if (tag === 'button' || type === 'submit' || type === 'button' || role === 'button') {
        return 'button';
    }

    // Tables
    if (tag === 'table') return 'table';

    // Selects/Dropdowns
    if (tag === 'select' || role === 'listbox' || role === 'combobox') return 'select';

    // Inputs
    if (tag === 'input' && type !== 'hidden' && type !== 'submit' && type !== 'button') {
        return 'input';
    }
    if (tag === 'textarea') return 'textarea';

    // Links (only navigation links, not all anchors)
    if (tag === 'a' && el.getAttribute('href') && !el.getAttribute('href')?.startsWith('#')) {
        return 'link';
    }

    // Cards (common patterns)
    if (className.includes('card') || className.includes('panel') || role === 'article') {
        return 'card';
    }

    // Sections
    if (tag === 'section' || role === 'region') return 'section';

    // Headers
    if (tag === 'header' || role === 'banner') return 'header';

    return '';
}

function shouldIncludeElement(el: Element): boolean {
    // Skip hidden elements
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }

    // Skip elements in the navbar (avoid cluttering)
    if (el.closest('nav')) return false;

    // Skip very small elements
    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 15) return false;

    // Skip elements outside viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;

    return true;
}

export function AutoDevOverlay() {
    const { isDevMode } = useDevMode();
    const pathname = usePathname();
    const [badges, setBadges] = useState<OverlayBadge[]>([]);
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const scanDOM = useCallback(() => {
        if (!isDevMode) {
            setBadges([]);
            return;
        }

        const counters: Record<string, number> = {};
        const newBadges: OverlayBadge[] = [];

        // Selectors for interactive elements
        const selectors = [
            'button',
            'input:not([type="hidden"])',
            'select',
            'textarea',
            'table',
            'a[href]',
            '[role="button"]',
            '[role="listbox"]',
            '[role="combobox"]',
            '.bg-white.rounded-lg.shadow', // Common card pattern
            'section',
            '[role="region"]',
        ];

        const elements = document.querySelectorAll(selectors.join(', '));

        elements.forEach((el) => {
            const type = getElementType(el);
            if (!type || !shouldIncludeElement(el)) return;

            const config = ELEMENT_CONFIG[type];
            if (!config) return;

            // Generate ID
            if (!counters[config.prefix]) counters[config.prefix] = 0;
            counters[config.prefix]++;
            const id = `${config.prefix}-${String(counters[config.prefix]).padStart(3, '0')}`;

            // Get label from element
            let label = '';
            if (el.textContent) {
                label = el.textContent.slice(0, 20).trim();
                if (el.textContent.length > 20) label += '...';
            }

            const rect = el.getBoundingClientRect();

            newBadges.push({
                id,
                type,
                rect,
                element: el,
                label,
            });
        });

        setBadges(newBadges);
    }, [isDevMode]);

    // Scan on mount, route change, and dev mode toggle
    useEffect(() => {
        scanDOM();
    }, [pathname, isDevMode, scanDOM, updateTrigger]);

    // Re-scan periodically to catch dynamically loaded content
    useEffect(() => {
        if (!isDevMode) return;

        const interval = setInterval(() => {
            setUpdateTrigger(t => t + 1);
        }, 2000);

        return () => clearInterval(interval);
    }, [isDevMode]);

    // Re-scan on scroll (positions change)
    useEffect(() => {
        if (!isDevMode) return;

        const handleScroll = () => {
            setUpdateTrigger(t => t + 1);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isDevMode]);

    if (!isDevMode || badges.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9998,
            }}
        >
            {badges.map((badge, idx) => {
                const config = ELEMENT_CONFIG[badge.type];
                return (
                    <div
                        key={`${badge.id}-${idx}`}
                        style={{
                            position: 'fixed',
                            top: badge.rect.top - 8,
                            left: badge.rect.right - 50,
                            backgroundColor: config.bg,
                            color: config.color,
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'ui-monospace, monospace',
                            padding: '2px 5px',
                            borderRadius: '3px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                            whiteSpace: 'nowrap',
                            zIndex: 9999,
                            pointerEvents: 'none',
                        }}
                        title={`ID: ${badge.id}\nType: ${badge.type}\nText: ${badge.label}`}
                    >
                        {badge.id}
                    </div>
                );
            })}

            {/* Legend */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    zIndex: 9999,
                    pointerEvents: 'auto',
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🛠️ Dev Mode Active</div>
                <div style={{ opacity: 0.8 }}>{badges.length} elements detected</div>
                <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>
                    BTN=Button TBL=Table FLT=Filter INP=Input LNK=Link
                </div>
            </div>
        </div>
    );
}
