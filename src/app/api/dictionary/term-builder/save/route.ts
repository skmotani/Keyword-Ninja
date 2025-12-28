import { NextRequest, NextResponse } from 'next/server';
import { saveClientDictionaryToProfile, saveGlobalDictionary, getGlobalDictionary } from '@/lib/dictionaries/termDictionaryStore';
import { TermEntry, ClientTermDictionary, GlobalIndustryDictionary, GlobalIndustryTerm } from '@/types/termDictionary';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            clientCode,
            domain,
            industryKey,
            saveToClient,
            saveToGlobal,
            terms
        } = body;

        const termList = terms as TermEntry[];

        if (!clientCode || !termList) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Prepare Client Dictionary
        if (saveToClient) {
            const clientDict: ClientTermDictionary = {
                version: 1,
                updatedAt: new Date().toISOString(),
                domain: domain || '',
                industryKey: industryKey || '',
                terms: termList.filter(t => t.bucket && t.bucket !== 'review').map(t => ({
                    ...t,
                    // Minimal storage: maybe strip history?
                    // We keep it for now.
                }))
            };

            await saveClientDictionaryToProfile(clientCode, clientDict);
        }

        // 2. Update Global Dictionary
        if (saveToGlobal && industryKey) {
            let globalDict = await getGlobalDictionary(industryKey);
            if (!globalDict) {
                globalDict = {
                    industryKey,
                    version: 1,
                    updatedAt: new Date().toISOString(),
                    terms: []
                };
            }

            const now = new Date().toISOString();

            // Merge logic
            termList.forEach(userTerm => {
                // Save to Global only: user-confirmed terms OR confidence >= 0.90
                // "User confirmed" -> source === 'user'
                const shouldSave = userTerm.source === 'user' || (userTerm.confidence >= 0.90 && userTerm.bucket === 'brand');

                if (shouldSave && userTerm.bucket && userTerm.bucket !== 'review') {
                    const existingIndex = globalDict!.terms.findIndex(g => g.term === userTerm.term && g.ngramType === userTerm.ngramType);

                    if (existingIndex >= 0) {
                        const existing = globalDict!.terms[existingIndex];
                        // Update support logic?
                        // Simply increment support if distinct? (Too complex for now)
                        // Just update last seen
                        globalDict!.terms[existingIndex] = {
                            ...existing,
                            bucket: userTerm.bucket, // Latest write wins? Or vote? adhering to "Single Source of Truth" -> last write.
                            lastSeenAt: now,
                            supportCount: existing.supportCount + 1
                        };
                    } else {
                        globalDict!.terms.push({
                            term: userTerm.term,
                            ngramType: userTerm.ngramType,
                            bucket: userTerm.bucket,
                            supportCount: 1,
                            globalConfidence: userTerm.confidence,
                            lastSeenAt: now
                        });
                    }
                }
            });

            globalDict.updatedAt = now;
            await saveGlobalDictionary(globalDict);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error in Term Builder Save:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
