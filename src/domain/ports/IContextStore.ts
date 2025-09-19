export interface IContextStore {
    setContext(key: string, value: any): Promise<void>;
}
