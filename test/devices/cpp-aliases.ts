import * as cppApi from '../../src/cpp.ts';
import { cpp as lambda, id as entity, millis as now, type u8 as Byte } from '../../src/cpp.ts';
import { esp } from '../../src/index.ts';

type Level = Byte;

/** The same lambdas as `cpp-demo`, with every import renamed. */
export default esp.device('cpp-aliases', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.logger();

  const startedMs = esp.global({ id: 'started_ms', initial_value: 0, type: 'uint32_t' });
  const sw = esp.switch.template({ id: 'sw_hold', name: 'Hold', optimistic: true });
  const { cpp: destructured } = esp;
  const viaProperty = esp.cpp;

  esp.interval({
    interval: '1s',
    then: [
      // named imports
      lambda(() => {
        const level: Byte = 3;
        entity(startedMs).value = now() + level;
      }),
      // a namespace import
      lambda(() => {
        cppApi.id(sw).turn_on();
        entity(startedMs).value = cppApi.millis();
      }),
      // a local type alias, and `cpp` under another name
      destructured(() => {
        const level: Level = 2;
        entity(sw).turn_off();
        entity(startedMs).value = level;
      }),
      viaProperty(() => {
        const hold = entity(sw);
        hold.toggle();
      }),
    ],
  });
});
