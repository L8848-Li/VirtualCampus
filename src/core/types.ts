export type LocationId = 0 | 1 | 2 | 3 | 4;
export type InterventionKind = 'rooms' | 'groups' | 'party';
export type EventType = 'system' | 'action' | 'intervention' | 'summary' | 'friendship' | 'crush' | 'misunderstanding' | 'repair' | 'rivalry' | 'invitation' | 'accepted' | 'declined' | 'missed';
export interface Profile { name: string; role: string; interest: string; quirk: string; goal: string; home: LocationId; habit: number; ext: number; sensitive: number; ambition: number; color: string; glyph: string }
export interface Relation { aff: number; trust: number; crush: number }
export interface Sighting { loc: LocationId; tick: number; event: number; missed: boolean }
export interface Knowledge extends Sighting { routine?: Partial<Record<number, Sighting>> }
export interface Intent { kind: 'seek' | 'repair'; target: number; evidence: number[] }
export interface AgentState { id: number; name: string; role: string; interest: string; quirk: string; home: LocationId; habit: number; goal: string; ext: number; sensitive: number; ambition: number; energy: number; hunger: number; social: number; progress: number; loc: LocationId; previousLoc: LocationId; action: string; why: string; interaction: string; intent: Intent | null; memory: number[]; known: Record<number, Knowledge>; rel: Relation[]; last: number | null }
export interface ActionOption { loc: LocationId; action: string; base: number; reason: string; kind?: 'seek' | 'repair'; target?: number; evidence?: number[]; knownTick?: number; habit?: number; avoidance?: number; exhaustion?: number; urgentMeal?: number; noise?: number; score?: number }
export interface ScoredAction extends ActionOption { habit: number; avoidance: number; exhaustion: number; urgentMeal: number; noise: number; score: number; evidence: number[] }
export interface ActionScore { action: string; location: LocationId; target: number | null; total: number; needAndGoal: number; habit: number; avoidance: number; exhaustion: number; urgentMeal: number; noise: number }
export interface DayCounts { meetings: number; crushes: number; misunderstandings: number; invitations: number }
export interface EventData { reason?: string; scores?: ActionScore[]; observedPeople?: number[]; location?: LocationId; target?: number | null; delta?: number; otherDelta?: number; topic?: string; roll?: number; probability?: number; perspectives?: { person: number; interpretation: string }[]; highlights?: number[]; day?: number; counts?: DayCounts; [key: string]: unknown }
export interface CampusEvent { id: number; tick: number; text: string; type: EventType; people: number[]; parents: number[]; data: EventData; importance: number }
export interface DecisionContext { tick: number; slot: number; party: boolean; memories: CampusEvent[]; roommates: number[] }
export interface Intervention { tick: number; kind: InterventionKind }
export interface SaveData { schemaVersion: number; engineVersion: string; seed: string; tick: number; inputs: Intervention[]; checksum: string }
export interface WorldSnapshot { version: string; seed: string; tick: number; npcs: AgentState[]; events: CampusEvent[]; rooms: number[]; groups: number[]; party: number; inputs: Intervention[] }
export type EventFilter = 'important' | 'stories' | 'watched' | 'selected' | 'all';
export interface ViewState { selected: number; watched: number[]; follow: boolean; direction: 'in' | 'out'; filter: EventFilter }
