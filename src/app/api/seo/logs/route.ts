import { NextRequest, NextResponse } from 'next/server';
import { getApiLogs, getApiLogContent } from '@/lib/keywordApiStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (filename) {
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
