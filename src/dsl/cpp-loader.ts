import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Makes `cpp(() => ...)` see the file around it, by adding a second argument:
 * `cpp(() => { id(tooHot).value = true; })` becomes
 * `cpp(() => { ... }, { captures: { id, tooHot }, ... })`.
 * Register it before importing the files that call `cpp`.
 */
export function registerCppLoader(): void {
  if (registered) return;
  registered = true;
  registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (!url.endsWith('.ts') || isLibrary(url)) return loaded;
      const source = String(loaded.source);
      // an alias (`import { cpp as fn }`) still spells the name once
      if (!/\bcpp\b/.test(source)) return loaded;
      return { ...loaded, source: captureFreeVariables(source, fileURLToPath(url)) };
    },
  });
}

let registered = false;

/** This package, generated code and other dependencies never call `cpp`. */
const isLibrary = (url: string): boolean =>
  url.startsWith(LIBRARY) || /\/(node_modules|generated)\//.test(url);

/** This package's own files: src in development, dist when installed. */
const LIBRARY = new URL('..', import.meta.url).href;

/** Globals a body can mention without having captured them. */
const IGNORED = new Set(['Math', 'undefined', 'NaN', 'Infinity']);

export function captureFreeVariables(source: string, path = 'device.ts'): string {
  // TypeScript is only loaded for a file that has a `cpp(` call
  const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ESNext, true);
  const edits: { at: number; text: string }[] = [];
  const { cppNames, renames } = aliases(ts, file);

  const visit = (node: import('typescript').Node): void => {
    if (
      ts.isCallExpression(node) &&
      isCpp(ts, node.expression, cppNames) &&
      node.arguments.length === 1
    ) {
      const [fn] = node.arguments;
      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
        const names = freeVariables(ts, fn);
        // the original text keeps the annotations, like `const on: u8 = 1`, that Node strips
        edits.push({
          at: fn.end,
          text: `, { captures: { ${names.join(', ')} }, source: ${JSON.stringify(fn.getText())}, renames: ${JSON.stringify(renames)} }`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return edits
    .sort((a, b) => b.at - a.at)
    .reduce((text, { at, text: insert }) => text.slice(0, at) + insert + text.slice(at), source);
}

type TS = typeof import('typescript');

const isCpp = (
  ts: TS,
  callee: import('typescript').Expression,
  cppNames: ReadonlySet<string>,
): boolean =>
  (ts.isIdentifier(callee) && cppNames.has(callee.text)) ||
  (ts.isPropertyAccessExpression(callee) && callee.name.text === 'cpp');

/**
 * The names a file gives things `cpp()` cares about.
 * `cppNames`: `cpp` itself,
 * from `import { cpp as run }`, `const run = esp.cpp` and `const { cpp: run } = esp`.
 * `renames`: type names, from `import type { u8 as Byte }` and `type Byte = u8`.
 */
function aliases(
  ts: TS,
  file: import('typescript').SourceFile,
): { cppNames: Set<string>; renames: Record<string, string> } {
  const cppNames = new Set(['cpp']);
  const renames: Record<string, string> = {};
  const visit = (node: import('typescript').Node): void => {
    if (ts.isImportSpecifier(node) && node.propertyName) {
      const imported = node.propertyName.text;
      if (imported === 'cpp') cppNames.add(node.name.text);
      else renames[node.name.text] = imported;
    }
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeReferenceNode(node.type)) {
      renames[node.name.text] = node.type.typeName.getText();
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer;
      const isCppValue =
        (ts.isPropertyAccessExpression(init) && init.name.text === 'cpp') ||
        (ts.isIdentifier(init) && cppNames.has(init.text));
      if (isCppValue && ts.isIdentifier(node.name)) cppNames.add(node.name.text);
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const key = element.propertyName ?? element.name;
          if (ts.isIdentifier(key) && key.text === 'cpp' && ts.isIdentifier(element.name)) {
            cppNames.add(element.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { cppNames, renames };
}

/** Names the function reads that it doesn't declare: its parameters and locals are its own. */
function freeVariables(
  ts: TS,
  fn: import('typescript').ArrowFunction | import('typescript').FunctionExpression,
): string[] {
  const declared = new Set<string>();
  const used = new Set<string>();
  const declare = (name: import('typescript').BindingName): void => {
    if (ts.isIdentifier(name)) declared.add(name.text);
    else name.elements.forEach((element) => ts.isBindingElement(element) && declare(element.name));
  };
  fn.parameters.forEach((param) => declare(param.name));

  const visit = (node: import('typescript').Node): void => {
    // type names like `u8` are erased, so they aren't variables
    if (ts.isTypeNode(node)) return;
    if (ts.isVariableDeclaration(node)) declare(node.name);
    if (ts.isIdentifier(node) && isReference(ts, node)) used.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return [...used].filter((name) => !declared.has(name) && !IGNORED.has(name));
}

/** An identifier that reads a variable, rather than naming a property or a declaration. */
function isReference(ts: TS, node: import('typescript').Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.expression === node;
  if (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent))
    return parent.name !== node;
  if (ts.isBindingElement(parent)) return parent.propertyName !== node && parent.name !== node;
  if (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) return parent.name !== node;
  return true;
}
