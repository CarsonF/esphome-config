import { construct, esp, log, secret, type InternalPin } from '../../src/index.ts';

/** A fan on a PWM pin, with children `<id>_output` and `<id>_fan`. */
const pwmFan = construct('pwm_fan', (props: { id?: string; name: string; pin: InternalPin }) => {
  const output = esp.output.ledc({ id: 'output', pin: props.pin });
  return esp.fan.speed({ id: 'fan', name: props.name, output });
});

export default esp.device('demo-fan', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.wifi({ ssid: secret('wifi_ssid'), password: secret('wifi_password'), fast_connect: true });
  esp.api({});
  esp.ota.esphome();
  esp.logger({ level: 'INFO' });

  const tooHot = esp.global({ id: 'too_hot', initial_value: false });
  const cooler = pwmFan({ name: 'Cooler', pin: 'GPIO5' });

  const temp = esp.sensor.adc({ name: 'Temperature', pin: 'GPIO34', update_interval: '10s' });
  temp.on_value(
    tooHot.assign('x > 30.0'),
    cooler.turn_on(),
    log.info('fan', 'too hot: %d', tooHot),
  );
});
