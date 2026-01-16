// CMS Publishing - Page Status Types and Utilities

export type PageStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';

export interface PageStatusInfo {
    status: PageStatus;
    label: string;
    color: string;
    bgColor: string;
    icon: string;
    description: string;
}

export const PAGE_STATUSES: Record<PageStatus, PageStatusInfo> = {
    draft: {
        status: 'draft',
        label: 'Draft',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: '📝',
        description: 'Work in progress, not visible to public',
    },
    review: {
        status: 'review',
        label: 'In Review',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        icon: '👁️',
        description: 'Waiting for approval before publishing',
    },
    scheduled: {
        status: 'scheduled',
        label: 'Scheduled',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        icon: '📅',
        description: 'Will be published at scheduled time',
    },
    published: {
        status: 'published',
        label: 'Published',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: '✅',
        description: 'Live and visible to public',
    },
    archived: {
        status: 'archived',
        label: 'Archived',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        icon: '📦',
        description: 'Removed from public view',
    },
};

// Valid status transitions
export const STATUS_TRANSITIONS: Record<PageStatus, PageStatus[]> = {
    draft: ['review', 'published', 'archived'],
    review: ['draft', 'published', 'scheduled', 'archived'],
    scheduled: ['draft', 'review', 'published', 'archived'],
    published: ['draft', 'archived'],
    archived: ['draft'],
};

// Check if a status transition is valid
export function canTransitionTo(from: PageStatus, to: PageStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Get available actions for a page based on its status
export function getAvailableActions(status: PageStatus): {
    action: string;
    targetStatus: PageStatus;
    label: string;
    variant: 'primary' | 'secondary' | 'danger';
}[] {
    const actions: ReturnType<typeof getAvailableActions> = [];

    switch (status) {
        case 'draft':
            actions.push(
                { action: 'submit_review', targetStatus: 'review', label: 'Submit for Review', variant: 'primary' },
                { action: 'publish', targetStatus: 'published', label: 'Publish Now', variant: 'secondary' },
            );
            break;
        case 'review':
            actions.push(
                { action: 'approve', targetStatus: 'published', label: 'Approve & Publish', variant: 'primary' },
                { action: 'schedule', targetStatus: 'scheduled', label: 'Schedule', variant: 'secondary' },
                { action: 'reject', targetStatus: 'draft', label: 'Send Back to Draft', variant: 'danger' },
            );
            break;
        case 'scheduled':
            actions.push(
                { action: 'publish_now', targetStatus: 'published', label: 'Publish Now', variant: 'primary' },
                { action: 'cancel_schedule', targetStatus: 'draft', label: 'Cancel Schedule', variant: 'danger' },
            );
            break;
        case 'published':
            actions.push(
                { action: 'unpublish', targetStatus: 'draft', label: 'Unpublish', variant: 'secondary' },
                { action: 'archive', targetStatus: 'archived', label: 'Archive', variant: 'danger' },
            );
            break;
        case 'archived':
            actions.push(
                { action: 'restore', targetStatus: 'draft', label: 'Restore to Draft', variant: 'primary' },
            );
            break;
    }

    return actions;
}

// Calculate workflow stats
export function calculateWorkflowStats(pages: Array<{ status: PageStatus }>): {
    total: number;
    byStatus: Record<PageStatus, number>;
    pendingReview: number;
    published: number;
} {
    const byStatus: Record<PageStatus, number> = {
        draft: 0,
        review: 0,
        scheduled: 0,
        published: 0,
        archived: 0,
    };

    pages.forEach((page) => {
        byStatus[page.status]++;
    });

    return {
        total: pages.length,
        byStatus,
        pendingReview: byStatus.review,
        published: byStatus.published,
    };
}
