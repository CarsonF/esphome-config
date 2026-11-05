# esphome-config

Write [ESPHome](https://esphome.io) configs in TypeScript.
Types and doc comments come from ESPHome's own language schema,
so a wrong key or option value is a compile error instead of an `esphome config` failure.

```ts
// devices/demo-fan.ts
import { construct, esp, log, secret, type InternalPin } from 'esphome-config';

/** A fan on a PWM pin, with children `<id>_output` and `<id>_fan`. */
const pwmFan = construct('pwm_fan', (props: { id?: string; name: string; pin: InternalPin }) => {
  const output = esp.output.ledc({ id: 'output', pin: props.pin });
  return esp.fan.speed({ id: 'fan', name: props.name, output });
});

export default esp.device('demo-fan', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.wifi({ ssid: secret('wifi_ssid'), password: secret('wifi_password') });
  esp.api({});
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
```

```sh
esphome-config build demo-fan > demo-fan.yaml
esphome-config build demo-fan --secrets > secrets.yaml  # dummy values, for `esphome config`
```

## Install

Needs Node 24 or newer.
Each release attaches a package tarball; depend on its URL:

```sh
pnpm add https://github.com/CarsonF/esphome-config/releases/download/v<version>/esphome-config-<version>.tgz
```

The package's types are for one ESPHome version, exported as `ESPHOME_VERSION`.
Use the ESPHome release that matches it.

Devices run on Node's built-in TypeScript support, so they use only erasable syntax.
A `tsconfig.json` for a project of devices:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["devices"]
}
```

## Writing devices

A device is `devices/<name>.ts` or `devices/<name>/index.ts`, and its default export is
`esp.device(name, build)`.
`ESPHOME_DEVICES` sets another directory.

- `esp.<domain>.<platform>(props)` and `esp.<component>(props)` create entities:
  `esp.sensor.adc(...)`, `esp.wifi(...)`.
- An entity's actions and conditions are its methods: `cooler.turn_on()`, `sw.is_on()`.
  Other steps are under `esp.actions` and `esp.conditions`.
- Triggers are methods (`temp.on_value(...)`) or props (`on_value: [...]`);
  a trigger with options takes `{ then, ...options }`.
- `` esp.lambda`...` `` writes a `!lambda`, where an interpolated entity becomes `id(<its id>)`.
- A step can be a function returning steps, which runs when the YAML renders:
  use it to name an entity created further down.

### Ids

An entity's id is its `id` prop, else made from its `name`.
`construct(label, build)` makes a reusable group whose entities are named under it:
`pwmFan({ name: 'Cooler', ... })` creates `cooler_output` and `cooler_fan`.
Ids only reach the YAML when something refers to the entity.
