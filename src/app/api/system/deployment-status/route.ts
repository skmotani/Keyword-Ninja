import { NextResponse } from 'next/server';

// This endpoint returns the current deployment info
// The client can compare this with the local git commit to know if a build is pending
export async function GET() {
    try {
        // Get git commit info embedded at build time
        const buildCommit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
        const buildBranch = process.env.RAILWAY_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
        const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || 'local';
        const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || '';
        
        // Determine environment
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT_ID;
        const isLocal = !isRailway;
        
        return NextResponse.json({
            success: true,
            deployment: {
                commit: buildCommit.substring(0, 7),
                commitFull: buildCommit,
                branch: buildBranch,
                environment: isRailway ? 'railway' : 'local',
                environmentId,
                publicDomain,
                timestamp: new Date().toISOString(),
            }
        });
    } catch (error) {
        console.error('Failed to get deployment status:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get deployment status' },
            { status: 500 }
        );
    }
}
