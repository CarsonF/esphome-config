import { esp } from '../../src/index.ts';

/** An action whose `id` ESPHome requires names its block, which then gets an id. */
export default esp.device('required-id', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  const uart = esp.uart({ tx_pin: 'GPIO17', rx_pin: 'GPIO16', baud_rate: 2400, parity: 'EVEN' });
  const hub = esp.mitsubishi_cn105({ uart_id: uart });
  esp.interval({ interval: '1min', then: hub.set_remote_temperature({ temperature: 21 }) });
});
