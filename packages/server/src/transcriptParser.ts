import { ToolEvent, TOOL_TO_ACTION, CatState } from '@cat-office/shared';

interface JsonlMessage {
  type?: string;
  message?: {
    role?: string;
    content?: Array<{
      type?: string;
      name?: string;
      tool_use_id?: string;
    }>;
  };
  // Claude Code JSONL format
  tool_name?: string;
  tool_use_id?: string;
}

export function parseJsonlLine(line: string, sessionId: string, filePath?: string): ToolEvent | null {
  try {
    const data = JSON.parse(line) as JsonlMessage;

    // Look for tool_use content blocks
    if (data.message?.content) {
      for (const block of data.message.content) {
        if (block.type === 'tool_use' && block.name) {
          return {
            type: 'tool_use',
            toolName: block.name,
            sessionId,
            timestamp: Date.now(),
            filePath,
          };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            toolName: '',
            sessionId,
            timestamp: Date.now(),
            filePath,
          };
        }
      }
    }

    // Alternative format: top-level tool fields
    if (data.type === 'tool_use' && data.tool_name) {
      return {
        type: 'tool_use',
        toolName: data.tool_name,
        sessionId,
        timestamp: Date.now(),
        filePath,
      };
    }

    if (data.type === 'tool_result') {
      return {
        type: 'tool_result',
        toolName: '',
        sessionId,
        timestamp: Date.now(),
        filePath,
      };
    }
  } catch {
    // Skip malformed lines
  }

  return null;
}

export function toolEventToAction(event: ToolEvent): CatState | null {
  if (event.type === 'tool_use') {
    return TOOL_TO_ACTION[event.toolName] ?? CatState.Typing;
  }
  return null;
}
