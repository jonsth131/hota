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
    { title: 'Sessionsstöld via komprometterad token', category: 'S', severity: 'High' },
    { title: 'Förfalskning av avsändaridentitet i API-anrop', category: 'S', severity: 'Medium' },
    { title: 'Manipulering av processindata', category: 'T', severity: 'High' },
    { title: 'Injektionsattack (SQL/command/LDAP) mot process', category: 'T', severity: 'Critical' },
    { title: 'Osäker deserialisering av indata', category: 'T', severity: 'Critical' },
    { title: 'Manipulering av konfigurationsfil', category: 'T', severity: 'High' },
    { title: 'Brist på loggning och spårbarhet', category: 'R', severity: 'Medium' },
    { title: 'Nekande av utförd transaktion (saknas verifierbar logg)', category: 'R', severity: 'Medium' },
    { title: 'Avsaknad av oavvislighetsbevis för kritiska operationer', category: 'R', severity: 'High' },
    { title: 'Läckage av känslig data från process', category: 'I', severity: 'High' },
    { title: 'Felhantering avslöjar stacktrace och interna detaljer', category: 'I', severity: 'Medium' },
    { title: 'Känslig data skrivs till loggar', category: 'I', severity: 'High' },
    { title: 'Cache-läckage av känsliga sessioner', category: 'I', severity: 'High' },
    { title: 'Resursöverbelastning av process', category: 'D', severity: 'Medium' },
    { title: 'CPU/minne-uttömning via skadlig indata (ReDoS, zip-bomb)', category: 'D', severity: 'High' },
    { title: 'Privilegieskalning via process', category: 'E', severity: 'Critical' },
    { title: 'Sårbar beroende-komponent med känd CVE', category: 'E', severity: 'High' },
    { title: 'Server-Side Request Forgery (SSRF)', category: 'E', severity: 'High' },
  ],
  ExternalEntity: [
    { title: 'Spoofing av extern aktör', category: 'S', severity: 'High' },
    { title: 'Man-in-the-middle mot extern kommunikation', category: 'S', severity: 'High' },
    { title: 'Förfalskning av extern aktörs begäran (CSRF)', category: 'S', severity: 'High' },
    { title: 'Manipulering av data skickat från extern aktör', category: 'T', severity: 'High' },
    { title: 'Replay-attack med kapat meddelande från extern aktör', category: 'T', severity: 'High' },
    { title: 'Nekande av kommunikation med extern part', category: 'R', severity: 'Medium' },
    { title: 'Extern aktör nekar ha initierat transaktion', category: 'R', severity: 'Medium' },
    { title: 'Extern aktör exponeras för internt systemfel via felmeddelanden', category: 'I', severity: 'Medium' },
    { title: 'DoS-attack från extern aktör (flood / botnät)', category: 'D', severity: 'High' },
    { title: 'Rekursiv begäran från extern aktör orsakar kedje-DoS', category: 'D', severity: 'Medium' },
    { title: 'Extern aktör missbrukar för öppen API-åtkomst (saknad auktorisering)', category: 'E', severity: 'Critical' },
  ],
  DataStore: [
    { title: 'Saknad autentisering mot datalager', category: 'S', severity: 'Critical' },
    { title: 'Missbruk av delad databasanvändare utan principen om minsta behörighet', category: 'S', severity: 'High' },
    { title: 'Manipulering av lagrad data', category: 'T', severity: 'Critical' },
    { title: 'SQL-injektion mot datalager', category: 'T', severity: 'Critical' },
    { title: 'Osäker direktobjektreferens (IDOR) till lagerpost', category: 'T', severity: 'High' },
    { title: 'Saknad auditlogg för känsliga läs-/skrivoperationer', category: 'R', severity: 'High' },
    { title: 'Obehörig åtkomst till datalager', category: 'I', severity: 'High' },
    { title: 'Känslig data lagras okrypterad i vila', category: 'I', severity: 'Critical' },
    { title: 'Läckage av backupfil med okrypterad data', category: 'I', severity: 'Critical' },
    { title: 'Förstörelse av datalager (DoS)', category: 'D', severity: 'High' },
    { title: 'Ransomware krypterar datalager', category: 'D', severity: 'Critical' },
    { title: 'Saknad backup möjliggör permanent dataförlust', category: 'D', severity: 'High' },
    { title: 'Privilegieskalning via SQL-injektion (t.ex. xp_cmdshell)', category: 'E', severity: 'Critical' },
  ],
  TrustBoundary: [
    { title: 'Förfalskning av token/certifikat vid gränsövergång', category: 'S', severity: 'Critical' },
    { title: 'Manipulering av data under gränsövergång', category: 'T', severity: 'High' },
    { title: 'Saknad loggning av gränsöverskridande trafik', category: 'R', severity: 'Medium' },
    { title: 'Data-läckage via felaktig gränskonfiguration', category: 'I', severity: 'High' },
    { title: 'Denial-of-service mot gränssättningsmekanism', category: 'D', severity: 'High' },
    { title: 'Kringgående av förtroendesegräns', category: 'E', severity: 'Critical' },
    { title: 'JWT-manipulation ger otillåten åtkomst till skyddad zon', category: 'E', severity: 'Critical' },
  ],
  TrustZone: [
    { title: 'Spoofing av intern komponent inom zon', category: 'S', severity: 'High' },
    { title: 'Otillåten modifiering av zonens konfiguration', category: 'T', severity: 'Critical' },
    { title: 'Saknad intern auditlogg inom zon', category: 'R', severity: 'Medium' },
    { title: 'Obehörig åtkomst till förtroendezon', category: 'E', severity: 'Critical' },
    { title: 'Exfiltrering av data ut ur zon', category: 'I', severity: 'High' },
    { title: 'Läckage via sido-kanal (timing, cache) inom zon', category: 'I', severity: 'Medium' },
    { title: 'Störning av intern kommunikation inom zon', category: 'D', severity: 'High' },
    { title: 'Lateral rörelse via komprometterad intern tjänst', category: 'E', severity: 'Critical' },
  ],
  connection: [
    { title: 'Spoofing av endpoint (saknad certifikatvalidering)', category: 'S', severity: 'High' },
    { title: 'Avlyssning av dataflöde', category: 'I', severity: 'High' },
    { title: 'Okrypterad transport av känsliga uppgifter (HTTP i st.f. HTTPS)', category: 'I', severity: 'Critical' },
    { title: 'Metadata-läckage via HTTP-headers', category: 'I', severity: 'Low' },
    { title: 'Manipulering av data under transport', category: 'T', severity: 'High' },
    { title: 'Replay-attack på dataflöde', category: 'T', severity: 'High' },
    { title: 'HTTP header injection via dataflöde', category: 'T', severity: 'Medium' },
    { title: 'Saknad loggning av dataflöde omöjliggör forensik', category: 'R', severity: 'Medium' },
    { title: 'Avbrott i dataflöde', category: 'D', severity: 'Medium' },
    { title: 'Connection flood mot kommunikationskanal', category: 'D', severity: 'High' },
    { title: 'Privilegieskalning via osäker protokollimplementation', category: 'E', severity: 'High' },
  ],
};

export function getThreatTemplates(elementType: string): ThreatTemplate[] {
  return THREAT_TEMPLATES[elementType] ?? THREAT_TEMPLATES['connection']!;
}
