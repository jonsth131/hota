// ── Core domain types ──────────────────────────────────────

export type ElementType = 'Process' | 'ExternalEntity' | 'DataStore' | 'TrustBoundary' | 'TrustZone';
export type Methodology = 'STRIDE' | 'PASTA';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type ThreatStatus = 'Open' | 'Mitigated' | 'Accepted' | 'Transferred' | 'In Progress' | 'N/A';
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

export interface ElementMetadata {
  notes?: string;
  [key: string]: unknown;
}

export interface DiagramElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  metadata: ElementMetadata;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface Threat {
  id: string;
  elementId: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  mitigation: string;
  status: ThreatStatus;
}

export interface ProjectMetadata {
  name: string;
  author: string;
  version: string;
  date: string;
  description: string;
  scope: string;
  assumptions: string[];
  outOfScope: string[];
}

export interface Model {
  version: string;
  metadata: ProjectMetadata;
  methodology: Methodology;
  elements: DiagramElement[];
  connections: Connection[];
  threats: Threat[];
}

export interface Point {
  x: number;
  y: number;
}

// ── Event map ──────────────────────────────────────────────

export interface EventMap {
  'metadata:updated': ProjectMetadata;
  'methodology:changed': Methodology;
  'element:added': DiagramElement;
  'element:updated': DiagramElement;
  'element:removed': string;
  'connection:added': Connection;
  'connection:updated': Connection;
  'connection:removed': string;
  'threat:added': Threat;
  'threat:updated': Threat;
  'threat:removed': string;
  'model:loaded': Model;
  '*': { event: string; payload: unknown };
}

export type EventName = keyof EventMap;
