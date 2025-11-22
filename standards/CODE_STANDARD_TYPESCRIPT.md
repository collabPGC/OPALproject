# TypeScript Coding and Documentation Standard

## Overview

All TypeScript code in this project should be documented using **TSDoc**. TSDoc is a proposal to standardize a subset of JSDoc for use with TypeScript, ensuring a consistent and machine-readable documentation format.

## Key Principles

- Use `/** ... */` style blocks before all exported functions, classes, interfaces, and methods.
- Use standard block tags like `@param`, `@returns`, and `@remarks`.
- TSDoc is stricter than JSDoc; avoid non-standard tags.

## Example

Below is an example of a well-documented TypeScript function using TSDoc.

```typescript
/**
 * Adds two numbers together.
 *
 * @remarks
 * This is a simple demonstration function.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The sum of the two numbers.
 */
export function add(a: number, b: number): number {
  return a + b;
}
```
