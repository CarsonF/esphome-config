import { Entity, plain } from '../dsl/index.ts';
import type { Action } from '../dsl/index.ts';
import { esp } from '../esp.ts';

type Level = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE';

/**
 * A `logger.log` step; an entity argument is read as `id(<id>)`, and other strings are C++.
 * Example: log.info('fan', 'too hot: %d', tooHot)
 */
export const log = {
  error: logAt('ERROR'),
  warn: logAt('WARN'),
  info: logAt('INFO'),
  debug: logAt('DEBUG'),
  verbose: logAt('VERBOSE'),
};

function logAt(level: Level) {
  return (tag: string, format: string, ...args: Array<Entity | string | number>): Action =>
    esp.actions.logger.log({
      tag,
      level,
      format,
      args: args.map((arg) => (arg instanceof Entity ? plain(`id(${arg.id})`, arg) : String(arg))),
    });
}
