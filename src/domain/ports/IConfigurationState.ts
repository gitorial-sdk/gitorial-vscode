export interface IConfigurationState {
    get<T>(key: string, defaultValue: T): T;
    update<T>(key: string, value: T): Promise<void>;
    onDidChange(callback: (event: { affectsConfiguration: (section: string) => boolean }) => void): void;
}
