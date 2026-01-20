
import { getCredibilityByClient, getCredibilityByClientAndLocation } from '../lib/storage/domainCredibilityStore';

async function main() {
    console.log('--- Debugging Credibility Store ---');
    try {
        const clientCode = '01';

        console.log(`Fetching by Client: ${clientCode}`);
        const byClient = await getCredibilityByClient(clientCode);
        console.log(`Count (byClient): ${byClient.length}`);
        if (byClient.length > 0) {
            console.log('First Record (byClient):', JSON.stringify(byClient[0], null, 2));
        }

        console.log(`Fetching by Client: ${clientCode} + Location: IN`);
        const byClientLoc = await getCredibilityByClientAndLocation(clientCode, 'IN');
        console.log(`Count (byClientLoc): ${byClientLoc.length}`);
        if (byClientLoc.length > 0) {
            console.log('First Record (byClientLoc):', JSON.stringify(byClientLoc[0], null, 2));
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
