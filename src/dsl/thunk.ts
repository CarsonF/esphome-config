import { isArray, isFunction, isPlainObject, mapValues } from 'remeda';

/**
 * Steps given as a function, built when the YAML renders so they can name what isn't made yet.
 * Example: sw.turn_on_action(() => hold.execute())
 */

//#region Registering

/** Remembers where each function in `value` was given, for the trace of an error it throws. */
export function markThunks(value: unknown): void {
  let site: string | undefined;
  const visit = (item: unknown): void => {
    if (isFunction(item)) {
      if (!sites.has(item)) sites.set(item, (site ??= registrationFrames()));
    } else if (isArray(item)) item.forEach(visit);
    else if (isPlainObject(item)) Object.values(item).forEach(visit);
  };
  visit(value);
}

//#endregion

//#region Resolving

export type Resolved = Map<Function, unknown[]>;

/** `value` with each function replaced by the steps it returns; `resolved` runs each once. */
export function resolveThunks<T>(value: T, resolved: Resolved): T {
  return resolve(value, resolved) as T;
}

/** Entities and constructs only exist while the config is being built, not while a step is. */
export function assertNotResolving(): void {
  if (running > 0) {
    throw new Error('create entities outside a step function: it runs while the YAML renders');
  }
}

//#endregion

//#region Helpers

const sites = new WeakMap<Function, string>();
let running = 0;

function resolve(value: unknown, resolved: Resolved): unknown {
  if (isArray(value)) return value.flatMap((item) => expand(item, resolved));
  if (isFunction(value)) return expand(value, resolved);
  if (isPlainObject(value)) return mapValues(value, (item) => resolve(item, resolved));
  return value;
}

/** The items an array holds in place of `item`: a function's steps, or the item itself. */
function expand(item: unknown, resolved: Resolved): unknown[] {
  if (!isFunction(item)) return [resolve(item, resolved)];
  const known = resolved.get(item);
  if (known) return known;
  const steps = [call(item)].flat(Infinity).flatMap((step) => expand(step, resolved));
  resolved.set(item, steps);
  return steps;
}

function call(fn: Function): unknown {
  running++;
  try {
    return fn();
  } catch (error) {
    throw withSite(error, fn);
  } finally {
    running--;
  }
}

function withSite(error: unknown, fn: Function): Error {
  const thrown = error instanceof Error ? error : new Error(String(error));
  const site = sites.get(fn);
  // shaped like a frame, so a trace printer that keeps only frames keeps it too
  if (site)
    thrown.stack = `${thrown.stack}\n    at given (the step function was given here)\n${site}`;
  return thrown;
}

/** The caller's frames, without the ones inside the DSL and the generated code. */
function registrationFrames(): string {
  return (new Error().stack ?? '')
    .split('\n')
    .slice(1)
    .filter((line) => !/\/(dsl|generated)\//.test(line))
    .join('\n');
}

//#endregion
