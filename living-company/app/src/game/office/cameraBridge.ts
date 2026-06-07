/**
 * A tiny bridge so React HUD elements can anchor themselves to a WORLD rectangle
 * in the Phaser scene (e.g. the big "screen" wall). The scene publishes its
 * camera view each frame; React reads it via rAF and converts world→screen.
 *
 * No Zustand here on purpose — this updates every frame and must not trigger
 * React re-renders; consumers poll `cameraState` inside their own rAF loop.
 */

export interface CameraState {
  /** Top-left of the visible world (camera.worldView). */
  viewX: number;
  viewY: number;
  zoom: number;
  ready: boolean;
}

export const cameraState: CameraState = { viewX: 0, viewY: 0, zoom: 1, ready: false };

export function publishCamera(viewX: number, viewY: number, zoom: number): void {
  cameraState.viewX = viewX;
  cameraState.viewY = viewY;
  cameraState.zoom = zoom;
  cameraState.ready = true;
}

/** The black "screen" wall in the WA office map, in world pixels (tile=32). */
export const SCREEN_RECT = { x: 21 * 32, y: 1 * 32, w: 13 * 32, h: 8 * 32 };

/** Convert a world rect to a screen-space CSS box (px), relative to the canvas
 *  top-left — which is the same origin as the full-screen HUD overlay. */
export function worldRectToScreen(rect: { x: number; y: number; w: number; h: number }) {
  const { viewX, viewY, zoom } = cameraState;
  return {
    left: (rect.x - viewX) * zoom,
    top: (rect.y - viewY) * zoom,
    width: rect.w * zoom,
    height: rect.h * zoom,
  };
}
