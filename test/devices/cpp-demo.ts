import { id, millis } from '../../src/cpp.ts';
import { esp } from '../../src/index.ts';

const HOLD_TIMEOUT_MS = 30_000;

/** Lambdas written as TypeScript, using the variables around them. */
export default esp.device('cpp-demo', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.logger();

  const startedMs = esp.global({ id: 'started_ms', initial_value: 0, type: 'uint32_t' });
  const tooHot = esp.global({ id: 'too_hot', initial_value: false });
  const temp = esp.sensor.adc({ name: 'Temperature', pin: 'GPIO34', update_interval: '10s' });
  const sw = esp.switch.template({ id: 'sw_hold', name: 'Hold', optimistic: true });

  // demo-fan: `x` is the sensor's new reading
  temp.on_value(
    esp.cpp((x) => {
      id(tooHot).value = x > 30.0;
    }),
  );

  // bed-rf: the hold loop's two lambdas
  const hold = esp.script({
    id: 'hold',
    mode: 'restart',
    then: [
      esp.cpp(() => {
        id(startedMs).value = millis();
      }),
      esp.actions.while({
        condition: esp.conditions.and(
          sw.is_on(),
          esp.cpp(() => millis() - id(startedMs).value < HOLD_TIMEOUT_MS),
        ),
        then: [esp.actions.delay('120ms')],
      }),
      sw.turn_off(),
    ],
  });
  sw.turn_on_action(hold.execute());
  sw.turn_off_action(hold.stop());

  // locals, a ternary, if/else, and entity members
  esp.interval({
    interval: '1s',
    then: [
      esp.cpp(() => {
        const sensor = id(temp);
        const level = sensor.state > 28 ? 2 : 1;
        if (id(tooHot).value && sensor.has_state() && level > 1) {
          id(sw).turn_on();
        } else {
          id(sw).turn_off();
        }
      }),
    ],
  });
});
