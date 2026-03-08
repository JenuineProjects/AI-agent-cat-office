import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { readFile, stat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, extname } from 'node:path';
import { EventEmitter } from 'node:events';
import { parseJsonlLine } from './transcriptParser.js';
import type { ToolEvent } from '@cat-office/shared';

export interface TranscriptWatcherEvents {
  toolEvent: [event: ToolEvent];
  sessionStart: [sessionId: string, filePath: string];
  sessionEnd: [sessionId: string];
  error: [error: Error];
}

export class TranscriptWatcher extends EventEmitter<TranscriptWatcherEvents> {
  private watcher: FSWatcher | null = null;
  private fileOffsets = new Map<string, number>();
  private lineBuffers = new Map<string, string>();
  private knownFiles = new Set<string>();
  private watchPath: string;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(watchPath?: string) {
    super();
    this.watchPath = watchPath ?? join(homedir(), '.claude', 'projects');
  }

  async start(): Promise<void> {
    console.log(`[watcher] Watching for JSONL files in: ${this.watchPath}`);

    // Scan for existing JSONL files
    await this.scanExisting(this.watchPath);

    // Use Node's native recursive fs.watch (works great on Windows)
    try {
      this.watcher = fsWatch(this.watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = join(this.watchPath, filename);
        if (!fullPath.endsWith('.jsonl')) return;

        // Debounce rapid changes to the same file
        const existing = this.debounceTimers.get(fullPath);
        if (existing) clearTimeout(existing);
        this.debounceTimers.set(fullPath, setTimeout(() => {
          this.debounceTimers.delete(fullPath);
          this.handleFileEvent(fullPath);
        }, 300));
      });

      this.watcher.on('error', (err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
    } catch (err) {
      console.error('[watcher] Failed to start fs.watch:', err);
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private async scanExisting(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const fullPath = join((entry as any).parentPath ?? (entry as any).path ?? dir, entry.name);
          // For existing files, set offset to end (only watch new content)
          try {
            const stats = await stat(fullPath);
            this.fileOffsets.set(fullPath, stats.size);
            this.lineBuffers.set(fullPath, '');
            this.knownFiles.add(fullPath);
          } catch {
            // File may have been deleted
          }
        }
      }
      console.log(`[watcher] Found ${this.knownFiles.size} existing JSONL files`);
    } catch {
      // Directory might not exist yet
      console.log(`[watcher] Watch directory doesn't exist yet, waiting for files...`);
    }
  }

  private sessionIdFromPath(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.jsonl', '');
  }

  private async handleFileEvent(filePath: string): Promise<void> {
    const isNew = !this.knownFiles.has(filePath);

    if (isNew) {
      this.knownFiles.add(filePath);
      this.fileOffsets.set(filePath, 0);
      this.lineBuffers.set(filePath, '');
      const sessionId = this.sessionIdFromPath(filePath);
      console.log(`[watcher] New session detected: ${sessionId}`);
      this.emit('sessionStart', sessionId, filePath);
    }

    await this.readNewContent(filePath);
  }

  private async readNewContent(filePath: string): Promise<void> {
    const sessionId = this.sessionIdFromPath(filePath);
    const offset = this.fileOffsets.get(filePath) ?? 0;

    try {
      const stats = await stat(filePath);
      if (stats.size <= offset) return;

      const content = await readFile(filePath, 'utf-8');
      const newContent = content.slice(offset);
      this.fileOffsets.set(filePath, stats.size);

      const buffer = (this.lineBuffers.get(filePath) ?? '') + newContent;
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      this.lineBuffers.set(filePath, lines.pop() ?? '');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseJsonlLine(trimmed, sessionId, filePath);
        if (event) {
          this.emit('toolEvent', event);
        }
      }
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }
}
