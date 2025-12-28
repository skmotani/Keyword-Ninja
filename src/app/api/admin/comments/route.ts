import { NextRequest, NextResponse } from 'next/server';
import { getPageConfigs, savePageConfig, PageComment } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const configs = await getPageConfigs();
        const allComments: (PageComment & { pagePath: string })[] = [];

        configs.forEach(page => {
            if (page.comments) {
                page.comments.forEach(comment => {
                    allComments.push({
                        ...comment,
                        pagePath: page.path
                    });
                });
            }
        });

        // Sort by createdAt desc
        allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(allComments);
    } catch (error) {
        console.error('Failed to fetch admin comments:', error);
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { pagePath, commentId, status } = await request.json();

        if (!pagePath || !commentId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const configs = await getPageConfigs();
        const pageConfig = configs.find(c => c.path === pagePath);

        if (!pageConfig || !pageConfig.comments) {
            return NextResponse.json({ error: 'Page or comments not found' }, { status: 404 });
        }

        const commentIndex = pageConfig.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        // Update status
        pageConfig.comments[commentIndex].status = status;
        pageConfig.comments[commentIndex].updatedAt = new Date().toISOString();

        await savePageConfig(pageConfig);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Failed to update comment status:', error);
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
}
