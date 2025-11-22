# Rust Coding and Documentation Standard

## Overview

All Rust code in this project must be documented using the built-in **`rustdoc`** tool. Documentation is written in Markdown and embedded directly in the source code.

## Key Principles

- Use `///` for doc comments that describe the item that follows them (functions, structs, etc.).
- Use `//!` for doc comments that describe the parent item (e.g., the module or crate).
- The documentation supports Markdown, allowing for rich formatting, code blocks, and links.
- A section for `Examples` is highly encouraged.

## Example

Below is an example of a well-documented Rust function.

```rust
//! A simple library for arithmetic operations.

/// Adds two integers together.
///
/// # Examples
///
/// ```
/// let result = my_crate::add(2, 2);
/// assert_eq!(result, 4);
/// ```
fn add(a: i32, b: i32) -> i32 {
    a + b
}
```
