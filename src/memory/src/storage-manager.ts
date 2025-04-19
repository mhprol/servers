// Storage manager for index-first architecture
import { promises as fs } from 'fs';
import { Entity, Relation, KnowledgeGraph } from './graph-types.js';
import { 
  IndexMetadata, 
  EntityIndex, 
  IndexStructure,
  INDEX_MARKER_START,
  INDEX_MARKER_END,
  DATA_MARKER_START
} from './index-structures.js';

/**
 * Manages the storage and retrieval of knowledge graph data using an index-first approach
 */
export class StorageManager {
  private indexStructure: IndexStructure;
  private memoryFilePath: string;
  private isIndexLoaded: boolean = false;
  
  constructor(memoryFilePath: string) {
    this.memoryFilePath = memoryFilePath;
    this.indexStructure = this.createEmptyIndex();
  }
  
  /**
   * Changes the memory file path
   */
  setMemoryFilePath(newPath: string): void {
    this.memoryFilePath = newPath;
    this.isIndexLoaded = false;
  }

  /**
   * Gets the current memory file path
   */
  getMemoryFilePath(): string {
    return this.memoryFilePath;
  }
  
  /**
   * Creates an empty index structure
   */
  private createEmptyIndex(): IndexStructure {
    return {
      metadata: {
        version: "1.0.0",
        entityCount: 0,
        relationCount: 0,
        lastUpdated: new Date().toISOString(),
        compressionEnabled: false
      },
      entityIndices: new Map(),
      typeIndices: new Map(),
      relationIndices: new Map()
    };
  }
  
  /**
   * Loads just the index portion of the file (lightweight operation)
   */
  async loadIndex(): Promise<IndexStructure> {
    if (this.isIndexLoaded) {
      return this.indexStructure;
    }
    
    try {
      // Check if file exists
      try {
        await fs.access(this.memoryFilePath);
      } catch (error) {
        // Create empty file with index structure if it doesn't exist
        await this.saveIndexAndEmptyData();
        this.isIndexLoaded = true;
        return this.indexStructure;
      }
      
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      
      // Check if file has index structure
      if (!data.includes(INDEX_MARKER_START)) {
        // Legacy file format - migrate it
        console.log(`Migrating legacy format to indexed format: ${this.memoryFilePath}`);
        await this.migrateFromLegacyFormat(data);
        this.isIndexLoaded = true;
        return this.indexStructure;
      }
      
      // Extract and parse index
      const indexStartPos = data.indexOf(INDEX_MARKER_START) + INDEX_MARKER_START.length;
      const indexEndPos = data.indexOf(INDEX_MARKER_END);
      
      if (indexEndPos === -1 || indexStartPos >= indexEndPos) {
        console.error("Invalid index format in memory file, rebuilding index");
        return await this.rebuildIndex();
      }
      
      const indexJson = data.substring(indexStartPos, indexEndPos).trim();
      
      try {
        const parsedIndex = JSON.parse(indexJson);
        
        // Convert to proper Map objects (JSON.parse doesn't preserve Maps)
        this.indexStructure = {
          metadata: parsedIndex.metadata,
          entityIndices: new Map(),
          typeIndices: new Map(),
          relationIndices: new Map()
        };
        
        // Reconstruct the entityIndices map
        for (const [name, entity] of parsedIndex.entityIndices) {
          this.indexStructure.entityIndices.set(name, entity);
        }
        
        // Reconstruct the typeIndices map
        for (const [type, entities] of parsedIndex.typeIndices) {
          this.indexStructure.typeIndices.set(type, new Set(entities));
        }
        
        // Reconstruct the relationIndices map
        for (const [type, relations] of parsedIndex.relationIndices) {
          // Relations are stored as objects with from/to properties
          this.indexStructure.relationIndices.set(type, new Set());
          const relationSet = this.indexStructure.relationIndices.get(type)!;
          
          for (const rel of relations) {
            relationSet.add({ from: rel.from, to: rel.to });
          }
        }
        
        this.isIndexLoaded = true;
        return this.indexStructure;
      } catch (error) {
        console.error("Error parsing index JSON:", error);
        return await this.rebuildIndex();
      }
    } catch (error) {
      console.error("Error loading index:", error);
      // Reset to empty index
      this.indexStructure = this.createEmptyIndex();
      return this.indexStructure;
    }
  }
  
  /**
   * Rebuilds the index from the data section
   */
  private async rebuildIndex(): Promise<IndexStructure> {
    console.log("Rebuilding index from data...");
    
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      const dataStartPos = data.indexOf(DATA_MARKER_START);
      
      if (dataStartPos === -1) {
        // No data marker, treat entire file as legacy format
        return await this.migrateFromLegacyFormat(data);
      }
      
      const dataContent = data.substring(dataStartPos + DATA_MARKER_START.length).trim();
      const graph = this.parseLegacyFormat(dataContent);
      
      await this.buildIndexFromGraph(graph);
      await this.saveIndexAndData(graph);
      
      this.isIndexLoaded = true;
      return this.indexStructure;
    } catch (error) {
      console.error("Error rebuilding index:", error);
      this.indexStructure = this.createEmptyIndex();
      await this.saveIndexAndEmptyData();
      return this.indexStructure;
    }
  }
  
  /**
   * Migrates from legacy format to indexed format
   */
  private async migrateFromLegacyFormat(data: string): Promise<IndexStructure> {
    console.log("Migrating from legacy format to indexed format...");
    
    // Parse legacy format
    const graph = this.parseLegacyFormat(data);
    
    // Build index from the parsed graph
    await this.buildIndexFromGraph(graph);
    
    // Save the new format
    await this.saveIndexAndData(graph);
    
    console.log("Migration complete");
    return this.indexStructure;
  }
  
  /**
   * Parses legacy format data into a knowledge graph
   */
  private parseLegacyFormat(data: string): KnowledgeGraph {
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
        console.error("Error parsing line:", line, error);
      }
    });
    
    return graph;
  }
  
  /**
   * Builds an index from a knowledge graph
   */
  private async buildIndexFromGraph(graph: KnowledgeGraph): Promise<void> {
    this.indexStructure = this.createEmptyIndex();
    
    this.indexStructure.metadata.entityCount = graph.entities.length;
    this.indexStructure.metadata.relationCount = graph.relations.length;
    this.indexStructure.metadata.lastUpdated = new Date().toISOString();
    
    // Index entities
    let filePosition = 0;
    for (const entity of graph.entities) {
      const entityIndex: EntityIndex = {
        name: entity.name,
        entityType: entity.entityType,
        observationCount: entity.observations.length,
        relationsFrom: [],
        relationsTo: [],
        filePosition: filePosition
      };
      
      this.indexStructure.entityIndices.set(entity.name, entityIndex);
      
      // Update type indices
      if (!this.indexStructure.typeIndices.has(entity.entityType)) {
        this.indexStructure.typeIndices.set(entity.entityType, new Set());
      }
      this.indexStructure.typeIndices.get(entity.entityType)!.add(entity.name);
      
      // Increment filePosition for next entity
      // This is just a placeholder - in real implementation, calculate actual file positions
      filePosition += 1;
    }
    
    // Index relations
    for (const relation of graph.relations) {
      // Add to from entity's relations
      const fromEntity = this.indexStructure.entityIndices.get(relation.from);
      if (fromEntity) {
        fromEntity.relationsFrom.push({
          relationType: relation.relationType,
          toEntity: relation.to
        });
      }
      
      // Add to to entity's relations
      const toEntity = this.indexStructure.entityIndices.get(relation.to);
      if (toEntity) {
        toEntity.relationsTo.push({
          relationType: relation.relationType,
          fromEntity: relation.from
        });
      }
      
      // Update relation indices
      if (!this.indexStructure.relationIndices.has(relation.relationType)) {
        this.indexStructure.relationIndices.set(relation.relationType, new Set());
      }
      
      this.indexStructure.relationIndices.get(relation.relationType)!.add({
        from: relation.from,
        to: relation.to
      });
    }
  }
  
  /**
   * Saves an empty index and data structure
   */
  private async saveIndexAndEmptyData(): Promise<void> {
    const emptyGraph: KnowledgeGraph = { entities: [], relations: [] };
    await this.saveIndexAndData(emptyGraph);
  }
  
  /**
   * Saves both index and data to the memory file
   */
  private async saveIndexAndData(graph: KnowledgeGraph): Promise<void> {
    // Prepare index for serialization (Maps need special handling)
    const serializableIndex = {
      metadata: this.indexStructure.metadata,
      entityIndices: Array.from(this.indexStructure.entityIndices.entries()),
      typeIndices: Array.from(this.indexStructure.typeIndices.entries()).map(
        ([type, entities]) => [type, Array.from(entities)]
      ),
      relationIndices: Array.from(this.indexStructure.relationIndices.entries()).map(
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
    
    await fs.writeFile(this.memoryFilePath, fileContent);
  }
  
  /**
   * Loads the complete graph from the file
   */
  async loadFullGraph(): Promise<KnowledgeGraph> {
    try {
      // Make sure index is loaded
      await this.loadIndex();
      
      // Read the full file
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      
      // Check if file has the new format
      if (!data.includes(DATA_MARKER_START)) {
        // Legacy format
        return this.parseLegacyFormat(data);
      }
      
      // Extract data section
      const dataStartPos = data.indexOf(DATA_MARKER_START) + DATA_MARKER_START.length;
      const dataContent = data.substring(dataStartPos).trim();
      
      // Parse the data
      return this.parseLegacyFormat(dataContent);
    } catch (error) {
      console.error("Error loading full graph:", error);
      return { entities: [], relations: [] };
    }
  }
  
  /**
   * Gets a single entity by name
   */
  async getEntityByName(entityName: string): Promise<Entity | null> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    const entityIndex = this.indexStructure.entityIndices.get(entityName);
    if (!entityIndex) {
      return null;
    }
    
    // In a real implementation, we would read only this entity from the file
    // For now, we'll load the full graph and filter
    const fullGraph = await this.loadFullGraph();
    return fullGraph.entities.find(e => e.name === entityName) || null;
  }
  
  /**
   * Gets all entities of a specific type
   */
  async getEntitiesByType(entityType: string): Promise<Entity[]> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    const entityNames = this.indexStructure.typeIndices.get(entityType);
    if (!entityNames || entityNames.size === 0) {
      return [];
    }
    
    // In a real implementation, we would read only these entities from the file
    // For now, we'll load the full graph and filter
    const fullGraph = await this.loadFullGraph();
    return fullGraph.entities.filter(e => entityNames.has(e.name));
  }
  
  /**
   * Gets all relations of a specific type
   */
  async getRelationsByType(relationType: string): Promise<Relation[]> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    const relationPairs = this.indexStructure.relationIndices.get(relationType);
    if (!relationPairs || relationPairs.size === 0) {
      return [];
    }
    
    // In a real implementation, we would read only these relations from the file
    // For now, we'll load the full graph and filter
    const fullGraph = await this.loadFullGraph();
    return fullGraph.relations.filter(r => 
      r.relationType === relationType && 
      Array.from(relationPairs).some(pair => 
        pair.from === r.from && pair.to === r.to
      )
    );
  }
  
  /**
   * Searches for entities by name
   */
  async searchEntitiesByName(query: string): Promise<Entity[]> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    const matchingEntityNames = Array.from(this.indexStructure.entityIndices.keys())
      .filter(name => name.toLowerCase().includes(query.toLowerCase()));
    
    if (matchingEntityNames.length === 0) {
      return [];
    }
    
    // In a real implementation, we would read only these entities from the file
    // For now, we'll load the full graph and filter
    const fullGraph = await this.loadFullGraph();
    return fullGraph.entities.filter(e => matchingEntityNames.includes(e.name));
  }
  
  /**
   * Updates or adds an entity
   */
  async updateEntity(entity: Entity): Promise<void> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    // Load the full graph
    const graph = await this.loadFullGraph();
    
    // Update or add the entity
    const existingIndex = graph.entities.findIndex(e => e.name === entity.name);
    if (existingIndex >= 0) {
      graph.entities[existingIndex] = entity;
    } else {
      graph.entities.push(entity);
    }
    
    // Rebuild index
    await this.buildIndexFromGraph(graph);
    
    // Save everything
    await this.saveIndexAndData(graph);
  }
  
  /**
   * Updates or adds a relation
   */
  async updateRelation(relation: Relation): Promise<void> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    // Load the full graph
    const graph = await this.loadFullGraph();
    
    // Check if relation already exists
    const existingIndex = graph.relations.findIndex(r => 
      r.from === relation.from && 
      r.to === relation.to && 
      r.relationType === relation.relationType
    );
    
    if (existingIndex >= 0) {
      // Nothing to do, relation already exists
      return;
    }
    
    // Add the new relation
    graph.relations.push(relation);
    
    // Rebuild index
    await this.buildIndexFromGraph(graph);
    
    // Save everything
    await this.saveIndexAndData(graph);
  }
  
  /**
   * Deletes an entity and its relations
   */
  async deleteEntity(entityName: string): Promise<void> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    // Load the full graph
    const graph = await this.loadFullGraph();
    
    // Remove the entity
    graph.entities = graph.entities.filter(e => e.name !== entityName);
    
    // Remove relations involving this entity
    graph.relations = graph.relations.filter(r => 
      r.from !== entityName && r.to !== entityName
    );
    
    // Rebuild index
    await this.buildIndexFromGraph(graph);
    
    // Save everything
    await this.saveIndexAndData(graph);
  }
  
  /**
   * Deletes a relation
   */
  async deleteRelation(relation: Relation): Promise<void> {
    if (!this.isIndexLoaded) {
      await this.loadIndex();
    }
    
    // Load the full graph
    const graph = await this.loadFullGraph();
    
    // Remove the relation
    graph.relations = graph.relations.filter(r => 
      !(r.from === relation.from && 
        r.to === relation.to && 
        r.relationType === relation.relationType)
    );
    
    // Rebuild index
    await this.buildIndexFromGraph(graph);
    
    // Save everything
    await this.saveIndexAndData(graph);
  }
}
