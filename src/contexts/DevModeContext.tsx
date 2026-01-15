'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

// ============================================================================
// DEVELOPER MODE CONTEXT
// Provides global state for Developer Mode (UI element ID overlays)
// ============================================================================

interface DevModeContextType {
    isDevMode: boolean;
    toggle: () => void;
    registerElement: (type: string, label?: string) => string;
    resetCounters: () => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

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

const STORAGE_KEY = 'devMode';

export function DevModeProvider({ children }: { children: React.ReactNode }) {
    const [isDevMode, setIsDevMode] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const countersRef = useRef<Record<string, number>>({});
    const pathname = usePathname();

    // Load state from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'true') {
            setIsDevMode(true);
        }
        setIsHydrated(true);
    }, []);

    // Persist state to localStorage
    useEffect(() => {
        if (isHydrated) {
            localStorage.setItem(STORAGE_KEY, String(isDevMode));
        }
    }, [isDevMode, isHydrated]);

    // Reset counters when route changes
    useEffect(() => {
        countersRef.current = {};
    }, [pathname]);

    const toggle = useCallback(() => {
        setIsDevMode(prev => !prev);
    }, []);

    const resetCounters = useCallback(() => {
        countersRef.current = {};
    }, []);

    const registerElement = useCallback((type: string, label?: string): string => {
        const prefix = TYPE_PREFIXES[type.toLowerCase()] || type.toUpperCase().slice(0, 3);

        if (label) {
            // Named elements get a descriptive ID
            return `${prefix}-${label}`;
        }

        // Auto-numbered elements
        if (!countersRef.current[prefix]) {
            countersRef.current[prefix] = 0;
        }
        countersRef.current[prefix]++;
        const num = String(countersRef.current[prefix]).padStart(3, '0');
        return `${prefix}-${num}`;
    }, []);

    return (
        <DevModeContext.Provider value={{ isDevMode, toggle, registerElement, resetCounters }}>
            {children}
        </DevModeContext.Provider>
    );
}

export function useDevMode() {
    const context = useContext(DevModeContext);
    if (context === undefined) {
        throw new Error('useDevMode must be used within a DevModeProvider');
    }
    return context;
}

// Convenience hook for components that just need an ID
export function useDevId(type: string, label?: string): string | null {
    const { isDevMode, registerElement } = useDevMode();
    const idRef = useRef<string | null>(null);

    // Generate ID only once per component instance
    if (idRef.current === null && isDevMode) {
        idRef.current = registerElement(type, label);
    }

    return isDevMode ? idRef.current : null;
}
