#!/usr/bin/env node
// Migration utility for converting legacy memory files to indexed format

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { 
  INDEX_MARKER_START, 
  INDEX_MARKER_END, 
  DATA_MARKER_START 
} from './src/index-structures.js';
import { Entity, Relation, KnowledgeGraph } from './src/graph-types.js';

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface IndexMetadata {
  version: string;
  entityCount: number;
  relationCount: number;
  lastUpdated: string;
  compressionEnabled: boolean;
}

interface EntityIndex {
  name: string;
  entityType: string;
  observationCount: number;
  relationsFrom: Array<{
    relationType: string;
    toEntity: string;
  }>;
  relationsTo: Array<{
    relationType: string;
    fromEntity: string;
  }>;
  filePosition: number;
}

interface IndexStructure {
  metadata: IndexMetadata;
  entityIndices: Map<string, EntityIndex>;
  typeIndices: Map<string, Set<string>>;
  relationIndices: Map<string, Set<{ from: string, to: string }>>;
}

// Main function
async function main() {
  console.log("MCP Memory Server Migration Utility");
  console.log("This utility converts legacy memory files to the new indexed format");
  console.log("-----------------------------------------------------------");
  
  // Get source file path
  const sourcePath = await askQuestion("Enter the path to the source memory file: ");
  
  // Check if source file exists
  try {
    await fs.access(sourcePath);
  } catch (error) {
    console.error(`Error: Source file does not exist at ${sourcePath}`);
    rl.close();
    return;
  }
  
  // Get target file path
  const defaultTargetPath = sourcePath + ".indexed";
  const targetPath = await askQuestion(`Enter the path for the converted file [${defaultTargetPath}]: `) || defaultTargetPath;
  
  // Confirm overwrite if target file exists
  try {
    await fs.access(targetPath);
    const confirm = await askQuestion(`Warning: ${targetPath} already exists. Overwrite? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
      console.log("Migration cancelled.");
      rl.close();
      return;
    }
  } catch (error) {
    // File doesn't exist, continue
  }
  
  try {
    console.log("Starting migration...");
    await migrateFile(sourcePath, targetPath);
    console.log(`Migration complete! Converted file saved to ${targetPath}`);
  } catch (error) {
    console.error("Error during migration:", error);
  }
  
  rl.close();
}

// Helper function to prompt for input
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to migrate a file
async function migrateFile(sourcePath: string, targetPath: string): Promise<void> {
  // Read legacy file
  console.log("Reading source file...");
  const data = await fs.readFile(sourcePath, "utf-8");
  
  // Check if file already has the indexed format
  if (data.includes(INDEX_MARKER_START)) {
    console.log("File is already in indexed format, no migration needed.");
    // Just copy the file if requested target is different
    if (sourcePath !== targetPath) {
      await fs.copyFile(sourcePath, targetPath);
      console.log(`Copied file to ${targetPath}`);
    }
    return;
  }
  
  // Parse legacy format
  console.log("Parsing legacy format...");
  const graph = parseLegacyFormat(data);
  
  console.log(`Found ${graph.entities.length} entities and ${graph.relations.length} relations`);
  
  // Build index
  console.log("Building index...");
  const indexStructure = buildIndexFromGraph(graph);
  
  // Write new format
  console.log("Writing indexed format...");
  await writeIndexedFormat(targetPath, graph, indexStructure);
}

// Parse legacy format
function parseLegacyFormat(data: string): KnowledgeGraph {
  const lines = data.split("\n").filter(line => line.trim() !== "");
  const graph: KnowledgeGraph = { entities: [], relations: [] };
  
  lines.forEach(line => {
    try {
      const item = JSON.parse(line);
      if (item.type === "entity") {
        const { type, ...entity } = item;
        graph.entities.push(entity as Entity);
      }
      if (item.type === "relation") {
        const { type, ...relation } = item;
        graph.relations.push(relation as Relation);
      }
    } catch (error) {
      console.error("Error parsing line:", line);
    }
  });
  
  return graph;
}

// Build index from graph
function buildIndexFromGraph(graph: KnowledgeGraph): IndexStructure {
  const indexStructure: IndexStructure = {
    metadata: {
      version: "2.0.0",
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
      lastUpdated: new Date().toISOString(),
      compressionEnabled: false
    },
    entityIndices: new Map(),
    typeIndices: new Map(),
    relationIndices: new Map()
  };
  
  // Calculate file positions (this is an approximation)
  // In a real implementation, we would calculate actual file positions
  let filePosition = 0;
  
  // Index entities
  for (const entity of graph.entities) {
    const entityIndex: EntityIndex = {
      name: entity.name,
      entityType: entity.entityType,
      observationCount: entity.observations.length,
      relationsFrom: [],
      relationsTo: [],
      filePosition: filePosition
    };
    
    indexStructure.entityIndices.set(entity.name, entityIndex);
    
    // Update type indices
    if (!indexStructure.typeIndices.has(entity.entityType)) {
      indexStructure.typeIndices.set(entity.entityType, new Set());
    }
    indexStructure.typeIndices.get(entity.entityType)!.add(entity.name);
    
    // Increment filePosition for next entity
    filePosition += 1;
  }
  
  // Index relations
  for (const relation of graph.relations) {
    // Add to from entity's relations
    const fromEntity = indexStructure.entityIndices.get(relation.from);
    if (fromEntity) {
      fromEntity.relationsFrom.push({
        relationType: relation.relationType,
        toEntity: relation.to
      });
    }
    
    // Add to to entity's relations
    const toEntity = indexStructure.entityIndices.get(relation.to);
    if (toEntity) {
      toEntity.relationsTo.push({
        relationType: relation.relationType,
        fromEntity: relation.from
      });
    }
    
    // Update relation indices
    if (!indexStructure.relationIndices.has(relation.relationType)) {
      indexStructure.relationIndices.set(relation.relationType, new Set());
    }
    
    indexStructure.relationIndices.get(relation.relationType)!.add({
      from: relation.from,
      to: relation.to
    });
  }
  
  return indexStructure;
}

// Write indexed format
async function writeIndexedFormat(targetPath: string, graph: KnowledgeGraph, indexStructure: IndexStructure): Promise<void> {
  // Prepare index for serialization (Maps need special handling)
  const serializableIndex = {
    metadata: indexStructure.metadata,
    entityIndices: Array.from(indexStructure.entityIndices.entries()),
    typeIndices: Array.from(indexStructure.typeIndices.entries()).map(
      ([type, entities]) => [type, Array.from(entities)]
    ),
    relationIndices: Array.from(indexStructure.relationIndices.entries()).map(
      ([type, relations]) => [type, Array.from(relations)]
    )
  };
  
  // Prepare data lines
  const dataLines = [
    ...graph.entities.map(e => JSON.stringify({ type: "entity", ...e })),
    ...graph.relations.map(r => JSON.stringify({ type: "relation", ...r })),
  ];
  
  // Combine everything
  const fileContent = [
    INDEX_MARKER_START,
    JSON.stringify(serializableIndex, null, 2),
    INDEX_MARKER_END,
    DATA_MARKER_START,
    ...dataLines
  ].join("\n");
  
  await fs.writeFile(targetPath, fileContent);
}

// Run the main function
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
