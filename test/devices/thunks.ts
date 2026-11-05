import { ESP_LOGD } from '../../src/cpp.ts';
import { esp } from '../../src/index.ts';

/** Steps given as functions, and triggers given as props. */
export default esp.device('thunks', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.logger();

  // the switch and the script name each other, so the switch's side is a function
  const sw = esp.switch.template({
    id: 'sw_hold',
    name: 'Hold',
    optimistic: true,
    turn_on_action: () => hold.execute(),
    turn_off_action: () => hold.stop(),
  });
  const hold = esp.script({
    id: 'hold',
    mode: 'restart',
    then: [
      esp.actions.while({
        condition: sw.is_on(),
        then: [() => [esp.actions.delay('120ms'), () => esp.actions.delay('1s')]],
      }),
      sw.turn_off(),
    ],
  });

  // a trigger with options is `{ then, ...options }`, and the method form still works
  const temp = esp.sensor.adc({
    id: 'temp',
    pin: 'GPIO34',
    on_value_range: { above: 30, then: esp.actions.delay('1s') },
    on_value: esp.cpp((x) => {
      ESP_LOGD('t', 'now %f', x);
    }),
  });
  temp.on_value(esp.actions.delay('2s'));
  temp.on_value_range(esp.actions.delay('3s')).with({ below: 5 });
});

/** Rejected by the type checker; never run. */
export function typeChecks(): void {
  const sw = esp.switch.template({ id: 'x', name: 'X' });
  // @ts-expect-error returns a number
  sw.turn_on_action(() => 3);
  // @ts-expect-error returns nothing
  sw.turn_on_action(() => {});
  // @ts-expect-error takes arguments
  sw.turn_on_action((x: number) => sw.turn_off());
  // @ts-expect-error a thunk of a thunk of numbers
  sw.turn_on_action(() => () => 3);
  // @ts-expect-error `then` takes steps, not a number
  esp.script({ id: 'y', then: [() => 'x'] });
  // @ts-expect-error a trigger prop takes steps
  esp.switch.template({ id: 'z', name: 'Z', turn_on_action: 3 });
  // @ts-expect-error `on_value_range` needs its options, so the bare steps are not enough
  esp.sensor.adc({ id: 'a', pin: 'GPIO34', on_value_range: esp.actions.delay('1s') });
  // @ts-expect-error a bad option
  esp.sensor.adc({ id: 'b', pin: 'GPIO34', on_value_range: { above: true, then: [] } });
  // @ts-expect-error the argument types still apply: x is a number
  esp.sensor.adc({ id: 'c', pin: 'GPIO34', on_value: esp.cpp((x) => x.toUpperCase()) });
}
