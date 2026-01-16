'use client';

import React, { useState } from 'react';
import { PageStatus, PAGE_STATUSES, getAvailableActions } from '@/lib/cms/publishing/pageStatus';
import { getQuickScheduleOptions, formatDate, formatTime } from '@/lib/cms/publishing/scheduler';

interface PublishControlsProps {
    pageId: string;
    currentStatus: PageStatus;
    scheduledAt?: Date | null;
    onStatusChange: (newStatus: PageStatus, scheduledAt?: Date) => Promise<void>;
    onSave: () => Promise<void>;
    isSaving?: boolean;
    hasChanges?: boolean;
}

export default function PublishControls({
    pageId,
    currentStatus,
    scheduledAt,
    onStatusChange,
    onSave,
    isSaving = false,
    hasChanges = false,
}: PublishControlsProps) {
    const [isChanging, setIsChanging] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('09:00');

    const statusInfo = PAGE_STATUSES[currentStatus];
    const actions = getAvailableActions(currentStatus);
    const quickSchedules = getQuickScheduleOptions();

    async function handleAction(targetStatus: PageStatus, scheduled?: Date) {
        setIsChanging(true);
        try {
            await onStatusChange(targetStatus, scheduled);
        } finally {
            setIsChanging(false);
            setShowScheduler(false);
        }
    }

    async function handleScheduleSubmit() {
        if (!scheduleDate) return;

        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        await handleAction('scheduled', scheduledDateTime);
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
            {/* Current Status */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md ${statusInfo.bgColor}`}>
                    <span>{statusInfo.icon}</span>
                    <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                {scheduledAt && currentStatus === 'scheduled' && (
                    <p className="text-xs text-gray-500 mt-1">
                        Scheduled for: {formatDate(new Date(scheduledAt))} at {formatTime(new Date(scheduledAt))}
                    </p>
                )}
            </div>

            {/* Save Button */}
            {hasChanges && (
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            Saving...
                        </>
                    ) : (
                        <>
                            💾 Save Changes
                        </>
                    )}
                </button>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
                {actions.map((action) => {
                    // Handle schedule action specially
                    if (action.action === 'schedule') {
                        return (
                            <div key={action.action}>
                                <button
                                    onClick={() => setShowScheduler(!showScheduler)}
                                    disabled={isChanging}
                                    className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                    📅 Schedule Publishing
                                </button>

                                {showScheduler && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-md space-y-3">
                                        {/* Quick Options */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {quickSchedules.map((option, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAction('scheduled', option.value)}
                                                    className="py-2 px-3 text-xs bg-white border rounded hover:bg-gray-50 transition-colors"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="text-xs text-center text-gray-500">or set custom time</div>

                                        {/* Custom Date/Time */}
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={scheduleDate}
                                                onChange={(e) => setScheduleDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="flex-1 px-2 py-1 text-sm border rounded"
                                            />
                                            <input
                                                type="time"
                                                value={scheduleTime}
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="w-24 px-2 py-1 text-sm border rounded"
                                            />
                                        </div>

                                        <button
                                            onClick={handleScheduleSubmit}
                                            disabled={!scheduleDate || isChanging}
                                            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            Confirm Schedule
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const buttonClasses = {
                        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
                        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
                    };

                    return (
                        <button
                            key={action.action}
                            onClick={() => handleAction(action.targetStatus)}
                            disabled={isChanging}
                            className={`w-full py-2 rounded-md transition-colors disabled:opacity-50 ${buttonClasses[action.variant]}`}
                        >
                            {action.label}
                        </button>
                    );
                })}
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500">{statusInfo.description}</p>
        </div>
    );
}
