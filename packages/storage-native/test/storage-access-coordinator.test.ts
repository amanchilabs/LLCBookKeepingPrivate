import { describe, expect, it, vi } from 'vitest';
import { createDatabaseLease } from '../src/database-lease';
import { StorageAccessCoordinator } from '../src/storage-access-coordinator';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('application-wide storage access coordinator', () => {
  it('rejects database work through a stale lease after its callback ends', async () => {
    const rawDatabase = {
      databasePath: '/synthetic/database.db',
      closeAsync: vi.fn(async () => undefined),
      execAsync: vi.fn(async () => undefined),
      runAsync: vi.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
      getFirstAsync: vi.fn(async () => ({ id: 'record' })),
      getAllAsync: vi.fn(async () => [{ id: 'record' }]),
    };
    const lease = createDatabaseLease(rawDatabase as never);
    const staleReference = lease.database;

    await expect(staleReference.getFirstAsync('SELECT id FROM records')).resolves.toEqual({ id: 'record' });
    await lease.release();
    await expect(staleReference.getFirstAsync('SELECT id FROM records')).rejects.toThrow('lease has ended');
    expect(rawDatabase.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('waits for every started statement before closing its database', async () => {
    const statement = deferred<{ id: string } | null>();
    const rawDatabase = {
      databasePath: '/synthetic/database.db',
      closeAsync: vi.fn(async () => undefined),
      execAsync: vi.fn(async () => undefined),
      runAsync: vi.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
      getFirstAsync: vi.fn(() => statement.promise),
      getAllAsync: vi.fn(async () => [{ id: 'record' }]),
    };
    const lease = createDatabaseLease(rawDatabase as never);
    const query = lease.database.getFirstAsync<{ id: string }>('SELECT id FROM records');
    const closing = lease.release();

    expect(rawDatabase.closeAsync).not.toHaveBeenCalled();
    statement.resolve({ id: 'record' });
    await expect(query).resolves.toEqual({ id: 'record' });
    await closing;
    expect(rawDatabase.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('settles active work, blocks new work through restore, then serves one new generation', async () => {
    const access = new StorageAccessCoordinator({ initiallyReady: true });
    const events: string[] = [];
    let generation = 'original';
    const activeSave = deferred();
    const releaseRestore = deferred();
    const restoreStarted = deferred();

    const saving = access.withOperation(async () => {
      events.push(`save:${generation}:started`);
      await activeSave.promise;
      events.push(`save:${generation}:settled`);
      return generation;
    });

    const restoring = access.withExclusiveTransition(async () => {
      events.push('restore:started');
      restoreStarted.resolve();
      await releaseRestore.promise;
      generation = 'restored';
      events.push('restore:validated');
    });

    const read = access.withOperation(async () => {
      events.push(`read:${generation}`);
      return generation;
    });
    const exported = access.withOperation(async () => {
      events.push(`export:${generation}:attachment-hash`);
      return `${generation}:attachment-hash`;
    });
    const attachment = access.withOperation(async () => {
      events.push(`attachment:${generation}`);
      return generation;
    });
    const nextSave = access.withOperation(async () => {
      events.push(`save:${generation}:after-restore`);
      return generation;
    });

    await Promise.resolve();
    expect(events).toEqual(['save:original:started']);
    activeSave.resolve();
    await restoreStarted.promise;
    expect(events).toEqual(['save:original:started', 'save:original:settled', 'restore:started']);

    releaseRestore.resolve();
    await restoring;
    await expect(Promise.all([saving, read, exported, attachment, nextSave])).resolves.toEqual([
      'original', 'restored', 'restored:attachment-hash', 'restored', 'restored',
    ]);
    expect(events).toEqual([
      'save:original:started',
      'save:original:settled',
      'restore:started',
      'restore:validated',
      'read:restored',
      'export:restored:attachment-hash',
      'attachment:restored',
      'save:restored:after-restore',
    ]);
  });

  it('keeps access locked after failed recovery and permits a validated retry', async () => {
    const access = new StorageAccessCoordinator();
    await expect(access.withOperation(async () => 'must not run')).rejects.toThrow();
    await expect(access.withExclusiveTransition(async () => { throw new Error('candidate invalid'); }))
      .rejects.toThrow('candidate invalid');
    await expect(access.withOperation(async () => 'must not run')).rejects.toThrow();

    await expect(access.withExclusiveTransition(async () => 'verified original')).resolves.toBe('verified original');
    await expect(access.withOperation(async () => 'active generation')).resolves.toBe('active generation');
  });
});
