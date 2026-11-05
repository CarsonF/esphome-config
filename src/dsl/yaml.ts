import { Document, Scalar, YAMLSeq } from 'yaml';
import { Entity } from './construct.ts';
import { Tagged } from './tags.ts';

/** Block-style YAML with ESPHome tags; entities render as their id. */
export function toYaml(config: Record<string, unknown>): string {
  const customTags = TAGS.map((tag) => ({ tag, resolve: (value: string) => value }));
  const doc = new Document(order(config, TOP_LEVEL), { customTags });
  return doc.toString({ lineWidth: 100, singleQuote: true });
}

//#region Conversion

const TOP_LEVEL = ['substitutions', 'esphome', 'esp32', 'esp8266', 'wifi', 'api', 'ota', 'logger'];
const ENTRY = ['platform', 'id', 'name'];
const TAGS = ['!lambda', '!secret', '!include', '!extend', '!remove'];

function order(value: unknown, first: string[] = ENTRY): unknown {
  if (value instanceof Entity) return value.id;
  if (value instanceof Tagged) return value.tag ? tagged(value) : value.value;
  if (Array.isArray(value)) return list(value);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const sorted = [
      ...first.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !first.includes(k)),
    ];
    return Object.fromEntries(sorted.map((k) => [k, order((value as Record<string, unknown>)[k])]));
  }
  return value;
}

function tagged({ tag, value }: Tagged): Scalar {
  const scalar = new Scalar(value);
  scalar.tag = `!${tag}`;
  if (value.includes('\n')) scalar.type = Scalar.BLOCK_LITERAL;
  return scalar;
}

function list(items: unknown[]): unknown {
  // a lambda directly in a list is a step: `- lambda: !lambda ...`
  const steps = items.map((item) =>
    item instanceof Tagged && item.tag === 'lambda' ? { lambda: item } : item,
  );
  if (!steps.every((item) => typeof item === 'number')) return steps.map((item) => order(item));
  const seq = new YAMLSeq();
  seq.items = items.map((item) => new Scalar(item));
  seq.flow = true;
  return seq;
}

//#endregion
