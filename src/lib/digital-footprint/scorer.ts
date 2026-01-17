// Scorer - Calculates digital footprint scores

import { SURFACES, SurfaceDefinition, getStatusFactor, getAllSurfaces, Relevance } from './surfaces';
import { BusinessProfile } from './profiler';
import { SurfaceEvidence } from './evidence';

export interface SurfaceScore {
    surfaceKey: string;
    label: string;
    category: string;
    status: string;
    relevance: Relevance;
    weight: number;
    pointsMax: number;
    pointsAwarded: number;
    potentialGain: number;  // Points gained if fixed
}

export interface CategoryScore {
    category: string;
    label: string;
    pointsMax: number;
    pointsAwarded: number;
    percentage: number;
    surfaces: number;
    present: number;
    partial: number;
    absent: number;
}

export interface FootprintScore {
    totalMax: number;
    totalAwarded: number;
    percentage: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    categories: CategoryScore[];
    surfaces: SurfaceScore[];
    topOpportunities: SurfaceScore[];  // Top items to fix
}

// Map weight to relevance
function weightToRelevance(weight: number): Relevance {
    if (weight >= 0.7) return 'high';
    if (weight >= 0.4) return 'medium';
    return 'low';
}

// Calculate grade from percentage
function calculateGrade(percentage: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (percentage >= 90) return 'A';
    if (percentage >= 75) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
}

// Get category display label
function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        owned: 'Website & Owned Assets',
        search: 'Search Engine Presence',
        social: 'Social Media Presence',
        trust: 'Trust & Reviews',
        authority: 'Authority & Mentions',
    };
    return labels[category] || category;
}

// Calculate footprint score from evidence
export function calculateFootprintScore(
    evidence: SurfaceEvidence[],
    profile: BusinessProfile
): FootprintScore {
    const surfaces = getAllSurfaces();
    const surfaceScores: SurfaceScore[] = [];

    // Calculate score for each surface
    for (const surface of surfaces) {
        const ev = evidence.find(e => e.surfaceKey === surface.key);
        const status = ev?.status || 'unknown';
        const weight = profile.surfaceWeights[surface.key] || 0.5;
        const relevance = weightToRelevance(weight);

        const statusFactor = getStatusFactor(status as 'present' | 'partial' | 'absent' | 'unknown');
        const pointsMax = surface.basePoints * weight;
        const pointsAwarded = pointsMax * statusFactor;
        const potentialGain = pointsMax - pointsAwarded;

        surfaceScores.push({
            surfaceKey: surface.key,
            label: surface.label,
            category: surface.category,
            status,
            relevance,
            weight,
            pointsMax,
            pointsAwarded,
            potentialGain,
        });
    }

    // Calculate category totals
    const categories = ['owned', 'search', 'social', 'trust', 'authority'];
    const categoryScores: CategoryScore[] = categories.map(cat => {
        const catSurfaces = surfaceScores.filter(s => s.category === cat);
        const pointsMax = catSurfaces.reduce((sum, s) => sum + s.pointsMax, 0);
        const pointsAwarded = catSurfaces.reduce((sum, s) => sum + s.pointsAwarded, 0);

        return {
            category: cat,
            label: getCategoryLabel(cat),
            pointsMax,
            pointsAwarded,
            percentage: pointsMax > 0 ? Math.round((pointsAwarded / pointsMax) * 100) : 0,
            surfaces: catSurfaces.length,
            present: catSurfaces.filter(s => s.status === 'present').length,
            partial: catSurfaces.filter(s => s.status === 'partial').length,
            absent: catSurfaces.filter(s => s.status === 'absent').length,
        };
    });

    // Calculate totals
    const totalMax = surfaceScores.reduce((sum, s) => sum + s.pointsMax, 0);
    const totalAwarded = surfaceScores.reduce((sum, s) => sum + s.pointsAwarded, 0);
    const percentage = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;

    // Find top opportunities (highest potential gain, sorted by relevance then gain)
    const topOpportunities = surfaceScores
        .filter(s => s.status === 'absent' || s.status === 'partial')
        .sort((a, b) => {
            // Sort by relevance first, then by potential gain
            const relevanceOrder = { high: 0, medium: 1, low: 2 };
            const relDiff = relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
            if (relDiff !== 0) return relDiff;
            return b.potentialGain - a.potentialGain;
        })
        .slice(0, 10);

    return {
        totalMax,
        totalAwarded,
        percentage,
        grade: calculateGrade(percentage),
        categories: categoryScores,
        surfaces: surfaceScores,
        topOpportunities,
    };
}

// Get action recommendations
export function getTopRecommendations(score: FootprintScore, limit: number = 5): string[] {
    return score.topOpportunities.slice(0, limit).map(opp => {
        const surface = SURFACES[opp.surfaceKey];
        if (!surface) return `Fix ${opp.label}`;

        return opp.status === 'absent'
            ? surface.tooltips.actionAbsent
            : `Improve ${opp.label}: Currently partial presence`;
    });
}
