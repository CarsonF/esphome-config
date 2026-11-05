import { flat } from '../dsl/index.ts';
import type { Step } from '../dsl/index.ts';
import { actions } from '../generated/index.ts';

type WhileProps = Parameters<typeof actions.while>[0];

/**
 * Runs `then` once, then again for as long as `condition` holds; ESPHome has no `do_while`.
 * Example: actions.doWhile({ condition: sw.is_on(), then: [send, esp.actions.delay('120ms')] })
 */
export function doWhile(props: WhileProps): Step[] {
  return [...flat([props.then]), actions.while(props)];
}
