import { describe, expect, it } from 'vitest';
import { openOnlyAfterCipherProbe } from '../src/fail-closed-open';

describe('fail-closed SQLCipher opening', () => {
  it('rejects a build without SQLCipher before opening a persistent database path', async () => {
    let persistentOpenCount = 0;
    let memoryProbeClosed = false;
    await expect(openOnlyAfterCipherProbe(
      async () => ({ closeAsync: async () => { memoryProbeClosed = true; } }),
      async () => false,
      async () => { persistentOpenCount += 1; return {}; },
    )).rejects.toThrow('Refusing to open persistent financial storage');
    expect(memoryProbeClosed).toBe(true);
    expect(persistentOpenCount).toBe(0);
  });

  it('opens persistent storage only after the in-memory SQLCipher probe succeeds', async () => {
    const order: string[] = [];
    const result = await openOnlyAfterCipherProbe(
      async () => ({ closeAsync: async () => { order.push('close-memory'); } }),
      async () => { order.push('check-cipher'); return true; },
      async () => { order.push('open-persistent'); return 'encrypted-db'; },
    );
    expect(result).toBe('encrypted-db');
    expect(order).toEqual(['check-cipher', 'close-memory', 'open-persistent']);
  });
});
