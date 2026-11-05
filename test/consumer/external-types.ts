import { esp } from 'esphome-config';

/** Type-checked against the fixture's generated types; never run. */

// a core platform is untouched by the external one beside it
esp.sensor.adc({ pin: 'GPIO34' });

esp.sensor.my_sensor({ channel: 1, mode: 'fast' });

// @ts-expect-error the mode is one of the schema's enum values
esp.sensor.my_sensor({ channel: 1, mode: 'sideways' });

// @ts-expect-error channel is required
esp.sensor.my_sensor({ mode: 'fast' });
