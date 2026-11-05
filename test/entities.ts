import {
  Entity,
  entityFactory,
  type Automation,
  type Config,
  type Kind,
  type Many,
  type Step,
} from '../src/index.ts';

/** Stand-ins for generated classes, with the kinds the generator gives them. */

export const sensor = entityFactory(
  class Sensor extends Entity {
    constructor(scope: ConstructorParameters<typeof Entity>[0], id: string, props: Config) {
      super(scope, id, SENSOR, props);
    }

    on_value(...actions: Many<Step>[]): Automation {
      return this.on('on_value', actions);
    }
  },
  'sensor',
);

export const wifi = entityFactory(kindClass({ domain: 'wifi', shape: 'single' }), 'wifi');

export const i2c = entityFactory(kindClass({ domain: 'i2c', shape: 'listable' }), 'i2c');

export const script = entityFactory(
  kindClass({ domain: 'script', id: 'always', steps: ['then'] }),
  'script',
);

const SENSOR: Kind = {
  domain: 'sensor',
  platform: 'adc',
  triggers: ['on_value'],
  steps: ['filters'],
  id: 'unlessNamed',
};

function kindClass(kind: Kind) {
  return class extends Entity {
    constructor(scope: ConstructorParameters<typeof Entity>[0], id: string, props: Config) {
      super(scope, id, kind, props);
    }
  };
}
