import type {
  ArgumentPlaceholder,
  Expression,
  SpreadElement,
  V8IntrinsicIdentifier,
} from '@babel/types';

export interface ParsedFunctionSpec {
  raw: string;
  type: 'identifier' | 'member';
  /** For 'identifier': the function name */
  name?: string;
  /** For 'member': the object and property */
  object?: string;
  property?: string;
}

export function parseFunctionSpec(spec: string): ParsedFunctionSpec {
  const dot = spec.indexOf('.');
  if (dot === -1) {
    return { raw: spec, type: 'identifier', name: spec };
  }
  return {
    raw: spec,
    type: 'member',
    object: spec.slice(0, dot),
    property: spec.slice(dot + 1),
  };
}

export function matchesCallee(
  callee: Expression | V8IntrinsicIdentifier,
  fn: ParsedFunctionSpec,
): boolean {
  if (fn.type === 'identifier') {
    return callee.type === 'Identifier' && callee.name === fn.name;
  }

  if (fn.type === 'member') {
    return (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.object.type === 'Identifier' &&
      callee.object.name === fn.object &&
      callee.property.type === 'Identifier' &&
      callee.property.name === fn.property
    );
  }

  return false;
}

/**
 * Extracts a static namespace string from a namespace-hook call's first
 * argument, supporting both `useTranslations("Namespace")` and
 * `getTranslations({ namespace: "Namespace" })` shapes.
 */
export function extractStaticNamespace(
  arg: Expression | SpreadElement | ArgumentPlaceholder | undefined,
): string | undefined {
  if (!arg || arg.type === 'ArgumentPlaceholder' || arg.type === 'SpreadElement') {
    return undefined;
  }

  if (arg.type === 'StringLiteral') {
    return arg.value;
  }

  if (arg.type === 'ObjectExpression') {
    for (const prop of arg.properties) {
      if (
        prop.type === 'ObjectProperty' &&
        !prop.computed &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'namespace' &&
        prop.value.type === 'StringLiteral'
      ) {
        return prop.value.value;
      }
    }
  }

  return undefined;
}

/**
 * Extracts the namespace argument identifier name from a namespace-hook
 * call's first argument, when it references a variable rather than a
 * literal — e.g. `useTranslations(featureNamespace)` or
 * `getTranslations({ namespace: featureNamespace })`. Used to trace a wrapper
 * hook's own parameter back to the namespace its caller passed in.
 */
export function extractNamespaceParamRef(
  arg: Expression | SpreadElement | ArgumentPlaceholder | undefined,
): string | undefined {
  if (!arg || arg.type === 'ArgumentPlaceholder' || arg.type === 'SpreadElement') {
    return undefined;
  }

  if (arg.type === 'Identifier') {
    return arg.name;
  }

  if (arg.type === 'ObjectExpression') {
    for (const prop of arg.properties) {
      if (
        prop.type === 'ObjectProperty' &&
        !prop.computed &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'namespace' &&
        prop.value.type === 'Identifier'
      ) {
        return prop.value.name;
      }
    }
  }

  return undefined;
}
