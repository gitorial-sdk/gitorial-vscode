import { IStateStorage } from '@domain/ports/IStateStorage';
import { GlobalState, StateDB } from './GlobalState';

export class AuthorManifestState implements IStateStorage {
  private readonly key = 'authorManifestBackup';
  private readonly db: StateDB;

  constructor(globalState: GlobalState) {
    this.db = globalState.getDB(this.key);
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.db.get<T>(`${this.key}_${key}`, defaultValue);
  }
  update<T>(key: string, value: T): Promise<void> {
    return this.db.update(`${this.key}_${key}`, value);
  }
  clear(key: string): Promise<void> {
    return this.db.update(`${this.key}_${key}`, undefined);
  }
  has(key: string): boolean {
    return this.db.has(`${this.key}_${key}`);
  }
}
