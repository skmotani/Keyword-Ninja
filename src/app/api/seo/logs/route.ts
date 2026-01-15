import { NextRequest, NextResponse } from 'next/server';
import { getApiLogs, getApiLogContent } from '@/lib/keywordApiStore';

function isValidLogFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
  if (!filename.startsWith('dataforseo_') || !filename.endsWith('.json')) return false;
  if (filename.length > 100) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (filename) {
      if (!isValidLogFilename(filename)) {
        return NextResponse.json(
          { error: 'Invalid filename' },
          { status: 400 }
        );
      }

      const content = await getApiLogContent(filename);
      if (!content) {
        return NextResponse.json(
          { error: 'Log file not found' },
          { status: 404 }
        );
      }
      try {
        const parsed = JSON.parse(content);
        return NextResponse.json({
          filename,
          content: parsed,
        });
      } catch {
        return NextResponse.json({
          filename,
          content: content,
        });
      }
    }

    const logs = await getApiLogs();
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching API logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API logs' },
      { status: 500 }
    );
  }
}
