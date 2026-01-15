/**
 * DataForSEO Balance Checker
 * Checks current account balance
 */

import { getDataForSEOClient } from './client';

export interface BalanceInfo {
    balance: number;
    currency: string;
}

export async function checkBalance(): Promise<BalanceInfo> {
    const client = getDataForSEOClient();
    try {
        const response = await client.request<any>('appendix/user_data', {});
        const userData = response.tasks?.[0]?.result?.[0];

        if (userData && typeof userData.money === 'number') {
            return {
                balance: userData.money,
                currency: 'USD' // Assuming USD as default
            };
        }
        throw new Error('Invalid response format');
    } catch (error) {
        console.error('[Balance] Failed to check balance:', error);
        throw error;
    }
}
