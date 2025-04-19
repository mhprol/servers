// Core graph data types for MCP Memory Server

/** Entity in the knowledge graph */
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

/** Relation in the knowledge graph */
export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

/** Complete knowledge graph structure */
export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}
