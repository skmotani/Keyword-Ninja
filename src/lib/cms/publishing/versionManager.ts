// CMS Publishing - Version Management

export interface PageVersion {
    id: string;
    pageId: string;
    version: number;
    title: string;
    content: Record<string, unknown>;
    changeNote?: string;
    createdAt: Date;
    createdById?: string;
    createdByName?: string;
}

export interface VersionDiff {
    field: string;
    oldValue: string;
    newValue: string;
    type: 'added' | 'removed' | 'modified';
}

// Compare two versions and return differences
export function compareVersions(
    oldVersion: PageVersion,
    newVersion: PageVersion
): VersionDiff[] {
    const diffs: VersionDiff[] = [];

    // Compare title
    if (oldVersion.title !== newVersion.title) {
        diffs.push({
            field: 'title',
            oldValue: oldVersion.title,
            newValue: newVersion.title,
            type: 'modified',
        });
    }

    // Compare content sections
    const oldContent = oldVersion.content as Record<string, unknown>;
    const newContent = newVersion.content as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(oldContent), ...Object.keys(newContent)]);

    allKeys.forEach((key) => {
        const oldVal = JSON.stringify(oldContent[key] || '');
        const newVal = JSON.stringify(newContent[key] || '');

        if (oldVal !== newVal) {
            if (!oldContent[key]) {
                diffs.push({
                    field: key,
                    oldValue: '',
                    newValue: truncateValue(newVal),
                    type: 'added',
                });
            } else if (!newContent[key]) {
                diffs.push({
                    field: key,
                    oldValue: truncateValue(oldVal),
                    newValue: '',
                    type: 'removed',
                });
            } else {
                diffs.push({
                    field: key,
                    oldValue: truncateValue(oldVal),
                    newValue: truncateValue(newVal),
                    type: 'modified',
                });
            }
        }
    });

    return diffs;
}

// Truncate long values for display
function truncateValue(value: string, maxLength: number = 100): string {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength) + '...';
}

// Format version number for display
export function formatVersionNumber(version: number): string {
    return `v${version}`;
}

// Generate version summary
export function generateVersionSummary(
    version: PageVersion,
    previousVersion?: PageVersion
): string {
    if (!previousVersion) {
        return 'Initial version';
    }

    const diffs = compareVersions(previousVersion, version);

    if (diffs.length === 0) {
        return 'No changes';
    }

    if (diffs.length === 1) {
        return `Updated ${diffs[0].field}`;
    }

    return `Updated ${diffs.length} fields: ${diffs.map(d => d.field).join(', ')}`;
}

// Check if content has changed since last version
export function hasChanges(
    currentContent: Record<string, unknown>,
    lastVersion?: PageVersion
): boolean {
    if (!lastVersion) return true;

    return JSON.stringify(currentContent) !== JSON.stringify(lastVersion.content);
}
