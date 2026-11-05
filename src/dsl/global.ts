import { autoId, Entity, type Cpp } from './construct.ts';
import type { Construct } from './construct.ts';
import { currentScope } from './scope.ts';
import { lambda, type Action, type Config } from './tags.ts';

export interface GlobalProps<T extends boolean | number | string = boolean | number | string> {
  /** Required with `restore_value`, which stores the value under this exact id, in any scope. */
  id?: string;
  initial_value: T;
  /** Follows `initial_value` unless given: bool, int, float or std::string. */
  type?: string;
  restore_value?: boolean;
  max_restore_data_length?: number;
}

/**
 * A `globals:` variable.
 * Example: const tooHot = esp.global({ id: 'too_hot', initial_value: false });
 */
export const globals = <T extends boolean | number | string>(
  props: GlobalProps<T>,
): Global<Widen<T>> => {
  const scope = currentScope();
  const { id, initial_value, ...rest } = props;
  if (rest.restore_value && !id) throw new Error('a global with restore_value needs an id');
  return new Global<Widen<T>>(scope, id ?? autoId(scope, undefined, 'global'), initial_value, rest);
};

/** `false` is a `boolean`, not the literal type. */
type Widen<T> = T extends boolean ? boolean : T extends number ? number : string;

export class Global<Value = unknown> extends Entity {
  // the value's type rides on the brand, for `id(global).value`
  declare readonly cpp: Cpp<'globals::GlobalsComponent'> & { readonly valueType?: Value };

  private readonly restores: boolean;

  /** A global that restores its value keeps its id as given: the stored value is found by it. */
  override get id(): string {
    return this.restores ? this.localId : super.id;
  }

  constructor(
    scope: Construct,
    id: string,
    initial: boolean | number | string,
    props: Config = {},
  ) {
    const type =
      typeof initial === 'boolean'
        ? 'bool'
        : typeof initial === 'string'
          ? 'std::string'
          : Number.isInteger(initial)
            ? 'int'
            : 'float';
    super(
      scope,
      id,
      { domain: 'globals', id: 'always' },
      { type, initial_value: String(initial), ...props },
    );
    this.restores = props.restore_value === true;
  }

  /** `value` is a C++ expression, e.g. `x > 30.0`. */
  assign(value: string): Action {
    return { 'globals.set': { id: this, value: lambda`return ${value};` } };
  }
}
