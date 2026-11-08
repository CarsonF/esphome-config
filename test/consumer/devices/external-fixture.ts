import { esp } from 'esphome-config';

export default esp.device('external-fixture', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.external.fixture();
  esp.sensor.my_sensor({ name: 'Fixture', channel: 3, mode: 'slow', scale: 2.5 });
});
