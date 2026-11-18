import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { device, lambda, reserveIds } from '../src/index.ts';
import { script, sensor, wifi } from './entities.ts';

// `wifi` is a stand-in for any single block that names an ESPHome integration
reserveIds(['wifi']);

test('a block nothing refers to has no id', () => {
  const yaml = device('d', () => {
    wifi({ ssid: 'x' });
  }).toYaml();
  assert.deepEqual(parse(yaml).wifi, { ssid: 'x' });
});

test('an action that names the block gives it an id, prefixed as it is reserved', () => {
  const config = parse(
    device('d', () => {
      const radio = wifi({ ssid: 'x' });
      script({ id: 'run', then: () => ({ 'wifi.disable': { id: radio } }) });
    }).toYaml(),
  );
  assert.deepEqual(config.wifi, { id: 'my_wifi', ssid: 'x' });
  assert.deepEqual(config.script, [{ id: 'run', then: [{ 'wifi.disable': { id: 'my_wifi' } }] }]);
});

test('a lambda that names the block gives it an id', () => {
  const config = parse(
    device('d', () => {
      const radio = wifi({ ssid: 'x' });
      script({ id: 'run', then: lambda`${radio}->disable();` });
    }).toYaml(),
    { logLevel: 'error' },
  );
  assert.equal(config.wifi.id, 'my_wifi');
  assert.deepEqual(config.script[0].then, [{ lambda: 'id(my_wifi)->disable();' }]);
});

test('a block that is named collides with an entity of the same id', () => {
  const clash = device('d', () => {
    const radio = wifi({ ssid: 'x' });
    sensor({ id: 'my_wifi' });
    script({ id: 'run', then: () => ({ 'wifi.disable': { id: radio } }) });
  });
  assert.throws(() => clash.toYaml(), /two entities have the id "my_wifi"/);
});

test('a block nothing names does not collide', () => {
  const unnamed = device('d', () => {
    wifi({ ssid: 'x' });
    sensor({ id: 'my_wifi' });
  });
  assert.doesNotThrow(() => unnamed.toYaml());
});
