# Go Coding and Documentation Standard

## Overview

All Go code in this project must be documented in a way that is compatible with **Godoc**, the built-in documentation tool for Go. Godoc enforces a minimalist and straightforward approach to documentation.

## Key Principles

- Write doc comments as plain, unwrapped text.
- Place the comment for a declaration immediately before it, with no intervening blank line.
- The first sentence of the comment should be a complete summary sentence.
- Godoc processes comments starting with `//` or within `/* ... */` blocks.

## Example

Below is an example of a well-documented Go function.

```go
// Package calculator provides simple arithmetic functions.
package calculator

// Add returns the sum of two integers.
// It is a basic implementation for demonstration purposes.
func Add(a, b int) int {
    return a + b
}
```
