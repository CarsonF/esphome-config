import { esp } from '../../src/index.ts';
import { MAC_A } from './cycle-a.ts';

export const MAC_B = 'BB:BB:BB:BB:BB:BB';

export default esp.device('cycle-b', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.espnow({ channel: 1, peers: [MAC_A] });
});
