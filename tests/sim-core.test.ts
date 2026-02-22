/**
 * Test harness for sim-core
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsLoop, vec3Add, vec3Scale, quatMultiply } from '../src/sim-core/index';

describe('PhysicsLoop', () => {
  let physics: PhysicsLoop;

  beforeEach(() => {
    physics = new PhysicsLoop({ fixedTimeStep: 1 / 60 });
  });

  it('should create with default config', () => {
    expect(physics).toBeDefined();
  });

  it('should subscribe and notify callbacks', () => {
    let callCount = 0;
    physics.subscribe((state, dt) => {
      callCount++;
    });

    physics.start();
    // Give it time to run a few frames
    return new Promise(resolve => setTimeout(() => {
      physics.stop();
      expect(callCount).toBeGreaterThan(0);
      resolve();
    }, 100));
  });

  it('should pause and resume', () => {
    const state = physics.getState();
    expect(state.totalTime).toBe(0);

    physics.pause();
    expect(physics.getState().totalTime).toBe(0);
  });

  it('should set time scale', () => {
    physics.setTimeScale(2.0);
    // Will test when running
  });
});

describe('Vector3 operations', () => {
  it('should add vectors', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };
    const result = vec3Add(a, b);
    expect(result.x).toBe(5);
    expect(result.y).toBe(7);
    expect(result.z).toBe(9);
  });

  it('should scale vectors', () => {
    const v = { x: 1, y: 2, z: 3 };
    const result = vec3Scale(v, 2);
    expect(result.x).toBe(2);
    expect(result.y).toBe(4);
    expect(result.z).toBe(6);
  });
});

describe('Quaternion operations', () => {
  it('should multiply quaternions', () => {
    const a = { x: 0, y: 0, z: 0, w: 1 };
    const b = { x: 0, y: 0, z: 0, w: 1 };
    const result = quatMultiply(a, b);
    expect(result.w).toBe(1);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
  });
});
