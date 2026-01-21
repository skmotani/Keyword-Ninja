import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { Client, CanonicalEntity, CanonicalEntityStatus, ClientAIProfile } from '@/types';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const AI_PROFILES_FILE = path.join(DATA_DIR, 'client_ai_profiles.json');

function getClients(): Client[] {
    try {
        const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveClients(clients: Client[]): void {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

function getAIProfiles(): ClientAIProfile[] {
    try {
        const data = fs.readFileSync(AI_PROFILES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function slugify(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 30);
}

function shortHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}

function normalizeDomain(domain: string): string {
    return domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

function generateEntityId(brand: string, domain: string, legal: string, country: string): string {
    return `ent_${slugify(brand)}_${shortHash(`${domain}${legal}${country}`)}`;
}

interface GenerationNotes {
    sources: string[];
    absent: { field: string; reason: string }[];
}

interface ExtractedData {
    phone?: string;
    email?: string;
    emails?: string[];
    addressLine?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    linkedin?: string;
    youtube?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    keyPeople?: string[];
}

// Helper: Fetch a URL with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeywordNinja/1.0)' },
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

// Extract data from HTML content
function extractFromHtml(html: string): ExtractedData {
    const data: ExtractedData = {};

    // Phone patterns - more comprehensive
    const phonePatterns = [
        /tel:([+\d\s().-]{8,})/gi,
        /\+91[\s.-]?\d{5}[\s.-]?\d{5}/g,
        /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
        /(?:phone|tel|call|contact)[:\s]*([+\d\s().-]{10,})/gi,
    ];
    for (const pattern of phonePatterns) {
        const match = html.match(pattern);
        if (match && match[0]) {
            data.phone = match[0].replace(/tel:/i, '').replace(/[^\d+]/g, '').substring(0, 15);
            if (data.phone.length >= 10) break;
        }
    }

    // Email addresses
    const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = Array.from(new Set(html.match(emailPattern) || [])).filter(e =>
        !e.includes('example.com') && !e.includes('email.com') && !e.includes('domain.com')
    );
    if (emails.length) {
        data.email = emails[0];
        data.emails = emails.slice(0, 5);
    }

    // Social media links
    const socialPatterns: Record<string, RegExp> = {
        linkedin: /linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i,
        youtube: /youtube\.com\/(?:@|channel\/|c\/|user\/)?([a-zA-Z0-9_-]+)/i,
        twitter: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i,
        facebook: /facebook\.com\/([a-zA-Z0-9.]+)/i,
        instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/i,
    };
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
        const match = html.match(pattern);
        if (match?.[1] && match[1] !== 'share' && match[1] !== 'intent') {
            (data as Record<string, string>)[platform] = match[1];
        }
    }

    // Address from JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
            try {
                const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
                const jsonData = JSON.parse(jsonContent);
                const address = jsonData.address || jsonData.location?.address;
                if (address) {
                    data.addressLine = address.streetAddress || data.addressLine;
                    data.city = address.addressLocality || data.city;
                    data.state = address.addressRegion || data.state;
                    data.country = address.addressCountry || data.country;
                    data.postalCode = address.postalCode || data.postalCode;
                }
            } catch { /* ignore parse errors */ }
        }
    }

    // Fallback: Extract address from common patterns
    if (!data.city) {
        // Look for Indian city names
        const indianCities = ['Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad',
            'Pune', 'Ahmedabad', 'Surat', 'Vadodara', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
            'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
            'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai',
            'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur',
            'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli', 'Tiruchirappalli',
            'Bareilly', 'Moradabad', 'Mysore', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Bhubaneswar', 'Salem',
            'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati', 'Noida',
            'Jamshedpur', 'Bhilai', 'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun',
            'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer', 'Akola', 'Gulbarga',
            'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi', 'Ulhasnagar', 'Jammu', 'Sangli',
            'Mangalore', 'Erode', 'Belgaum', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon',
            'Udaipur', 'Maheshtala', 'Sachin', 'GIDC'];

        for (const city of indianCities) {
            const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
            if (cityRegex.test(html)) {
                data.city = city;
                break;
            }
        }
    }

    // Indian states
    if (!data.state) {
        const indianStates = ['Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Andhra Pradesh',
            'Telangana', 'Kerala', 'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh',
            'Bihar', 'Punjab', 'Haryana', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Assam', 'Uttarakhand',
            'Himachal Pradesh', 'Goa', 'Tripura', 'Meghalaya', 'Manipur', 'Nagaland', 'Arunachal Pradesh',
            'Mizoram', 'Sikkim', 'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
            'Andaman and Nicobar Islands', 'Lakshadweep', 'Dadra and Nagar Haveli'];

        for (const state of indianStates) {
            const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
            if (stateRegex.test(html)) {
                data.state = state;
                break;
            }
        }
    }

    // Postal code patterns (India and others)
    if (!data.postalCode) {
        const postalPatterns = [
            /\b(\d{6})\b/g, // India
            /\b(\d{5}(?:-\d{4})?)\b/g, // US
            /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi, // UK
        ];
        for (const pattern of postalPatterns) {
            const match = html.match(pattern);
            if (match?.[0]) {
                data.postalCode = match[0];
                break;
            }
        }
    }

    // Key people (CEO, Founder, Director patterns)
    const peoplePatterns = [
        /(?:CEO|Chief Executive Officer|Founder|Managing Director|Director|Chairman)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})/gi,
        /([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})[,\s]+(?:CEO|Founder|MD|Director|Chairman)/gi,
    ];
    const keyPeople: string[] = [];
    for (const pattern of peoplePatterns) {
        const matches = Array.from(html.matchAll(pattern));
        for (const m of matches) {
            if (m[1] && m[1].length > 3 && m[1].length < 40) {
                keyPeople.push(m[1].trim());
            }
        }
    }
    if (keyPeople.length) {
        data.keyPeople = Array.from(new Set(keyPeople)).slice(0, 5);
    }

    return data;
}

// Search Google for company information
async function searchGoogleForCompany(companyName: string, domain: string): Promise<ExtractedData> {
    const data: ExtractedData = {};

    try {
        // Search for company address
        const searchQuery = encodeURIComponent(`"${companyName}" address contact ${domain}`);
        const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

        const html = await fetchWithTimeout(searchUrl, 5000);
        if (!html) return data;

        // Extract structured data from search results
        const extracted = extractFromHtml(html);
        return extracted;
    } catch (err) {
        console.log('Google search failed:', err);
    }

    return data;
}

// POST /api/clients/[id]/canonical-entity/generate
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { overwriteAll = false } = body as { overwriteAll?: boolean };

    const clients = getClients();
    const clientIndex = clients.findIndex(c => c.id === id);

    if (clientIndex === -1) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = clients[clientIndex];
    const aiProfiles = getAIProfiles();
    const aiProfile = aiProfiles.find(p => p.clientCode === client.code);

    const notes: GenerationNotes = { sources: [], absent: [] };

    const canonicalDomain = normalizeDomain(client.mainDomain || client.domains?.[0] || '');
    const brand = client.name;
    const legal = aiProfile?.clientName || client.name;
    const country = aiProfile?.targetGeographies?.[0] || 'Unknown';

    notes.sources.push('Client Master');
    if (aiProfile) notes.sources.push('AI Profile');

    const entityId = generateEntityId(brand, canonicalDomain, legal, country);

    // Crawl multiple pages for comprehensive data
    const baseUrl = `https://${canonicalDomain}`;
    const pagesToCrawl = [
        baseUrl,
        `${baseUrl}/contact`,
        `${baseUrl}/contact-us`,
        `${baseUrl}/about`,
        `${baseUrl}/about-us`,
        `${baseUrl}/company`,
    ];

    let combinedData: ExtractedData = {};
    let crawledPages = 0;

    for (const url of pagesToCrawl) {
        const html = await fetchWithTimeout(url, 6000);
        if (html) {
            crawledPages++;
            const extracted = extractFromHtml(html);
            // Merge extracted data (first non-empty value wins)
            combinedData = {
                phone: combinedData.phone || extracted.phone,
                email: combinedData.email || extracted.email,
                emails: combinedData.emails?.length ? combinedData.emails : extracted.emails,
                addressLine: combinedData.addressLine || extracted.addressLine,
                city: combinedData.city || extracted.city,
                state: combinedData.state || extracted.state,
                country: combinedData.country || extracted.country,
                postalCode: combinedData.postalCode || extracted.postalCode,
                linkedin: combinedData.linkedin || extracted.linkedin,
                youtube: combinedData.youtube || extracted.youtube,
                twitter: combinedData.twitter || extracted.twitter,
                facebook: combinedData.facebook || extracted.facebook,
                instagram: combinedData.instagram || extracted.instagram,
                keyPeople: combinedData.keyPeople?.length ? combinedData.keyPeople : extracted.keyPeople,
            };
        }
        // Stop if we have most data
        if (combinedData.phone && combinedData.email && combinedData.city && combinedData.linkedin) break;
    }

    if (crawledPages > 0) {
        notes.sources.push(`Website crawl (${crawledPages} page${crawledPages > 1 ? 's' : ''})`);
    }

    // Also try Google search for missing data
    if (!combinedData.city || !combinedData.addressLine) {
        const googleData = await searchGoogleForCompany(brand, canonicalDomain);
        combinedData = {
            ...combinedData,
            city: combinedData.city || googleData.city,
            state: combinedData.state || googleData.state,
            addressLine: combinedData.addressLine || googleData.addressLine,
            postalCode: combinedData.postalCode || googleData.postalCode,
        };
        if (googleData.city || googleData.addressLine) {
            notes.sources.push('Google Search');
        }
    }

    // Build canonical entity
    const newEntity: CanonicalEntity = {
        entityId,
        entityVersion: (client.canonicalEntity?.entityVersion || 0) + 1,
        generatedAt: new Date().toISOString(),
        names: {
            brand: client.name,
            legal: legal,
            aliases: [],
        },
        web: {
            canonicalDomain,
            allowedDomains: (client.domains || []).map(normalizeDomain),
            canonicalUrl: baseUrl,
            brandEmailDomains: [canonicalDomain],
        },
        contact: {
            primaryPhoneE164: combinedData.phone || '',
            supportEmails: combinedData.emails || (combinedData.email ? [combinedData.email] : []),
        },
        location: {
            hq: {
                addressLine: combinedData.addressLine || '',
                city: combinedData.city || '',
                state: combinedData.state || '',
                country: combinedData.country || (country !== 'Unknown' ? country : ''),
                postalCode: combinedData.postalCode || '',
            },
            serviceGeographies: aiProfile?.targetGeographies || [],
        },
        industry: {
            businessModel: aiProfile?.businessModel || '',
            industry: aiProfile?.industryType?.replace(/_/g, ' ') || '',
            products: aiProfile?.productLines || [],
            keywords: aiProfile?.coreTopics || [],
            uniqueIdentifiers: [],
        },
        profiles: {
            googleBusiness: { placeId: null, cid: null, preferredNameOnGBP: null },
            knowledgeGraph: { wikidataQid: null, wikipediaUrl: null },
            directories: { crunchbaseUrl: null, g2Url: null, capterraUrl: null, trustpilotUrl: null, clutchUrl: null },
            social: {
                linkedinCompanySlug: combinedData.linkedin || null,
                youtubeHandle: combinedData.youtube || null,
                instagramHandle: combinedData.instagram || null,
                xHandle: combinedData.twitter || null,
                facebookPage: combinedData.facebook || null,
            },
        },
        proofSignals: {
            logoUrl: client.brandPhotos?.[0] || null,
            logoHashPhash: null,
            tagline: aiProfile?.shortSummary?.substring(0, 100) || null,
            keyPeople: combinedData.keyPeople || [],
        },
        disambiguation: {
            topCompetitors: [],
            negativeKeywords: aiProfile?.negativeTopics || [],
        },
    };

    // Track absent fields
    if (!newEntity.contact.primaryPhoneE164) notes.absent.push({ field: 'phone', reason: 'Not found on website pages' });
    if (!newEntity.contact.supportEmails.length) notes.absent.push({ field: 'email', reason: 'Not found on website' });
    if (!newEntity.location.hq.addressLine) notes.absent.push({ field: 'address', reason: 'No structured address found' });
    if (!newEntity.location.hq.city) notes.absent.push({ field: 'city', reason: 'City not detected in content' });
    if (!newEntity.location.hq.state) notes.absent.push({ field: 'state', reason: 'State not detected' });
    if (!newEntity.location.hq.postalCode) notes.absent.push({ field: 'postalCode', reason: 'Postal code not found' });
    if (!newEntity.profiles.social.linkedinCompanySlug) notes.absent.push({ field: 'linkedin', reason: 'LinkedIn link not found' });
    if (!newEntity.profiles.social.youtubeHandle) notes.absent.push({ field: 'youtube', reason: 'YouTube link not found' });
    if (!newEntity.profiles.social.xHandle) notes.absent.push({ field: 'twitter/X', reason: 'X/Twitter link not found' });
    if (!newEntity.profiles.googleBusiness.placeId) notes.absent.push({ field: 'googleBusiness', reason: 'Requires Google Places API' });
    if (!newEntity.profiles.knowledgeGraph.wikidataQid) notes.absent.push({ field: 'wikidata', reason: 'Requires Wikidata API' });
    if (!newEntity.industry.uniqueIdentifiers.length) notes.absent.push({ field: 'uniqueIdentifiers', reason: 'Manual entry (SKUs, model numbers)' });
    if (!newEntity.proofSignals.keyPeople?.length) notes.absent.push({ field: 'keyPeople', reason: 'Not detected on website' });
    if (!newEntity.disambiguation.topCompetitors?.length) notes.absent.push({ field: 'competitors', reason: 'Manual entry required' });

    // Merge with existing if not overwriting all
    if (!overwriteAll && client.canonicalEntity) {
        const e = client.canonicalEntity;
        if (e.names?.brand) newEntity.names.brand = e.names.brand;
        if (e.names?.legal) newEntity.names.legal = e.names.legal;
        if (e.names?.aliases?.length) newEntity.names.aliases = e.names.aliases;
        if (e.contact?.primaryPhoneE164) newEntity.contact.primaryPhoneE164 = e.contact.primaryPhoneE164;
        if (e.contact?.supportEmails?.length) newEntity.contact.supportEmails = e.contact.supportEmails;
        if (e.location?.hq?.addressLine) newEntity.location.hq.addressLine = e.location.hq.addressLine;
        if (e.location?.hq?.city) newEntity.location.hq.city = e.location.hq.city;
        if (e.location?.hq?.state) newEntity.location.hq.state = e.location.hq.state;
        if (e.location?.hq?.country) newEntity.location.hq.country = e.location.hq.country;
        if (e.location?.hq?.postalCode) newEntity.location.hq.postalCode = e.location.hq.postalCode;
        if (e.proofSignals?.keyPeople?.length) newEntity.proofSignals.keyPeople = e.proofSignals.keyPeople;
        if (e.disambiguation?.topCompetitors?.length) newEntity.disambiguation.topCompetitors = e.disambiguation.topCompetitors;
        if (e.profiles?.googleBusiness?.placeId) newEntity.profiles.googleBusiness = e.profiles.googleBusiness;
        if (e.profiles?.social?.linkedinCompanySlug) newEntity.profiles.social = e.profiles.social;
        if (e.profiles?.directories?.crunchbaseUrl) newEntity.profiles.directories = e.profiles.directories;
        if (e.profiles?.knowledgeGraph?.wikidataQid) newEntity.profiles.knowledgeGraph = e.profiles.knowledgeGraph;
    }

    const newStatus: CanonicalEntityStatus = { status: 'generated', lastReviewedAt: null, lastReviewedBy: null };

    clients[clientIndex].canonicalEntity = newEntity;
    clients[clientIndex].canonicalEntityStatus = newStatus;
    saveClients(clients);

    return NextResponse.json({
        success: true,
        canonicalEntity: newEntity,
        canonicalEntityStatus: newStatus,
        aiProfileUsed: !!aiProfile,
        generationNotes: notes,
    });
}
