import type * as SQLite from 'expo-sqlite';

export interface DatabaseLease {
  readonly databasePath: string;
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLite.SQLiteVariadicBindParams): Promise<SQLite.SQLiteRunResult>;
  getFirstAsync<T>(source: string, ...params: SQLite.SQLiteVariadicBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SQLite.SQLiteVariadicBindParams): Promise<T[]>;
}

export interface ReleasableDatabaseLease {
  database: DatabaseLease;
  release(): Promise<void>;
}

/** Hide the raw SQLite handle, wait for started statements, and reject stale use. */
export function createDatabaseLease(database: SQLite.SQLiteDatabase): ReleasableDatabaseLease {
  let acceptingStatements = true;
  let released = false;
  const pending = new Set<Promise<unknown>>();

  const execute = <T>(statement: () => Promise<T>): Promise<T> => {
    if (!acceptingStatements) return Promise.reject(new Error('The database lease has ended.'));
    const result = Promise.resolve().then(statement);
    pending.add(result);
    void result.then(() => pending.delete(result), () => pending.delete(result));
    return result;
  };

  const lease: DatabaseLease = {
    databasePath: database.databasePath,
    execAsync: (source) => execute(() => database.execAsync(source)),
    runAsync: (source, ...params) => execute(() => database.runAsync(source, ...params)),
    getFirstAsync: <T>(source: string, ...params: SQLite.SQLiteVariadicBindParams) =>
      execute(() => database.getFirstAsync<T>(source, ...params)),
    getAllAsync: <T>(source: string, ...params: SQLite.SQLiteVariadicBindParams) =>
      execute(() => database.getAllAsync<T>(source, ...params)),
  };

  return {
    database: lease,
    async release(): Promise<void> {
      if (released) return;
      acceptingStatements = false;
      while (pending.size > 0) await Promise.allSettled([...pending]);
      released = true;
      await database.closeAsync();
    },
  };
}
