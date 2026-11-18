import { isPlainObject } from 'remeda';
import { flat, withActions, type AnyAction, type Config, type Many } from './tags.ts';
import { assertNotResolving, markThunks } from './thunk.ts';

//#region Construct keys

const childrenKey: unique symbol = Symbol('Construct.children');
const scopeKey: unique symbol = Symbol('Construct.scope');
const localIdKey: unique symbol = Symbol('Construct.localId');
const pathKey: unique symbol = Symbol('Construct.path');
const walkKey: unique symbol = Symbol('Construct.walk');

//#endregion

/**
 * A node in the construct tree; its `id` is the path from the device, joined by `_`.
 * Internals are symbol keys so a generated method can't collide with them: `x[Construct.walk]()`
 * Example: `new Entity(new Construct(device, 'cooler'), 'output', ...)` is `cooler_output`
 */
export class Construct {
  static readonly children: typeof childrenKey = childrenKey;
  static readonly scope: typeof scopeKey = scopeKey;
  static readonly localId: typeof localIdKey = localIdKey;
  static readonly path: typeof pathKey = pathKey;
  static readonly walk: typeof walkKey = walkKey;

  readonly [childrenKey]: Construct[] = [];
  readonly [scopeKey]: Construct | undefined;
  readonly [localIdKey]: string;

  constructor(scope: Construct | undefined, localId: string) {
    this[scopeKey] = scope;
    this[localIdKey] = localId;
    assertNotResolving();
    if (scope && !identifier.test(localId))
      throw new Error(`construct id "${localId}" must be a C++ identifier without a leading _`);
    if (scope?.[childrenKey].some((child) => child[localIdKey] === localId))
      throw new Error(`${scope[pathKey].join('/') || 'device'} already has a child "${localId}"`);
    scope?.[childrenKey].push(this);
  }

  /** Local ids from just under the root down to this construct. */
  get [pathKey](): string[] {
    const scope = this[scopeKey];
    return scope ? [...scope[pathKey], this[localIdKey]] : [];
  }

  get id(): string {
    const id = this[pathKey].join('_');
    return reserved.has(id) ? `my_${id}` : id;
  }

  /** This construct and everything under it, depth first. */
  *[walkKey](): Generator<Construct> {
    yield this;
    for (const child of this[childrenKey]) yield* child[walkKey]();
  }
}

/** The construct at the top of the tree `construct` is in. */
export function rootOf(construct: Construct): Construct {
  const scope = construct[scopeKey];
  return scope ? rootOf(scope) : construct;
}

/**
 * An id for a construct that wasn't given one: its `name` as a C++ identifier, else `label`,
 * with a numeric suffix if a sibling has it. It only reaches the YAML if something refers to it.
 */
export function autoId(scope: Construct, props: object | undefined, label: string): string {
  const name = (props as { name?: unknown } | undefined)?.name;
  const slug = typeof name === 'string' ? name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : '';
  const trimmed = slug.replace(/^_|_$/g, '');
  const base = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(trimmed) ? trimmed : label;
  let id = base;
  const taken = (candidate: string): boolean =>
    scope[childrenKey].some((child) => child[localIdKey] === candidate);
  for (let n = 2; taken(id); n++) id = `${base}_${n}`;
  return id;
}

/** The id a construct is placed under: its `id` prop, else one made up from its props. */
export function localId(scope: Construct, props: object | undefined, label: string): string {
  const id = (props as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : autoId(scope, props, label);
}

/**
 * How a component lands in the YAML: `list` is `<domain>: [...]`, `single` a block like `wifi:`,
 * and `listable` a block that becomes a list only when there is more than one.
 */
export interface Kind {
  domain: string;
  platform?: string;
  shape?: 'single' | 'listable';
  /** Props that hold actions, which may be given as one, varargs or a list. */
  actions?: string[];
  /** Props that are triggers: actions, or `{ then, ...options }`. */
  triggers?: string[];
  /**
   * When the YAML needs the entry's `id`: `always`, or `unlessNamed`.
   * Without it, only if something refers to the entry.
   */
  id?: 'always' | 'unlessNamed';
}

//#region Entity keys

const kindKey: unique symbol = Symbol('Entity.kind');
const propsKey: unique symbol = Symbol('Entity.props');
const toConfigKey: unique symbol = Symbol('Entity.toConfig');
const onKey: unique symbol = Symbol('Entity.on');

//#endregion

/** A component with an `id`, e.g. a sensor. */
export class Entity<Props extends object = Config> extends Construct {
  static readonly kind: typeof kindKey = kindKey;
  static readonly props: typeof propsKey = propsKey;
  static readonly toConfig: typeof toConfigKey = toConfigKey;
  static readonly on: typeof onKey = onKey;

  readonly [kindKey]: Kind;
  readonly [propsKey]: Props;
  readonly #automations = new Map<string, Config[]>();

  constructor(scope: Construct, id: string, kind: Kind, props: Props) {
    super(scope, id);
    this[kindKey] = kind;
    markThunks(props);
    this[propsKey] = { ...props };
  }

  /** `referenced` is every entity something names; omit it to print every id. */
  [toConfigKey](referenced?: ReadonlySet<unknown>): Config {
    const { platform, shape, actions = [], triggers = [] } = this[kindKey];
    const rest = { ...withActions(this[propsKey], actions) } as Config;
    // a trigger given as a prop and through `on_x()` is one list of automations
    const merged = new Map<string, Config[]>();
    for (const name of Object.keys(rest).filter((name) => triggers.includes(name))) {
      const given = rest[name];
      delete rest[name];
      if (given !== undefined) merged.set(name, [asAutomation(given)]);
    }
    for (const [trigger, list] of this.#automations) {
      merged.set(trigger, [...(merged.get(trigger) ?? []), ...list]);
    }
    const automations = Object.fromEntries(
      [...merged].map(([trigger, list]) => [trigger, list.length === 1 ? list[0] : list]),
    );
    return {
      ...(platform && { platform }),
      ...(this.#printsId(shape, referenced) && { id: this.id }),
      ...rest,
      ...automations,
    };
  }

  #printsId(shape: Kind['shape'], referenced?: ReadonlySet<unknown>): boolean {
    // a single block like `espnow:` has an id only for what refers to it: `espnow.send`
    return shape === 'single' ? !!referenced?.has(this) : this.#needsId(referenced);
  }

  #needsId(referenced?: ReadonlySet<unknown>): boolean {
    const { id: mode } = this[kindKey];
    return (
      !referenced ||
      mode === 'always' ||
      referenced.has(this) ||
      (mode === 'unlessNamed' && (this[propsKey] as Config).name === undefined)
    );
  }

  /** Each call is its own automation on `trigger`, e.g. `on_value`. */
  protected [onKey](trigger: string, given: unknown): this {
    markThunks(given);
    const list = this.#automations.get(trigger) ?? [];
    this.#automations.set(trigger, [...list, asAutomation(given)]);
    return this;
  }
}

/** A trigger prop as an automation: `{ then, ...options }` as written, or just the actions. */
function asAutomation(given: unknown): Config {
  return isPlainObject(given) && 'then' in given
    ? { ...given, then: flat([given.then as Many<AnyAction>]) }
    : { then: flat([given as Many<AnyAction>]) };
}

/** A construct that adds to a block owned elsewhere, e.g. an `api` action. */
export abstract class Contribution extends Construct {
  abstract contribute(blocks: Config): void;
}

/** Appends to `<block>.<key>`, skipping a value already there; e.g. `esphome`, `libraries`. */
export function appendList(blocks: Config, block: string, key: string, entry: unknown): void {
  const owner = (blocks[block] ??= {}) as Config;
  const list = (owner[key] as unknown[] | undefined) ?? [];
  if (!list.includes(entry)) owner[key] = [...list, entry];
}

const reserved = new Set<string>();

/** Ids that name an ESPHome integration, which it rejects. */
export function reserveIds(ids: Iterable<string>): void {
  for (const id of ids) reserved.add(id);
}

const identifier = /^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*$/;

//#region Types for generated props

/** The C++ classes an entity is, so a prop wanting an `output::FloatOutput` rejects a sensor. */
export type Cpp<Classes extends string> = { readonly [K in Classes]: true };
export type Ref<Class extends string> = Entity<any> & { readonly cpp: Cpp<Class> };

/** `GPIO5`, a board alias like `D1`, or a bare number. */
export type PinNumber = number | Uppercase<string>;
/** A pin on the chip itself: the number, or an object with the schema's options. */
export type InternalPin = PinNumber | PinOptions;
/** Any pin; an expander's is an object that names the expander: `{ pcf8574: hub, number: 3 }`. */
export type Pin = InternalPin | Config;

export interface PinOptions {
  number: PinNumber;
  mode?: PinModeName | Lowercase<PinModeName> | PinFlags;
  inverted?: boolean;
  allow_other_uses?: boolean;
  drive_strength?: number | `${number}mA`;
  ignore_strapping_warning?: boolean;
  ignore_pin_validation_error?: boolean;
}

type PinModeName =
  | 'INPUT'
  | 'OUTPUT'
  | 'INPUT_PULLUP'
  | 'INPUT_PULLDOWN'
  | 'INPUT_PULLDOWN_16'
  | 'OUTPUT_OPEN_DRAIN'
  | 'INPUT_OUTPUT_OPEN_DRAIN';

interface PinFlags {
  input?: boolean;
  output?: boolean;
  open_drain?: boolean;
  pullup?: boolean;
  pulldown?: boolean;
}
/** A function's parameters after the first, e.g. an action builder's after the entity. */
export type Tail<F> = F extends (first: any, ...rest: infer R) => any ? R : never;

//#endregion
