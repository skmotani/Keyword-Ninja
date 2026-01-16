// CMS Publishing - Scheduler Utilities

export interface ScheduleInfo {
    scheduledAt: Date;
    timezone: string;
    isValid: boolean;
    isFuture: boolean;
    formattedDate: string;
    formattedTime: string;
    relativeTime: string;
}

// Parse and validate scheduled date
export function parseScheduleDate(
    dateString: string,
    timezone: string = 'UTC'
): ScheduleInfo {
    const date = new Date(dateString);
    const now = new Date();
    const isFuture = date > now;
    const isValid = !isNaN(date.getTime()) && isFuture;

    return {
        scheduledAt: date,
        timezone,
        isValid,
        isFuture,
        formattedDate: formatDate(date),
        formattedTime: formatTime(date),
        relativeTime: getRelativeTime(date),
    };
}

// Format date for display
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// Format time for display
export function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

// Get relative time string
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
        return 'Past due';
    }

    if (diffMins < 1) {
        return 'In less than a minute';
    }

    if (diffMins < 60) {
        return `In ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
    }

    if (diffHours < 24) {
        return `In ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }

    if (diffDays < 7) {
        return `In ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    }

    return formatDate(date);
}

// Check if page should be published based on schedule
export function shouldPublish(scheduledAt: Date | string): boolean {
    const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
    return new Date() >= date;
}

// Get suggested publish times (on the hour, half hour)
export function getSuggestedTimes(): { value: string; label: string }[] {
    const times = [];
    const now = new Date();

    // Start from next hour
    const startHour = now.getHours() + 1;

    for (let i = 0; i < 24; i++) {
        const hour = (startHour + i) % 24;
        const hourStr = hour.toString().padStart(2, '0');

        times.push({
            value: `${hourStr}:00`,
            label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
        });

        times.push({
            value: `${hourStr}:30`,
            label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:30 ${hour >= 12 ? 'PM' : 'AM'}`,
        });
    }

    return times.slice(0, 48); // Next 24 hours
}

// Generate schedule options for quick selection
export function getQuickScheduleOptions(): { value: Date; label: string }[] {
    const now = new Date();

    return [
        {
            value: new Date(now.getTime() + 3600000), // 1 hour
            label: 'In 1 hour',
        },
        {
            value: new Date(now.getTime() + 14400000), // 4 hours
            label: 'In 4 hours',
        },
        {
            value: getNextMorning(),
            label: 'Tomorrow morning (9 AM)',
        },
        {
            value: getNextMonday(),
            label: 'Next Monday (9 AM)',
        },
    ];
}

function getNextMorning(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
}

function getNextMonday(): Date {
    const date = new Date();
    const day = date.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    date.setDate(date.getDate() + daysUntilMonday);
    date.setHours(9, 0, 0, 0);
    return date;
}
