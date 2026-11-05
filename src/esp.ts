import { apiAction } from './constructs/api-action.ts';
import { doWhile } from './constructs/do-while.ts';
import { esphomeLists } from './constructs/esphome-lists.ts';
import { globals } from './dsl/global.ts';
import { cpp } from './dsl/cpp.ts';
import { currentScope, device, lambda, secret, type Construct } from './dsl/index.ts';
import * as real from './generated/index.ts';
import type { Actions, Components, Conditions, Domains } from './generated/registry.ts';

/**
 * Everything ESPHome has, as `esp.<domain>.<platform>(...)` and `esp.<component>(...)`.
 * Example: esp.sensor.adc({ pin: 'GPIO34' })
 */
export const esp: Esp = merge(real, handWritten()) as unknown as Esp;

/** Adds an external component's module to `esp`; the module's own register.ts calls it. */
export function registerExternal(module: Record<string, unknown>): void {
  mergeInto(esp as unknown as Record<string, unknown>, module);
}

export type * from './generated/index.ts';

//#region Types

/** Entries written by hand: what the schema can't say, and the DSL's own functions. */
function handWritten() {
  // `esp.api(...)` is the component, and `esp.api.action(...)` adds one of its actions
  const api = Object.assign((...args: Parameters<typeof real.api>) => real.api(...args), {
    action: apiAction,
  });
  // `esp.esphome(...)` is the component, and `esp.esphome.library(...)` adds to one of its lists
  const esphomeBlock = Object.assign(esphome, esphomeLists);
  return {
    global: globals,
    esphome: esphomeBlock,
    device,
    lambda,
    cpp,
    secret,
    api,
    // one entry of the `external_components:` list, which each call adds to
    external_component: real.external_components,
    actions: { doWhile },
  };
}

/** `name` defaults to the device's. */
function esphome(props: Omit<real.Esphome.Props, 'name'> & { name?: string } = {}): real.Esphome {
  let root: Construct = currentScope();
  while (root.scope) root = root.scope;
  return real.esphome({ name: root.localId, ...props });
}

type HandWritten = ReturnType<typeof handWritten>;

/** The interfaces in generated/registry.ts are what external components extend. */
type Esp = Domains &
  Omit<Components, keyof HandWritten | 'external_components'> &
  Omit<HandWritten, 'actions'> & {
    actions: Actions & HandWritten['actions'];
    conditions: Conditions;
  };

function isGroup(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objects merge entry by entry, so `esp.sensor` has the core platforms and the external ones. */
function merge(...modules: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const module of modules) mergeInto(merged, module);
  return merged;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const before = target[key];
    if (!isGroup(value)) target[key] = value;
    else if (isGroup(before)) mergeInto(before, value);
    // a copy, so merging into it later doesn't change the generated module's own object
    else target[key] = merge(value);
  }
}

//#endregion
