import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildDevice } from '../src/dsl/build.ts';

for (const name of ['demo-fan']) {
  test(`${name} builds to its golden YAML`, async () => {
    const expected = readFileSync(new URL(`devices/${name}.yaml`, import.meta.url), 'utf8');
    assert.equal(await buildDevice(name, { devicesDir: 'test/devices' }), expected);
  });
}
