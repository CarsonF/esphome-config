import { Contribution, appendList, currentScope, flat } from '../dsl/index.ts';
import type { Action, Config, Many } from '../dsl/index.ts';
import type { Api } from '../generated/index.ts';

type Route = NonNullable<Api.Props['actions']>[number];

export interface ApiActionProps extends Omit<Route, 'action' | 'service' | 'then'> {
  then: Many<Action>;
}

/**
 * An action Home Assistant can call, named by its id, declared anywhere in the tree.
 * Example: esp.api.action('send_flat', { variables: { frames: 'int' }, then: [...] });
 */
export function apiAction(id: string, props: ApiActionProps): Contribution {
  return new (class extends Contribution {
    contribute(blocks: Config): void {
      appendList(blocks, 'api', 'actions', { action: id, ...props, then: flat([props.then]) });
    }
  })(currentScope(), id);
}
