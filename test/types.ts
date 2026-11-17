import { esp } from '../src/index.ts';

/** Type-checked; never run. */
export function shorthand(): void {
  // `cv.maybe_simple_value`: a variable is `{ type }`, or the type alone
  esp.api({
    actions: [
      { action: 'a', variables: { frames: 'int', label: { type: 'string' } }, then: [] },
    ],
  });
  // @ts-expect-error the type is one of the schema's
  esp.api({ actions: [{ action: 'b', variables: { frames: 'integer' }, then: [] }] });
}

/** Type-checked; never run. */
export function triggerOptions(): void {
  const button = esp.binary_sensor.gpio({ pin: 'GPIO4' });
  button.on_multi_click({ timing: 'ON for at most 1s', then: [] });
  // @ts-expect-error `timing` is required
  button.on_multi_click({ then: [] });
  // @ts-expect-error a bare list of actions has no `timing`
  button.on_multi_click([]);
  // @ts-expect-error an option the schema doesn't have
  button.on_multi_click({ timing: 'ON for at most 1s', then: [], invalid_cooldwn: '1s' });
}

/** Type-checked; never run. */
export function oneOf(): void {
  const temp = esp.sensor.adc({ pin: 'GPIO34' });
  temp.on_value_range({ above: 30, then: [] });
  temp.on_value_range({ above: 30, below: 40, then: [] });
  // @ts-expect-error `above` or `below` is needed
  temp.on_value_range({ then: [] });

  esp.sensor.ble_rssi({ mac_address: 'AA:BB:CC:DD:EE:FF' });
  // @ts-expect-error exactly one of `mac_address` and `irk`
  esp.sensor.ble_rssi({ mac_address: 'AA:BB:CC:DD:EE:FF', irk: 'x' });
  // @ts-expect-error one of them is needed
  esp.sensor.ble_rssi({});
}

/** Type-checked; never run. */
export function inRange(): void {
  const temp = esp.sensor.adc({ pin: 'GPIO34' });
  temp.in_range({ above: 30 });
  temp.in_range({ above: 20, below: 30 });
  // @ts-expect-error `above` or `below` is needed
  temp.in_range();
  // @ts-expect-error `above` or `below` is needed
  temp.in_range({});
}
