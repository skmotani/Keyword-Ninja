'use client';

import React from 'react';
import { PageStatus, PAGE_STATUSES } from '@/lib/cms/publishing/pageStatus';

interface PageStatusBadgeProps {
    status: PageStatus;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

export default function PageStatusBadge({
    status,
    size = 'md',
    showIcon = true,
}: PageStatusBadgeProps) {
    const info = PAGE_STATUSES[status];

    const sizeClasses = {
        sm: 'text-xs px-1.5 py-0.5',
        md: 'text-sm px-2 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md font-medium ${info.bgColor} ${info.color} ${sizeClasses[size]}`}
        >
            {showIcon && <span>{info.icon}</span>}
            {info.label}
        </span>
    );
}
