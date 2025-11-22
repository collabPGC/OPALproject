# C Coding and Documentation Standard

## Overview

All C code in this project should be documented using **Doxygen**-compatible comments. Doxygen is a robust tool that generates documentation from annotated source code.

## Key Principles

- Use `/** ... */` style blocks or `///` line comments before functions, structs, enums, and files.
- Use tags like `\param`, `\return`, and `\brief` to provide structured information.
- A file should begin with a `\file` block describing its purpose.

## Example

Below is an example of a well-documented C function using Doxygen style.

```c
/**
 * @file calculator.c
 * @brief A simple integer calculator.
 * 
 * This file contains functions for basic arithmetic operations.
 */

/**
 * @brief Adds two integers together.
 * 
 * This function takes two integer parameters and returns their sum.
 * 
 * @param a The first integer.
 * @param b The second integer.
 * @return int The sum of a and b.
 */
int add(int a, int b) {
    return a + b;
}
```

```