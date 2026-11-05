#!/usr/bin/env node
import process from 'node:process';
import { buildDevice } from './dsl/build.ts';

/**
 * The `esphome-config` command.
 * Example: esphome-config build demo-fan > demo-fan.yaml
 */
async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command !== 'build') throw new Error(USAGE);
  const name = rest.find((arg) => !arg.startsWith('--'));
  if (!name) throw new Error(USAGE);
  const yaml = await buildDevice(name, {
    devicesDir: process.env.ESPHOME_DEVICES,
    secrets: rest.includes('--secrets'),
    localExternals: JSON.parse(process.env.ESPHOME_LOCAL_EXTERNALS ?? '{}'),
  });
  process.stdout.write(yaml);
}

const USAGE = `usage: esphome-config build <device> [--secrets]
  Prints devices/<device>.ts as YAML, or with --secrets a dummy secrets.yaml for it.
  ESPHOME_DEVICES sets the devices directory.`;

await main(process.argv.slice(2));
