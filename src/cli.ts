#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildDevice } from './dsl/build.ts';
import { generate } from './gen/generate.ts';
import { schemaDir } from './gen/schema.ts';

/**
 * The `esphome-config` command.
 * Example: esphome-config build demo-fan > demo-fan.yaml
 */
async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command === 'build') return build(rest);
  if (command === 'generate') return generateCore();
  throw new Error(USAGE);
}

const USAGE = `usage: esphome-config <command>
  build <device> [--secrets]
    Prints devices/<device>.ts as YAML, or with --secrets a dummy secrets.yaml for it.
    ESPHOME_DEVICES sets the devices directory.
  generate
    Writes this package's core types from the pinned ESPHome schema, into src/generated.
    ESPHOME_SCHEMA names a schema directory to use instead of downloading it.`;

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
  await generate({ version, schema: await schemaDir(version), out });
}

/** The ESPHome version in package.json, which the core types are generated for. */
function pinnedVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return manifest.esphome.version;
}

await main(process.argv.slice(2));
