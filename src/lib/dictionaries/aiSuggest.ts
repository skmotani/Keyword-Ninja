import { TermEntry } from '@/types/termDictionary';
import { isBrandTerm, generateBrandVariants } from './brandRules';

const AUTO_ASSIGN_THRESHOLD = 0.90;
const WEAK_THRESHOLD = 0.55;

export function applyAiClassification(terms: TermEntry[], domain: string): TermEntry[] {
    const brandVariants = generateBrandVariants(domain);

    return terms.map(t => {
        // If already locked by user, skip
        if (t.locked) return t;

        // 1. Brand Detection (Highest Priority)
        if (isBrandTerm(t.term, brandVariants)) {
            return {
                ...t,
                bucket: 'brand',
                confidence: 0.95, // High confidence for explicit string match
                source: 'ai'
            };
        }

        // 2. Existing AI Suggestions (simulated for now, or preserved if passed in)
        // If the term has no bucket but high confidence, we might auto-assign?
        // The Prompt says: 
        // Brand/Exclude >= 0.90 -> auto-assign
        // Include -> NEVER auto-assign/suggest only
        // < 0.55 -> Default Review

        if (t.bucket === 'include') {
            // Force "suggestion only" state if strictly following rules? 
            // Ideally UI handles "suggestion" vs "assignment". 
            // For data structure, we can leave it assigned but confidence reflects it.
            // But prompt says "NEVER auto-assigned", implies it should be unassigned if it wasn't user-set?
            // "AI suggests classifications... User confirmed decisions are saved".
            // So for "Include", we might want to return it as unassigned or a special state?
            // Simplification: We set bucket, but UI renders it as "Suggested" (faded) until confirmed.
            // However, bubble logic says "Bubble color = bucket + confidence".
            // If we leave bucket undefined, it's neutral.

            // For M1: If it's effectively "include", we leave bucket undefined or 'review' if low confidence?
            // Let's stick to: AI logic populates 'bucket' field. UI interprets AI source vs User source.
            // Wait, logic says: "Include: NEVER auto-assigned". 
            // So if AI thinks it's include, we might leave bucket undefined but add a "suggestedBucket" field?
            // The TermEntry type doesn't have suggestedBucket.
            // Let's rely on `source: 'ai'` and `locked: false`.
            // If source is AI and bucket is Include, UI treats it as a suggestion.
            // BUT: "Appear as a chip in the selected bucket tray" -> implies assignment.

            return t;
        }

        if (t.confidence >= AUTO_ASSIGN_THRESHOLD && (t.bucket === 'exclude' || t.bucket === 'brand')) {
            return { ...t, source: 'ai' }; // Keep assignment
        }

        if (t.confidence < WEAK_THRESHOLD) {
            return { ...t, bucket: 'review', source: 'ai', confidence: t.confidence };
        }

        return t;
    });
}
