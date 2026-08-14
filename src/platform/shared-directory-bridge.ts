import { Capacitor, registerPlugin } from "@capacitor/core";
import { invoke, isTauri } from "@tauri-apps/api/core";

export interface SharedDirectoryBridge {
  readonly available: boolean;
  getLocation(): Promise<string | null>;
  chooseLocation(): Promise<string | null>;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, data: string): Promise<void>;
}

interface SharedDirectoryPlugin {
  getLocation(): Promise<{ location?: string }>;
  chooseLocation(): Promise<{ location?: string }>;
  listFiles(): Promise<{ files: string[] }>;
  readFile(options: { path: string }): Promise<{ data?: string }>;
  writeFile(options: { path: string; data: string }): Promise<void>;
}

const androidPlugin = registerPlugin<SharedDirectoryPlugin>("SharedDirectory");

function createAndroidBridge(): SharedDirectoryBridge {
  return {
    available: true,
    async getLocation() {
      return (await androidPlugin.getLocation()).location ?? null;
    },
    async chooseLocation() {
      return (await androidPlugin.chooseLocation()).location ?? null;
    },
    async listFiles() {
      return (await androidPlugin.listFiles()).files;
    },
    async readFile(path) {
      return (await androidPlugin.readFile({ path })).data ?? null;
    },
    async writeFile(path, data) {
      await androidPlugin.writeFile({ path, data });
    },
  };
}

function createTauriBridge(): SharedDirectoryBridge {
  return {
    available: true,
    getLocation: () => invoke<string | null>("shared_get_location"),
    chooseLocation: () => invoke<string | null>("shared_choose_location"),
    listFiles: () => invoke<string[]>("shared_list_files"),
    readFile: (path) => invoke<string | null>("shared_read_file", { path }),
    writeFile: (path, data) => invoke("shared_write_file", { path, data }),
  };
}

const unavailableBridge: SharedDirectoryBridge = {
  available: false,
  getLocation: async () => null,
  chooseLocation: async () => null,
  listFiles: async () => [],
  readFile: async () => null,
  writeFile: async () => undefined,
};

export function createPlatformSharedDirectoryBridge(): SharedDirectoryBridge {
  if (Capacitor.getPlatform() === "android") return createAndroidBridge();
  if (isTauri()) return createTauriBridge();
  return unavailableBridge;
}
