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
