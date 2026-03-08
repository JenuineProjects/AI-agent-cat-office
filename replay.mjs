/**
 * Replay script: reads an existing JSONL transcript and replays tool events
 * sequentially in the original order they occurred.
 * Shows a real-time terminal simulation of agent activity.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const projectsDir = join(homedir(), '.claude', 'projects');
const replayDir = join(projectsDir, 'replay-session');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLine(toolEvent) {
  if (toolEvent.type === 'tool_use') {
    return JSON.stringify({
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: toolEvent.name }],
      },
    });
  }
  return JSON.stringify({
    message: {
      role: 'user',
      content: [{ type: 'tool_result' }],
    },
  });
}

// Map tool names to human-readable descriptions
function describeAction(toolName) {
  const descriptions = {
    Read: 'Reading a file...',
    Write: 'Writing a new file...',
    Edit: 'Editing code...',
    Bash: 'Running a terminal command...',
    Grep: 'Searching through code...',
    Glob: 'Looking for files...',
    WebSearch: 'Searching the web...',
    WebFetch: 'Fetching a webpage...',
    TaskCreate: 'Creating a new task...',
    TaskUpdate: 'Updating task progress...',
    TaskOutput: 'Checking task output...',
    TaskStop: 'Stopping a task...',
    ToolSearch: 'Looking up available tools...',
    Agent: 'Delegating to a sub-agent...',
    NotebookEdit: 'Editing a notebook...',
    AskUserQuestion: 'Asking the user a question...',
  };
  return descriptions[toolName] || `Using ${toolName}...`;
}

// Agent colour codes for terminal output
const AGENT_COLORS = {
  Researcher: '\x1b[36m',  // cyan
  Designer: '\x1b[35m',    // magenta
  Coder: '\x1b[33m',       // yellow
  Communicator: '\x1b[32m',// green
  Manager: '\x1b[34m',     // blue
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

function agentColor(name) {
  return AGENT_COLORS[name] || '\x1b[37m';
}

function timestamp() {
  const now = new Date();
  return DIM + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + RESET;
}

// Detect which agent is active based on text content in the JSONL line
function detectAgent(line) {
  const lower = line.toLowerCase();
  if (lower.includes('agent 1') || lower.includes('the researcher')) return 'Researcher';
  if (lower.includes('agent 2') || lower.includes('the designer')) return 'Designer';
  if (lower.includes('agent 3') || lower.includes('the coder')) return 'Coder';
  if (lower.includes('agent 4') || lower.includes('the communicator')) return 'Communicator';
  if (lower.includes('agent 5') || lower.includes('the manager')) return 'Manager';
  return null;
}

async function main() {
  const jsonlPath = process.argv[2];
  if (!jsonlPath) {
    console.error('Usage: node replay.mjs <path-to-jsonl>');
    process.exit(1);
  }

  console.log(`\n${BOLD}=== Cat Office Replay ===${RESET}`);
  console.log(`${DIM}Reading transcript: ${jsonlPath}${RESET}\n`);
  const content = await readFile(jsonlPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());

  // First pass: extract tool events in original order, tracking agent transitions
  const events = []; // { type, name?, agent } - in original sequential order
  let currentAgent = 'Manager';

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const detected = detectAgent(line);
      if (detected) currentAgent = detected;

      if (data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'tool_use' && block.name) {
            events.push({ type: 'tool_use', name: block.name, agent: currentAgent });
          }
          if (block.type === 'tool_result') {
            events.push({ type: 'tool_result', agent: currentAgent });
          }
        }
      }
    } catch {
      // skip malformed
    }
  }

  // Find unique agents in order of first appearance
  const seenAgents = new Set();
  const agentOrder = [];
  for (const event of events) {
    if (!seenAgents.has(event.agent)) {
      seenAgents.add(event.agent);
      agentOrder.push(event.agent);
    }
  }

  // Count actions per agent
  const actionCounts = new Map();
  for (const event of events) {
    if (event.type === 'tool_use') {
      actionCounts.set(event.agent, (actionCounts.get(event.agent) || 0) + 1);
    }
  }

  console.log(`${BOLD}Agents detected (in workflow order):${RESET}`);
  for (const name of agentOrder) {
    const count = actionCounts.get(name) || 0;
    console.log(`  ${agentColor(name)}${name}${RESET} - ${count} actions`);
  }

  // Show workflow transitions
  let prevAgent = null;
  const transitions = [];
  for (const event of events) {
    if (event.agent !== prevAgent) {
      transitions.push(event.agent);
      prevAgent = event.agent;
    }
  }
  console.log(`\n${BOLD}Workflow:${RESET} ${transitions.map(n => `${agentColor(n)}${n}${RESET}`).join(' -> ')}\n`);

  // Create replay directory
  await mkdir(replayDir, { recursive: true });

  // Create session files for all agents upfront (spawn all cats)
  console.log(`${BOLD}--- Agents joining the office ---${RESET}\n`);
  const agentSessions = new Map(); // agent name -> { path, actionCount }
  for (let i = 0; i < agentOrder.length; i++) {
    const agentName = agentOrder[i];
    const sessionId = `replay-${Date.now()}-${i}`;
    const filePath = join(replayDir, `${sessionId}.jsonl`);

    // Write role-identifying line to spawn the cat
    const roleLine = JSON.stringify({
      message: {
        role: 'user',
        content: `You are Agent ${i + 1} — The ${agentName}`,
      },
    });
    // Write a tool_result as initial event (just to create the file and trigger spawn)
    const initEvent = JSON.stringify({
      message: {
        role: 'user',
        content: [{ type: 'tool_result' }],
      },
    });
    await writeFile(filePath, roleLine + '\n' + initEvent + '\n');
    agentSessions.set(agentName, { path: filePath, actionCount: 0 });
    console.log(`  ${timestamp()}  ${agentColor(agentName)}${agentName}${RESET} has joined the office`);
    await sleep(1500);
  }

  console.log(`\n${BOLD}--- Work begins ---${RESET}\n`);

  // Replay events in original sequential order
  let activeAgent = null;
  for (const event of events) {
    // Announce agent transitions
    if (event.agent !== activeAgent) {
      activeAgent = event.agent;
      const color = agentColor(activeAgent);
      console.log(`\n  ${timestamp()}  ${BOLD}${color}>> ${activeAgent} takes over${RESET}\n`);
      await sleep(800);
    }

    // Write event to the correct agent's session file
    const session = agentSessions.get(event.agent);
    if (!session) continue;

    await appendFile(session.path, makeLine(event) + '\n');

    if (event.type === 'tool_use') {
      session.actionCount++;
      const desc = describeAction(event.name);
      const color = agentColor(event.agent);
      console.log(`  ${timestamp()}  ${color}${event.agent}${RESET}  ${desc}`);
      await sleep(800);
    } else {
      // tool_result — shorter pause
      await sleep(300);
    }
  }

  // Summary
  console.log(`\n${BOLD}--- Work complete ---${RESET}\n`);
  console.log(`${BOLD}Summary:${RESET}`);
  for (const [name, session] of agentSessions) {
    const color = agentColor(name);
    console.log(`  ${color}${name}${RESET} completed ${session.actionCount} actions`);
  }
  console.log(`\n${DIM}Cats are now relaxing in the office. Press Ctrl+C to exit.${RESET}\n`);
  await sleep(120000);
}

main().catch(console.error);
