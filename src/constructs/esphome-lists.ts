import { Contribution, appendList, autoId, currentScope } from '../dsl/index.ts';
import type { Config } from '../dsl/index.ts';

/**
 * Entries for the lists of the `esphome:` block, addable from anywhere in the tree.
 * Example: esp.esphome.library('SPI'); esp.esphome.build_flag('-DFOO=1');
 */
export const esphomeLists = {
  include: listEntry('includes', 'include'),
  library: listEntry('libraries', 'library'),
  build_flag: listEntry('build_flags', 'build_flag'),
};

function listEntry(key: string, label: string) {
  return (value: string): Contribution => {
    const scope = currentScope();
    return new (class extends Contribution {
      contribute(blocks: Config): void {
        appendList(blocks, 'esphome', key, value);
      }
    })(scope, autoId(scope, undefined, label));
  };
}
