import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WS_PORT } from '@cat-office/shared';
import { TranscriptWatcher } from './transcriptWatcher.js';
import { CatManager } from './catManager.js';
import { WsServer } from './wsServer.js';
import { createDefaultOffice } from './officeLayout.js';
import { loadAgentNames, saveAgentNames } from './agentConfig.js';
import { CONFIG_HTML } from './configPage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // Load agent names
  let agentNames = await loadAgentNames();

  // API routes (before static serving)
  app.use(express.json());

  app.get('/api/agent-names', (_req, res) => {
    res.json(agentNames);
  });

  app.put('/api/agent-names', async (req, res) => {
    agentNames = req.body;
    await saveAgentNames(agentNames);
    catManager.setAgentNames(agentNames);
    console.log('[config] Agent names updated:', agentNames);
    res.json({ ok: true });
  });

  app.get('/config', (_req, res) => {
    res.type('html').send(CONFIG_HTML);
  });

  // Serve client build
  const clientDist = join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });

  // Create office layout
  const office = createDefaultOffice();

  // Create cat manager
  const catManager = new CatManager(office);
  catManager.setAgentNames(agentNames);
  catManager.start();

  // Create WebSocket server
  new WsServer(httpServer, catManager);

  // Create transcript watcher
  const watcher = new TranscriptWatcher();

  watcher.on('toolEvent', (event) => {
    console.log(`[event] ${event.type}: ${event.toolName} (session: ${event.sessionId.slice(0, 8)}...)`);
    catManager.handleToolEvent(event);
  });

  watcher.on('sessionStart', (sessionId, filePath) => {
    catManager.handleSessionStart(sessionId, filePath);
  });

  watcher.on('error', (err) => {
    console.error('[watcher] Error:', err.message);
  });

  await watcher.start();

  httpServer.listen(WS_PORT, () => {
    console.log(`\n🐱 Cat Office is running!`);
    console.log(`   Open http://localhost:${WS_PORT} in your browser`);
    console.log(`   Watching for Claude Code activity...\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    watcher.stop();
    catManager.stop();
    httpServer.close();
    process.exit(0);
  });
}

main().catch(console.error);
