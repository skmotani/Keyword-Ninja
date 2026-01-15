import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');

// Types
export interface ExportPageEntry {
  id: string;
  pageKey: string;
  pageName: string;
  route: string;
  module: string;
  clientFilterField: string;
  dataSourceType: 'JSON_FILE' | 'API';
  dataSourceRef: string;
  description: string;
  rowDescription: string;
  status: 'ACTIVE' | 'DEPRECATED';
  lastDiscoveredAt: string;
}

export interface ExportColumnEntry {
  id: string;
  pageKey: string;
  columnName: string;
  displayName: string;
  dataType: string;
  sourceField: string;
  metricMatchKey: string | null;
  notes: string | null;
}

export interface GlossaryEntry {
  metricKey: string;
  definition: string;
  notes: string | null;
  source: string;
  updatedAt: string;
}

// File paths
const PAGE_REGISTRY_FILE = 'export_page_registry.json';
const COLUMN_REGISTRY_FILE = 'export_column_registry.json';
const GLOSSARY_FILE = 'dataforseo_glossary.json';

// Generic read/write helpers
async function readJsonFile<T>(filename: string): Promise<T[]> {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch (error) {
    return [];
  }
}

async function writeJsonFile<T>(filename: string, data: T[]): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Page Registry Functions
export async function getExportPages(): Promise<ExportPageEntry[]> {
  return readJsonFile<ExportPageEntry>(PAGE_REGISTRY_FILE);
}

export async function getExportPage(pageKey: string): Promise<ExportPageEntry | undefined> {
  const pages = await getExportPages();
  return pages.find(p => p.pageKey === pageKey);
}

export async function upsertExportPage(entry: Omit<ExportPageEntry, 'id'> & { id?: string }): Promise<ExportPageEntry> {
  const pages = await getExportPages();
  const existingIndex = pages.findIndex(p => p.pageKey === entry.pageKey);
  
  const finalEntry: ExportPageEntry = {
    ...entry,
    id: entry.id || (existingIndex >= 0 ? pages[existingIndex].id : uuidv4()),
    lastDiscoveredAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    pages[existingIndex] = finalEntry;
  } else {
    pages.push(finalEntry);
  }

  await writeJsonFile(PAGE_REGISTRY_FILE, pages);
  return finalEntry;
}

export async function getActiveExportPages(): Promise<ExportPageEntry[]> {
  const pages = await getExportPages();
  return pages.filter(p => p.status === 'ACTIVE');
}

// Column Registry Functions
export async function getAllColumns(): Promise<ExportColumnEntry[]> {
  return readJsonFile<ExportColumnEntry>(COLUMN_REGISTRY_FILE);
}

export async function getColumnsForPage(pageKey: string): Promise<ExportColumnEntry[]> {
  const columns = await getAllColumns();
  return columns.filter(c => c.pageKey === pageKey);
}

export async function upsertColumns(pageKey: string, columns: Omit<ExportColumnEntry, 'id' | 'pageKey'>[]): Promise<void> {
  const allColumns = await getAllColumns();
  
  // Remove existing columns for this page
  const otherColumns = allColumns.filter(c => c.pageKey !== pageKey);
  
  // Add new columns with IDs
  const newColumns: ExportColumnEntry[] = columns.map(col => ({
    ...col,
    id: uuidv4(),
    pageKey,
  }));

  await writeJsonFile(COLUMN_REGISTRY_FILE, [...otherColumns, ...newColumns]);
}

// Glossary Functions
export async function getGlossary(): Promise<GlossaryEntry[]> {
  return readJsonFile<GlossaryEntry>(GLOSSARY_FILE);
}

export async function matchGlossary(columnName: string): Promise<GlossaryEntry | null> {
  const glossary = await getGlossary();
  
  // Normalize column name: lowercase, trim, convert camelCase to snake_case
  const normalized = columnName
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/\s+/g, '_');

  // Try exact match first
  let match = glossary.find(g => g.metricKey === normalized);
  if (match) return match;

  // Try without underscores
  const noUnderscores = normalized.replace(/_/g, '');
  match = glossary.find(g => g.metricKey.replace(/_/g, '') === noUnderscores);
  if (match) return match;

  // Common aliases
  const aliases: Record<string, string> = {
    'vol': 'search_volume',
    'volume': 'search_volume',
    'searchvol': 'search_volume',
    'sv': 'search_volume',
    'clicks': 'etv',
    'traffic': 'organic_traffic',
    'pos': 'position',
    'ranking': 'rank',
    'dr': 'domain_rank',
    'da': 'domain_rank',
    'backlinks': 'backlinks_count',
    'referringdomains': 'referring_domains_count',
  };

  const aliasKey = aliases[noUnderscores];
  if (aliasKey) {
    match = glossary.find(g => g.metricKey === aliasKey);
    if (match) return match;
  }

  return null;
}

// Batch match for multiple columns
export async function matchGlossaryBatch(columnNames: string[]): Promise<Map<string, GlossaryEntry>> {
  const results = new Map<string, GlossaryEntry>();
  
  for (const col of columnNames) {
    const match = await matchGlossary(col);
    if (match) {
      results.set(col, match);
    }
  }
  
  return results;
}
