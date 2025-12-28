import path from 'path';
import { readJsonFile, writeJsonFile } from '@/lib/storage/jsonStore';
import { ClientTermDictionary, GlobalIndustryDictionary, TermEntry } from '@/types/termDictionary';
import { getClient } from '@/lib/db'; // Existing to get client profile path? 
// Actually we store client dictionary IN client profile JSON per prompt:
// "Store under Client Profile JSON: clientProfile.ai_kw_builder_term_dictionary"

// However, getClient in db.ts returns basic type. We might need to extend it or read raw.
// Or we treat the dictionary as a separate file for safety/cleanliness? 
// Prompt says: "Store under Client Profile JSON: clientProfile.ai_kw_builder_term_dictionary"
// This implies modifying the massive client profile. 
// For safety in this "Antigravity" context, I will assume we can write to `data/clients.json` or similar?
// But `data/clients.json` is a list of ALL clients. That's risky to rewriting the whole DB for one field.
// Better: Check if `clients.json` is the only store.
// `src/lib/db.ts` has `getClients` reading `clients.json`.
// Yes.
// To avoid concurrency issues on the big `clients.json`, 
// I will implement a localized update for the specific client in the array.

const DATA_DIR = path.join(process.cwd(), 'data');
const GLOBAL_DICT_DIR = path.join(DATA_DIR, 'global_industry_dictionaries');

// --- Global Dictionary ---

export async function getGlobalDictionary(industryKey: string): Promise<GlobalIndustryDictionary | null> {
    if (!industryKey) return null;
    const filePath = path.join(GLOBAL_DICT_DIR, `${industryKey}.json`);
    return readJsonFile<GlobalIndustryDictionary>(filePath);
}

export async function saveGlobalDictionary(dictionary: GlobalIndustryDictionary): Promise<boolean> {
    const filePath = path.join(GLOBAL_DICT_DIR, `${dictionary.industryKey}.json`);
    return writeJsonFile(filePath, dictionary);
}

// --- Client Dictionary ---

import { getAiProfileByClientCode, saveAiProfile } from '@/lib/clientAiProfileStore';
import { ClientAIProfile } from '@/types';

export async function saveClientDictionaryToProfile(clientCode: string, dictionary: ClientTermDictionary): Promise<boolean> {
    try {
        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) {
            console.error('Client Profile not found for dictionary save:', clientCode);
            // Optional: Create profile if missing?
            // For now, assume profile exists.
            return false;
        }

        const updatedProfile: ClientAIProfile = {
            ...profile,
            ai_kw_builder_term_dictionary: dictionary,
            updatedAt: new Date().toISOString()
        };

        await saveAiProfile(updatedProfile);
        return true;
    } catch (e) {
        console.error('Failed to save client dictionary to profile:', e);
        return false;
    }
}

export async function getClientDictionaryFromProfile(clientCode: string): Promise<ClientTermDictionary | null> {
    try {
        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) return null;
        return profile.ai_kw_builder_term_dictionary || null;
    } catch (e) {
        return null;
    }
}
