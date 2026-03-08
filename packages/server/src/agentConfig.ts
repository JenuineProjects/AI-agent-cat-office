import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', '..', 'agents.json');

/**
 * Agent names are stored as a simple array.
 * Index 0 = first agent to connect, index 1 = second, etc.
 * Empty strings mean "use default cat name".
 */
export async function loadAgentNames(): Promise<string[]> {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    // Support both old object format and new array format
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function saveAgentNames(names: string[]): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(names, null, 2) + '\n');
}
