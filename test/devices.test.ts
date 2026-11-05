import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildDevice } from '../src/dsl/build.ts';

const goldens = readdirSync(new URL('devices', import.meta.url)).filter((file) =>
  file.endsWith('.yaml'),
);

for (const name of goldens.map((file) => file.slice(0, -'.yaml'.length))) {
  test(`${name} builds to its golden YAML`, async () => {
    const expected = readFileSync(new URL(`devices/${name}.yaml`, import.meta.url), 'utf8');
    assert.equal(await buildDevice(name, { devicesDir: 'test/devices' }), expected);
  });
}
