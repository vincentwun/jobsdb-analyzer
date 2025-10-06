# JobsDB Analyzer: Agent Workflow TODO

## 1. Map-Reduce Agent Workflow

- Design data splitting utility to break the big JSON into batches (fit within LLM context window, e.g., 100K tokens per batch)
- Implement Coordinator Agent:
    - Reads the full job list JSON
    - Splits data into N batches
    - Assigns each batch to a Worker Agent
- Implement Worker Agent:
    - Analyzes a batch (extracts skills, certifications, experience, locations)
    - Outputs result in standard JSON format
    - Handles batch errors and retries if needed
- Implement Aggregator Agent:
    - Collects all Worker results
    - Merges results (aggregating stats, frequencies, deduplicating lists)
    - Produces final summary report and charts
- Add parallel execution logic (limit to reasonable concurrency, e.g., max 10 parallel calls)
- Integrate status/progress tracking for long job runs
- Add automated tests for data splitting, merging, error handling
- Document the workflow and usage in README

---

## 2. Hierarchical Agent Workflow

- Design a Master Agent that defines multiple specialized analysis tasks (e.g., skills, certifications, experience, locations)
- For each specialized task, implement a Specialist Agent:
    - Receives targeted job list (e.g., all jobs with AWS certification)
    - Performs in-depth extraction and analysis only on the relevant field
    - If input is still too large, uses Map-Reduce internally to split workload
- Implement logic to allow Specialist Agents to communicate findings (e.g., cross-reference between skills and locations)
- Master Agent collects and correlates all results, synthesizes insights (e.g., "Jobs with AWS certification mostly require 3+ years experience")
- Add error handling for dependencies (if one agent fails, handle gracefully)
- Consider providing “insight” and “explanation” fields in final output
- Add tests for each type of Specialist Agent
- Update documentation to explain new agent structure and responsibilities

---

## General

- Monitor API token usage and costs
- Optionally add result caching to avoid repeated analysis on same data
- Prepare visualizations for all aggregate outputs
