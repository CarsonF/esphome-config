import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { construct, Construct, currentScope, device, reserveIds } from '../src/index.ts';
import { script, sensor } from './entities.ts';

test('an id is the path from the device, joined by _', () => {
  device('d', () => {
    const cooler = construct('cooler', (_: { id?: string }) => sensor({ id: 'temp' }));
    assert.equal(cooler({}).id, 'cooler_temp');
    assert.equal(cooler({ id: 'fan' }).id, 'fan_temp');
  });
});

test('an id without one comes from the name, else the label, made unique', () => {
  device('d', () => {
    assert.equal(sensor({ name: 'Living Room Temp!' }).id, 'living_room_temp');
    assert.equal(sensor({ name: 'Living Room Temp' }).id, 'living_room_temp_2');
    assert.equal(sensor({ name: '42' }).id, 'probe');
    assert.equal(sensor({}).id, 'probe_2');
  });
});

test('an id naming an ESPHome integration gets a _ suffix', () => {
  reserveIds(['wifi']);
  device('d', () => assert.equal(sensor({ id: 'wifi' }).id, 'wifi_'));
});

test('a bad or repeated local id is rejected', () => {
  device('d', () => {
    assert.throws(() => sensor({ id: '_x' }), /must be a C\+\+ identifier/);
    sensor({ id: 'x' });
    assert.throws(() => sensor({ id: 'x' }), /device already has a child "x"/);
    const scope = new Construct(currentScope(), 'group');
    new Construct(scope, 'x');
    assert.throws(() => new Construct(scope, 'x'), /group already has a child "x"/);
  });
});

test('entities need a device, and not a running step function', () => {
  assert.throws(() => sensor({}), /no current scope/);
  const root = device('d', () => {
    script({ id: 's', then: () => sensor({}) as never });
  });
  assert.throws(() => root.toYaml(), /create entities outside a step function/);
});

test('a trigger prop and on_x() calls are one list of automations', () => {
  const yaml = device('d', () => {
    const temp = sensor({ id: 'temp', on_value: { then: { log: 1 }, above: 3 } });
    temp.on_value({ log: 2 }).then({ log: 3 });
    temp.on_value([{ log: 4 }]).with({ below: 5 });
  }).toYaml();
  assert.deepEqual(parse(yaml).sensor[0].on_value, [
    { above: 3, then: [{ log: 1 }] },
    { then: [{ log: 2 }, { log: 3 }] },
    { below: 5, then: [{ log: 4 }] },
  ]);
});

test('a single automation is not a list', () => {
  const yaml = device('d', () => {
    sensor({ id: 'temp', on_value: [{ log: 1 }, [{ log: 2 }]] });
  }).toYaml();
  assert.deepEqual(parse(yaml).sensor[0].on_value, { then: [{ log: 1 }, { log: 2 }] });
});

test('step props flatten nested lists', () => {
  const yaml = device('d', () => {
    sensor({ id: 'temp', filters: [{ a: 1 }, [{ b: 2 }, [{ c: 3 }]]] });
  }).toYaml();
  assert.deepEqual(parse(yaml).sensor[0].filters, [{ a: 1 }, { b: 2 }, { c: 3 }]);
});
