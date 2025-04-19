# Memory MCP Server with Index-First Architecture

This MCP server provides a knowledge graph memory system for Claude with efficient index-first architecture. It enables storing entities, relations, and observations with optimized context window usage and performance.

## Features

- **Index-First Architecture:** Optimized for reduced context window usage
- **Progressive Entity Loading:** Only load the entities you need
- **Enhanced Search:** Use targeted entity and relation retrieval
- **Automatic Indexing:** Metadata and relationship indexing for performance
- **Dynamic Memory File Support:** Change memory files at runtime
- **Backward Compatibility:** Automatic migration for legacy files

## Usage

### Installation

```bash
npx @modelcontextprotocol/server-memory-dynamic
```

### Environment Variables

- `MEMORY_FILE_PATH`: Set the initial path for the memory file (optional, defaults to `memory.json` in the server directory)

### New API Tools

#### Index-First Operations

- `read_index`: Get just the index metadata (lightweight operation)
- `expand_entity`: Load a single entity by name
- `get_entities_by_type`: Get all entities of a specific type
- `get_relations_by_type`: Get all relations of a specific type

#### Dynamic Memory Management

- `set_memory_file`: Change the memory file path
- `get_memory_file`: Get the current memory file path
- `health_check`: Check server status with index support info

#### Legacy Operations (High-Context)

- `read_graph`: Read the entire graph (marked as high-context)
- All other operations from the original server

### Migration Utility

Convert existing memory files to the new indexed format:

```bash
npx @modelcontextprotocol/server-memory-dynamic migrate
```

Or programmatically:

```javascript
import { migrateFile } from '@modelcontextprotocol/server-memory-dynamic/migrate';
await migrateFile('old-memory.json', 'indexed-memory.json');
```

## Optimized Usage Examples

### Efficient Knowledge Graph Initialization

```javascript
// Legacy high-context approach
const graph = await callTool("read_graph");
// Process entire graph...

// New index-first approach
const index = await callTool("read_index");
// Just see what entities exist without loading full content
```

### Targeted Entity Loading

```javascript
// Get a single entity without loading the entire graph
const entity = await callTool("expand_entity", { 
  name: "CustomerSegment" 
});

// Get all entities of a specific type
const configurations = await callTool("get_entities_by_type", { 
  entityType: "Configuration" 
});
```

### Enhanced Search

```javascript
// Find entities related to a specific concept
const results = await callTool("search_nodes", { 
  query: "marketing strategy" 
});

// Find all relations of a specific type
const connections = await callTool("get_relations_by_type", { 
  relationType: "depends_on" 
});
```

## Benefits

- **Context Efficiency:** Up to 90% reduction in context usage for large graphs
- **Performance:** Faster retrieval with indexed operations
- **Progressive Loading:** Only load what you need when you need it
- **Zero-Downtime Migration:** Automatic conversion of legacy files
