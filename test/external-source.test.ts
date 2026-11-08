import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { construct, device, esp, externalSource } from '../src/index.ts';

const fixture = externalSource('github://example/fixture@main', ['a_sensor', 'b_sensor']);

test('a source adds one external_components entry, however often it is called', () => {
  const yaml = device('d', () => {
    fixture('a_sensor');
    construct('group', () => fixture('b_sensor'))({});
    fixture('a_sensor');
  }).toYaml();
  assert.deepEqual(parse(yaml).external_components, {
    source: 'github://example/fixture@main',
    components: ['a_sensor', 'b_sensor'],
  });
});

test('a source called without components lists all of them', () => {
  const yaml = device('d', () => {
    fixture();
  }).toYaml();
  assert.deepEqual(parse(yaml).external_components.components, ['a_sensor', 'b_sensor']);
});

test('a source joins the entry that names it with a string', () => {
  const yaml = device('d', () => {
    esp.external_component({ source: 'github://example/fixture@main', components: ['b_sensor'] });
    esp.external_component({ source: 'github://example/other@main' });
    fixture('a_sensor');
  }).toYaml();
  assert.deepEqual(parse(yaml).external_components, [
    { source: 'github://example/fixture@main', components: ['b_sensor', 'a_sensor'] },
    { source: 'github://example/other@main' },
  ]);
});
