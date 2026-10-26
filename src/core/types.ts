export type LocationId = 0 | 1 | 2 | 3 | 4;
export type InterventionKind = "rooms" | "groups" | "party";
export type EventType =
  | "system"
  | "action"
  | "intervention"
  | "summary"
  | "friendship"
  | "crush"
  | "misunderstanding"
  | "repair"
  | "rivalry"
  | "invitation"
  | "accepted"
  | "declined"
  | "missed"
  | "plan_started"
  | "plan_proposed"
  | "plan_accepted"
  | "plan_declined"
  | "plan_waiting"
  | "plan_fulfilled"
  | "plan_cancelled"
  | "plan_expired"
  | "task_announced"
  | "task_progress"
  | "task_completed"
  | "task_expired"
  | "brief_reply"
  | "belief_formed"
  | "explanation"
  | "belief_revised"
  | "activity_proposed"
  | "activity_invited"
  | "activity_accepted"
  | "activity_declined"
  | "activity_progress"
  | "activity_held"
  | "activity_cancelled";
export interface Profile {
  name: string;
  role: string;
  interest: string;
  quirk: string;
  goal: string;
  home: LocationId;
  habit: number;
  ext: number;
  sensitive: number;
  ambition: number;
  color: string;
  glyph: string;
}
export interface Relation {
  aff: number;
  trust: number;
  crush: number;
}
export interface Sighting {
  loc: LocationId;
  tick: number;
  event: number;
  missed: boolean;
}
export interface Knowledge extends Sighting {
  routine?: Partial<Record<number, Sighting>>;
}
export interface Intent {
  kind: "seek" | "repair" | "appointment" | "task" | "activity_prepare" | "activity_attend";
  target?: number;
  taskId?: string;
  activityId?: string;
  evidence: number[];
}
export interface AgentState {
  id: number;
  name: string;
  role: string;
  interest: string;
  quirk: string;
  home: LocationId;
  habit: number;
  goal: string;
  ext: number;
  sensitive: number;
  ambition: number;
  energy: number;
  hunger: number;
  social: number;
  progress: number;
  loc: LocationId;
  previousLoc: LocationId;
  action: string;
  why: string;
  interaction: string;
  intent: Intent | null;
  memory: number[];
  known: Record<number, Knowledge>;
  rel: Relation[];
  last: number | null;
  plan: AgentPlan | null;
  lastPlanTick: number;
  beliefs: Belief[];
  accounts: PersonalAccount[];
  activityInvitations: ActivityInvitation[];
}
export interface ActionOption {
  loc: LocationId;
  action: string;
  base: number;
  reason: string;
  kind?: Intent["kind"];
  target?: number;
  taskId?: string;
  activityId?: string;
  evidence?: number[];
  knownTick?: number;
  habit?: number;
  avoidance?: number;
  exhaustion?: number;
  urgentMeal?: number;
  noise?: number;
  score?: number;
  commitment?: number;
  switching?: number;
}
export interface ScoredAction extends ActionOption {
  habit: number;
  avoidance: number;
  exhaustion: number;
  urgentMeal: number;
  noise: number;
  score: number;
  evidence: number[];
  commitment: number;
  switching: number;
}
export interface ActionScore {
  action: string;
  location: LocationId;
  target: number | null;
  total: number;
  needAndGoal: number;
  habit: number;
  avoidance: number;
  exhaustion: number;
  urgentMeal: number;
  noise: number;
  commitment: number;
  switching: number;
}
export interface DayCounts {
  meetings: number;
  crushes: number;
  misunderstandings: number;
  invitations: number;
  tasksCompleted?: number;
  plansFulfilled?: number;
  activitiesHeld?: number;
  explanations?: number;
}
export interface EventData {
  reason?: string;
  dueTick?: number;
  planId?: string;
  taskId?: string;
  activityId?: string;
  beliefId?: string;
  sourceEvent?: number;
  claim?: string;
  confidence?: number;
  previousConfidence?: number;
  progress?: number;
  required?: number;
  scores?: ActionScore[];
  observedPeople?: number[];
  location?: LocationId;
  target?: number | null;
  delta?: number;
  otherDelta?: number;
  topic?: string;
  roll?: number;
  probability?: number;
  perspectives?: { person: number; interpretation: string }[];
  highlights?: number[];
  day?: number;
  counts?: DayCounts;
  [key: string]: unknown;
}
export interface CampusEvent {
  id: number;
  tick: number;
  text: string;
  type: EventType;
  people: number[];
  parents: number[];
  data: EventData;
  importance: number;
}
export interface DecisionContext {
  tick: number;
  slot: number;
  party: boolean;
  memories: CampusEvent[];
  roommates: number[];
  tasks?: CampusTask[];
  activities?: ActivityOffer[];
}
export interface Intervention {
  tick: number;
  kind: InterventionKind;
}
export interface SaveData {
  schemaVersion: number;
  engineVersion: string;
  seed: string;
  tick: number;
  inputs: Intervention[];
  checksum: string;
}
export interface WorldSnapshot {
  version: string;
  seed: string;
  tick: number;
  npcs: AgentState[];
  events: CampusEvent[];
  rooms: number[];
  groups: number[];
  party: number;
  inputs: Intervention[];
  tasks: CampusTask[];
  activities: CampusActivity[];
}
export type EventFilter =
  | "important"
  | "stories"
  | "watched"
  | "selected"
  | "all";
export interface ViewState {
  selected: number;
  watched: number[];
  follow: boolean;
  direction: "in" | "out";
  filter: EventFilter;
}

export type PlanStage =
  | "pending"
  | "waiting"
  | "working"
  | "fulfilled"
  | "cancelled"
  | "expired";
export interface AgentPlan {
  id: string;
  kind: "appointment" | "task";
  target?: number;
  taskId?: string;
  location: LocationId;
  createdTick: number;
  dueTick: number;
  untilTick: number;
  stage: PlanStage;
  attempts: number;
  worked: number;
  lastEvent: number;
}
export interface CampusTask {
  id: string;
  title: string;
  members: number[];
  location: LocationId;
  progress: number;
  required: number;
  deadline: number;
  status: "open" | "completed" | "expired";
  lastEvent: number;
  contributions: Record<number, number>;
}

export interface Belief {
  id: string;
  kind: "absence" | "brief_reply";
  subject: number;
  claim: string;
  confidence: number;
  status: "unresolved" | "revised";
  sourceEvent: number;
  evidence: number[];
  planId?: string;
  taskId?: string;
  activityId?: string;
  createdTick: number;
  updatedTick: number;
  explanationEvent?: number;
  resolution?: string;
}

// Only the owner may turn a private account into a spoken explanation.
export interface PersonalAccount {
  kind: Belief["kind"];
  sourceEvent: number;
  planId?: string;
  text: string;
  evidence: number[];
}

export interface ActivityInvitation {
  activityId: string;
  title: string;
  organizer: number;
  dueTick: number;
  accepted: boolean;
  sourceEvent: number;
  preparationGoal: number;
}

export interface ActivityOffer extends ActivityInvitation {
  ownPreparation: number;
}

export interface CampusActivity {
  id: string;
  title: string;
  organizer: number;
  createdTick: number;
  dueTick: number;
  location: LocationId;
  status: "preparing" | "held" | "cancelled";
  progress: number;
  required: number;
  invited: number[];
  members: number[];
  attendees: number[];
  contributions: Record<number, number>;
  lastEvent: number;
}
