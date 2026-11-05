import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { Root } from './root.ts';

/**
 * A device's YAML, or with `secrets` a dummy secrets.yaml for it.
 * Example: await buildDevice('demo-fan') reads devices/demo-fan.ts
 */
export async function buildDevice(name: string, options: BuildOptions = {}): Promise<string> {
  // the project's external component types, which add themselves to `esp`
  const external = resolve(process.cwd(), 'generated/external/register.ts');
  if (existsSync(external)) await import(pathToFileURL(external).href);
  const device = await loadDevice(name, options.devicesDir ?? 'devices');
  if (options.secrets) {
    return device
      .secretNames()
      .map((key) => `${key}: dummy-${key}\n`)
      .join('');
  }
  return device.toYaml({ localExternals: options.localExternals });
}

export interface BuildOptions {
  /** Relative to the working directory. */
  devicesDir?: string;
  secrets?: boolean;
  /** Maps an `external_components` source to a directory, to validate offline. */
  localExternals?: Record<string, string>;
}

/** `<dir>/<name>.ts` or `<dir>/<name>/index.ts`. */
async function loadDevice(name: string, dir: string): Promise<Root> {
  const base = resolve(process.cwd(), dir, name);
  const file = [`${base}.ts`, `${base}/index.ts`].find((path) => existsSync(path));
  if (!file) {
    throw new Error(`no device ${name}: expected ${dir}/${name}.ts or ${dir}/${name}/index.ts`);
  }
  const { default: exported } = (await import(pathToFileURL(file).href)) as {
    default?: Root | Promise<Root>;
  };
  if (!exported) throw new Error(`${file} has no default export: export default device(...)`);
  return await exported;
}
