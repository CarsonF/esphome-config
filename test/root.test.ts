import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';
import {
  appendList,
  autoId,
  construct,
  Contribution,
  currentScope,
  device,
  lambda,
  secret,
} from '../src/index.ts';
import type { Config } from '../src/index.ts';
import { i2c, script, sensor, wifi } from './entities.ts';

test('a device gets an esphome block with its name', () => {
  assert.equal(device('bare', () => {}).toYaml(), 'esphome:\n  name: bare\n');
});

test('only referenced ids are printed, unless the kind always needs one', () => {
  const yaml = device('d', () => {
    const named = sensor({ name: 'Named' });
    sensor({ name: 'Other' });
    sensor({});
    script({ id: 'run', then: [lambda`${named}->update();`] });
  }).toYaml();
  assert.deepEqual(parse(yaml).sensor, [
    { platform: 'adc', id: 'named', name: 'Named' },
    { platform: 'adc', name: 'Other' },
    { platform: 'adc', id: 'sensor' },
  ]);
  assert.deepEqual(parse(yaml).script, [{ id: 'run', then: [{ lambda: 'id(named)->update();' }] }]);
});

test('a single block is not a list, and a listable one only when there are two', () => {
  const one = parse(
    device('d', () => {
      wifi({ ssid: 'x' });
      i2c({ sda: 1 });
    }).toYaml(),
  );
  assert.deepEqual(one.wifi, { ssid: 'x' });
  assert.deepEqual(one.i2c, { sda: 1 });
  const two = parse(
    device('d', () => {
      i2c({ id: 'a', sda: 1 });
      i2c({ id: 'b', sda: 2 });
    }).toYaml(),
  );
  assert.deepEqual(two.i2c, [{ sda: 1 }, { sda: 2 }]);
});

test('ids that collide across scopes are rejected', () => {
  const clash = device('d', () => {
    sensor({ id: 'a_b' });
    construct('a', (_: { id?: string }) => sensor({ id: 'b' }))({});
  });
  assert.throws(() => clash.toYaml(), /two entities have the id "a_b"/);
});

test('secretNames lists the secrets in blocks, props and step functions', () => {
  const root = device('d', () => {
    wifi({ ssid: secret('wifi_ssid') });
    script({ id: 's', then: () => ({ 'wifi.connect': { password: secret('pw') } }) });
  });
  root.set('ota', { password: secret('ota') });
  assert.deepEqual(root.secretNames().sort(), ['ota', 'pw', 'wifi_ssid']);
});

test('step functions run once, at render, and can name entities made after them', () => {
  let runs = 0;
  const root = device('d', () => {
    script({
      id: 'first',
      then: () => {
        runs++;
        return { 'script.execute': later };
      },
    });
    const later = script({ id: 'later' });
  });
  const yaml = root.toYaml();
  root.secretNames();
  assert.equal(runs, 1);
  assert.deepEqual(parse(yaml).script[0], {
    id: 'first',
    then: [{ 'script.execute': 'later' }],
  });
});

test('a contribution adds to a block owned elsewhere', () => {
  const yaml = device('d', () => {
    for (const lib of ['SPI', 'Wire', 'SPI']) {
      new (class extends Contribution {
        contribute(blocks: Config): void {
          appendList(blocks, 'esphome', 'libraries', lib);
        }
      })(currentScope(), autoId(currentScope(), undefined, 'library'));
    }
  }).toYaml();
  assert.deepEqual(parse(yaml).esphome, { name: 'd', libraries: ['SPI', 'Wire'] });
});

test('localExternals swaps a git source for a local path', () => {
  const root = device('d', () => {});
  root.set('external_components', [{ source: 'github://a/b@main', components: ['c'] }]);
  const yaml = root.toYaml({ localExternals: { 'github://a/b@main': '/src/b/components' } });
  assert.deepEqual(parse(yaml).external_components, [
    { source: { type: 'local', path: '/src/b/components' }, components: ['c'] },
  ]);
});

test('an async build resolves to the root', async () => {
  const root = await device('d', async () => {
    await Promise.resolve();
    sensor({ id: 'after_await' });
  });
  assert.match(root.toYaml(), /id: after_await/);
});

/** `!lambda` and `!secret` read as plain strings. */
function parse(yaml: string) {
  return parseYaml(yaml, { logLevel: 'error' });
}
