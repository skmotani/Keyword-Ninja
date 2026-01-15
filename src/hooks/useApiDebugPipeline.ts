import { useState, useCallback, useRef } from 'react';

export type ApiStepStatus = 'idle' | 'running' | 'success' | 'error';

export interface ApiDebugStep {
    id: string;
    label: string;
    status: ApiStepStatus;
    summary?: string;
    details?: any;
    startedAt?: number;
    finishedAt?: number;
}

export interface ApiRequestDetails {
    url: string;
    method: string;
    requestHeadersPreview?: any;
    requestBodyPreview?: string;
    httpStatus?: number;
    statusText?: string;
    responseBodyPreview?: string;
    errorCategory?: 'ROUTE_NOT_FOUND' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
    [key: string]: any; // Allow other props
}

export interface UseApiDebugPipelineReturn {
    steps: ApiDebugStep[];
    setInitialSteps: (steps: { id: string; label: string }[]) => void;
    startStep: (id: string, label?: string) => void;
    finishStepSuccess: (id: string, summary?: string, details?: any) => void;
    finishStepError: (id: string, summary: string, details?: any) => void;
    resetPipeline: () => void;
    correlationId: string;
}

export function useApiDebugPipeline(): UseApiDebugPipelineReturn {
    const [steps, setSteps] = useState<ApiDebugStep[]>([]);
    const [correlationId, setCorrelationId] = useState<string>('');

    // Initialize/Reset
    const setInitialSteps = useCallback((stepDefinitions: { id: string; label: string }[]) => {
        setSteps(stepDefinitions.map(s => ({
            id: s.id,
            label: s.label,
            status: 'idle'
        })));
        setCorrelationId(Date.now().toString(36) + Math.random().toString(36).substr(2));
    }, []);

    const resetPipeline = useCallback(() => {
        setSteps(prev => prev.map(s => ({ ...s, status: 'idle', summary: undefined, details: undefined, startedAt: undefined, finishedAt: undefined })));
        setCorrelationId(Date.now().toString(36) + Math.random().toString(36).substr(2));
    }, []);

    // Actions
    const startStep = useCallback((id: string, label?: string) => {
        const now = Date.now();
        setSteps(prev => prev.map(s => {
            if (s.id === id) {
                // Console Log Standard
                console.groupCollapsed(`[API_PIPELINE] ${id} RUNNING`);
                console.log('Started At:', new Date(now).toISOString());
                console.groupEnd();

                return {
                    ...s,
                    status: 'running',
                    startedAt: now,
                    label: label || s.label,
                    finishedAt: undefined,
                    summary: undefined,
                    details: undefined
                };
            }
            return s;
        }));
    }, []);

    const finishStepSuccess = useCallback((id: string, summary?: string, details?: any) => {
        const now = Date.now();
        setSteps(prev => prev.map(s => {
            if (s.id === id) {
                console.groupCollapsed(`[API_PIPELINE] ${id} SUCCESS`);
                console.log('Summary:', summary);
                if (details) console.log('Details:', details);
                console.groupEnd();

                return {
                    ...s,
                    status: 'success',
                    finishedAt: now,
                    summary,
                    details
                };
            }
            return s;
        }));
    }, []);

    const finishStepError = useCallback((id: string, summary: string, details?: any) => {
        const now = Date.now();
        setSteps(prev => prev.map(s => {
            if (s.id === id) {
                console.groupCollapsed(`[API_PIPELINE] ${id} ERROR`);
                console.error('Summary:', summary);
                if (details) console.error('Details:', details);
                console.groupEnd();

                return {
                    ...s,
                    status: 'error',
                    finishedAt: now,
                    summary,
                    details
                };
            }
            return s;
        }));
    }, []);

    return {
        steps,
        setInitialSteps,
        startStep,
        finishStepSuccess,
        finishStepError,
        resetPipeline,
        correlationId
    };
}
