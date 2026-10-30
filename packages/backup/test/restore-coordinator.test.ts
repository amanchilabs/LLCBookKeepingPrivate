import { describe, expect, it } from 'vitest';
import { recoverInterruptedRestore, restoreCandidate, type RestoreStore } from '../src/restore-coordinator';

type Snapshot = { label: string };
type DurableState = {
  active: string;
  generations: Map<string, Snapshot>;
  journal?: { previous: string; candidate: string };
  nextId: number;
};

function makeStore(state: DurableState, crashAt?: string, corruptCandidate = false): RestoreStore<Snapshot> {
  const crash = (name: string) => {
    if (crashAt === name) throw new Error(`simulated process termination at ${name}`);
  };
  return {
    async stageCandidate(snapshot) {
      crash('before-stage');
      const id = `generation-${state.nextId++}`;
      state.generations.set(id, snapshot);
      crash('after-stage');
      return id;
    },
    async getActivation() {
      return {
        activeGeneration: state.active,
        journal: state.journal && {
          previousGeneration: state.journal.previous,
          candidateGeneration: state.journal.candidate,
        },
      };
    },
    async activate(previous, candidate) {
      crash('before-activate');
      if (state.active !== previous || !state.generations.has(candidate)) throw new Error('activation precondition failed');
      state.journal = { previous, candidate };
      state.active = candidate;
      crash('after-activate');
    },
    async verifyGeneration(id) {
      crash('before-verify');
      if (!state.generations.has(id) || (corruptCandidate && id !== 'generation-0')) throw new Error('integrity check failed');
      crash('after-verify');
    },
    async finishActivation() {
      crash('before-finish');
      state.journal = undefined;
      crash('after-finish');
    },
    async rollback(previous) {
      crash('before-rollback');
      if (!state.generations.has(previous)) throw new Error('previous generation is missing');
      state.active = previous;
      state.journal = undefined;
      crash('after-rollback');
    },
    async deleteGeneration(id) {
      crash('before-delete');
      if (id === state.active) throw new Error('refusing to delete active generation');
      state.generations.delete(id);
      crash('after-delete');
    },
  };
}

function initialState(): DurableState {
  return { active: 'generation-0', generations: new Map([['generation-0', { label: 'original' }]]), nextId: 1 };
}

describe('recoverable database restore coordinator', () => {
  it('keeps the current generation until a validated candidate is activated and verified', async () => {
    const state = initialState();
    const result = await restoreCandidate(makeStore(state), { label: 'restored' });
    expect(result).toEqual({ activeGeneration: 'generation-1', removedGeneration: 'generation-0' });
    expect(state.active).toBe('generation-1');
    expect(state.generations).toEqual(new Map([['generation-1', { label: 'restored' }]]));
    expect(state.journal).toBeUndefined();
  });

  it.each(['before-stage', 'after-stage', 'before-activate'])('preserves the original after interruption at %s', async (point) => {
    const state = initialState();
    await expect(restoreCandidate(makeStore(state, point), { label: 'restored' })).rejects.toThrow('simulated process termination');
    await recoverInterruptedRestore(makeStore(state));
    expect(state.active).toBe('generation-0');
    expect(state.generations.get(state.active)).toEqual({ label: 'original' });
  });

  it.each(['after-activate', 'before-verify', 'after-verify', 'before-finish', 'after-finish', 'before-delete', 'after-delete'])(
    'recovers an all-or-nothing generation after interruption at %s',
    async (point) => {
      const state = initialState();
      await expect(restoreCandidate(makeStore(state, point), { label: 'restored' })).rejects.toThrow('simulated process termination');
      await recoverInterruptedRestore(makeStore(state));
      expect(['generation-0', 'generation-1']).toContain(state.active);
      expect(state.generations.get(state.active)).toEqual({ label: state.active === 'generation-0' ? 'original' : 'restored' });
      if (state.journal) await recoverInterruptedRestore(makeStore(state));
      expect(state.journal).toBeUndefined();
    },
  );

  it('rolls back and preserves the original when candidate integrity validation fails on restart', async () => {
    const state = initialState();
    await expect(restoreCandidate(makeStore(state, undefined, true), { label: 'restored' })).rejects.toThrow('integrity check failed');
    expect(state.active).toBe('generation-1');
    await recoverInterruptedRestore(makeStore(state, undefined, true));
    expect(state.active).toBe('generation-0');
    expect(state.generations.get(state.active)).toEqual({ label: 'original' });
    expect(state.journal).toBeUndefined();
  });
});
