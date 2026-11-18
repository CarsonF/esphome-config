import { esp } from '../../src/index.ts';

/** The bound `send` refers to `espnow:`, which needs an id even though a single block has none. */
export default esp.device('espnow-send', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  const radio = esp.espnow({ channel: 1 });
  esp.interval({ interval: '10s', then: radio.send({ address: 'FF:FF:FF:FF:FF:FF', data: 'hi' }) });
});
