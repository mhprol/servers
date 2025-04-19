#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowledgeGraphManager } from './src/knowledge-graph-manager.js';
import { Entity, Relation } from './src/graph-types.js';

// Define memory file path using environment variable with fallback
const defaultMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.json');

// If MEMORY_FILE_PATH is just a filename, put it in the same directory as the script
let MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH
  ? path.isAbsolute(process.env.MEMORY_FILE_PATH)
    ? process.env.MEMORY_FILE_PATH
    : path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.MEMORY_FILE_PATH)
  : defaultMemoryPath;

// Create knowledge graph manager with the indexed architecture
const knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);

// The server instance and tools exposed to Claude
const server = new Server({
  name: "memory-server",
  version: "2.0.0", // Version bump for index-first architecture
},    {
    capabilities: {
      tools: {},
    },
  },);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  contents: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
              },
            },
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities and their associated relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: { 
              type: "array", 
              items: { type: "string" },
              description: "An array of entity names to delete" 
            },
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "Delete specific observations from entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            relations: { 
              type: "array", 
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
              description: "An array of relations to delete" 
            },
          },
          required: ["relations"],
        },
      },
      // New optimized endpoint (preferred over read_graph)
      {
        name: "read_index",
        description: "Read only the index structure of the knowledge graph (lightweight operation)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // Legacy endpoint (marked as high-context)
      {
        name: "read_graph",
        description: "Read the entire knowledge graph (HIGH-CONTEXT OPERATION, use read_index when possible)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // Enhanced search endpoint
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query (index-optimized)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
          },
          required: ["query"],
        },
      },
      // New endpoint for targeted entity expansion
      {
        name: "expand_entity",
        description: "Get detailed information about a specific entity by name",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The name of the entity to expand" },
          },
          required: ["name"],
        },
      },
      // Optimized version of open_nodes
      {
        name: "open_nodes",
        description: "Open specific nodes in the knowledge graph by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
          },
          required: ["names"],
        },
      },
      // New endpoint for getting entities by type
      {
        name: "get_entities_by_type",
        description: "Get all entities of a specific type",
        inputSchema: {
          type: "object",
          properties: {
            entityType: { type: "string", description: "The type of entities to retrieve" },
          },
          required: ["entityType"],
        },
      },
      // New endpoint for getting relations by type
      {
        name: "get_relations_by_type",
        description: "Get all relations of a specific type",
        inputSchema: {
          type: "object",
          properties: {
            relationType: { type: "string", description: "The type of relations to retrieve" },
          },
          required: ["relationType"],
        },
      },
      // Health check remains unchanged
      {
        name: "health_check",
        description: "Check if the server is running and can access its resources",
        inputSchema: {
          type: "object",
          properties: {},
          title: "health_checkArguments",
        },
      },
      // Memory file operations remain unchanged
      {
        name: "set_memory_file",
        description: "Change the memory file path used for storing the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            path: { 
              type: "string", 
              description: "New file path for the memory file. Can be absolute or relative to the server directory." 
            },
          },
          required: ["path"],
        },
      },
      {
        name: "get_memory_file",
        description: "Get the current memory file path used for storing the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (args === undefined && 
      name !== "health_check" && 
      name !== "get_memory_file" &&
      name !== "read_graph" &&
      name !== "read_index") {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    // Entity operations
    case "create_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createEntities(args?.entities as Entity[] || []), null, 2) }] };
    
    case "expand_entity":
      const entity = await knowledgeGraphManager.expandEntity(args?.name as string || "");
      if (!entity) {
        return { content: [{ type: "text", text: `Entity with name "${args?.name}" not found` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(entity, null, 2) }] };
    
    case "get_entities_by_type":
      const entitiesByType = await knowledgeGraphManager.storageManager.getEntitiesByType(args?.entityType as string || "");
      return { content: [{ type: "text", text: JSON.stringify(entitiesByType, null, 2) }] };
    
    // Relation operations
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createRelations(args?.relations as Relation[] || []), null, 2) }] };
    
    case "get_relations_by_type":
      const relationsByType = await knowledgeGraphManager.storageManager.getRelationsByType(args?.relationType as string || "");
      return { content: [{ type: "text", text: JSON.stringify(relationsByType, null, 2) }] };
    
    // Observation operations
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addObservations(args?.observations as { entityName: string; contents: string[] }[] || []), null, 2) }] };
    
    // Delete operations
    case "delete_entities":
      await knowledgeGraphManager.deleteEntities(args?.entityNames as string[] || []);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    
    case "delete_observations":
      await knowledgeGraphManager.deleteObservations(args?.deletions as { entityName: string; observations: string[] }[] || []);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    
    case "delete_relations":
      await knowledgeGraphManager.deleteRelations(args?.relations as Relation[] || []);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    
    // Read operations
    case "read_index":
      const indexStructure = await knowledgeGraphManager.readIndex();
      // Prepare index for serialization (Maps need special handling)
      const serializableIndex = {
        metadata: indexStructure.metadata,
        entityIndices: Object.fromEntries(indexStructure.entityIndices),
        typeIndices: Object.fromEntries(
          Array.from(indexStructure.typeIndices.entries()).map(
            ([type, entities]) => [type, Array.from(entities)]
          )
        ),
        relationIndices: Object.fromEntries(
          Array.from(indexStructure.relationIndices.entries()).map(
            ([type, relations]) => [type, Array.from(relations)]
          )
        )
      };
      return { content: [{ type: "text", text: JSON.stringify(serializableIndex, null, 2) }] };
    
    case "read_graph":
      console.warn("Warning: read_graph is a high-context operation");
      console.warn("Consider using read_index and targeted entity/relation methods instead");
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.readGraph(), null, 2) }] };
    
    // Search operations
    case "search_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args?.query as string || ""), null, 2) }] };
    
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.openNodes(args?.names as string[] || []), null, 2) }] };
    
    // Utility operations
    case "health_check":
      return { content: [{ type: "text", text: JSON.stringify({ 
        status: "ok", 
        memoryFilePath: knowledgeGraphManager.getMemoryFilePath(),
        indexSupport: true,
        version: "2.0.0-index"
      }, null, 2) }] };
    
    case "set_memory_file":
      try {
        const newPath = args?.path as string || "";
        // If path is just a filename, put it in the same directory as the script
        const resolvedPath = path.isAbsolute(newPath)
          ? newPath
          : path.join(path.dirname(fileURLToPath(import.meta.url)), newPath);
          
        // Create empty file if it doesn't exist
        try {
          await fs.access(resolvedPath);
        } catch (error: any) {
          await fs.writeFile(resolvedPath, "");
        }
        
        knowledgeGraphManager.setMemoryFilePath(resolvedPath);
        return { content: [{ type: "text", text: `Memory file path changed to: ${resolvedPath}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error changing memory file: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    
    case "get_memory_file":
      return { content: [{ type: "text", text: knowledgeGraphManager.getMemoryFilePath() }] };
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server with Index Support running on stdio");
  console.error(`Using memory file: ${knowledgeGraphManager.getMemoryFilePath()}`);
  console.error("Index-first architecture: v2.0.0");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
