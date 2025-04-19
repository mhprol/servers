// Core index data structures for MCP Memory Server

/** Metadata about the index and its contents */
export interface IndexMetadata {
  version: string;
  entityCount: number;
  relationCount: number;
  lastUpdated: string;
  compressionEnabled: boolean;
}

/** Index entry for a single entity */
export interface EntityIndex {
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
  filePosition: number; // Position in the file for efficient loading
}

/** Complete index structure for the knowledge graph */
export interface IndexStructure {
  metadata: IndexMetadata;
  entityIndices: Map<string, EntityIndex>;
  typeIndices: Map<string, Set<string>>; // entityType -> entity names
  relationIndices: Map<string, Set<{ from: string, to: string }>>;
}

// Constants for file format
export const INDEX_MARKER_START = "===INDEX_START===";
export const INDEX_MARKER_END = "===INDEX_END===";
export const DATA_MARKER_START = "===DATA_START===";
