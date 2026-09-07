export interface DesktopSyncResult {
  ok: boolean;
  json?: string;
  reason?: string;
  path?: string;
  modifiedAt?: number;
}

export interface DesktopSyncApi {
  getStatus(): Promise<DesktopSyncResult>;
  exportNow(json: string): Promise<DesktopSyncResult>;
  importNow(): Promise<DesktopSyncResult>;
  onRemoteUpdate(callback: (result: DesktopSyncResult) => void): () => void;
}

declare global {
  interface Window {
    zenchadDesktopSync?: DesktopSyncApi;
  }
}

export {};
