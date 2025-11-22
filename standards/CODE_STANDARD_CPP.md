# C++ Coding and Documentation Standard

## Overview

All C++ code in this project should be documented using **Doxygen**-compatible comments. This ensures consistency with C and leverages a powerful, industry-standard documentation generator.

## Key Principles

- Use `/** ... */` style blocks or `///` line comments before classes, methods, functions, and files.
- Use tags like `\param`, `\return`, `\brief`, and `\class` to provide structured information.
- Document classes and their members thoroughly.

## Example

Below is an example of a well-documented C++ class using Doxygen style.

```cpp
/**
 * @class Rectangle
 * @brief A class to represent a rectangle.
 *
 * This class stores the dimensions of a rectangle and can compute its area.
 */
class Rectangle {
public:
    /**
     * @brief Sets the dimensions of the rectangle.
     * @param w The width of the rectangle.
     * @param h The height of the rectangle.
     */
    void setDimensions(int w, int h) {
        width = w;
        height = h;
    }

    /**
     * @brief Calculates the area of the rectangle.
     * @return The area of the rectangle.
     */
    int getArea() {
        return width * height;
    }

private:
    int width;  ///< The width of the rectangle.
    int height; ///< The height of the rectangle.
};
```

