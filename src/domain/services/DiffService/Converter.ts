import { DiffChangeType, DiffModel } from '@domain/models/DiffModel';
import { DiffFilePayload } from '@ui/ports/IGitChanges';

/**
 * Converts DiffFilePayload to DiffModel with type-safe overloads.
 * Preserves input type: single → single, array → array.
 */
export class Converter {
  /** Type-safe conversion with overloads */
  public static convert(payload: DiffFilePayload[]): DiffModel[];
  public static convert(payload: DiffFilePayload): DiffModel;
  public static convert(payload: DiffFilePayload | DiffFilePayload[]): DiffModel | DiffModel[] {
    if (Array.isArray(payload)) {
      return payload.map(p => this._convertSingle(p));
    } else {
      return this._convertSingle(payload);
    }
  }

  private static _convertSingle(payload: DiffFilePayload): DiffModel {
    const changeType = payload.isNew
      ? DiffChangeType.ADDED
      : payload.isDeleted
        ? DiffChangeType.DELETED
        : DiffChangeType.MODIFIED;

    return new DiffModel(payload.relativeFilePath, payload.absoluteFilePath, payload.commitHash, changeType, false);
  }
}
