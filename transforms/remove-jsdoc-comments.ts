import { Transform } from 'jscodeshift';

/**
 * This transform removes JSDoc style comments from TypeScript files.
 * It preserves the code structure while removing comments that match the JSDoc pattern.
 */
function transform(file: { source: string }, /* eslint-disable-line @typescript-eslint/no-unused-vars */ api: unknown): string {
  // A simpler approach: use regex to remove JSDoc comments
  // This is more reliable than AST manipulation for comments
  let source = file.source;

  // Regex to match JSDoc comments (/** ... */)
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;

  // Replace JSDoc comments with empty string
  source = source.replace(jsdocRegex, '');

  // Return the modified source
  return source;
}

export default transform as Transform;
