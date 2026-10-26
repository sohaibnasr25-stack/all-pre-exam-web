import fs from 'fs';
import path from 'path';
import os from 'os';

export type StorageMode = 'auto' | 'local_only';

export interface StorageConfigFile {
  mode: StorageMode;
  auto_sync_enabled: boolean;
  last_synced_at?: string;
  updated_at: string;
}

let inMemoryConfig: StorageConfigFile | null = null;

function getConfigPaths() {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );
  const activeDir = isServerless ? path.join(os.tmpdir(), 'omnimed_data') : path.join(process.cwd(), 'data');
  const activeFile = path.join(activeDir, 'storage_config.json');
  const bundledFile = path.join(process.cwd(), 'data', 'storage_config.json');
  return { isServerless, activeDir, activeFile, bundledFile };
}

// Safely ensure data directory exists without crashing on read-only systems
function ensureDataDir(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

export function getStorageConfig(): StorageConfigFile {
  if (inMemoryConfig) {
    return inMemoryConfig;
  }

  const { activeDir, activeFile, bundledFile } = getConfigPaths();

  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ activeFile)) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ activeFile, 'utf-8');
      const parsed = JSON.parse(content) as StorageConfigFile;
      inMemoryConfig = {
        mode: parsed.mode === 'local_only' ? 'local_only' : 'auto',
        auto_sync_enabled: parsed.auto_sync_enabled !== false,
        last_synced_at: parsed.last_synced_at || undefined,
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
      return inMemoryConfig;
    }

    if (fs.existsSync(/*turbopackIgnore: true*/ bundledFile)) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ bundledFile, 'utf-8');
      const parsed = JSON.parse(content) as StorageConfigFile;
      inMemoryConfig = {
        mode: parsed.mode === 'local_only' ? 'local_only' : 'auto',
        auto_sync_enabled: parsed.auto_sync_enabled !== false,
        last_synced_at: parsed.last_synced_at || undefined,
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
      return inMemoryConfig;
    }

    // Default configuration
    const defaultCfg: StorageConfigFile = {
      mode: 'auto',
      auto_sync_enabled: true,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryConfig = defaultCfg;

    if (ensureDataDir(activeDir)) {
      try {
        fs.writeFileSync(activeFile, JSON.stringify(defaultCfg, null, 2), 'utf-8');
      } catch {}
    }

    return defaultCfg;
  } catch (err) {
    console.warn('[StorageConfig] Error reading storage config, defaulting:', err);
    inMemoryConfig = {
      mode: 'auto',
      auto_sync_enabled: true,
      updated_at: new Date().toISOString(),
    };
    return inMemoryConfig;
  }
}

export function getStorageMode(): StorageMode {
  return getStorageConfig().mode;
}

export function setStorageMode(mode: StorageMode): StorageMode {
  const curr = getStorageConfig();
  const config: StorageConfigFile = {
    ...curr,
    mode,
    updated_at: new Date().toISOString(),
  };
  inMemoryConfig = config;

  const { activeDir, activeFile } = getConfigPaths();
  try {
    if (ensureDataDir(activeDir)) {
      fs.writeFileSync(activeFile, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[StorageConfig] Note: Running on read-only serverless filesystem, saved mode in-memory.');
  }

  return mode;
}

export function recordLastSync(timestamp = new Date().toISOString()): void {
  const curr = getStorageConfig();
  const config: StorageConfigFile = {
    ...curr,
    last_synced_at: timestamp,
    updated_at: new Date().toISOString(),
  };
  inMemoryConfig = config;

  const { activeDir, activeFile } = getConfigPaths();
  try {
    if (ensureDataDir(activeDir)) {
      fs.writeFileSync(activeFile, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[StorageConfig] Note: Running on read-only serverless filesystem, recorded sync in-memory.');
  }
}
