import { groupBy, mapValues } from 'remeda';
import { Construct, Contribution, Entity } from './construct.ts';
import { Tagged, type Config } from './tags.ts';
import { resolveThunks, type Resolved } from './thunk.ts';
import { toYaml } from './yaml.ts';

/**
 * The root construct: scope for every entity, and the YAML they render to.
 * Example: const root = new Root('demo-fan'); new AdcSensor(root, 'temp', { pin: 'GPIO34' });
 */
export class Root extends Construct {
  readonly name: string;
  private readonly blocks: Config = {};
  /** Step functions already run, so the two render passes and the secrets scan share one run. */
  private readonly resolved: Resolved = new Map();

  constructor(name: string) {
    super(undefined, name);
    this.name = name;
  }

  /** A top-level block with no generated class, e.g. `spi`. */
  set(key: string, value: unknown): this {
    this.blocks[key] = value;
    return this;
  }

  /** `localExternals` maps an `external_components` source to a directory, to validate offline. */
  toYaml(options: { localExternals?: Record<string, string> } = {}): string {
    this.checkIds();
    // the first pass prints every id to find what is referenced; the second prints only those
    const referenced = collectRefs(this.build());
    return toYaml(withLocalSources(this.build(referenced), options.localExternals));
  }

  /** The `!secret` keys the config uses, for a dummy secrets.yaml. */
  secretNames(): string[] {
    const found = new Set<string>();
    const visit = (value: unknown): void => {
      if (value instanceof Tagged) {
        if (value.tag === 'secret') found.add(value.value);
      } else if (!(value instanceof Entity) && value && typeof value === 'object') {
        Object.values(value).forEach(visit);
      }
    };
    visit(this.blocks);
    this.entities().forEach((entity) => visit(resolveThunks(entity.toConfig(), this.resolved)));
    return [...found];
  }

  //#region Helpers

  private build(referenced?: ReadonlySet<unknown>): Config {
    const domains = mapValues(
      groupBy(this.entities(), (entity) => entity.kind.domain),
      (entities) => {
        const configs = entities.map((entity) => entity.toConfig(referenced));
        const { shape } = entities[0].kind;
        const block = shape === 'single' || (shape === 'listable' && configs.length === 1);
        return block ? configs[0] : configs;
      },
    );
    // `esphome:` needs only the device name, so a device that never configures it still gets one
    const blocks = { esphome: { name: this.name }, ...this.blocks, ...domains };
    for (const construct of this.walk()) {
      if (construct instanceof Contribution) construct.contribute(blocks);
    }
    return resolveThunks(blocks, this.resolved);
  }

  private entities(): Entity<any>[] {
    return [...this.walk()].filter((c): c is Entity<any> => c instanceof Entity);
  }

  /** ESPHome ids are global, and `a_b` under `a` collides with `b` under `a_b`. */
  private checkIds(): void {
    const seen = new Set<string>();
    for (const { id, kind } of this.entities()) {
      if (kind.shape === 'single') continue;
      if (seen.has(id)) throw new Error(`${this.name}: two entities have the id "${id}"`);
      seen.add(id);
    }
  }

  //#endregion
}

/** `source: github://user/repo@ref` becomes a local path, so `esphome config` needs no network. */
function withLocalSources(blocks: Config, local: Record<string, string> = {}): Config {
  const entries = blocks.external_components;
  if (!entries || Object.keys(local).length === 0) return blocks;
  const swap = (entry: Config): Config => {
    const path = typeof entry.source === 'string' ? local[entry.source] : undefined;
    return path ? { ...entry, source: { type: 'local', path } } : entry;
  };
  return {
    ...blocks,
    external_components: Array.isArray(entries) ? entries.map(swap) : swap(entries as Config),
  };
}

/** Every entity named in a config, directly or through a lambda's interpolations. */
function collectRefs(value: unknown, found = new Set<unknown>()): Set<unknown> {
  if (value instanceof Entity) found.add(value);
  else if (value instanceof Tagged) value.refs.forEach((ref) => collectRefs(ref, found));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => collectRefs(child, found));
  }
  return found;
}
