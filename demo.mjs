/**
 * Demo script: spawns cats and cycles them through all actions
 * so they visit every piece of furniture in the office.
 *
 * Creates fake JSONL session files that the TranscriptWatcher picks up.
 */

import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const projectsDir = join(homedir(), '.claude', 'projects');
const demoDir = join(projectsDir, 'demo-cats');

// Tool events that map to different cat actions:
//   Write/Edit/Bash -> Typing (goes to desk)
//   Read/WebFetch   -> Reading (goes to bookshelf)
//   Grep/Glob       -> Searching (goes to bookshelf)
//   (idle behavior) -> Playing (goes to cat_tree), Eating (goes to food_bowl), Sleeping (goes to cat_bed)

const toolSequence = [
  // Each cat will cycle through these tools with pauses in between
  { type: 'tool_use', name: 'Write' },     // -> Typing -> desk
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'Read' },       // -> Reading -> bookshelf
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'Grep' },       // -> Searching -> bookshelf
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'Bash' },       // -> Typing -> desk
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'Edit' },       // -> Typing -> desk
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'Glob' },       // -> Searching -> bookshelf
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'WebFetch' },   // -> Reading -> bookshelf
  { type: 'tool_result' },                  // -> Idle
  { type: 'tool_use', name: 'WebSearch' },  // -> Reading -> bookshelf
  { type: 'tool_result' },                  // -> Idle
];

function makeLine(tool) {
  if (tool.type === 'tool_use') {
    return JSON.stringify({
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: tool.name }],
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NUM_CATS = 6;

async function main() {
  await mkdir(demoDir, { recursive: true });

  const sessions = [];
  console.log(`Spawning ${NUM_CATS} cats...`);

  // Create session files one by one with a delay (so cats spawn visibly)
  for (let i = 0; i < NUM_CATS; i++) {
    const sessionId = `demo-cat-${Date.now()}-${i}`;
    const filePath = join(demoDir, `${sessionId}.jsonl`);

    // Create the file with an initial tool_use to spawn + activate the cat
    const initialTool = toolSequence[i % toolSequence.length];
    await writeFile(filePath, makeLine(initialTool) + '\n');
    sessions.push({ id: sessionId, path: filePath, toolIndex: 0 });

    console.log(`  Cat ${i + 1} spawned (${sessionId.slice(0, 20)}...)`);
    await sleep(1500);
  }

  console.log(`\nAll cats spawned! Now cycling through actions...\n`);

  // Cycle through tool events, staggering each cat
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      // Each cat gets a different tool from the sequence
      const toolIdx = (i * 2 + round * 2) % toolSequence.length;
      const tool = toolSequence[toolIdx];
      const nextTool = toolSequence[(toolIdx + 1) % toolSequence.length];

      const toolName = tool.name ?? 'result';
      console.log(`  Cat ${i + 1}: ${tool.type}${tool.name ? ` (${tool.name})` : ''}`);
      await appendFile(session.path, makeLine(tool) + '\n');
      await sleep(800);

      // Send the follow-up (result after use, or next use)
      await appendFile(session.path, makeLine(nextTool) + '\n');
      await sleep(600);
    }

    console.log(`  --- Round ${round + 1} complete, waiting for cats to walk... ---`);
    await sleep(5000);
  }

  // Final round: make sure all action types are covered
  const finalTools = ['Write', 'Read', 'Grep', 'Bash', 'Edit', 'WebFetch'];
  console.log('\nFinal round - one tool per cat...');
  for (let i = 0; i < sessions.length; i++) {
    const toolName = finalTools[i % finalTools.length];
    await appendFile(sessions[i].path, makeLine({ type: 'tool_use', name: toolName }) + '\n');
    console.log(`  Cat ${i + 1}: ${toolName}`);
    await sleep(1200);
  }

  console.log('\nDemo running! Cats will also do idle behaviors (Playing, Eating, Sleeping)');
  console.log('automatically after ~30s of no activity.');
  console.log('\nLeaving demo active - cats are in the office now.');
  console.log('Press Ctrl+C to exit.\n');

  // Keep alive so the user can watch idle behaviors kick in
  await sleep(120000);
}

main().catch(console.error);
