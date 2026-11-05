import { esp } from 'esphome-config';

/** Roode's own example (peopleCounter32.yaml), to try its external components. */
export default esp.device('roode32', () => {
  esp.esp32({ board: 'wemos_d1_mini32', framework: { type: 'arduino' } });
  esp.external_component({
    source: 'github://Lyr3x/Roode@b975cec4e5570c393d35ce7a9778c8d599865961',
    components: ['roode', 'vl53l1x', 'persisted_number'],
  });
  esp.wifi({ ssid: esp.secret('ssid1'), password: esp.secret('ssid1_password') });
  esp.i2c({ sda: 21, scl: 22 });
  esp.vl53l1x({ calibration: { ranging: 'auto' } });

  const roode = esp.roode({
    id: 'roode_platform',
    sampling: 2,
    roi: { height: 16, width: 6 },
    detection_thresholds: { max: '85%' },
    zones: { invert: true },
  });
  esp.number.roode({ people_counter: { name: 'people counter' } });
  esp.binary_sensor.roode({ presence_sensor: { name: 'presence' } });
  esp.sensor.roode({ distance_entry: { name: 'distance zone 0', filters: [{ delta: 100 }] } });

  esp.api({
    actions: [
      {
        action: 'recalibrate',
        then: [esp.lambda`${roode}->recalibration();`],
      },
    ],
  });
});
