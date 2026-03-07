import { Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { getTileTexture, getMapData } from '../assets/AssetLoader.js';

export interface MapLayer {
  name: string;
  tiles: { id: string; x: number; y: number }[];
  collider: boolean;
}

export interface MapData {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  layers: MapLayer[];
}

/** Background layers render below cats. */
const BACKGROUND_LAYERS = ['Floor', 'Walls', 'Office Furniture', 'Cat Furniture', 'Chairs'];

/** Foreground layers render above cats (monitors in front of sitting cats). */
const FOREGROUND_LAYERS = ['Computers'];

function renderLayers(layerNames: string[], layerMap: Map<string, MapLayer>, ts: number): Container {
  const container = new Container();
  for (const layerName of layerNames) {
    const layer = layerMap.get(layerName);
    if (!layer) continue;

    const layerContainer = new Container();
    layerContainer.label = layerName;

    for (const tile of layer.tiles) {
      const tileId = parseInt(tile.id, 10);
      const texture = getTileTexture(tileId);
      if (!texture) continue;

      const sprite = new Sprite(texture);
      sprite.position.set(tile.x * ts, tile.y * ts);
      layerContainer.addChild(sprite);
    }

    container.addChild(layerContainer);
  }
  return container;
}

/**
 * Renders the tile map from map.json using the spritesheet.
 * Returns background (below cats) and foreground (above cats) containers.
 */
export function renderTileMap(): { background: Container; foreground: Container } {
  const mapData = getMapData();
  if (!mapData) {
    return { background: new Container(), foreground: new Container() };
  }

  const ts = mapData.tileSize; // 32

  // Build a lookup: layerName → layer
  const layerMap = new Map<string, MapLayer>();
  for (const layer of mapData.layers) {
    layerMap.set(layer.name, layer);
  }

  return {
    background: renderLayers(BACKGROUND_LAYERS, layerMap, ts),
    foreground: renderLayers(FOREGROUND_LAYERS, layerMap, ts),
  };
}
