/**
 * Logic for brand auto-detection based on domain name.
 */
export function generateBrandVariants(domain: string): string[] {
    const cleanDomain = domain.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];

    const token = cleanDomain.split('.')[0]; // e.g. "aalidhra" from "aalidhra.in"

    if (!token || token.length < 3) return [];

    return [
        token,
        `${token} group`,
        `${token} textile`,
        `${token} engineers`,
        `${token} industries`,
        `${token} machine`,
        `${token} tech`,
        `${token} india`,
        `${token} pvt`,
        `${token} ltd`
    ];
}

export function isBrandTerm(term: string, brandVariants: string[]): boolean {
    const normalizedTerm = term.toLowerCase().trim();

    // exact match or strong substring match
    return brandVariants.some(variant => {
        // Variant is contained in term OR term is contained in variant?
        // Usually, we want to know if the term REPRESENTS the brand.
        // If term is "aalidhra machine", and variant is "aalidhra", it's a match.
        // If term is "machine", and variant is "aalidhra machine", NO match.

        return normalizedTerm.includes(variant);
    });
}
