import type { Enrollment } from './enrollment.ts';
import type { ClubState } from './clubs.ts';
import type { MealDelivery } from './mealDelivery.ts';
import type { LivingState } from './livingExperiment.ts';
import type { Parcel, Laundry } from './parcelLaundry.ts';
export type LocationId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22;
export type InterventionKind = "rooms" | "groups" | "party";
export type EventType =
  | "holiday_departed" | "holiday_returned"
  | "living_meal" | "living_work" | "living_support_accepted" | "living_support_unavailable" | "living_delivery_paid"
  | "library_waitlisted" | "library_hold_notified" | "library_hold_expired" | "library_wait_cancelled"
  | "parcel_arrived" | "parcel_overdue" | "parcel_collected" | "laundry_started" | "laundry_waiting" | "laundry_collected"
  | "course_catalog" | "course_selected" | "course_selection_failed"
  | "club_joined" | "club_left" | "club_meeting" | "club_meeting_cancelled" | "club_project_rejected"
  | "festival_visit"
  | "dorm_borrow" | "dorm_declined" | "dorm_return" | "dorm_routine_agreed" | "dorm_routine_declined"
  | "delivery_ordered" | "delivery_ready" | "delivery_collected" | "delivery_expired"
  | "between_classes"
  | "quiz_result"
  | "schedule_changed"
  | "exam_taken" | "exam_missed" | "exam_result" | "exam_deferred"
  | "restaurant_wait" | "restaurant_alternative"
  | "library_borrow" | "library_return" | "library_unavailable" | "library_print"
  | "library_room_reserved" | "library_room_rejected" | "library_room_used" | "library_room_missed"
  | "homework_assigned"
  | "homework_progress"
  | "homework_completed"
  | "homework_expired"
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
  | "research_experiment_failed" | "research_stage" | "research_feedback" | "research_meeting_missed"
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
  education?: "undergraduate" | "graduate";
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
  kind: "seek" | "repair" | "appointment" | "task" | "activity_prepare" | "activity_attend" | "homework" | "library_borrow" | "library_return" | "library_book_room" | "library_cancel" | "lab" | "exam" | "defer_exam" | "retake_study" | "delivery_pickup" | "seminar" | "parcel_pickup" | "laundry_start" | "laundry_pickup" | "club_join" | "club_leave" | "club_meeting" | "club_propose" | "part_time" | "living_support";
  target?: number;
  taskId?: string;
  activityId?: string;
  homeworkId?: string;
  courseId?: string;
  evidence: number[];
}
export interface AgentState {
  holidayReturnTick?: number;
  education: "undergraduate" | "graduate";
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
  homeworkId?: string;
  courseId?: string;
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
  dorm?: 0 | 5 | 20 | 21;
  tasks?: CampusTask[];
  homework?: Homework[];
  library?: LibraryState;
  crowding?: Partial<Record<LocationId, number>>;
  weather?: "晴" | "多云" | "小雨";
  assessments?: Assessment[];
  delivery?: MealDelivery;
  living?: LivingState;
  parcel?: Parcel;
  laundry?: Laundry;
  activities?: ActivityOffer[];
  courseIds?: string[];
  clubs?: { id: string; name: string; meetingLocation: 4 | 16; meetingSlot: number; member: boolean; canPropose: boolean }[];
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
  livingEnabled: boolean;
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
  homework: Homework[];
  library: LibraryState;
  assessments: Assessment[];
  deliveries: MealDelivery[];
  livingEnabled: boolean;
  living: LivingState[];
  parcels: Parcel[];
  laundry: Laundry[];
  activities: CampusActivity[];
  clubs: ClubState;
  enrollments: Enrollment[];
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
  research?: {
    stage: "资料" | "实验" | "整理";
    attempts: number;
    feedback: "未参加" | "建议复核" | null;
    meetingEvent?: number;
  };
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
  preparationLocation?: LocationId;
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
  clubId?: string;
  kind?: "project" | "gathering";
  preparationLocation?: LocationId;
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

export interface Homework {
  id: string; owner: number; title: string; courseId: string; deadline: number;
  progress: number; required: number; status: "open" | "completed" | "expired"; lastEvent: number;
}

export interface LibraryState {
  books: { id: string; title: string; copies: number }[];
  loans: { owner: number; bookId: string; borrowedTick: number; dueTick: number; returnedTick: number | null; lastEvent: number }[];
  waitlist: LibraryWait[];
  reservations: { taskId: string; organizer: number; createdTick: number; dueTick: number; status: "reserved" | "rejected" | "used" | "missed"; attendees: number[]; lastEvent: number }[];
}

export interface LibraryWait { owner: number; bookId: string; createdTick: number; status: 'waiting' | 'notified' | 'borrowed' | 'expired' | 'cancelled'; expiresTick?: number; lastEvent: number }

export interface Assessment {
  owner: number; courseId: string; title: string; credits: number; examTick: number; makeupTick: number;
  status: "scheduled" | "pending" | "passed" | "failed" | "missed" | "makeup_pending" | "retake_needed" | "deferred" | "deferred_pending" | "retake_pending";
  processScore?: number; examScore: number | null; score: number | null; earnedCredits: number;
  publishedTick: number | null; lastEvent: number | null; retakeTick: number; retakeWork: number;
}
