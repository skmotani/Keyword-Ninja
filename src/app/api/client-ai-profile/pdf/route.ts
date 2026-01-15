import { NextRequest, NextResponse } from 'next/server';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');

    if (!clientCode) {
        return NextResponse.json({ error: 'Client code required' }, { status: 400 });
    }

    const profile = await getAiProfileByClientCode(clientCode);

    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Create a stream
    const stream = new PassThrough();
    const doc = new PDFDocument({ margin: 50 });

    doc.pipe(stream);

    // --- CONTENT GENERATION ---

    // Header
    doc.fontSize(20).text(`Client AI Profile: ${profile.clientName}`, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date(profile.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Overview
    doc.fontSize(14).text('Business Overview', { underline: true });
    doc.fontSize(10).text(`Industry: ${profile.industryType}`);
    doc.text(`Model: ${profile.businessModel}`);
    doc.text(`Summary: ${profile.shortSummary}`);
    doc.moveDown();

    // Dictionary
    if (profile.matchingDictionary) {
        const dict = profile.matchingDictionary;
        doc.fontSize(14).text('Matching Dictionary (Keyword Tagging Rules)', { underline: true });
        doc.moveDown(0.5);

        // Helper for sections
        const printSection = (title: string, tokens: string[], color = 'black') => {
            if (!tokens || tokens.length === 0) return;
            doc.fillColor(color).fontSize(11).text(`${title} (${tokens.length})`, { continued: false });
            doc.fillColor('black').fontSize(9).text(tokens.join(', '), { indent: 10 });
            doc.moveDown(0.5);
        };

        printSection('Brand Tokens', (dict.brandTokens || []).map(t => typeof t === 'string' ? t : t.token), 'purple');
        printSection('Negative Tokens', (dict.negativeTokens || []).map(t => typeof t === 'string' ? t : t.token), 'red');

        // Product Lines
        doc.fontSize(11).fillColor('blue').text('Product Line Tokens');
        Object.entries(dict.productLineTokens || {}).forEach(([key, tokens]) => {
            doc.fillColor('black').fontSize(9).text(`${key}: ${tokens.join(', ')}`, { indent: 20 });
        });
        doc.moveDown(0.5);

        printSection('Industry Indicators', dict.industryIndicators || []);
        printSection('Core Tokens', dict.coreTokens || [], 'green');
        printSection('Adjacent Tokens', dict.adjacentTokens || [], 'orange');
    } else {
        doc.fontSize(12).fillColor('red').text('⚠️ Missing Matching Dictionary');
    }

    doc.end();

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${profile.clientName.replace(/\s+/g, '_')}_Profile.pdf"`,
        },
    });
}
