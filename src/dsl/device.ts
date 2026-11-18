import { Root, type Build } from './root.ts';

/**
 * The root of a device's tree: everything `build` creates lands in it.
 * `build` waits until the device is rendered or loaded, so a device file can import other
 * devices' exports, cyclically, and an async `build` needs `await root.load()` before rendering.
 * Example: device('bed-rf', () => { esp.esphome({ friendly_name: 'Bed RF' }); ... })
 */
export function device(name: string, build: Build): Root {
  return new Root(name, build);
}
