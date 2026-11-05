import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('build prints a device as YAML', () => {
  assert.equal(
    build('plain'),
    'esphome:\n  name: plain\nwifi:\n  ssid: !secret wifi_ssid\n' +
      'sensor:\n  - platform: adc\n    name: Temperature\n    pin: GPIO34\n',
  );
});

test('build --secrets prints dummy secrets', () => {
  assert.equal(build('plain', '--secrets'), 'wifi_ssid: dummy-wifi_ssid\n');
});

test('build finds <device>/index.ts, and awaits an async device', () => {
  assert.equal(build('folder'), 'esphome:\n  name: folder\n');
});

test('build fails clearly for a missing device', () => {
  assert.throws(() => build('nope'), /no device nope/);
});

function build(...args: string[]): string {
  return execFileSync(process.execPath, ['src/cli.ts', 'build', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ESPHOME_DEVICES: 'test/devices' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
