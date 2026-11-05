import { isPlainObject } from 'remeda';
import { flat, withSteps, type Config, type Many, type Step } from './tags.ts';
import { assertNotResolving, markThunks } from './thunk.ts';

/**
 * A node in the construct tree; its `id` is the path from the device, joined by `_`.
 * Example: `new Entity(new Construct(device, 'cooler'), 'output', ...)` is `cooler_output`
 */
export class Construct {
  readonly children: Construct[] = [];
  readonly scope: Construct | undefined;
  readonly localId: string;

  constructor(scope: Construct | undefined, localId: string) {
    this.scope = scope;
    this.localId = localId;
    assertNotResolving();
    if (scope && !identifier.test(localId))
      throw new Error(`construct id "${localId}" must be a C++ identifier without a leading _`);
    if (scope?.children.some((child) => child.localId === localId))
      throw new Error(`${scope.path.join('/') || 'device'} already has a child "${localId}"`);
    scope?.children.push(this);
  }

  /** Local ids from just under the root down to this construct. */
  get path(): string[] {
    return this.scope ? [...this.scope.path, this.localId] : [];
  }

  get id(): string {
    const id = this.path.join('_');
    return reserved.has(id) ? `${id}_` : id;
  }

  /** This construct and everything under it, depth first. */
  *walk(): Generator<Construct> {
    yield this;
    for (const child of this.children) yield* child.walk();
  }
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
  for (let n = 2; scope.children.some((child) => child.localId === id); n++) id = `${base}_${n}`;
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
  /** Props that hold steps, which may be given as one, varargs or a list. */
  steps?: string[];
  /** Props that are triggers: steps, or `{ then, ...options }`. */
  triggers?: string[];
  /**
   * When the YAML needs the entry's `id`: `always`, or `unlessNamed`.
   * Without it, only if something refers to the entry.
   */
  id?: 'always' | 'unlessNamed';
}

/** A component with an `id`, e.g. a sensor. */
export class Entity<Props extends object = Config> extends Construct {
  readonly kind: Kind;
  readonly props: Props;
  private readonly automations = new Map<string, Automation[]>();

  constructor(scope: Construct, id: string, kind: Kind, props: Props) {
    super(scope, id);
    this.kind = kind;
    markThunks(props);
    this.props = { ...props };
  }

  /** `referenced` is every entity something names; omit it to print every id. */
  toConfig(referenced?: ReadonlySet<unknown>): Config {
    const { platform, shape, steps = [], triggers = [] } = this.kind;
    const rest = { ...withSteps(this.props, steps) } as Config;
    // a trigger given as a prop and through `on_x()` is one list of automations
    const fromProps = new Map<string, Config[]>();
    for (const key of Object.keys(rest).filter((name) => triggers.includes(name))) {
      const given = rest[key];
      delete rest[key];
      if (given !== undefined) fromProps.set(key, [asAutomation(given)]);
    }
    const merged = new Map(fromProps);
    for (const [trigger, list] of this.automations) {
      merged.set(trigger, [...(merged.get(trigger) ?? []), ...list.map((a) => a.toConfig())]);
    }
    const automations = Object.fromEntries(
      [...merged].map(([trigger, list]) => [trigger, list.length === 1 ? list[0] : list]),
    );
    return {
      ...(platform && { platform }),
      ...(shape !== 'single' && this.needsId(referenced) && { id: this.id }),
      ...rest,
      ...automations,
    };
  }

  private needsId(referenced?: ReadonlySet<unknown>): boolean {
    const { id: mode } = this.kind;
    return (
      !referenced ||
      mode === 'always' ||
      referenced.has(this) ||
      (mode === 'unlessNamed' && (this.props as Config).name === undefined)
    );
  }

  /** Each call is its own automation on `trigger`, e.g. `on_value`. */
  protected on(trigger: string, actions: Many<Step>[]): Automation {
    const automation = new Automation(actions);
    this.automations.set(trigger, [...(this.automations.get(trigger) ?? []), automation]);
    return automation;
  }
}

/** A trigger prop as an automation: `{ then, ...options }` as written, or just the steps. */
function asAutomation(given: unknown): Config {
  return isPlainObject(given) && 'then' in given
    ? { ...given, then: flat([given.then as Many<Step>]) }
    : { then: flat([given as Many<Step>]) };
}

/** What an `on_x()` returns, to add steps or options to later. */
export class Automation {
  private options: Config = {};
  private readonly actions: Step[];

  constructor(actions: Many<Step>[]) {
    markThunks(actions);
    this.actions = flat(actions);
  }

  /** Appends steps, which run after the ones already here. */
  then(...actions: Many<Step>[]): this {
    markThunks(actions);
    this.actions.push(...flat(actions));
    return this;
  }

  /** Settings beside the steps, e.g. `above` for `on_value_range`. */
  with(options: Config): this {
    Object.assign(this.options, options);
    return this;
  }

  toConfig(): Config {
    return { ...this.options, then: this.actions };
  }
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

/** Ids that name an ESPHome integration, which it rejects; an entity with one gets a `_` suffix. */
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
