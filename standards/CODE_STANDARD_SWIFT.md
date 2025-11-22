# Swift Coding and Documentation Standard

## Overview

All Swift code in this project must be documented using the **Swift Markup** language, which is processed by the built-in documentation compiler in Xcode.

## Key Principles

- Use `///` for single-line doc comments or `/** ... */` for multi-line blocks.
- The documentation is written in a variant of Markdown.
- Use a hyphen (`-`) for list items like parameters and returns.
- Use keywords like `Parameter`, `Returns`, and `Throws` to structure the documentation.

## Example

Below is an example of a well-documented Swift function.

```swift
/**
 Greets a person by name.

 - Parameter name: The name of the person to greet.
 - Returns: A greeting string.
*/
func greet(name: String) -> String {
    return "Hello, \(name)!"
}
```
