import assert from 'node:assert/strict';
import { test } from 'node:test';
import { device, lambda, secret } from '../src/index.ts';
import { toYaml } from '../src/dsl/yaml.ts';
import { sensor } from './entities.ts';

test('top-level blocks come in ESPHome order, then as written', () => {
  const yaml = toYaml({ sensor: [], logger: {}, wifi: {}, esphome: { name: 'x' } });
  assert.deepEqual(
    yaml.split('\n').filter((line) => /^\w/.test(line)),
    ['esphome:', 'wifi: {}', 'logger: {}', 'sensor: []'],
  );
});

test('an entry starts with platform, id and name', () => {
  const yaml = toYaml({ sensor: [{ name: 'T', pin: 1, id: 't', platform: 'adc' }] });
  assert.equal(yaml, 'sensor:\n  - platform: adc\n    id: t\n    name: T\n    pin: 1\n');
});

test('tags render as YAML tags, and a multi-line lambda as a block', () => {
  const yaml = toYaml({
    wifi: { ssid: secret('wifi_ssid') },
    one: lambda`return 1;`,
    two: lambda`
      int x = 1;
      return x;
    `,
  });
  assert.equal(
    yaml,
    'wifi:\n  ssid: !secret wifi_ssid\none: !lambda return 1;\n' +
      'two: !lambda |-\n  int x = 1;\n  return x;\n',
  );
});

test('a list of numbers is one flow sequence', () => {
  assert.equal(toYaml({ code: [100, -200, 300] }), 'code: [ 100, -200, 300 ]\n');
});

test('a lambda directly in a list is a lambda step', () => {
  assert.equal(toYaml({ then: [lambda`f();`] }), 'then:\n  - lambda: !lambda f();\n');
});

test('an entity renders as its id', () => {
  const root = device('d', () => {
    const temp = sensor({ id: 'temp' });
    assert.equal(toYaml({ sensor: temp }), 'sensor: temp\n');
  });
  assert.ok(root);
});
