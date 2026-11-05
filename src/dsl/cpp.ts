import type { Entity } from './construct.ts';
import type { Global } from './global.ts';

/**
 * A TypeScript function as the C++ of a `!lambda`. Entities and constants it mentions are
 * captured by name, and its own parameters (like `x`) are the trigger's arguments.
 * Example: temp.on_value(cpp((x: number) => { id(tooHot).value = x > 30; }))
 */
export function cpp<Args extends unknown[], Ret>(fn: (...args: Args) => Ret): CppFn<Args, Ret>;
export function cpp(_fn: Fn): unknown {
  throw new Error('cpp() needs the transpiler, which this version of esphome-config lacks');
}

/**
 * An entity's C++ members, inside a `cpp()` body.
 * Example: id(sw).turn_on(), id(temp).state, id(tooHot).value = x > 30
 */
export function id<V>(global: Global<V>): { value: V };
export function id<E extends Entity<any>>(entity: E): CppView<E>;
export function id(_entity: Entity<any>): never {
  return ambient('id');
}

//#region Types

/**
 * A `cpp()` lambda, remembering the arguments its trigger gives it and what it returns.
 * A trigger method that takes `CppFn<[x: number]>` lets TypeScript type the parameters of the
 * function written inside it, and a condition takes only `CppFn<any[], boolean>`.
 * The fields are for the type checker: at runtime it is a `Tagged`.
 */
export interface CppFn<Args extends unknown[] = any[], Ret = unknown> {
  readonly cppArgs: Args;
  readonly cppReturn: Ret;
}

export type Fn = (...args: any[]) => unknown;

/** What the loader read from the file around a `cpp()` call. */
export interface Scan {
  /** The function's free variables, by the name it uses for them. */
  captures: Record<string, unknown>;
  /** The function's text, with the type annotations that `toString()` has lost. */
  source: string;
  /** Names a file gives to types it imports or declares: `import type { u8 as Byte }`. */
  renames: Record<string, string>;
}

/**
 * The members of the C++ classes an entity derives from; the generated `members.ts` fills it in,
 * keyed by C++ class: `'sensor::Sensor': SensorMembers`.
 */
export interface CppClasses {}

export type CppView<E> = E extends { readonly cpp: infer C }
  ? Every<{ [K in keyof C & keyof CppClasses]: CppClasses[K] }[keyof C & keyof CppClasses]>
  : never;

type Every<U> = (U extends unknown ? (u: U) => void : never) extends (all: infer I) => void
  ? I
  : never;
/**
 * C++ types for a local: `const level: u8 = ...` is a `uint8_t`.
 * They are all numbers in TypeScript.
 */
export type u8 = number;
export type u16 = number;
export type u32 = number;
export type i8 = number;
export type i16 = number;
export type i32 = number;
export type f32 = number;

/** ESPHome's own functions, which a body calls by name. */
export const millis = (): number => ambient('millis');
export const micros = (): number => ambient('micros');
export const ESP_LOGD = (tag: string, format: string, ...args: unknown[]): void =>
  ambient('ESP_LOGD', args);
export const ESP_LOGI = (tag: string, format: string, ...args: unknown[]): void =>
  ambient('ESP_LOGI', args);
export const ESP_LOGW = (tag: string, format: string, ...args: unknown[]): void =>
  ambient('ESP_LOGW', args);
export const ESP_LOGE = (tag: string, format: string, ...args: unknown[]): void =>
  ambient('ESP_LOGE', args);

function ambient(name: string, _args?: unknown[]): never {
  throw new Error(`${name}() only exists in the C++ that cpp() writes`);
}

export type { Entity };

//#endregion
