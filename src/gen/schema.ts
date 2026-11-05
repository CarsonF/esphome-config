import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { unzipSync } from 'fflate';

/**
 * A directory with the esphome-schema release for `version`:
 * `ESPHOME_SCHEMA` if set, else a download cached under `~/.cache/esphome-config`.
 */
export async function schemaDir(version: string): Promise<string> {
  const given = process.env.ESPHOME_SCHEMA;
  if (given) return given;
  const dir = join(cacheRoot(), `schema-${version}`);
  if (existsSync(join(dir, 'esphome.json'))) return dir;
  const url = `https://github.com/esphome/esphome-schema/releases/download/${version}/schema.zip`;
  process.stderr.write(`downloading the ESPHome ${version} schema from ${url}\n`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not download the ESPHome ${version} schema: HTTP ${response.status}`);
  }
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  // renamed into place once complete, so an interrupted download leaves no partial schema
  const partial = `${dir}.partial`;
  rmSync(partial, { recursive: true, force: true });
  mkdirSync(partial, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const file = name.replace(/^schema\//, '');
    if (file.endsWith('.json') && !file.includes('/')) writeFileSync(join(partial, file), data);
  }
  rmSync(dir, { recursive: true, force: true });
  renameSync(partial, dir);
  return dir;
}

/** `$XDG_CACHE_HOME/esphome-config`, for downloads. */
export function cacheRoot(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'esphome-config');
}
