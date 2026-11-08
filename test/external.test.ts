import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('two sources with one name fail generation', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'esphome-config-')), 'external');
  const fixture = ['--path', 'test/external-fixture'];
  const run = spawnSync(
    process.execPath,
    [
      ...process.execArgv,
      'src/cli.ts',
      'generate-external',
      ...['github://one/fixture@main', ...fixture, 'github://two/fixture@main', ...fixture],
      ...['--from-dump', 'test/external-fixture/schema', '--out', out],
    ],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /two external component sources are named "fixture"/);
});
