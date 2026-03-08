/**
 * Replay the CV Screening agent session.
 * Replays 5 agents: HR Admin 1, HR Admin 2, DEI Specialist, Head of People & Culture, HR Manager
 * First 4 work in parallel, then HR Manager reviews all assessments.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const projectsDir = join(homedir(), '.claude', 'projects');
const replayDir = join(projectsDir, 'replay-session');

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const AGENT_COLORS = {
  'HR Admin 1': '\x1b[36m',       // cyan
  'HR Admin 2': '\x1b[35m',       // magenta
  'DEI Specialist': '\x1b[33m',   // yellow
  'Head of People': '\x1b[32m',   // green
  'HR Manager': '\x1b[34m',       // blue
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  const now = new Date();
  return DIM + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + RESET;
}

function agentColor(name) {
  return AGENT_COLORS[name] || '\x1b[37m';
}

function describeAction(toolName) {
  const descriptions = {
    Read: 'Reading a file...',
    Write: 'Writing assessment...',
    Edit: 'Editing a document...',
    Bash: 'Running a command...',
    Grep: 'Searching through files...',
    Glob: 'Looking for files...',
    ToolSearch: 'Looking up tools...',
  };
  return descriptions[toolName] || `Using ${toolName}...`;
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
    message: { role: 'user', content: [{ type: 'tool_result' }] },
  });
}

// Extract tool events from a JSONL file
async function extractEvents(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const events = [];
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.message?.content && Array.isArray(data.message.content)) {
        for (const block of data.message.content) {
          if (block.type === 'tool_use' && block.name) {
            events.push({ type: 'tool_use', name: block.name });
          }
          if (block.type === 'tool_result') {
            events.push({ type: 'tool_result' });
          }
        }
      }
    } catch {}
  }
  return events;
}

async function main() {
  const subagentDir = join(
    homedir(), '.claude', 'projects', 'C--Users-carey',
    'c44d0f47-cd98-41a8-b9e2-bd377ef4d080', 'subagents'
  );

  // The 5 agent files (second batch that ran with proper prompts)
  const agentFiles = [
    { name: 'HR Admin 1', file: 'agent-a36eb9b1b4d6d393c.jsonl', phase: 1 },
    { name: 'HR Admin 2', file: 'agent-a0f195d0e46084063.jsonl', phase: 1 },
    { name: 'DEI Specialist', file: 'agent-a9cab70fafb04326f.jsonl', phase: 1 },
    { name: 'Head of People', file: 'agent-a8f0bb5cd05001e38.jsonl', phase: 1 },
    { name: 'HR Manager', file: 'agent-a105284db9110e579.jsonl', phase: 2 },
  ];

  console.log(`\n${BOLD}=== Cat Office Replay: CV Screening ===${RESET}`);
  console.log(`${DIM}Replaying the recruitment team screening 12 candidates${RESET}\n`);

  // Extract events from each file
  for (const agent of agentFiles) {
    agent.events = await extractEvents(join(subagentDir, agent.file));
    const toolUses = agent.events.filter(e => e.type === 'tool_use').length;
    console.log(`  ${agentColor(agent.name)}${agent.name}${RESET} - ${toolUses} actions`);
  }

  console.log('');

  // Create replay directory
  await mkdir(replayDir, { recursive: true });

  // Phase 1: Spawn all 4 parallel agents
  console.log(`${BOLD}--- Phase 1: Individual Assessments ---${RESET}\n`);

  const sessions = new Map();
  const phase1Agents = agentFiles.filter(a => a.phase === 1);
  const phase2Agents = agentFiles.filter(a => a.phase === 2);

  for (const agent of phase1Agents) {
    const sessionId = `replay-${Date.now()}-${agent.name.replace(/\s+/g, '-')}`;
    const filePath = join(replayDir, `${sessionId}.jsonl`);
    const roleLine = JSON.stringify({
      message: { role: 'user', content: `You are Agent — The ${agent.name}` },
    });
    const initEvent = JSON.stringify({
      message: { role: 'user', content: [{ type: 'tool_result' }] },
    });
    await writeFile(filePath, roleLine + '\n' + initEvent + '\n');
    sessions.set(agent.name, { path: filePath, actionCount: 0 });
    console.log(`  ${timestamp()}  ${agentColor(agent.name)}${agent.name}${RESET} has joined the office`);
    await sleep(1500);
  }

  console.log('');

  // Replay phase 1 events round-robin (parallel work)
  let hasMore = true;
  let idx = 0;
  while (hasMore) {
    hasMore = false;
    for (const agent of phase1Agents) {
      if (idx < agent.events.length) {
        hasMore = true;
        const event = agent.events[idx];
        const session = sessions.get(agent.name);
        await appendFile(session.path, makeLine(event) + '\n');
        if (event.type === 'tool_use') {
          session.actionCount++;
          console.log(`  ${timestamp()}  ${agentColor(agent.name)}${agent.name}${RESET}  ${describeAction(event.name)}`);
        }
        await sleep(300);
      }
    }
    if (hasMore) await sleep(800);
    idx++;
  }

  // Phase 2: HR Manager reviews
  console.log(`\n${BOLD}--- Phase 2: HR Manager Reviews All Assessments ---${RESET}\n`);

  for (const agent of phase2Agents) {
    const sessionId = `replay-${Date.now()}-${agent.name.replace(/\s+/g, '-')}`;
    const filePath = join(replayDir, `${sessionId}.jsonl`);
    const roleLine = JSON.stringify({
      message: { role: 'user', content: `You are Agent 1 — The ${agent.name}` },
    });
    const initEvent = JSON.stringify({
      message: { role: 'user', content: [{ type: 'tool_result' }] },
    });
    await writeFile(filePath, roleLine + '\n' + initEvent + '\n');
    sessions.set(agent.name, { path: filePath, actionCount: 0 });
    console.log(`  ${timestamp()}  ${agentColor(agent.name)}${agent.name}${RESET} has joined the office`);
    await sleep(1500);

    console.log(`\n  ${timestamp()}  ${BOLD}${agentColor(agent.name)}>> ${agent.name} reviewing all assessments${RESET}\n`);

    for (const event of agent.events) {
      const session = sessions.get(agent.name);
      await appendFile(session.path, makeLine(event) + '\n');
      if (event.type === 'tool_use') {
        session.actionCount++;
        console.log(`  ${timestamp()}  ${agentColor(agent.name)}${agent.name}${RESET}  ${describeAction(event.name)}`);
        await sleep(800);
      } else {
        await sleep(300);
      }
    }
  }

  // Summary
  console.log(`\n${BOLD}--- Screening Complete ---${RESET}\n`);
  console.log(`${BOLD}Summary:${RESET}`);
  for (const [name, session] of sessions) {
    console.log(`  ${agentColor(name)}${name}${RESET} completed ${session.actionCount} actions`);
  }

  console.log(`\n${BOLD}Final Shortlist:${RESET}`);
  console.log(`  1. Niamh Kelly      (unanimous #1)`);
  console.log(`  2. James O'Brien    (analytical + DEI)`);
  console.log(`  3. Ciara O'Sullivan (highest growth)`);
  console.log(`  4. Sarah Murphy     (reliable match)`);
  console.log(`  5. Priya Sharma     (DEI expertise)`);

  console.log(`\n${DIM}Cats are now relaxing in the office. Press Ctrl+C to exit.${RESET}\n`);
  await sleep(120000);
}

main().catch(console.error);
