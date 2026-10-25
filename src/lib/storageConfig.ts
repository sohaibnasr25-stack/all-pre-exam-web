import fs from 'fs';
import path from 'path';

export type StorageMode = 'auto' | 'local_only';

export interface StorageConfigFile {
  mode: StorageMode;
  auto_sync_enabled: boolean;
  last_synced_at?: string;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'storage_config.json');

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getStorageConfig(): StorageConfigFile {
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultCfg: StorageConfigFile = {
        mode: 'auto',
        auto_sync_enabled: true,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultCfg, null, 2), 'utf-8');
      return defaultCfg;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(content) as StorageConfigFile;
    return {
      mode: parsed.mode === 'local_only' ? 'local_only' : 'auto',
      auto_sync_enabled: parsed.auto_sync_enabled !== false,
      last_synced_at: parsed.last_synced_at || undefined,
      updated_at: parsed.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[StorageConfig] Error reading storage config, defaulting:', err);
    return {
      mode: 'auto',
      auto_sync_enabled: true,
      updated_at: new Date().toISOString(),
    };
  }
}

export function getStorageMode(): StorageMode {
  return getStorageConfig().mode;
}

export function setStorageMode(mode: StorageMode): StorageMode {
  try {
    ensureDataDir();
    const curr = getStorageConfig();
    const config: StorageConfigFile = {
      ...curr,
      mode,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return mode;
  } catch (err) {
    console.error('[StorageConfig] Error saving storage mode:', err);
    return mode;
  }
}

export function recordLastSync(timestamp = new Date().toISOString()): void {
  try {
    ensureDataDir();
    const curr = getStorageConfig();
    const config: StorageConfigFile = {
      ...curr,
      last_synced_at: timestamp,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[StorageConfig] Error recording last sync:', err);
  }
}
