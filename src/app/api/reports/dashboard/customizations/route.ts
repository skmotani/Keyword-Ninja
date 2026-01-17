import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'dashboard_query_customizations.json');

interface QueryCustomization {
    queryId: string;
    clientCode: string;
    customTitle?: string;
    customDescription?: string;
    updatedAt: string;
}

interface CustomizationsData {
    customizations: QueryCustomization[];
}

async function readCustomizations(): Promise<CustomizationsData> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { customizations: [] };
    }
}

async function writeCustomizations(data: CustomizationsData): Promise<void> {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET - Get all customizations for a client
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientCode = searchParams.get('clientCode');

        if (!clientCode) {
            return NextResponse.json(
                { success: false, error: 'clientCode is required' },
                { status: 400 }
            );
        }

        const data = await readCustomizations();
        const clientCustomizations = data.customizations.filter(
            c => c.clientCode === clientCode
        );

        // Convert to lookup objects for easy access
        const titles: Record<string, string> = {};
        const descriptions: Record<string, string> = {};

        for (const c of clientCustomizations) {
            if (c.customTitle) titles[c.queryId] = c.customTitle;
            if (c.customDescription) descriptions[c.queryId] = c.customDescription;
        }

        return NextResponse.json({
            success: true,
            titles,
            descriptions,
        });
    } catch (error) {
        console.error('Failed to get customizations:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get customizations' },
            { status: 500 }
        );
    }
}

// POST - Save a customization
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, queryId, customTitle, customDescription } = body;

        if (!clientCode || !queryId) {
            return NextResponse.json(
                { success: false, error: 'clientCode and queryId are required' },
                { status: 400 }
            );
        }

        const data = await readCustomizations();

        // Find existing customization
        const existingIndex = data.customizations.findIndex(
            c => c.clientCode === clientCode && c.queryId === queryId
        );

        const customization: QueryCustomization = {
            queryId,
            clientCode,
            customTitle: customTitle || undefined,
            customDescription: customDescription || undefined,
            updatedAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
            // Update existing
            data.customizations[existingIndex] = {
                ...data.customizations[existingIndex],
                ...customization,
            };
        } else {
            // Add new
            data.customizations.push(customization);
        }

        await writeCustomizations(data);

        return NextResponse.json({
            success: true,
            customization: data.customizations[existingIndex >= 0 ? existingIndex : data.customizations.length - 1],
        });
    } catch (error) {
        console.error('Failed to save customization:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save customization' },
            { status: 500 }
        );
    }
}
