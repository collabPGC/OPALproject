# Python Coding and Documentation Standard

## Overview

All Python code in this project must adhere to the **Google Python Style Guide** for documentation.

This format is clean, human-readable, and can be automatically parsed by tools like Sphinx (using the `napoleon` extension).

## Key Principles

- Use triple-quote `"""docstrings"""` for all modules, functions, classes, and methods.
- A docstring should begin with a short, one-line summary of the object's purpose.
- For complex functions, include sections like `Args:`, `Returns:`, and `Raises:`.

## Example

Below is an example of a well-documented function conforming to the Google style.

```python
def get_embedding(text, client, model="text-embedding-3-small"):
    """Generates an embedding for the given text.

    Args:
        text (str): The text content to embed.
        client (OpenAI): An initialized OpenAI client.
        model (str): The name of the embedding model to use.

    Returns:
        list[float]: The vector embedding for the text.
    """
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model=model).data[0].embedding
```

