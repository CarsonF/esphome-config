import { esp } from 'esphome-config';

/** Type-checked against Roode's generated types; never run. */

esp.roode({ orientation: 'parallel', sampling: 2, roi: 'auto' });

// @ts-expect-error orientation is one of the schema's enum values
esp.roode({ orientation: 'diagonal' });

// @ts-expect-error sampling is a number
esp.roode({ sampling: 'often' });

// @ts-expect-error the sensor is a VL53L1X, not any entity
esp.roode({ sensor: esp.sensor.adc({ pin: 'GPIO34' }) });
