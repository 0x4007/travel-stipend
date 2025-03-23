# JSDoc Comment Removal Tools

This directory contains scripts to remove JSDoc style comments from TypeScript files. These tools are useful for cleaning up code and reducing file sizes by removing documentation comments.

## Available Scripts

### 1. Remove JSDoc Comments from All TypeScript Files

Removes JSDoc comments from all TypeScript files in specified directories.

```bash
# Remove JSDoc comments from default directories (src, tests, build)
bun run remove-jsdoc

# Remove JSDoc comments from a specific directory
bun run remove-jsdoc:src  # Processes only the src directory
```

### 2. Remove JSDoc Comments from a Specific File

Removes JSDoc comments from a single TypeScript file.

```bash
# Remove JSDoc comments from a specific file
bun run remove-jsdoc:file path/to/your/file.ts
```

## How It Works

These scripts use regular expressions to identify and remove JSDoc style comments (comments that start with `/**` and end with `*/`). They preserve all other code and regular comments.

### Example

Before:

```typescript
/**
 * This is a JSDoc comment that will be removed.
 * @param {string} param1 - A parameter description
 * @returns {boolean} - Return value description
 */
function testFunction(param1: string): boolean {
  return param1.length > 0;
}

// This is a regular comment that will be preserved
const regularVariable = 42;
```

After:

```typescript
function testFunction(param1: string): boolean {
  return param1.length > 0;
}

// This is a regular comment that will be preserved
const regularVariable = 42;
```

## Implementation Details

The scripts use a simple regex pattern (`/\/\*\*[\s\S]*?\*\//g`) to match JSDoc comments and replace them with an empty string. This approach is efficient and works well for most TypeScript files.

## Notes

- These scripts only remove JSDoc style comments (`/** ... */`), not regular comments (`// ...` or `/* ... */`).
- The scripts modify files in place, so make sure to commit your changes before running them if you want to be able to revert.
- For large codebases, consider running the scripts on specific directories or files rather than the entire project.
