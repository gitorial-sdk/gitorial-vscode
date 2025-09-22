import { DiffFilePayload } from '@ui/ports/IGitChanges';

/**
 * Fluent API for filtering diff files based on various criteria.
 * Chain methods and call filter() to apply all predicates.
 */
export class Filter {
  private payload: DiffFilePayload[];
  private predicates: Array<(item: DiffFilePayload) => boolean> = [];

  constructor(payload: DiffFilePayload[]) {
    this.payload = payload;
  }

  private readonly README_FILE = 'readme.md';

  private readonly EDUCATIONAL_PATTERNS = [
    /TODO:/i,
    /FIXME:/i,
    /unimplemented!\(\)/,
    /todo!\(\)/,
    /\?\?\?/,
    /\/\*\s*.*implement.*\*\//i,
  ];

  private readonly NOISE_FILES = [
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /Cargo\.lock$/,
    /\.DS_Store$/,
    /node_modules/,
    /target\/debug/,
    /target\/release/,
    /\.git\//,
    /\.vscode\//,
    /\.idea\//,
    /dist\//,
    /build\//,
  ];

  /** Add custom filter predicate */
  public where(predicate: (item: DiffFilePayload) => boolean): Filter {
    this.predicates.push(predicate);
    return this;
  }

  /** Remove build artifacts and noise files */
  public removeBuildArtifacts(): Filter {
    return this.where(item => !this._isNoiseFile(item.relativeFilePath));
  }

  /** Keep only files with educational content (TODO, FIXME, etc.) */
  public keepOnlyLearningMarkers(): Filter {
    return this.where(
      item =>
        Boolean(item.originalContent && this._hasEducationalContent(item.originalContent)) ||
        Boolean(item.modifiedContent && this._hasEducationalContent(item.modifiedContent))
    );
  }

  /** Remove README files */
  public removeRootReadmeFile(): Filter {
    return this.where(item => item.relativeFilePath.toLowerCase() !== this.README_FILE);
  }

  /** Execute all filters and return filtered results */
  public filter(): DiffFilePayload[] {
    return this.payload.filter(item => this.predicates.every(predicate => predicate(item)));
  }

  private _hasEducationalContent(content: string): boolean {
    return this.EDUCATIONAL_PATTERNS.some(pattern => pattern.test(content));
  }

  private _isNoiseFile(filePath: string): boolean {
    return this.NOISE_FILES.some(pattern => pattern.test(filePath));
  }
}
