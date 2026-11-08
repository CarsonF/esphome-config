import { esp } from 'esphome-config';

/** Type-checked against the fixture's generated types; never run. */

// a core platform is untouched by the external one beside it
esp.sensor.adc({ pin: 'GPIO34' });

esp.sensor.my_sensor({ channel: 1, mode: 'fast' });

// @ts-expect-error the mode is one of the schema's enum values
esp.sensor.my_sensor({ channel: 1, mode: 'sideways' });

// @ts-expect-error channel is required
esp.sensor.my_sensor({ mode: 'fast' });

// each source is `esp.external.<name>()`, with all its components or some of them
esp.external.fixture();
esp.external.fixture('my_sensor');

// @ts-expect-error no source is named this
esp.external.nope();

// @ts-expect-error the fixture source has no such component
esp.external.fixture('other_sensor');
