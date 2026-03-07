import { Application } from 'pixi.js';
import { OfficeScene } from './scenes/OfficeScene.js';
import { WsClient } from './network/wsClient.js';
import { initUI } from './ui/Toolbar.js';
import { loadAllAssets } from './assets/AssetLoader.js';
import { ISO_ROOM_W, ISO_ROOM_H, ISO_CANVAS_SCALE } from './utils/isoUtils.js';

async function main() {
  // Load all sprite sheet assets before anything else
  await loadAllAssets();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const canvasWidth = ISO_ROOM_W * ISO_CANVAS_SCALE;
  const canvasHeight = ISO_ROOM_H * ISO_CANVAS_SCALE;

  const app = new Application();
  await app.init({
    canvas,
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: 0x2d2d44,
    resolution: 1,
    antialias: false,
    preference: 'webgl',
    webgl: {
      preserveDrawingBuffer: true,
    },
  });

  // Scale the stage so 1 pixel = ISO_CANVAS_SCALE screen pixels
  app.stage.scale.set(ISO_CANVAS_SCALE);

  const scene = new OfficeScene();
  // Shift scene left by 1 tile to visually center the office (content starts at tile x=2)
  scene.container.x = -32;
  app.stage.addChild(scene.container);

  // Connect WebSocket — in dev mode, Vite runs on a different port than WS server (3000)
  const port = window.location.port;
  const isDev = port !== '' && port !== '3000';
  const wsHost = isDev ? 'localhost:3000' : window.location.host;
  const wsUrl = `ws://${wsHost}`;
  const wsClient = new WsClient(wsUrl, scene);
  wsClient.connect();

  // Make app available for screenshot
  (window as any).__pixiApp = app;

  // Init UI overlay
  initUI(wsClient, scene);

  // Game loop
  app.ticker.add(() => {
    scene.update(app.ticker.deltaMS);
  });
}

main().catch((err) => {
  console.error('Failed to start cat-office:', err);
  document.body.style.color = 'white';
  document.body.innerText = `Error: ${err.message}`;
});
