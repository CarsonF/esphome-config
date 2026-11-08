import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generate, type ExternalSource } from './generate.ts';
import { cacheRoot, schemaDir } from './schema.ts';

/**
 * Writes the types of external components into `out`: their schema is dumped by the ESPHome
 * on PATH, which must be the version the package's types are for.
 * Each source also gets an `esp.external.<name>()` that adds its `external_components` entry.
 * Example: await generateExternal({ version, sources: [{ source: 'github://o/r@v1' }], out })
 */
export async function generateExternal(options: ExternalOptions): Promise<void> {
  const { version, out, fromDump } = options;
  const sources = options.sources.map(resolveSource);
  checkNames(sources);
  const external = fromDump ?? (await dumpSchema(version, sources.map((source) => source.dir)));
  try {
    await generate({ version, schema: await schemaDir(version), out, external, sources });
  } finally {
    if (!fromDump) rmSync(external, { recursive: true, force: true });
  }
}

export interface ExternalOptions {
  /** The ESPHome version of the package's core types. */
  version: string;
  sources: SourceSpec[];
  out: string;
  /** A schema dump to read instead of running ESPHome, one `<component>.json` each. */
  fromDump?: string;
}

/** Example: { source: 'github://example/fixture@main', path: 'test/external-fixture' } */
export interface SourceSpec {
  /** `github://<owner>/<repo>@<ref>`, as `external_components` takes it, or a local directory. */
  source: string;
  /** The source's files, to read instead of fetching it. */
  path?: string;
  /** Its `esp.external.<name>()`; the repo's or directory's name if omitted. */
  name?: string;
}

//#region Sources

interface Resolved extends ExternalSource {
  /** The directory with one subdirectory per component. */
  dir: string;
}

function resolveSource(spec: SourceSpec): Resolved {
  const github = GITHUB.exec(spec.source);
  const dir = componentsDir(spec.path ?? spec.source);
  const name = spec.name ?? identifierOf(github ? github[2] : basename(resolve(spec.source)));
  if (!IDENTIFIER.test(name)) {
    throw new Error(`external component source ${spec.source}: "${name}" is not a valid name`);
  }
  const components = readdirSync(dir)
    .filter((entry) => existsSync(join(dir, entry, '__init__.py')))
    .sort();
  if (components.length === 0) throw new Error(`${spec.source} has no components in ${dir}`);
  // a local directory is a `type: local` source, which ESPHome reads by path
  const source = github ? spec.source : { type: 'local' as const, path: dir };
  return { name, source, components, dir };
}

/** Two sources can't share an `esp.external.<name>()`. */
function checkNames(sources: Resolved[]): void {
  for (const [name, same] of Map.groupBy(sources, (source) => source.name)) {
    if (same.length < 2) continue;
    const listed = same.map(({ source }) => JSON.stringify(source)).join(' and ');
    throw new Error(
      `two external component sources are named "${name}": ${listed}; ` +
        'give one another name (--name after it, or `name` in Nix)',
    );
  }
}

const GITHUB = /^github:\/\/([^/]+)\/([^/@]+)(?:@(.+))?$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `Roode` is `roode`, `esphome-components` is `esphome_components`. */
const identifierOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[_0-9]+|_+$/g, '');

/** The directory with one subdirectory per component, cloning a GitHub source first. */
function componentsDir(source: string): string {
  const github = GITHUB.exec(source);
  const root = github ? clone(github[1], github[2], github[3] ?? 'HEAD') : resolve(source);
  if (!existsSync(root)) throw new Error(`external component source ${source} does not exist`);
  return existsSync(join(root, 'components')) ? join(root, 'components') : root;
}

/** A commit is cached; a branch or tag is fetched again each time. */
function clone(owner: string, repo: string, ref: string): string {
  const dir = join(cacheRoot(), 'externals', owner, `${repo}@${ref}`);
  if (/^[0-9a-f]{40}$/.test(ref) && existsSync(join(dir, '.git'))) return dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  process.stderr.write(`fetching github://${owner}/${repo}@${ref}\n`);
  git('init', '--quiet');
  git('fetch', '--quiet', '--depth=1', `https://github.com/${owner}/${repo}.git`, ref);
  git('checkout', '--quiet', 'FETCH_HEAD');
  return dir;
}

//#endregion

//#region Schema dump

/** ESPHome's own schema script, run over each directory; returns the dump's directory. */
async function dumpSchema(version: string, dirs: string[]): Promise<string> {
  const python = esphomePython(version);
  const script = await schemaScript(version);
  const dump = mkdtempSync(join(tmpdir(), 'esphome-config-dump-'));
  for (const dir of dirs) {
    const all = mkdtempSync(join(tmpdir(), 'esphome-config-all-'));
    // no __pycache__ in the component sources, which may be read-only
    const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
    const run = spawnSync(python, [DUMP_SCRIPT, script, dir, all], { encoding: 'utf8', env });
    if (run.status !== 0) throw new Error(`dumping the schema of ${dir} failed:\n${run.stderr}`);
    for (const component of readdirSync(dir)) {
      const file = join(all, `${component}.json`);
      if (existsSync(file)) copyFileSync(file, join(dump, `${component}.json`));
    }
    rmSync(all, { recursive: true, force: true });
  }
  return dump;
}

const DUMP_SCRIPT = fileURLToPath(new URL('dump-external.py', import.meta.url));

/**
 * The Python that runs ESPHome: `ESPHOME_PYTHON`, else the `esphome` command's interpreter,
 * else `python3`.
 */
function esphomePython(version: string): string {
  const python = process.env.ESPHOME_PYTHON ?? interpreterOf('esphome') ?? 'python3';
  const found = spawnSync(python, ['-c', 'import esphome.const as c; print(c.__version__)'], {
    encoding: 'utf8',
  });
  if (found.status !== 0) {
    throw new Error(
      `${python} cannot import esphome: install ESPHome ${version}, ` +
        'or set ESPHOME_PYTHON to the Python that runs it',
    );
  }
  const actual = found.stdout.trim();
  if (series(actual) !== series(version)) {
    throw new Error(
      `found ESPHome ${actual}, but esphome-config's types are for ESPHome ${version}: ` +
        `install ESPHome ${series(version)}.x, or esphome-config ${series(actual)}.x`,
    );
  }
  // a patch release rarely changes the schema
  if (actual !== version) {
    process.stderr.write(`warning: found ESPHome ${actual}; the types are for ${version}\n`);
  }
  return python;
}

/** `2026.9` for `2026.9.1`: the ESPHome release a version of this package follows. */
const series = (version: string): string => version.split('.').slice(0, 2).join('.');

/** The interpreter in a command's `#!` line, if it is a Python. */
function interpreterOf(command: string): string | undefined {
  const path = (process.env.PATH ?? '')
    .split(delimiter)
    .map((dir) => join(dir, command))
    .find((candidate) => existsSync(candidate));
  const shebang = path && /^#!\s*(.+)/.exec(readFileSync(path, 'utf8').split('\n', 1)[0]);
  if (!shebang) return undefined;
  const words = shebang[1].trim().split(/\s+/);
  // `#!/usr/bin/env python3`
  const interpreter = words[0].endsWith('/env') ? words[1] : words[0];
  return interpreter && /python/.test(interpreter) ? interpreter : undefined;
}

const RAW = 'https://raw.githubusercontent.com/esphome/esphome';

/** ESPHome's `script/build_language_schema.py`: `ESPHOME_SCHEMA_SCRIPT`, else downloaded. */
async function schemaScript(version: string): Promise<string> {
  const given = process.env.ESPHOME_SCHEMA_SCRIPT;
  if (given) return given;
  const file = join(cacheRoot(), `build_language_schema-${version}.py`);
  if (existsSync(file)) return file;
  const url = `${RAW}/${version}/script/build_language_schema.py`;
  process.stderr.write(`downloading ${url}\n`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not download ${url}: HTTP ${response.status}`);
  const source = await response.text();
  mkdirSync(cacheRoot(), { recursive: true });
  writeFileSync(file, source);
  return file;
}

//#endregion
