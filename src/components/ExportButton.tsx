'use client';

import React, { useState } from 'react';

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  getValue?: (row: T) => string | number | boolean | null | undefined;
}

interface ExportButtonProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  disabled?: boolean;
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const headerRow = columns.map(col => escapeCSVValue(col.header)).join(',');
  
  const dataRows = data.map(row => {
    return columns.map(col => {
      let value: unknown;
      if (col.getValue) {
        value = col.getValue(row);
      } else if (typeof col.key === 'string' && col.key in (row as object)) {
        value = (row as Record<string, unknown>)[col.key];
      } else {
        value = '';
      }
      return escapeCSVValue(value);
    }).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ExportButton<T>({
  data,
  columns,
  filename,
  disabled = false,
}: ExportButtonProps<T>) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (data.length === 0) return;
    
    setExporting(true);
    try {
      exportToCSV(data, columns, filename);
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || data.length === 0 || exporting}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
        ${disabled || data.length === 0
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      title={data.length === 0 ? 'No data to export' : `Export ${data.length} rows to CSV`}
    >
      {exporting ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV ({data.length})
        </>
      )}
    </button>
  );
}
