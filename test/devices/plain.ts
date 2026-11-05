import { device, secret } from '../../src/index.ts';
import { sensor, wifi } from '../entities.ts';

/** A device built from the DSL alone, for the CLI test. */
export default device('plain', () => {
  wifi({ ssid: secret('wifi_ssid') });
  sensor({ name: 'Temperature', pin: 'GPIO34' });
});
