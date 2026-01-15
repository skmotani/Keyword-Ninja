import { NextRequest, NextResponse } from 'next/server';
import { getUsageSummary, API_PRICING } from '@/lib/dataforseo/core/usage-tracker';
import { checkBalance } from '@/lib/dataforseo/core/balance';

export async function GET(request: NextRequest) {
    try {
        const [summary, balanceInfo] = await Promise.all([
            getUsageSummary(),
            checkBalance().catch(() => ({ balance: null })),
        ]);
        return NextResponse.json({
            success: true,
            balance: balanceInfo.balance,
            domainsAffordable: balanceInfo.balance ? Math.floor(balanceInfo.balance / API_PRICING.fullDomain) : null,
            totals: { allTimeCost: summary.allTimeCost, allTimeCalls: summary.allTimeCalls, byClient: summary.byClient },
            recentLogs: summary.recentLogs,
            pricing: API_PRICING,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
