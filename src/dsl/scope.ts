import { AsyncLocalStorage } from 'node:async_hooks';
import { Construct, localId } from './construct.ts';
import { assertNotResolving } from './thunk.ts';

/** The scope new entities land in, set by `device(...)` and by each `construct(...)` below it. */
export function currentScope(): Construct {
  assertNotResolving();
  const scope = scopes.getStore();
  if (!scope) throw new Error('no current scope: create entities inside device(...)');
  return scope;
}

export function inScope<T>(scope: Construct, run: () => T): T {
  return scopes.run(scope, run);
}

/**
 * A function of props whose entities nest under its own scope, named by `props.id` or `props.name`.
 * Example: export const pwmFan = construct('pwm_fan', (props: PwmFanProps) => { ... });
 */
export function construct<P extends { id?: string }, R>(
  label: string,
  build: (props: P) => R,
): (props: P) => R {
  return (props) => {
    const parent = currentScope();
    return inScope(new Construct(parent, localId(parent, props, label)), () => build(props));
  };
}

export interface EntityFactory<P, E> {
  (props: P): E;
}

export interface OptionalEntityFactory<P, E> {
  (props?: P): E;
}

type Make<P, E> = new (scope: Construct, id: string, props: P) => E;

/** `esp.sensor.adc({ name: 'Temperature', pin })` in the current scope; `id` is optional. */
export function entityFactory<P extends object, E>(
  make: Make<P, E>,
  label: string,
): EntityFactory<P, E> {
  return (props: P) => {
    const scope = currentScope();
    const { id: _, ...rest } = (props ?? {}) as P & { id?: string };
    return new make(scope, localId(scope, props, label), rest as P);
  };
}

export function optionalEntityFactory<P extends object, E>(
  make: Make<P, E>,
  label: string,
): OptionalEntityFactory<P, E> {
  return entityFactory(make, label) as unknown as OptionalEntityFactory<P, E>;
}

const scopes = new AsyncLocalStorage<Construct>();
