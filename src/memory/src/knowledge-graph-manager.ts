// Knowledge Graph Manager for index-first architecture
import { StorageManager } from './storage-manager.js';
import { Entity, Relation, KnowledgeGraph } from './graph-types.js';
import { IndexStructure } from './index-structures.js';

/**
 * Manages the knowledge graph with index-optimized operations
 */
export class KnowledgeGraphManager {
  storageManager: StorageManager;
  
  constructor(memoryFilePath: string) {
    this.storageManager = new StorageManager(memoryFilePath);
  }
  
  /**
   * Changes the memory file path
   */
  setMemoryFilePath(newPath: string): void {
    this.storageManager.setMemoryFilePath(newPath);
  }

  /**
   * Gets the current memory file path
   */
  getMemoryFilePath(): string {
    return this.storageManager.getMemoryFilePath();
  }
  
  /**
   * Reads just the index structure (lightweight operation)
   */
  async readIndex(): Promise<IndexStructure> {
    return this.storageManager.loadIndex();
  }
  
  /**
   * Reads the entire graph (heavy operation)
   */
  async readGraph(): Promise<KnowledgeGraph> {
    console.warn("Warning: read_graph is a high-context operation");
    console.warn("Consider using read_index and targeted entity methods instead");
    return this.storageManager.loadFullGraph();
  }
  
  /**
   * Creates multiple entities
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // Load current graph
    const graph = await this.storageManager.loadFullGraph();
    
    // Find new entities
    const newEntities = entities.filter(e => 
      !graph.entities.some(existingEntity => existingEntity.name === e.name)
    );
    
    // Add new entities
    for (const entity of newEntities) {
      await this.storageManager.updateEntity(entity);
    }
    
    return newEntities;
  }
  
  /**
   * Creates multiple relations
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    // Filter out relations that already exist
    const graph = await this.storageManager.loadFullGraph();
    const newRelations = relations.filter(relation => 
      !graph.relations.some(r => 
        r.from === relation.from && 
        r.to === relation.to && 
        r.relationType === relation.relationType
      )
    );
    
    // Add new relations
    for (const relation of newRelations) {
      await this.storageManager.updateRelation(relation);
    }
    
    return newRelations;
  }
  
  /**
   * Adds observations to entities
   */
  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const results: { entityName: string; addedObservations: string[] }[] = [];
    
    for (const observation of observations) {
      // Get the entity
      const entity = await this.storageManager.getEntityByName(observation.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${observation.entityName} not found`);
      }
      
      // Filter new observations
      const newObservations = observation.contents.filter(
        content => !entity.observations.includes(content)
      );
      
      if (newObservations.length > 0) {
        // Add new observations
        entity.observations.push(...newObservations);
        
        // Update the entity
        await this.storageManager.updateEntity(entity);
        
        // Record results
        results.push({
          entityName: observation.entityName,
          addedObservations: newObservations
        });
      } else {
        // No new observations
        results.push({
          entityName: observation.entityName,
          addedObservations: []
        });
      }
    }
    
    return results;
  }
  
  /**
   * Deletes multiple entities
   */
  async deleteEntities(entityNames: string[]): Promise<void> {
    for (const name of entityNames) {
      await this.storageManager.deleteEntity(name);
    }
  }
  
  /**
   * Deletes observations from entities
   */
  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    for (const deletion of deletions) {
      // Get the entity
      const entity = await this.storageManager.getEntityByName(deletion.entityName);
      if (!entity) {
        continue; // Skip if entity doesn't exist
      }
      
      // Remove observations
      entity.observations = entity.observations.filter(
        o => !deletion.observations.includes(o)
      );
      
      // Update the entity
      await this.storageManager.updateEntity(entity);
    }
  }
  
  /**
   * Deletes multiple relations
   */
  async deleteRelations(relations: Relation[]): Promise<void> {
    for (const relation of relations) {
      await this.storageManager.deleteRelation(relation);
    }
  }
  
  /**
   * Searches for nodes in the graph
   */
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    // First, make sure the index is loaded
    await this.storageManager.loadIndex();
    
    // Special pattern for relations query
    const relationQueryRegex = /relations\s+(\w+)/i;
    const fromQueryRegex = /from\s+(\w+)/i;
    const toQueryRegex = /to\s+(\w+)/i;
    const typeQueryRegex = /type\s+(\w+)/i;
    
    const relationMatch = query.match(relationQueryRegex);
    const fromMatch = query.match(fromQueryRegex);
    const toMatch = query.match(toQueryRegex);
    const typeMatch = query.match(typeQueryRegex);
    
    // Handle relation-specific queries using index
    if (relationMatch || fromMatch || toMatch || typeMatch) {
      // Implementation using indexes
      // For now, use the legacy method
      const graph = await this.storageManager.loadFullGraph();
      let filteredRelations: Relation[] = [...graph.relations];
      
      // Filter for "relations [entity]" query
      if (relationMatch) {
        const entityName = relationMatch[1];
        filteredRelations = filteredRelations.filter(r => 
          r.from === entityName || r.to === entityName
        );
      }
      
      // Filter for "from [entity]" query
      if (fromMatch) {
        const fromEntity = fromMatch[1];
        filteredRelations = filteredRelations.filter(r => r.from === fromEntity);
      }
      
      // Filter for "to [entity]" query
      if (toMatch) {
        const toEntity = toMatch[1];
        filteredRelations = filteredRelations.filter(r => r.to === toEntity);
      }
      
      // Filter for "type [relationType]" query
      if (typeMatch) {
        const relationType = typeMatch[1];
        filteredRelations = filteredRelations.filter(r => 
          r.relationType.toLowerCase().includes(relationType.toLowerCase())
        );
      }
      
      // Get all the unique entity names involved in these relations
      const relatedEntityNames = new Set<string>();
      filteredRelations.forEach(r => {
        relatedEntityNames.add(r.from);
        relatedEntityNames.add(r.to);
      });
      
      // Get the entities with these names
      const filteredEntities = graph.entities.filter(e => 
        relatedEntityNames.has(e.name)
      );
      
      return {
        entities: filteredEntities,
        relations: filteredRelations
      };
    }
    
    // Handle entity type queries
    if (query.toLowerCase().startsWith("type ")) {
      const entityType = query.substring(5).trim();
      const entities = await this.storageManager.getEntitiesByType(entityType);
      
      // Get all relations between these entities
      const graph = await this.storageManager.loadFullGraph();
      const entityNames = new Set(entities.map(e => e.name));
      
      const relations = graph.relations.filter(r => 
        entityNames.has(r.from) && entityNames.has(r.to)
      );
      
      return {
        entities,
        relations
      };
    }
    
    // Handle multiple search terms
    const searchTerms = query.trim().split(/\s+/);
    if (searchTerms.length > 1) {
      // For now, use the legacy method
      return this.legacySearchNodes(query);
    }
    
    // Handle simple name search
    const entities = await this.storageManager.searchEntitiesByName(query);
    
    // Get relations between these entities
    const graph = await this.storageManager.loadFullGraph();
    const entityNames = new Set(entities.map(e => e.name));
    
    const relations = graph.relations.filter(r => 
      entityNames.has(r.from) && entityNames.has(r.to)
    );
    
    return {
      entities,
      relations
    };
  }
  
  /**
   * Legacy search implementation
   */
  private async legacySearchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.storageManager.loadFullGraph();
    
    // Handle multiple search terms
    const searchTerms = query.trim().split(/\s+/);
    
    if (searchTerms.length > 1) {
      // For multiple terms, find entities matching any term
      const matchingEntitiesByTerm: Map<string, Set<string>> = new Map();
      
      // Find entities matching each term
      for (const term of searchTerms) {
        const termLower = term.toLowerCase();
        const matchingEntities = new Set<string>();
        
        // Find entities matching this term
        for (const entity of graph.entities) {
          if (
            entity.name.toLowerCase().includes(termLower) ||
            entity.entityType.toLowerCase().includes(termLower) ||
            entity.observations.some(o => o.toLowerCase().includes(termLower))
          ) {
            matchingEntities.add(entity.name);
          }
        }
        
        // Store the matching entities for this term
        matchingEntitiesByTerm.set(term, matchingEntities);
      }
      
      // Collect all entities that match at least one term
      const allMatchingEntities = new Set<string>();
      for (const matchingEntities of matchingEntitiesByTerm.values()) {
        for (const entityName of matchingEntities) {
          allMatchingEntities.add(entityName);
        }
      }
      
      // Filter the entities
      const filteredEntities = graph.entities.filter(e => 
        allMatchingEntities.has(e.name)
      );
      
      // Filter relations
      const filteredRelations = graph.relations.filter(r => 
        allMatchingEntities.has(r.from) && allMatchingEntities.has(r.to)
      );
      
      return {
        entities: filteredEntities,
        relations: filteredRelations,
      };
    }
    
    // Regular text search (original behavior) for single terms
    const filteredEntities = graph.entities.filter(e => 
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.entityType.toLowerCase().includes(query.toLowerCase()) ||
      e.observations.some(o => o.toLowerCase().includes(query.toLowerCase()))
    );
  
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
  
    // Filter relations
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }
  
  /**
   * Opens specific nodes by name
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    // Load entities by name from index
    const entities: Entity[] = [];
    
    for (const name of names) {
      const entity = await this.storageManager.getEntityByName(name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    // Get relations between these entities
    const graph = await this.storageManager.loadFullGraph();
    const entityNames = new Set(entities.map(e => e.name));
    
    const relations = graph.relations.filter(r => 
      entityNames.has(r.from) && entityNames.has(r.to)
    );
    
    return {
      entities,
      relations
    };
  }
  
  /**
   * Expands a single entity by name
   */
  async expandEntity(entityName: string): Promise<Entity | null> {
    return this.storageManager.getEntityByName(entityName);
  }
}
