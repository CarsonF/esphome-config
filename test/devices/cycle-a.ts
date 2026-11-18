import { esp } from '../../src/index.ts';
import { MAC_B } from './cycle-b.ts';

export const MAC_A = 'AA:AA:AA:AA:AA:AA';

/** Imports a constant from a device that imports one back, so the build must wait. */
export default esp.device('cycle-a', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.espnow({ channel: 1, peers: [MAC_B] });
});
