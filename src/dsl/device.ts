import { Root } from './root.ts';
import { inScope } from './scope.ts';

/**
 * The root of a device's tree: everything `build` creates lands in it.
 * An async `build` makes the result a promise; scopes survive its awaits.
 * Example: device('bed-rf', () => { esp.esphome({ friendly_name: 'Bed RF' }); ... })
 */
export function device<B extends Build>(name: string, build: B): DeviceResult<B> {
  const root = new Root(name);
  const built = inScope(root, build);
  return (built instanceof Promise ? built.then(() => root) : root) as DeviceResult<B>;
}

type Build = () => void | Promise<void>;

type DeviceResult<B extends Build> = B extends () => Promise<unknown> ? Promise<Root> : Root;
