import { describe, expect, it } from 'vitest';
import {
  createDrawingClock,
  lastPoint,
  roundCoordinate,
  startStroke,
  strokeReach,
} from './stroke-builder';
import { drawingDuration, pointCount, type StrokeStyle } from './types';

const PEN: StrokeStyle = { tool: 'pen', color: '#000000', width: 8 };

describe('roundCoordinate', () => {
  it('keeps one decimal', () => {
    expect(roundCoordinate(12.3456)).toBe(12.3);
    expect(roundCoordinate(12.35)).toBe(12.4);
    expect(roundCoordinate(-0.04)).toBe(-0);
  });
});

describe('startStroke', () => {
  it('starts with one point: a dot', () => {
    const { stroke } = startStroke(PEN, { x: 10.04, y: 20.06, t: 5.4 });
    expect(stroke).toEqual({ ...PEN, points: [10, 20.1, 5] });
    expect(pointCount(stroke)).toBe(1);
  });

  it('appends rounded samples', () => {
    const builder = startStroke(PEN, { x: 0, y: 0, t: 0 });
    expect(builder.add({ x: 1.26, y: 2.21, t: 16.6 })).toBe(true);
    expect(builder.stroke.points).toEqual([0, 0, 0, 1.3, 2.2, 17]);
  });

  it('skips a sample at the same rounded position', () => {
    const builder = startStroke(PEN, { x: 5, y: 5, t: 0 });
    expect(builder.add({ x: 5.01, y: 4.99, t: 8 })).toBe(false);
    expect(pointCount(builder.stroke)).toBe(1);
  });

  it('never lets time go backwards', () => {
    const builder = startStroke(PEN, { x: 0, y: 0, t: 100 });
    builder.add({ x: 1, y: 0, t: 99 });
    expect(builder.stroke.points.at(-1)).toBe(100);
  });

  it('copies the style instead of sharing it', () => {
    const style = { ...PEN };
    const { stroke } = startStroke(style, { x: 0, y: 0, t: 0 });
    style.color = '#ff0000';
    expect(stroke.color).toBe('#000000');
  });

  it('keeps only the style fields', () => {
    const toolState = { ...PEN, mode: 'finger' };
    const { stroke } = startStroke(toolState, { x: 0, y: 0, t: 0 });
    expect(Object.keys(stroke).sort()).toEqual(['color', 'points', 'tool', 'width']);
  });
});

describe('createDrawingClock', () => {
  it('counts from the start offset', () => {
    const clock = createDrawingClock(0, 1000);
    expect(clock(1000)).toBe(0);
    expect(clock(1016.7)).toBe(17);
  });

  it('continues a reopened drawing after its last point', () => {
    const clock = createDrawingClock(5000, 200);
    expect(clock(250)).toBe(5050);
  });

  it('never goes before the start offset', () => {
    expect(createDrawingClock(300, 1000)(900)).toBe(300);
  });
});

describe('helpers', () => {
  it('gives the last point of a stroke', () => {
    const builder = startStroke(PEN, { x: 1, y: 2, t: 0 });
    builder.add({ x: 3, y: 4, t: 10 });
    expect(lastPoint(builder.stroke)).toEqual([3, 4]);
    expect(lastPoint({ ...PEN, points: [] })).toBeNull();
    expect(lastPoint({ ...PEN, points: [1, 2, 0, 7] })).toEqual([1, 2]);
    expect(lastPoint({ ...PEN, points: [1, 2] })).toBeNull();
  });

  it('measures the duration of a drawing', () => {
    expect(drawingDuration([])).toBe(0);
    expect(
      drawingDuration([
        { ...PEN, points: [0, 0, 10, 1, 1, 400] },
        { ...PEN, points: [5, 5, 900] },
        { ...PEN, points: [] },
      ]),
    ).toBe(900);
    expect(drawingDuration([{ ...PEN, points: [0, 0, 10, 5000] }])).toBe(10);
  });

  it('measures how far a stroke reaches from its first point', () => {
    expect(strokeReach({ ...PEN, points: [] })).toBe(0);
    expect(strokeReach({ ...PEN, points: [5, 5, 0] })).toBe(0);
    // A scribble that comes back to its start still reached its farthest point.
    expect(strokeReach({ ...PEN, points: [0, 0, 0, 3, 4, 10, 1, 0, 20] })).toBe(5);
    // A truncated trailing triplet (corrupt import) is ignored.
    expect(strokeReach({ ...PEN, points: [0, 0, 0, 30, 40] })).toBe(0);
    // From where the contact landed: its first point, pulled onto the edge, is skipped.
    expect(strokeReach({ ...PEN, points: [0, 50, 0, -30, 50, 10] }, [-30, 50])).toBe(0);
    expect(strokeReach({ ...PEN, points: [0, 50, 0, -27, 46, 10] }, [-30, 50])).toBe(5);
  });
});
