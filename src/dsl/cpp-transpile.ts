import { createRequire } from 'node:module';
import type * as TS from 'typescript';
import { Entity } from './construct.ts';
import { Global } from './global.ts';
import {
  ESP_LOGD,
  ESP_LOGE,
  ESP_LOGI,
  ESP_LOGW,
  id,
  micros,
  millis,
  type Fn,
  type Scan,
} from './cpp.ts';
import { Tagged } from './tags.ts';

export function transpile(fn: Fn, scan?: Scan): Tagged {
  ts ??= createRequire(import.meta.url)('typescript') as typeof TS;
  return new Transpiler(scan).run(fn);
}

/** Loaded by the first `cpp()`, so a device without one never loads TypeScript. */
let ts: typeof TS;

/**
 * ESPHome's own functions, by identity so that `import { millis as ms }` still finds them.
 * Built on first use: cpp.ts imports this module, so its exports aren't ready while this loads.
 */
function ambientName(value: unknown): string | undefined {
  ambient ??= new Map(
    Object.entries({ millis, micros, ESP_LOGD, ESP_LOGI, ESP_LOGW, ESP_LOGE }).map(
      ([name, fn]) => [fn, name],
    ),
  );
  return ambient.get(value);
}

let ambient: Map<unknown, string> | undefined;

/** A name that isn't a captured variable. */
const UNKNOWN = Symbol('unknown');

/** The C++ type for a local's TypeScript annotation; anything else is `auto`. */
const CPP_TYPES: Record<string, string> = {
  u8: 'uint8_t',
  u16: 'uint16_t',
  u32: 'uint32_t',
  i8: 'int8_t',
  i16: 'int16_t',
  i32: 'int32_t',
  f32: 'float',
  boolean: 'bool',
  string: 'std::string',
};
const MATH: Record<string, string> = {
  abs: 'std::abs',
  min: 'std::min',
  max: 'std::max',
  floor: 'floorf',
  ceil: 'ceilf',
  round: 'roundf',
  sqrt: 'sqrtf',
};
const BINARY = new Set(
  [
    '+',
    '-',
    '*',
    '/',
    '%',
    '<',
    '>',
    '<=',
    '>=',
    '==',
    '!=',
    '&&',
    '||',
    '&',
    '|',
    '^',
    '<<',
    '>>',
  ].concat(['=', '+=', '-=', '*=', '/=', '%=']),
);
const ASSIGNMENT = new Set(['=', '+=', '-=', '*=', '/=', '%=']);

class Transpiler {
  private readonly used = new Set<Entity<any>>();
  /** Parameters and locals, which keep their names in C++. */
  private readonly names = new Set<string>();
  /** `const light = id(closetLight)`: a name for an entity, which C++ never sees. */
  private readonly views = new Map<string, Entity<any>>();
  private readonly captures: Record<string, unknown>;
  private readonly renames: Record<string, string>;
  private readonly scanned?: string;
  private source = '';

  constructor(scan?: Scan) {
    this.captures = scan?.captures ?? {};
    this.renames = scan?.renames ?? {};
    this.scanned = scan?.source;
  }

  run(fn: Fn): Tagged {
    // the loader's text keeps the annotations that type stripping erases
    this.source = this.scanned ?? fn.toString();
    const file = ts.createSourceFile(
      'lambda.ts',
      `(${this.source})`,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );
    const node = (file.statements[0] as TS.ExpressionStatement | undefined)?.expression;
    const arrow = node && ts.isParenthesizedExpression(node) ? node.expression : undefined;
    if (!arrow || !(ts.isArrowFunction(arrow) || ts.isFunctionExpression(arrow))) {
      throw new Error(`cpp() takes an arrow function, got: ${this.source}`);
    }
    for (const param of arrow.parameters) this.names.add(this.identifier(param.name));
    const code = ts.isBlock(arrow.body)
      ? this.statements(arrow.body.statements)
      : this.expressionBody(arrow.body);
    return new Tagged('lambda', code, [...this.used]);
  }

  /** What a name, or a chain like `ns.millis`, was when `cpp()` ran; locals aren't known then. */
  private value(node: TS.Expression): unknown {
    if (ts.isParenthesizedExpression(node)) return this.value(node.expression);
    if (ts.isIdentifier(node)) {
      return !this.names.has(node.text) && node.text in this.captures
        ? this.captures[node.text]
        : UNKNOWN;
    }
    if (ts.isPropertyAccessExpression(node)) {
      const base = this.value(node.expression);
      return (typeof base === 'object' || typeof base === 'function') && base !== null
        ? (base as Record<string, unknown>)[node.name.text]
        : UNKNOWN;
    }
    return UNKNOWN;
  }

  /** The entity an `id(...)` call names, or a name bound to one. */
  private idTarget(node: TS.Expression): Entity<any> | undefined {
    if (ts.isIdentifier(node)) return this.views.get(node.text);
    if (!ts.isCallExpression(node) || this.value(node.expression) !== id) return undefined;
    const entity = node.arguments.length === 1 ? this.value(node.arguments[0]) : UNKNOWN;
    if (!(entity instanceof Entity)) {
      this.fail(node, 'takes one entity from the enclosing code');
    }
    return entity;
  }

  //#region Statements

  private statements(list: readonly TS.Statement[]): string {
    return list
      .map((statement) => this.statement(statement))
      .filter(Boolean)
      .join('\n');
  }

  private statement(node: TS.Statement): string {
    if (ts.isExpressionStatement(node)) return `${this.expression(node.expression)};`;
    if (ts.isReturnStatement(node))
      return node.expression ? `return ${this.expression(node.expression)};` : 'return;';
    if (ts.isVariableStatement(node)) {
      return node.declarationList.declarations
        .map((declaration) => {
          const name = this.identifier(declaration.name);
          const view = declaration.initializer && this.idTarget(declaration.initializer);
          if (view) {
            this.names.add(name);
            this.views.set(name, view);
            return '';
          }
          const type = declaration.type ? this.cppType(declaration.type) : 'auto';
          if (!declaration.initializer) {
            if (type === 'auto') this.fail(declaration, 'needs a value or a type like f32');
            this.names.add(name);
            return `${type} ${name};`;
          }
          const value = this.initializer(declaration.initializer, type);
          this.names.add(name);
          return `${type} ${name} = ${value};`;
        })
        .filter(Boolean)
        .join('\n');
    }
    if (ts.isIfStatement(node)) {
      const otherwise = node.elseStatement ? ` else ${this.block(node.elseStatement)}` : '';
      return `if (${this.expression(node.expression)}) ${this.block(node.thenStatement)}${otherwise}`;
    }
    if (ts.isBlock(node)) return this.block(node);
    if (ts.isBreakStatement(node)) return 'break;';
    if (ts.isSwitchStatement(node)) {
      const clauses = node.caseBlock.clauses.map((clause) => {
        const label = ts.isCaseClause(clause)
          ? `case ${this.expression(clause.expression)}:`
          : 'default:';
        return `${label}\n${indent(this.statements(clause.statements))}`;
      });
      return `switch (${this.expression(node.expression)}) {\n${clauses.join('\n')}\n}`;
    }
    return this.fail(node, 'is not supported in a cpp() body');
  }

  private cppType(node: TS.TypeNode): string {
    let text = node.getText();
    // `import type { u8 as Byte }` and `type Byte = u8`, followed to the name it ends at
    for (let hops = 0; text in this.renames && hops < 8; hops++) text = this.renames[text];
    const type = CPP_TYPES[text];
    if (!type && text !== 'number')
      this.fail(node, 'is not a type cpp() knows: use u8, i32, f32, boolean or string');
    return type ?? 'auto';
  }

  /** A float local gets float literals, so `0.05` is `0.05f`. */
  private initializer(node: TS.Expression, type: string): string {
    const code = this.expression(node);
    return type === 'float' && /^-?\d+\.\d+$/.test(code) ? `${code}f` : code;
  }

  private block(node: TS.Statement): string {
    const inner = ts.isBlock(node) ? this.statements(node.statements) : this.statement(node);
    return `{\n${indent(inner)}\n}`;
  }

  /** An assignment or a call on an entity does something; any other expression is the value. */
  private expressionBody(node: TS.Expression): string {
    const acts =
      (ts.isBinaryExpression(node) && ASSIGNMENT.has(node.operatorToken.getText())) ||
      ts.isPostfixUnaryExpression(node) ||
      (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        !this.isMath(node.expression));
    const code = this.expression(node);
    return acts ? `${code};` : `return ${code};`;
  }

  //#endregion

  //#region Expressions

  private expression(node: TS.Expression): string {
    // keep hex as written, the way a byte reads in the protocol; `30_000` isn't C++
    if (ts.isNumericLiteral(node)) return /^0x/i.test(node.getText()) ? node.getText() : node.text;
    if (ts.isElementAccessExpression(node)) {
      return `${this.expression(node.expression)}[${this.expression(node.argumentExpression)}]`;
    }
    // a list is what a C++ function taking a vector reads: `return {0x10, on, level};`
    if (ts.isArrayLiteralExpression(node)) {
      return `{${node.elements.map((element) => this.expression(element)).join(', ')}}`;
    }
    if (ts.isStringLiteralLike(node)) return JSON.stringify(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
    if (ts.isParenthesizedExpression(node)) return `(${this.expression(node.expression)})`;
    if (ts.isIdentifier(node)) return this.name(node);
    if (ts.isPrefixUnaryExpression(node)) {
      const op = ts.tokenToString(node.operator)!;
      if (!['!', '-', '+', '~', '++', '--'].includes(op))
        this.fail(node, `the operator ${op} is not supported`);
      return `${op}${this.expression(node.operand)}`;
    }
    if (ts.isPostfixUnaryExpression(node))
      return `${this.expression(node.operand)}${ts.tokenToString(node.operator)}`;
    if (ts.isConditionalExpression(node)) {
      return `${this.expression(node.condition)} ? ${this.expression(node.whenTrue)} : ${this.expression(node.whenFalse)}`;
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.getText();
      const cpp = op === '===' ? '==' : op === '!==' ? '!=' : op;
      if (!BINARY.has(cpp)) this.fail(node, `the operator ${op} is not supported`);
      return `${this.expression(node.left)} ${cpp} ${this.expression(node.right)}`;
    }
    if (ts.isPropertyAccessExpression(node)) return this.member(node);
    if (ts.isCallExpression(node)) return this.call(node);
    return this.fail(node, 'is not supported in a cpp() body');
  }

  private name(node: TS.Identifier): string {
    const view = this.views.get(node.text);
    if (view) return this.reference(view);
    if (this.names.has(node.text)) return node.text;
    const value = this.value(node);
    if (value instanceof Entity) {
      return this.fail(node, `is an entity: its C++ members are on id(${node.text})`);
    }
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value === UNKNOWN) {
      return this.fail(
        node,
        'is not known here: a cpp() body uses constants and entities from the enclosing code, ' +
          'and only runs under the esphome-config loader',
      );
    }
    return this.fail(node, `is a ${typeof value}, which C++ can't use`);
  }

  private member(node: TS.PropertyAccessExpression): string {
    const entity = this.idTarget(node.expression);
    // a global is its value in C++: `id(tooHot).value` is `id(too_hot)`
    if (entity instanceof Global && node.name.text === 'value') return this.reference(entity);
    return `${this.expression(node.expression)}.${node.name.text}`;
  }

  private call(node: TS.CallExpression): string {
    const callee = node.expression;
    const entity = this.idTarget(node);
    if (entity) return this.reference(entity);
    if (ts.isIdentifier(callee) && this.names.has(callee.text)) {
      this.fail(
        node,
        `calls "${callee.text}", a local here: does it shadow \`id\` or an ESPHome function?`,
      );
    }
    const args = node.arguments.map((arg) => this.expression(arg)).join(', ');
    const name = ambientName(this.value(callee));
    if (name) return `${name}(${args})`;
    if (ts.isPropertyAccessExpression(callee) && this.isMath(callee))
      return `${MATH[callee.name.text]}(${args})`;
    if (ts.isPropertyAccessExpression(callee)) return `${this.expression(callee)}(${args})`;
    return this.fail(node, 'only ESPHome functions and methods of id(...) can be called');
  }

  private isMath(node: TS.PropertyAccessExpression): boolean {
    return (
      ts.isIdentifier(node.expression) && node.expression.text === 'Math' && node.name.text in MATH
    );
  }

  private reference(entity: Entity<any>): string {
    this.used.add(entity);
    return `id(${entity.id})`;
  }

  //#endregion

  private identifier(name: TS.BindingName): string {
    if (!ts.isIdentifier(name)) this.fail(name, 'needs a plain name');
    return (name as TS.Identifier).text;
  }

  private fail(node: TS.Node | undefined, message: string): never {
    const text = node?.getText().replace(/\s+/g, ' ') ?? '';
    throw new Error(`cpp(): \`${text}\` ${message}`);
  }
}

const indent = (code: string): string => code.replace(/^/gm, '  ');
