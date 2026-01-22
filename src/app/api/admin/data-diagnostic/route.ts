import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Diagnostic endpoint to check data integrity on Railway
 * GET /api/admin/data-diagnostic
 */
export async function GET(req: NextRequest) {
    try {
        const results: Record<string, any> = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            dataDir: DATA_DIR,
            dataDirExists: fs.existsSync(DATA_DIR),
            files: {},
            clientProfiles: {}
        };

        // Check if data directory exists
        if (!results.dataDirExists) {
            return NextResponse.json({
                error: 'Data directory not found',
                path: DATA_DIR,
                cwd: process.cwd()
            }, { status: 500 });
        }

        // List all files in data directory
        const files = fs.readdirSync(DATA_DIR);
        files.forEach(file => {
            const filePath = path.join(DATA_DIR, file);
            const stat = fs.statSync(filePath);
            results.files[file] = {
                size: stat.size,
                modified: stat.mtime.toISOString(),
                isDirectory: stat.isDirectory()
            };
        });

        // Check client_ai_profiles.json specifically
        const profilesPath = path.join(DATA_DIR, 'client_ai_profiles.json');
        if (fs.existsSync(profilesPath)) {
            try {
                const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

                results.clientProfiles = {
                    totalProfiles: profiles.length,
                    clients: profiles.map((p: any) => {
                        const terms = p.ai_kw_builder_term_dictionary?.terms;
                        const termArray = Array.isArray(terms) ? terms : Object.values(terms || {});

                        // Count buckets
                        const bucketCounts: Record<string, number> = {};
                        termArray.forEach((t: any) => {
                            const bucket = t.bucket || 'unassigned';
                            bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
                        });

                        return {
                            clientCode: p.clientCode,
                            companyName: p.companyName,
                            updatedAt: p.updatedAt,
                            dictionaryVersion: p.ai_kw_builder_term_dictionary?.version,
                            dictionaryUpdatedAt: p.ai_kw_builder_term_dictionary?.updatedAt,
                            totalTerms: termArray.length,
                            bucketCounts
                        };
                    })
                };
            } catch (e) {
                results.clientProfiles = { error: 'Failed to parse profiles', message: String(e) };
            }
        } else {
            results.clientProfiles = { error: 'File not found', path: profilesPath };
        }

        // Check data-init directory (backup from Docker build)
        const dataInitDir = path.join(process.cwd(), 'data-init');
        if (fs.existsSync(dataInitDir)) {
            results.dataInitDir = {
                exists: true,
                files: fs.readdirSync(dataInitDir).map(f => ({
                    name: f,
                    size: fs.statSync(path.join(dataInitDir, f)).size
                }))
            };
        } else {
            results.dataInitDir = { exists: false };
        }

        return NextResponse.json(results, { status: 200 });

    } catch (error) {
        console.error('[DataDiagnostic] Error:', error);
        return NextResponse.json({
            error: 'Diagnostic failed',
            message: String(error)
        }, { status: 500 });
    }
}
