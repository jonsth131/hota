/**
 * PASTA methodology definitions.
 */

export interface PastaStage {
  stage: number;
  name: string;
  description: string;
  icon: string;
  activities: string[];
}

export interface PastaCategory {
  id: string;
  name: string;
}

export const PASTA_STAGES: PastaStage[] = [
  {
    stage: 1,
    name: 'Definiera mål',
    description: 'Identifiera affärsmål, säkerhetsmål och riskaptit för applikationen.',
    icon: '🎯',
    activities: ['Definiera affärsmål och krav', 'Identifiera säkerhetsmål', 'Fastställ riskaptit', 'Samla in compliance-krav'],
  },
  {
    stage: 2,
    name: 'Definiera teknisk scope',
    description: 'Kartlägg teknisk infrastruktur, beroenden och systemgränser.',
    icon: '🗺️',
    activities: ['Inventera infrastrukturkomponenter', 'Identifiera mjukvaruberoenden', 'Kartlägg nätverkstopologi', 'Definiera systemgränser'],
  },
  {
    stage: 3,
    name: 'Applikationsdekomposition',
    description: 'Bryt ner applikationen i dataflöden, komponenter och förtroendenivåer.',
    icon: '🔍',
    activities: ['Skapa dataflödesdiagram (DFD)', 'Identifiera förtroendesons', 'Kartlägg användarroller och rättigheter', 'Dokumentera API:er och integrationspunkter'],
  },
  {
    stage: 4,
    name: 'Hotanalys',
    description: 'Identifiera och klassificera hot baserade på hotaktörer och angreppsytor.',
    icon: '⚠️',
    activities: ['Identifiera relevanta hotaktörer', 'Kartlägg angreppsytor (attack surface)', 'Analysera hotscenarier', 'Korrelera med hotintelligens (MITRE ATT&CK)'],
  },
  {
    stage: 5,
    name: 'Sårbarhetsanalys',
    description: 'Identifiera svagheter i design och implementation som kan utnyttjas.',
    icon: '🔓',
    activities: ['Granska kod och konfiguration', 'Utför statisk analys (SAST)', 'Identifiera designsvagheter', 'Korrelera sårbarheter med hot'],
  },
  {
    stage: 6,
    name: 'Attackmodellering',
    description: 'Bygg attackträd och simulera hur hot kan realiseras mot systemet.',
    icon: '🌳',
    activities: ['Bygg attackträd per hot', 'Simulera attackscenarier', 'Identifiera attackvägar', 'Bedöm sannolikhet per attackväg'],
  },
  {
    stage: 7,
    name: 'Risk- och konsekvensanalys',
    description: 'Kvantifiera risker, prioritera och ta fram åtgärdsplan.',
    icon: '📊',
    activities: ['Beräkna risknivå (sannolikhet × konsekvens)', 'Prioritera hot efter affärspåverkan', 'Ta fram åtgärdsplan med ägare', 'Definiera residualrisker'],
  },
];

export function getStages(): PastaStage[] {
  return PASTA_STAGES;
}

export function getStage(stageNum: number): PastaStage | undefined {
  return PASTA_STAGES.find((s) => s.stage === stageNum);
}

export function getPastaCategories(): PastaCategory[] {
  return PASTA_STAGES.map((s) => ({
    id: `P${s.stage}`,
    name: `Steg ${s.stage}: ${s.name}`,
  }));
}
