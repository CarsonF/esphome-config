import { esp } from '../src/index.ts';

/** Type-checked; never run. */
export function shorthand(): void {
  // `cv.maybe_simple_value`: a variable is `{ type }`, or the type alone
  esp.api({
    actions: [
      { action: 'a', variables: { frames: 'int', label: { type: 'string' } }, then: [] },
    ],
  });
  // @ts-expect-error the type is one of the schema's
  esp.api({ actions: [{ action: 'b', variables: { frames: 'integer' }, then: [] }] });
}
