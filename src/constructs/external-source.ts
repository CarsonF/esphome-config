import { Construct, currentScope, Entity, rootOf } from '../dsl/index.ts';
import type { Config } from '../dsl/index.ts';
import { external_components, type ExternalComponents } from '../generated/index.ts';

/**
 * The `esp.external.<name>()` the generator writes for each external component source:
 * it adds that source's `external_components` entry once, however often it is called.
 * Example: esp.external.roode() for all its components, or esp.external.roode('roode')
 */
export function externalSource<const Component extends string>(
  source: string,
  provided: readonly Component[],
): (...components: Component[]) => ExternalComponents {
  return (...components) => {
    const wanted = components.length > 0 ? components : provided;
    const existing = findEntry(currentScope(), source);
    if (!existing) return external_components({ source, components: [...wanted] });
    const props = existing[Entity.props];
    // an entry without `components` already loads all of them
    if (props.components) props.components = [...new Set([...props.components, ...wanted])];
    return existing;
  };
}

/** The device's entry for `source`, wherever in the tree it was added. */
function findEntry(scope: Construct, source: string): ExternalComponents | undefined {
  return [...rootOf(scope)[Construct.walk]()].find(
    (node): node is ExternalComponents =>
      node instanceof Entity &&
      node[Entity.kind].domain === 'external_components' &&
      (node[Entity.props] as Config).source === source,
  );
}
