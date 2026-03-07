import type { ServerMessage, ClientMessage } from '@cat-office/shared';
import { WS_RECONNECT_BASE_DELAY, WS_RECONNECT_MAX_DELAY } from '@cat-office/shared';
import type { OfficeScene } from '../scenes/OfficeScene.js';

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private scene: OfficeScene;
  private reconnectDelay = WS_RECONNECT_BASE_DELAY;
  private reconnectTimer: number | null = null;
  connected = false;

  constructor(url: string, scene: OfficeScene) {
    this.url = url;
    this.scene = scene;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[ws] Connected');
        this.connected = true;
        this.reconnectDelay = WS_RECONNECT_BASE_DELAY;
        this.scene.setConnectionStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          this.handleMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        console.log('[ws] Disconnected');
        this.connected = false;
        this.scene.setConnectionStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'room:snapshot':
        this.scene.handleSnapshot(msg);
        break;
      case 'cat:spawn':
        this.scene.handleCatSpawn(msg.cat);
        break;
      case 'cat:despawn':
        this.scene.handleCatDespawn(msg.catId);
        break;
      case 'cat:stateChange':
        this.scene.handleCatStateChange(msg.catId, msg.state, msg.direction, msg.waitingForInput);
        break;
      case 'cat:move':
        this.scene.handleCatMove(msg.catId, msg.position, msg.targetPosition);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log(`[ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX_DELAY);
  }
}
