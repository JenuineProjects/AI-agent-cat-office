import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { WsClient } from '../network/wsClient.js';
import type { OfficeScene, CatInfo } from '../scenes/OfficeScene.js';
import { CatState } from '@cat-office/shared';

interface ToolbarProps {
  wsClient: WsClient;
  scene: OfficeScene;
}

const SKIN_COLORS: Record<string, string> = {
  tabby: '#c8a060',
  black: '#333333',
  white: '#eeeeee',
  ginger: '#e8943a',
  tuxedo: '#1a1a1a',
  grey: '#999999',
  calico: '#d4a86a',
  siamese: '#d2c0a0',
  tortoiseshell: '#8b5e3c',
  mackerel: '#7a8a7a',
};

const STATE_LABELS: Record<CatState, string> = {
  [CatState.Idle]: 'Idle',
  [CatState.Walking]: 'Walking...',
  [CatState.Typing]: 'Coding...',
  [CatState.Reading]: 'Reading files...',
  [CatState.Searching]: 'Searching...',
  [CatState.Sleeping]: 'Sleeping',
  [CatState.Playing]: 'Playing',
  [CatState.Eating]: 'Eating',
};

const STATE_EMOJI: Record<CatState, string> = {
  [CatState.Idle]: '',
  [CatState.Walking]: '',
  [CatState.Typing]: '',
  [CatState.Reading]: '',
  [CatState.Searching]: '',
  [CatState.Sleeping]: '',
  [CatState.Playing]: '',
  [CatState.Eating]: '',
};

function CatChip({ cat }: { cat: CatInfo }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 14px',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '16px',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: SKIN_COLORS[cat.skin] ?? '#888',
        border: '2px solid rgba(255,255,255,0.3)',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '14px', color: '#eee', fontWeight: 'bold' }}>{cat.name}</span>
      <span style={{ fontSize: '13px', color: '#aaa' }}>{STATE_LABELS[cat.state] ?? cat.state}</span>
    </div>
  );
}

function Toolbar({ wsClient, scene }: ToolbarProps) {
  const [connected, setConnected] = useState(false);
  const [catCount, setCatCount] = useState(0);
  const [cats, setCats] = useState<CatInfo[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(wsClient.connected);
      const infos = scene.getCatsInfo();
      setCatCount(infos.length);
      setCats(infos);
    }, 1000);
    return () => clearInterval(interval);
  }, [wsClient, scene]);

  const handleScreenshot = async () => {
    const app = (window as any).__pixiApp;
    if (!app?.renderer) return;

    try {
      app.renderer.render(app.stage);
      const image = await app.renderer.extract.image({
        target: app.stage,
        format: 'image/png',
        resolution: 1,
      });
      const link = document.createElement('a');
      link.download = 'cat-office.png';
      link.href = image.src;
      link.click();
    } catch (e) {
      console.warn('Extract failed, using canvas fallback:', e);
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'cat-office.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <>
      {/* Top bar — agent chips */}
      {cats.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '-55px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 'calc(100% - 24px)',
          background: 'rgba(0, 0, 0, 0.75)',
          borderRadius: '12px',
          padding: '8px 16px',
          fontFamily: 'monospace',
          backdropFilter: 'blur(6px)',
        }}>
          {cats.map(cat => <CatChip key={cat.id} cat={cat} />)}
        </div>
      )}

      {/* Bottom toolbar */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        padding: '8px 16px',
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ddd',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: connected ? '#88ff88' : '#ff4444',
          display: 'inline-block',
        }} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
        <span style={{ color: '#888' }}>|</span>
        <span>Cats: {catCount}</span>
        <span style={{ color: '#888' }}>|</span>
        <button
          onClick={handleScreenshot}
          style={{
            background: '#444',
            border: '1px solid #666',
            color: '#ddd',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          Screenshot
        </button>
      </div>
    </>
  );
}

export function initUI(wsClient: WsClient, scene: OfficeScene): void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  const root = createRoot(overlay);
  root.render(<Toolbar wsClient={wsClient} scene={scene} />);
}
