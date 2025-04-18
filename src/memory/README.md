# Memory MCP Server with Dynamic Memory File Support

This MCP server provides a knowledge graph memory system for Claude. It enables storing entities, relations, and observations with full dynamic memory file selection.

## Features

- Create and manage entities with observations
- Create relationships between entities
- Search and retrieve nodes from the knowledge graph
- **Dynamic memory file selection:** Change the memory file at runtime without restarting the server

## Usage

### Installation

```bash
npx @modelcontextprotocol/server-memory
```

### Environment Variables

- `MEMORY_FILE_PATH`: Set the initial path for the memory file (optional, defaults to `memory.json` in the server directory)

### New API Tools

This fork adds new API tools for dynamic memory file management:

#### 1. `set_memory_file`
Changes the memory file path used for storing the knowledge graph.

**Input:**
```json
{
  "path": "path/to/your/memory-file.json" 
}
```

The path can be absolute or relative to the server directory.

#### 2. `get_memory_file`
Returns the current memory file path being used.

#### 3. `health_check` 
Checks if the server is running and returns the current memory file path.

## Use Cases

This dynamic memory file feature enables:

1. **Multiple memory contexts:** Switch between different knowledge bases
2. **Backup and restore:** Create snapshots by switching files
3. **User-specific memories:** Change memory files based on user identity
4. **Isolation for testing:** Use temporary memory files

## Example

```javascript
// Get current memory file
const result = await callTool("get_memory_file");
console.log(`Current memory file: ${result}`);

// Switch to a different memory file
await callTool("set_memory_file", { 
  path: "team-project-memory.json" 
});

// Verify the change
const healthCheck = await callTool("health_check");
console.log(healthCheck);
```
