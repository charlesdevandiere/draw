import { describe, expect, it } from 'vitest';
import { renderDrawing, renderStroke, type RenderContext } from './render';
import { PAGE_SIZE, type Stroke } from './types';

type Call = [string, ...unknown[]];

/** Records drawing calls with the style in effect when paint happens. */
function fakeContext() {
  const calls: Call[] = [];
  const context: RenderContext = {
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: () => calls.push(['fill', context.fillStyle, context.globalCompositeOperation]),
    stroke: () =>
      calls.push([
        'stroke',
        context.strokeStyle,
        context.lineWidth,
        context.globalCompositeOperation,
        context.lineCap,
        context.lineJoin,
      ]),
  };
  return { context, calls };
}

const pen = (points: number[]): Stroke => ({ tool: 'pen', color: '#e53935', width: 8, points });

describe('renderStroke', () => {
  it('draws a single point as a dot of the stroke diameter', () => {
    const { context, calls } = fakeContext();
    expect(renderStroke(context, pen([10, 20, 0]))).toBe(1);
    expect(calls).toEqual([
      ['beginPath'],
      ['arc', 10, 20, 4, 0, Math.PI * 2],
      ['fill', '#e53935', 'source-over'],
    ]);
  });

  it('draws a polyline with round caps and joins', () => {
    const { context, calls } = fakeContext();
    expect(renderStroke(context, pen([0, 0, 0, 10, 0, 5, 10, 10, 9]))).toBe(3);
    expect(calls).toEqual([
      ['beginPath'],
      ['moveTo', 0, 0],
      ['lineTo', 10, 0],
      ['lineTo', 10, 10],
      ['stroke', '#e53935', 8, 'source-over', 'round', 'round'],
    ]);
  });

  it('continues a stroke in progress from the last drawn point', () => {
    const { context, calls } = fakeContext();
    const stroke = pen([0, 0, 0, 10, 0, 5, 10, 10, 9, 20, 10, 12]);
    expect(renderStroke(context, stroke, 2)).toBe(4);
    expect(calls).toEqual([
      ['beginPath'],
      ['moveTo', 10, 0],
      ['lineTo', 10, 10],
      ['lineTo', 20, 10],
      ['stroke', '#e53935', 8, 'source-over', 'round', 'round'],
    ]);
  });

  it('does nothing when everything is already drawn, or for an empty stroke', () => {
    const { context, calls } = fakeContext();
    expect(renderStroke(context, pen([0, 0, 0, 1, 1, 1]), 2)).toBe(2);
    expect(renderStroke(context, pen([]))).toBe(0);
    expect(calls).toEqual([]);
  });

  it('does not redraw the dot of a one-point stroke already drawn', () => {
    const { context, calls } = fakeContext();
    expect(renderStroke(context, pen([5, 5, 0]), 1)).toBe(1);
    expect(calls).toEqual([]);
  });

  it('erases with destination-out', () => {
    const { context, calls } = fakeContext();
    renderStroke(context, {
      tool: 'eraser',
      color: '#e53935',
      width: 48,
      points: [0, 0, 0, 5, 5, 1],
    });
    expect(calls.at(-1)).toEqual(['stroke', '#000000', 48, 'destination-out', 'round', 'round']);
  });
});

describe('renderDrawing', () => {
  it('clears the page then draws every stroke in order, eraser included', () => {
    const { context, calls } = fakeContext();
    context.globalCompositeOperation = 'destination-out';
    renderDrawing(
      context,
      [pen([1, 1, 0]), { tool: 'eraser', color: '', width: 48, points: [1, 1, 5, 2, 2, 6] }],
      2,
      PAGE_SIZE,
    );
    expect(calls[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    expect(calls[1]).toEqual(['clearRect', 0, 0, PAGE_SIZE, PAGE_SIZE]);
    expect(calls.filter(([name]) => name === 'fill' || name === 'stroke')).toEqual([
      ['fill', '#e53935', 'source-over'],
      ['stroke', '#000000', 48, 'destination-out', 'round', 'round'],
    ]);
  });
});
