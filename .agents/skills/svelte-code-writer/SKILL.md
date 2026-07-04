---
name: svelte-code-writer
description: CLI tools and MCP server tools for Svelte 5 documentation lookup and code analysis. MUST be used whenever creating, editing or analyzing any Svelte component (.svelte) or Svelte module (.svelte.ts/.svelte.js).
---

# Svelte 5 Code Writer Skill

## Available Svelte MCP Tools
If the Svelte MCP server is active in the environment, use these tools to fetch documentation and validate code:
- **`svelte/list-sections`**: List all available Svelte 5 and SvelteKit documentation sections.
- **`svelte/get-documentation`**: Fetch full content for specific sections.
- **`svelte/svelte-autofixer`**: Statically analyze Svelte code and provide fixes/suggestions.
- **`svelte/playground-link`**: Generate a Svelte Playground link (use only after user confirmation).

## CLI Fallback
If direct MCP tools are not currently registered or active, use the `@sveltejs/mcp` CLI via `npx`:

### List Documentation Sections
```bash
npx -y @sveltejs/mcp list-sections
```

### Get Documentation
```bash
npx -y @sveltejs/mcp get-documentation "<section1>,<section2>,..."
```
Example:
```bash
npx -y @sveltejs/mcp get-documentation "$state,$derived,$effect"
```

### Svelte Autofixer
```bash
npx -y @sveltejs/mcp svelte-autofixer "<code_or_path>" [options]
```
Options:
- `--svelte-version <4|5>`: Target Svelte version (default: 5)
- `--async`: Enable async Svelte mode (default: false)

Example:
```bash
npx -y @sveltejs/mcp svelte-autofixer ./src/lib/Component.svelte
```
*Note: When passing raw code containing `$` characters in the terminal, make sure to escape them as `\$` to prevent shell expansion.*

## Workflow
1. **Understand Syntax**: Use `list-sections` then `get-documentation` to fetch up-to-date documentation.
2. **Implement**: Write clean Svelte 5 code using modern patterns (State over Stores, Snippets over Slots, etc.).
3. **Validate**: Always run `svelte-autofixer` (MCP or CLI) on updated/new files before completing the task. Loop until no issues remain.
