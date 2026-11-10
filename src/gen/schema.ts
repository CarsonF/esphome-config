import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * The directory of ESPHome's language schema: `ESPHOME_SCHEMA` if set,
 * else the copy the package ships, which its core types were generated from.
 */
export function schemaDir(): string {
  const dir = process.env.ESPHOME_SCHEMA ?? PACKAGED;
  if (!existsSync(join(dir, 'esphome.json'))) {
    throw new Error(
      `no ESPHome schema in ${dir}: set ESPHOME_SCHEMA, as \`nix develop\` does, ` +
        'to `nix build .#schema`',
    );
  }
  return dir;
}

/** `$XDG_CACHE_HOME/esphome-config`, for downloads. */
export function cacheRoot(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'esphome-config');
}

/** Written beside the core types by `generate`. */
const PACKAGED = fileURLToPath(new URL('../generated/schema', import.meta.url));
