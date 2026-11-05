import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const consumer = new URL('consumer/', import.meta.url);

test('a consumer device uses an external component through its generated types', () => {
  const yaml = execFileSync(
    process.execPath,
    [...process.execArgv, '../../src/cli.ts', 'build', 'external-fixture'],
    { cwd: consumer, encoding: 'utf8' },
  );
  const expected = readFileSync(new URL('devices/external-fixture.yaml', consumer), 'utf8');
  assert.equal(yaml, expected);
});
