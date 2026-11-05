/** A C++ member: a method when `params` is given (`'x: number'`, or `''`), else a property. */
export interface Member {
  params?: string;
  returns: string;
}

type Members = Record<string, Member>;

const call = (returns: string, params = ''): Member => ({ params, returns });
const prop = (returns: string): Member => ({ returns });

/** Classes that only appear as the type of something else. */
export const HELPER_INTERFACES: Record<string, Members> = {
  LightCall: {
    set_state: call('LightCall', 'on: boolean'),
    set_brightness: call('LightCall', 'brightness: number'),
    set_color_temperature: call('LightCall', 'kelvin: number'),
    set_transition_length: call('LightCall', 'ms: number'),
    perform: call('void'),
  },
  LightColorValues: {
    is_on: call('boolean'),
    get_brightness: call('number'),
    get_color_temperature: call('number'),
  },
  /** The `info` of an ESP-NOW receive trigger. */
  EspNowRecvInfo: {
    src_addr: prop('number[]'),
    des_addr: prop('number[]'),
  },
};

/** What `id(entity)` has inside `cpp()`, by the C++ class the entity derives from. */
export const ENTITY_MEMBERS: { cppClass: string; name: string; members: Members }[] = [
  {
    cppClass: 'sensor::Sensor',
    name: 'SensorMembers',
    members: {
      state: prop('number'),
      raw_state: prop('number'),
      has_state: call('boolean'),
      publish_state: call('void', 'value: number'),
    },
  },
  {
    cppClass: 'binary_sensor::BinarySensor',
    name: 'BinarySensorMembers',
    members: {
      state: prop('boolean'),
      has_state: call('boolean'),
      publish_state: call('void', 'value: boolean'),
    },
  },
  {
    cppClass: 'switch_::Switch',
    name: 'SwitchMembers',
    members: {
      state: prop('boolean'),
      turn_on: call('void'),
      turn_off: call('void'),
      toggle: call('void'),
      publish_state: call('void', 'value: boolean'),
    },
  },
  {
    cppClass: 'light::LightState',
    name: 'LightMembers',
    members: {
      remote_values: prop('LightColorValues'),
      current_values: prop('LightColorValues'),
      make_call: call('LightCall'),
      turn_on: call('LightCall'),
      turn_off: call('LightCall'),
      toggle: call('LightCall'),
    },
  },
];

/** `members.ts`: the interface for each of the above, and the `CppClasses` entry that picks it. */
export function membersSource(header: string): string {
  const declare = (name: string, members: Members): string =>
    `export interface ${name} {\n${Object.entries(members)
      .map(([key, m]) =>
        m.params === undefined ? `  ${key}: ${m.returns};` : `  ${key}(${m.params}): ${m.returns};`,
      )
      .join('\n')}\n}\n`;
  const classes = ENTITY_MEMBERS.map(({ cppClass, name }) => `    '${cppClass}': ${name};`);
  return [
    header,
    ...Object.entries(HELPER_INTERFACES).map(([name, members]) => declare(name, members)),
    ...ENTITY_MEMBERS.map(({ name, members }) => declare(name, members)),
    `declare module '../dsl/cpp.ts' {\n  interface CppClasses {\n${classes.join('\n')}\n  }\n}\n`,
  ].join('\n');
}
