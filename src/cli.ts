#!/usr/bin/env node
import { cpSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildDevice } from './dsl/build.ts';
import { generateExternal, type SourceSpec } from './gen/external.ts';
import { generate } from './gen/generate.ts';
import { schemaDir } from './gen/schema.ts';

/**
 * The `esphome-config` command.
 * Example: esphome-config build demo-fan > demo-fan.yaml
 */
async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command === 'build') return build(rest);
  if (command === 'generate') return oneLineErrors(generateCore);
  if (command === 'generate-external') return oneLineErrors(() => generateExternalTypes(rest));
  throw new Error(USAGE);
}

/** A device's error keeps its trace, but a generator's is the message alone. */
async function oneLineErrors(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`esphome-config: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

const USAGE = `usage: esphome-config <command>
  build <device> [--secrets]
    Prints devices/<device>.ts as YAML, or with --secrets a dummy secrets.yaml for it.
    ESPHOME_DEVICES sets the devices directory.
  generate
    Writes this package's core types from ESPHome's schema, into src/generated.
    ESPHOME_SCHEMA names the schema directory: \`nix develop\` sets it to \`nix build .#schema\`.
  generate-external <source> [--path <dir>] [--name <name>]... [--out <dir>]
    Writes the types of external components into generated/external, or --out,
    and esp.external.<name>() for each source, which adds its external_components entry.
    A source is github://<owner>/<repo>@<ref>, as in external_components, or a local directory.
    --path reads the source's files from <dir> instead of fetching them;
    --name names its esp.external.<name>(), else it is the repo's or directory's name.
    Needs the ESPHome the types are for: the \`esphome\` command's Python, or ESPHOME_PYTHON.
    --from-dump <dir> reads a schema dump of the components instead of running ESPHome.`;

async function build(args: string[]): Promise<void> {
  const name = args.find((arg) => !arg.startsWith('--'));
  if (!name) throw new Error(USAGE);
  const yaml = await buildDevice(name, {
    devicesDir: process.env.ESPHOME_DEVICES,
    secrets: args.includes('--secrets'),
    localExternals: JSON.parse(process.env.ESPHOME_LOCAL_EXTERNALS ?? '{}'),
  });
  process.stdout.write(yaml);
}

async function generateCore(): Promise<void> {
  const version = pinnedVersion();
  const out = fileURLToPath(new URL('generated', import.meta.url));
  const schema = schemaDir();
  await generate({ version, schema, out });
  // shipped beside the types, for generating external components' types
  cpSync(schema, join(out, 'schema'), { recursive: true });
}

async function generateExternalTypes(args: string[]): Promise<void> {
  const sources: SourceSpec[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const [arg, value] = [args[i], args[i + 1]];
    if (!arg.startsWith('--')) sources.push({ source: arg });
    // `--path` and `--name` belong to the source before them
    else if (arg === '--path' || arg === '--name') {
      const current = sources.at(-1);
      if (!current || value === undefined) throw new Error(`${arg} follows a source: ${USAGE}`);
      current[arg === '--path' ? 'path' : 'name'] = value;
      i++;
    } else {
      flags[arg] = value;
      i++;
    }
  }
  if (sources.length === 0) throw new Error(USAGE);
  const out = resolve(flags['--out'] ?? 'generated/external');
  const fromDump = flags['--from-dump'];
  await generateExternal({ version: pinnedVersion(), sources, out, fromDump });
}

/** The ESPHome version in package.json, which the core types are generated for. */
function pinnedVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return manifest.esphome.version;
}

await main(process.argv.slice(2));
