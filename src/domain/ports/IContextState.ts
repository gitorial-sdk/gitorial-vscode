export interface IContextState {
  setContext(key: string, value: any): Promise<void>;
}
