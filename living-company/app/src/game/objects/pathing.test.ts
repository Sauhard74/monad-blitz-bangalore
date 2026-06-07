import { describe, it, expect } from 'vitest';
import { nextStepToward, pathBetween } from './pathing';

describe('nextStepToward', () => {
  it('steps right one tile when target is to the right', () => {
    expect(nextStepToward({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual({ x: 1, y: 0, dir: 'right' });
  });

  it('moves on X before Y', () => {
    expect(nextStepToward({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual({ x: 1, y: 0, dir: 'right' });
  });

  it('steps up when target is above and aligned on X', () => {
    expect(nextStepToward({ x: 4, y: 5 }, { x: 4, y: 2 })).toEqual({ x: 4, y: 4, dir: 'up' });
  });

  it('reports arrival with a null direction', () => {
    expect(nextStepToward({ x: 7, y: 7 }, { x: 7, y: 7 })).toEqual({ x: 7, y: 7, dir: null });
  });
});

describe('pathBetween', () => {
  it('produces one step per tile of Manhattan distance', () => {
    const path = pathBetween({ x: 0, y: 0 }, { x: 2, y: 1 });
    expect(path).toEqual([
      { x: 1, y: 0, dir: 'right' },
      { x: 2, y: 0, dir: 'right' },
      { x: 2, y: 1, dir: 'down' },
    ]);
  });

  it('is empty when already at the target', () => {
    expect(pathBetween({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([]);
  });
});
