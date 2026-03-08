import { readFile } from 'node:fs/promises';

/**
 * Attempt to detect an agent's role/name from the first few lines of its JSONL transcript.
 * Looks for common patterns like:
 *   "You are Agent 1 — The Researcher"
 *   "You are the HR Manager"
 *   "Role: Designer"
 */

const ROLE_PATTERNS: Array<{ regex: RegExp; group: number }> = [
  // "You are \"HR Admin 1\"" — quoted role name
  { regex: /You are\s*"([A-Za-z][A-Za-z0-9 &,'\-]*)"/i, group: 1 },
  // "You are Agent N — The Role Name" (with em dash or hyphen) — capture everything after "The" until period/newline
  { regex: /You are Agent \d+\s*[—–\-]+\s*The\s+([A-Za-z][A-Za-z0-9 &]*)/i, group: 1 },
  // "You are the Role Name in/overseeing/." — capture multi-word role
  { regex: /You are the\s+([A-Za-z][A-Za-z0-9 &,']*?)(?:\s+in\s|\s+overseeing\s|\s+specialising\s|\.)/i, group: 1 },
  // "You are \"Role Name\" — description" — quoted with em dash
  { regex: /You are\s*\\?"([A-Za-z][A-Za-z0-9 &,'\-]*)\\?"\s*[—–\-]/i, group: 1 },
  // "Role: RoleName"
  { regex: /Role:\s*([A-Za-z][A-Za-z0-9 &]*)/i, group: 1 },
  // "Your role is RoleName"
  { regex: /Your role is\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 &]*?)(?:\.|,|\n)/i, group: 1 },
];

export async function detectRoleFromFile(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    // Only scan the first 4000 chars (covers the initial system prompt / first message)
    const head = content.slice(0, 4000);
    return detectRoleFromText(head);
  } catch {
    return null;
  }
}

export function detectRoleFromText(text: string): string | null {
  for (const { regex, group } of ROLE_PATTERNS) {
    const match = text.match(regex);
    if (match?.[group]) {
      let role = match[group].trim();
      // Remove trailing words that aren't part of the role name
      role = role.replace(/\s+in$/, '').replace(/\s+a$/, '').trim();
      // Title case each word (keep small words lowercase)
      const smallWords = new Set(['of', 'and', 'the', 'in', 'a', 'an', 'to', 'for']);
      role = role.split(/\s+/).map((w, i) => {
        const lower = w.toLowerCase();
        if (i > 0 && smallWords.has(lower)) return lower;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');
      if (role.length > 0 && role.length <= 40) {
        return role;
      }
    }
  }
  return null;
}
