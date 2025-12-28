import { readJsonFile, writeJsonFile } from './jsonStore';
import path from 'path';

export interface DomainCredibilityRecord {
    clientCode: string;
    domain: string;
    name?: string;
    type: 'client' | 'competitor' | 'other';

    // Computed / Extracted
    domainAgeYears?: number;
    createdDate?: string;
    referringDomains?: number;
    totalBacklinks?: number;
    dofollowBacklinks?: number;
    nofollowBacklinks?: number;
    paidKeywords?: number;

    // Raw Data Snippets (for debugging/detailed view)
    whoisJson?: any;
    backlinksSummaryJson?: any;
    adsKeywordsJson?: any;

    lastPulledAt: string;
}

const STORE_FILE = path.join(process.cwd(), 'data', 'domain_credibility.json');

export async function getAllCredibilityRecords(): Promise<DomainCredibilityRecord[]> {
    const data = await readJsonFile<DomainCredibilityRecord[]>(STORE_FILE);
    return data || [];
}

export async function getDomainCredibility(clientCode: string, domain: string): Promise<DomainCredibilityRecord | undefined> {
    const all = await getAllCredibilityRecords();
    return all.find(r =>
        r.clientCode === clientCode &&
        r.domain.toLowerCase() === domain.toLowerCase()
    );
}

export async function saveDomainCredibility(records: DomainCredibilityRecord[]) {
    let all = await getAllCredibilityRecords();

    for (const record of records) {
        // Remove existing if present
        all = all.filter(r =>
            !(r.clientCode === record.clientCode && r.domain.toLowerCase() === record.domain.toLowerCase())
        );
        all.push(record);
    }

    await writeJsonFile(STORE_FILE, all);
}
