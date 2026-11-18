import { esp } from '../../src/index.ts';

/** An action bound to the one `espnow:` block leaves out its `id`. */
export default esp.device('implicit-id', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  const radio = esp.espnow({ channel: 1 });
  esp.interval({ interval: '10s', then: radio.send({ address: 'FF:FF:FF:FF:FF:FF', data: 'hi' }) });
});
