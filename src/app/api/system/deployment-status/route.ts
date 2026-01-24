import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

// This endpoint returns the current deployment info
// The client can compare this with the local git commit to know if a build is pending
export async function GET() {
    try {
        // Get git commit info embedded at build time (Railway/Vercel set these)
        let buildCommit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
        let buildBranch = process.env.RAILWAY_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || '';
        
        // For local development, try to get git info from git command
        if (!buildCommit) {
            try {
                buildCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
            } catch {
                buildCommit = 'dev';
            }
        }
        if (!buildBranch) {
            try {
                buildBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
            } catch {
                buildBranch = 'local';
            }
        }
        
        const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || 'local';
        const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:5000';
        
        // Determine environment
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT_ID;
        
        return NextResponse.json({
            success: true,
            deployment: {
                appName: 'Keyword Ninja',
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
