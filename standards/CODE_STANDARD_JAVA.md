# Java Coding and Documentation Standard

## Overview

All Java code in this project must be documented using **JavaDoc**, the official documentation generator for Java included with the JDK.

## Key Principles

- Use `/** ... */` style blocks before all public classes, interfaces, methods, and member variables.
- The first sentence should be a concise summary of the element.
- Use tags like `@param`, `@return`, `@throws`, `@since`, and `@version` to provide structured details.

## Example

Below is an example of a well-documented Java class using JavaDoc.

```java
/**
 * Represents a simple calculator for integer arithmetic.
 *
 * @author  Hubert Williams
 * @version 1.0
 * @since   2025-10-16
 */
public class Calculator {

    /**
     * Calculates the sum of two integers.
     *
     * @param a The first integer to add.
     * @param b The second integer to add.
     * @return The sum of the two integers.
     */
    public int add(int a, int b) {
        return a + b;
    }
}
```
