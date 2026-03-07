import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ServerMessage, ClientMessage } from '@cat-office/shared';
import type { CatManager } from './catManager.js';

export class WsServer {
  private wss: WebSocketServer;
  private catManager: CatManager;

  constructor(httpServer: Server, catManager: CatManager) {
    this.catManager = catManager;

    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      console.log(`[ws] Client connected (total: ${this.wss.clients.size})`);

      // Send snapshot on connect
      const snapshot = this.catManager.getSnapshot();
      ws.send(JSON.stringify(snapshot));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage;
          this.handleClientMessage(ws, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        console.log(`[ws] Client disconnected (total: ${this.wss.clients.size})`);
      });
    });

    // Forward cat manager events to all clients
    this.catManager.on('message', (msg) => {
      this.broadcast(msg);
    });
  }

  private handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'room:requestSnapshot': {
        const snapshot = this.catManager.getSnapshot();
        ws.send(JSON.stringify(snapshot));
        break;
      }
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
