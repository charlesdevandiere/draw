import { describe, expect, it } from 'vitest';
import { createReplayClock } from './replay-clock';

describe('replay clock', () => {
  it('starts stopped at 0', () => {
    const clock = createReplayClock(1000);
    expect(clock.playing).toBe(false);
    expect(clock.elapsed(500)).toBe(0);
    expect(clock.progress(500)).toBe(0);
    expect(clock.ended(500)).toBe(false);
  });

  it('runs while playing', () => {
    const clock = createReplayClock(1000);
    clock.play(100);
    expect(clock.playing).toBe(true);
    expect(clock.elapsed(350)).toBe(250);
    expect(clock.progress(350)).toBe(0.25);
  });

  it('stops while paused and resumes from the same point', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.pause(300);
    expect(clock.playing).toBe(false);
    expect(clock.elapsed(5000)).toBe(300);
    clock.play(6000);
    expect(clock.elapsed(6100)).toBe(400);
  });

  it('ignores a second play or pause', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.play(200);
    expect(clock.elapsed(300)).toBe(300);
    clock.pause(300);
    clock.pause(800);
    expect(clock.elapsed(900)).toBe(300);
  });

  it('clamps at the duration and ends there', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    expect(clock.elapsed(5000)).toBe(1000);
    expect(clock.progress(5000)).toBe(1);
    expect(clock.ended(999)).toBe(false);
    expect(clock.ended(1000)).toBe(true);
  });

  it('pausing after the end keeps the end', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.pause(3000);
    expect(clock.elapsed(4000)).toBe(1000);
    expect(clock.ended(4000)).toBe(true);
  });

  it('play once ended starts again from 0', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.pause(2000);
    clock.play(3000);
    expect(clock.elapsed(3000)).toBe(0);
    expect(clock.elapsed(3100)).toBe(100);
  });

  it('play while still running past the end starts again from 0', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.play(1500);
    expect(clock.elapsed(1600)).toBe(100);
  });

  it('restart goes back to 0 and plays', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.pause(600);
    clock.restart(700);
    expect(clock.playing).toBe(true);
    expect(clock.elapsed(700)).toBe(0);
    expect(clock.elapsed(750)).toBe(50);
  });

  it('an empty replay is ended at once and its progress is complete', () => {
    const clock = createReplayClock(0);
    clock.play(0);
    expect(clock.ended(0)).toBe(true);
    expect(clock.progress(0)).toBe(1);
  });

  it('never goes backwards when time does', () => {
    const clock = createReplayClock(1000);
    clock.play(500);
    expect(clock.elapsed(400)).toBe(0);
  });

  it('never goes back before the paused point when time does', () => {
    const clock = createReplayClock(1000);
    clock.play(0);
    clock.pause(300);
    clock.play(1000);
    expect(clock.elapsed(900)).toBe(300);
  });
});
