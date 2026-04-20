/**
 * STRIDE methodology definitions.
 */
import type { ElementType } from '../types.js';

export interface StrideCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  applicableTo: string[];
}

export interface ThreatTemplate {
  title: string;
  category: string;
  severity: string;
}

export const STRIDE_CATEGORIES: StrideCategory[] = [
  {
    id: 'S',
    name: 'Spoofing',
    description: 'En angripare utger sig för att vara en legitim användare, process eller system.',
    icon: '🎭',
    applicableTo: ['Process', 'ExternalEntity'],
  },
  {
    id: 'T',
    name: 'Tampering',
    description: 'Obehörig modifiering av data under transit eller i vila.',
    icon: '🔧',
    applicableTo: ['Process', 'DataStore', 'connection'],
  },
  {
    id: 'R',
    name: 'Repudiation',
    description: 'En användare nekar att ha utfört en åtgärd utan möjlighet att motbevisa det.',
    icon: '🚫',
    applicableTo: ['Process', 'ExternalEntity'],
  },
  {
    id: 'I',
    name: 'Information Disclosure',
    description: 'Känslig information exponeras för obehöriga parter.',
    icon: '👁️',
    applicableTo: ['Process', 'DataStore', 'connection'],
  },
  {
    id: 'D',
    name: 'Denial of Service',
    description: 'En angripare förhindrar legitima användare från att komma åt systemet.',
    icon: '💥',
    applicableTo: ['Process', 'DataStore', 'connection'],
  },
  {
    id: 'E',
    name: 'Elevation of Privilege',
    description: 'En angripare får behörighet utöver vad som är avsett.',
    icon: '⬆️',
    applicableTo: ['Process', 'TrustBoundary', 'TrustZone'],
  },
];

export function getCategoriesForElement(elementType: ElementType | 'connection'): StrideCategory[] {
  return STRIDE_CATEGORIES.filter(
    (c) => c.applicableTo.includes(elementType) || c.applicableTo.includes('connection'),
  );
}

export function getCategoryById(id: string): StrideCategory | undefined {
  return STRIDE_CATEGORIES.find((c) => c.id === id);
}

const THREAT_TEMPLATES: Record<string, ThreatTemplate[]> = {
  Process: [
    { title: 'Spoofing av processidentitet', category: 'S', severity: 'High' },
    { title: 'Manipulering av processindata', category: 'T', severity: 'High' },
    { title: 'Brist på loggning och spårbarhet', category: 'R', severity: 'Medium' },
    { title: 'Läckage av känslig data från process', category: 'I', severity: 'High' },
    { title: 'Resursöverbelastning av process', category: 'D', severity: 'Medium' },
    { title: 'Privilegieskalning via process', category: 'E', severity: 'Critical' },
  ],
  ExternalEntity: [
    { title: 'Spoofing av extern aktör', category: 'S', severity: 'High' },
    { title: 'Nekande av kommunikation med extern part', category: 'R', severity: 'Medium' },
  ],
  DataStore: [
    { title: 'Obehörig åtkomst till datalager', category: 'I', severity: 'High' },
    { title: 'Manipulering av lagrad data', category: 'T', severity: 'Critical' },
    { title: 'Förstörelse av datalager (DoS)', category: 'D', severity: 'High' },
  ],
  TrustBoundary: [
    { title: 'Kringgående av förtroendesegräns', category: 'E', severity: 'Critical' },
  ],
  TrustZone: [
    { title: 'Obehörig åtkomst till förtroendezon', category: 'E', severity: 'Critical' },
    { title: 'Exfiltrering av data ut ur zon', category: 'I', severity: 'High' },
  ],
  connection: [
    { title: 'Avlyssning av dataflöde', category: 'I', severity: 'High' },
    { title: 'Manipulering av data under transport', category: 'T', severity: 'High' },
    { title: 'Avbrott i dataflöde', category: 'D', severity: 'Medium' },
  ],
};

export function getThreatTemplates(elementType: string): ThreatTemplate[] {
  return THREAT_TEMPLATES[elementType] ?? THREAT_TEMPLATES['connection']!;
}
