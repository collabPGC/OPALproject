# Self-Debugger Directives

## Overview
This document outlines the procedure for using web search for advanced debugging and problem-solving when internal methods are insufficient. This process should be considered a primary option when encountering complex logical errors, conceptual misunderstandings, or repetitive failure loops.

## Primary Tool
The designated tool for this process is `google_web_search`.

## Procedure

When a debugging scenario meets the criteria for external assistance, the following steps should be taken:

1.  **Formulate a Search Query:** Construct a clear and concise search query that encapsulates the problem. The query should include:
    - The primary goal or technology.
    - The specific error message or issue being encountered.
    - Key terms from relevant code snippets or logs.

2.  **Execute the Search:** Call the `google_web_search` tool with the formulated query.

    **Example Usage:**
    ```python
    default_api.google_web_search(query="github repository 'permission denied' https authentication")
    ```

3.  **Analyze the Results:** Review the search results for potential solutions, explanations, or alternative approaches.

4.  **Integrate and Retry:** Based on the information gathered, formulate a new plan and attempt to resolve the issue.

## Activation Criteria

This protocol should be activated if:

- A task has failed three or more times with different approaches.
- The error message is ambiguous and internal search/analysis does not yield a solution.
- The problem is suspected to be conceptual rather than a simple syntax error.
