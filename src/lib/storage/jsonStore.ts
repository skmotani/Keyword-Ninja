import { promises as fs } from 'fs';
import path from 'path';

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        if ((error as any).code === 'ENOENT') return null;
        console.error(`Error reading generic JSON file ${filePath}:`, error);
        return null;
    }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<boolean> {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Simple atomic write simulation: write to temp then rename? 
        // For now, standard writeFile is sufficient for this scope.
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error writing generic JSON file ${filePath}:`, error);
        return false;
    }
}
