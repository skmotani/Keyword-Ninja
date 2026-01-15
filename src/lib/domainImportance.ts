/**
 * Domain Importance Score Calculator
 * 
 * Computes a weighted importance score for each domain based on:
 * 1. Search volume of keywords where the domain ranks
 * 2. The domain's ranking position (higher ranks = more weight)
 * 3. Frequency of appearance across multiple keywords
 */

export interface SerpRowForScoring {
  domain: string;
  keyword?: string;
  rank?: number;
  searchVolume?: number | null;
}

interface DomainAccumulator {
  baseScore: number;
  appearanceCount: number;
}

/**
 * Computes Domain Importance Scores for all domains in the SERP dataset.
 * 
 * Algorithm:
 * 1. For each SERP row, calculate: baseScore = searchVolume × rankWeight
 *    - rankWeight = 1 / (position + 1) — gives higher weight to top positions
 *    - Position 1 gets weight 0.5, Position 2 gets 0.33, Position 10 gets 0.09
 * 
 * 2. Group by domain and sum base scores, counting appearances
 * 
 * 3. Apply appearance weight multiplier: 1 + (appearanceCount / 10)
 *    - Domains appearing in many keywords get a boost
 *    - 10 appearances = 2x multiplier, 20 appearances = 3x multiplier
 * 
 * 4. Final score = domainBaseScore × appearanceWeight
 * 
 * @param rows - Array of SERP rows with domain, rank, and searchVolume
 * @returns Object mapping domain names to their importance scores
 */
export function computeDomainImportanceScores(
  rows: SerpRowForScoring[]
): Record<string, number> {
  const domainAccumulators: Record<string, DomainAccumulator> = {};

  for (const row of rows) {
    // Skip rows with no valid domain
    if (!row.domain || typeof row.domain !== 'string' || row.domain.trim() === '') {
      continue;
    }

    const domain = row.domain.toLowerCase().trim();

    // Get search volume, defaulting to 0 if missing/invalid
    const searchVolume = 
      typeof row.searchVolume === 'number' && !isNaN(row.searchVolume) && row.searchVolume >= 0
        ? row.searchVolume
        : 0;

    // Calculate rank weight: 1 / (position + 1)
    // Higher positions (lower numbers) get higher weight
    // Position 1 → 1/2 = 0.5, Position 2 → 1/3 = 0.33, Position 10 → 1/11 = 0.09
    let rankWeight = 0;
    if (typeof row.rank === 'number' && !isNaN(row.rank) && row.rank > 0) {
      rankWeight = 1 / (row.rank + 1);
    }

    // Calculate base score for this row
    // searchVolume × rankWeight rewards domains that rank well for high-volume keywords
    const baseScoreForRow = searchVolume * rankWeight;

    // Accumulate for this domain
    if (!domainAccumulators[domain]) {
      domainAccumulators[domain] = { baseScore: 0, appearanceCount: 0 };
    }
    domainAccumulators[domain].baseScore += baseScoreForRow;
    domainAccumulators[domain].appearanceCount += 1;
  }

  // Calculate final scores with appearance weight multiplier
  const result: Record<string, number> = {};

  for (const [domain, acc] of Object.entries(domainAccumulators)) {
    // Appearance weight: domains appearing many times get a boost
    // 1 + (count / 10) means:
    // - 10 appearances = 2x multiplier
    // - 20 appearances = 3x multiplier
    // This rewards domains with broad keyword coverage
    const appearanceWeight = 1 + (acc.appearanceCount / 10);

    // Final importance score
    const domainImportanceScore = acc.baseScore * appearanceWeight;

    // Store as a clean number (avoid NaN/Infinity)
    result[domain] = isFinite(domainImportanceScore) ? domainImportanceScore : 0;
  }

  return result;
}

/**
 * Formats a domain importance score for display.
 * Large numbers are formatted with K/M suffixes.
 */
export function formatImportanceScore(score: number): string {
  if (score === 0) return '0';
  if (score >= 1000000) {
    return (score / 1000000).toFixed(1) + 'M';
  }
  if (score >= 1000) {
    return (score / 1000).toFixed(1) + 'K';
  }
  return score.toFixed(0);
}
