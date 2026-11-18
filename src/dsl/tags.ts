import type { RequireAtLeastOne, RequireExactlyOne } from 'type-fest';
import type { CppFn } from './cpp.ts';
import { Construct } from './construct.ts';

export type Config = Record<string, unknown>;
export type Action = Tagged | Config | CppFn<any, unknown>;
/** An action as given: an `Action`, or a function building actions when the YAML renders. */
export type AnyAction = Action | LazyAction;
export type LazyAction = Thunk<Many<AnyAction>>;
/** A function that builds `T` later. */
// an interface, so a recursive type can include it
export interface Thunk<T> {
  (): T;
}
/** A `cpp()` lambda here has to return a boolean; the `lambda` tag is not checked. */
export type Condition = Tagged | Config | CppFn<any, boolean>;
/** A computed value: a `!lambda`, or a `cpp()` function returning what the field takes. */
export type Lambda<Ret = unknown> = Tagged | CppFn<any, Ret>;
/** One item, or any nesting of arrays of them. */
export type Many<T> = T | readonly Many<T>[];
/**
 * A trigger's argument: the actions, or `{ then, ...options }` when it has options.
 * `Args` are what it hands a `cpp()` function, e.g. `[x: number]`.
 * Example: Trigger<{ above?: number }> is `[...]` or `{ above: 30, then: [...] }`
 */
export type Trigger<
  Options extends object = never,
  Args extends unknown[] = any,
  AtLeastOne extends keyof Options = never,
> =
  | Many<TriggerAction<Args>>
  | ([Options] extends [never] ? never : TriggerWith<Options, Args, AtLeastOne>);
/**
 * A trigger that can't do without its options, e.g. `timing` of `on_multi_click`.
 * `AtLeastOne` are options of which one has to be given, e.g. `above` and `below`.
 */
export type TriggerWith<
  Options extends object,
  Args extends unknown[] = any,
  AtLeastOne extends keyof Options = never,
> = ([AtLeastOne] extends [never]
  ? Omit<Options, 'then'>
  : RequireAtLeastOne<Omit<Options, 'then'>, Extract<AtLeastOne, keyof Omit<Options, 'then'>>>) & {
  then: Many<TriggerAction<Args>>;
};
/** An action of a trigger, where a `cpp()` function takes `Args` if they're known. */
export type TriggerAction<Args extends unknown[] = any> =
  | Config
  | Tagged
  | CppFn<Args, unknown>
  | LazyAction;
/** Props of which some must be given, e.g. `{ atLeast: 'heat_output' | 'cool_output' }`. */
export type OneOfRule = { atLeast: PropertyKey } | { exactly: PropertyKey };
/**
 * `Props` where the `Rule` holds: `{ atLeast: K }` needs one or more of `K`, `{ exactly: K }` one.
 */
export type Constrain<Props extends object, Rule extends OneOfRule = never> = [Rule] extends [never]
  ? Props
  : Rule extends { atLeast: infer K extends keyof Props }
    ? RequireAtLeastOne<Props, K>
    : Rule extends { exactly: infer K extends keyof Props }
      ? RequireExactlyOne<Props, K>
      : Props;
/** A field the schema doesn't type: any YAML. */
export type Any = Value | Config | Any[];
/**
 * A time period: `120ms`, `1.5 seconds`, `01:30` (hours:minutes), `{ minutes: 5 }`, or `never`.
 * A bare number is milliseconds, which most fields take, though some reject it.
 */
export type Time = TimeString | TimeObject | number | 'never';
/** Like `433.9MHz` or `38k`; a bare number is hertz. */
export type Frequency = `${number}${Space}${'' | 'k' | 'M' | 'G'}${'Hz' | 'HZ' | 'hz' | ''}`;
/** Like `100%`; a bare number is a fraction from 0 to 1. */
export type Percent = `${number}%`;

type TimeString =
  `${number}${Space}${TimeUnit}` | `${number}:${number}` | `${number}:${number}:${number}`;
type TimeUnit =
  | 'ns'
  | 'nanoseconds'
  | 'us'
  | 'µs'
  | 'microseconds'
  | 'ms'
  | 'milliseconds'
  | 's'
  | 'sec'
  | 'seconds'
  | 'min'
  | 'minutes'
  | 'h'
  | 'hours'
  | 'd'
  | 'days';
type TimeObject = {
  [Unit in 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds' | 'microseconds']?: number;
};
type Space = '' | ' ';

/** A field ESPHome lets you template: a literal, or a `!lambda` or `!secret`. */
export type Value = string | number | boolean | Lambda;

/** A YAML tag on a scalar: `new Tagged('secret', 'wifi_ssid')` renders `!secret wifi_ssid`. */
export class Tagged {
  readonly tag: string;
  readonly value: string;
  /** Entities the value names, e.g. through `${tooHot}` in a lambda; they need an id printed. */
  readonly refs: readonly unknown[];

  constructor(tag: string, value: string, refs: readonly unknown[] = []) {
    this.tag = tag;
    this.value = value;
    this.refs = refs;
  }
}

/**
 * C++ for `!lambda`, where an entity interpolates as `id(<id>)`.
 * Example: lambda`${tooHot} = x > 30.0;` => `!lambda id(too_hot) = x > 30.0;`
 */
export function lambda(strings: TemplateStringsArray, ...values: unknown[]): Tagged {
  const code = strings.reduce(
    (out, text, i) => out + text + (i < values.length ? interpolate(values[i]) : ''),
    '',
  );
  return new Tagged('lambda', dedent(code), values.filter(isIdentified));
}

export function flat<T>(items: readonly Many<T>[]): T[] {
  return items.flatMap((item) => (Array.isArray(item) ? flat(item) : [item as T]));
}

/** A bare lambda is a condition too: `condition: lambda: !lambda ...`. */
export const toCondition = (condition: Condition): Config =>
  condition instanceof Tagged ? { lambda: condition } : (condition as Config);

/** Props with the `actions` keys flattened to lists, and the `conditions` keys as conditions. */
export function withActions<P extends object | undefined>(
  props: P,
  actions: readonly string[],
  conditions: readonly string[] = [],
): P {
  if (!props) return props;
  const out: Record<string, unknown> = { ...props };
  for (const key of actions) {
    if (out[key] !== undefined) out[key] = flat([out[key] as Many<AnyAction>]);
  }
  for (const key of conditions) {
    if (out[key] !== undefined) out[key] = toCondition(out[key] as Condition);
  }
  return out as P;
}

/** An untagged string that names entities, like a `logger.log` arg `id(too_hot)`. */
export const plain = (value: string, ...refs: unknown[]): Tagged => new Tagged('', value, refs);

export const secret = (key: string): Tagged => new Tagged('secret', key);

//#region Helpers

function isIdentified(value: unknown): boolean {
  return typeof (value as { id?: unknown })?.id === 'string';
}

function interpolate(value: unknown): string {
  // duck-typed so tags.ts doesn't import entities.ts, which imports it
  const id = (value as { id?: unknown })?.id;
  return typeof id === 'string' ? `id(${id})` : String(value);
}

function dedent(code: string): string {
  const lines = code.split('\n');
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)![0].length);
  const strip = Math.min(...indents, Infinity);
  return lines
    .map((line) => line.slice(Number.isFinite(strip) ? strip : 0))
    .join('\n')
    .trim();
}

//#endregion
