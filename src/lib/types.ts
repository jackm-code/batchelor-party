export type Role = 'organiser' | 'group' | 'groom';
export type CityId = 'boston' | 'nyc';
export type Tier = 'budget' | 'mid' | 'premium';
export type Ccy = 'USD' | 'GBP';
export type EntityType = 'option' | 'assumption' | 'fx_rate' | 'decision' | 'open_question';

export interface City { id: CityId; name: string }

export interface Option {
  id: number; slug: string; city_id: CityId | null;
  category: 'stay' | 'activity' | 'food' | 'transport' | 'payment';
  name: string; tier: Tier | null;
  price_amount: number | null; price_amount_high: number | null;
  price_unit: 'per_person' | 'per_room_night' | 'flat';
  currency: Ccy; quoted_amount: number | null; quoted_amount_high: number | null;
  price_note: string | null; lead_time_days: number | null; lead_time_note: string | null;
  status: 'shortlist' | 'chosen' | 'rejected';
  groom_fit_note: string | null; notes: string | null;
  verified: boolean; model_input: boolean; excluded_from_totals: boolean;
}

export interface Assumption {
  id: number; key: string; city_id: CityId | null;
  value: number | null; value_text: string | null;
  unit: 'percent' | 'usd_cents' | 'beds' | 'legs' | 'flag' | 'text';
  currency: Ccy | null; reason: string | null; status_note: string | null; verified: boolean;
}

export interface FxRate { id: number; from_ccy: Ccy; to_ccy: Ccy; rate: number; as_of: string; source_id: number | null; note: string | null }
export interface Source { id: number; slug: string; title: string; url: string | null; date_checked: string; publisher: string | null; notes: string | null }
export interface SourceLink { id: number; source_id: number; entity_type: EntityType; entity_id: number; quote_or_figure: string | null }
export interface Conflict {
  id: number; entity_type: EntityType; entity_id: number; title: string;
  source_a: number | null; source_b: number | null; value_a: string; value_b: string | null; used: string; why: string;
}
export interface ScenarioRow {
  id: number; name: string; city_id: CityId; tier: Tier; nights: 2 | 3;
  group_size: number; local_guests: number; groom_covered: boolean;
}
export interface Decision {
  id: number; date: string; title: string; decision: string; reason: string | null;
  decided_by: string; linked_option_ids: number[]; superseded_by: number | null; created_at: string;
}
export interface OpenQuestion {
  id: number; question: string; owner: string; status: 'open' | 'answered';
  answer: string | null; closed_by_decision_id: number | null;
}
export interface Guest { id: number; name: string; home_country: string | null; bed_needed: boolean; role: Role; currency: Ccy }
export interface Payment {
  id: number; guest_id: number; amount: number; currency: Ccy; quoted_amount: number | null;
  due_date: string | null; paid_date: string | null;
}
export interface Vote { id: number; option_id: number; guest_id: number; vote: 1 | -1 }
export interface Comment { id: number; entity_type: EntityType; entity_id: number; guest_id: number; body: string; created_at: string }
export interface AuditRow {
  id: number; table_name: string; row_id: string; action: 'insert' | 'update' | 'delete';
  actor: string; at: string; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null;
}

/** Everything one role may see, from a single api_bundle() call. */
export interface Bundle {
  role: Role;
  published: boolean;
  settings: Record<string, string>;
  cities: City[];
  options: Option[];
  assumptions: Assumption[];
  fx_rates: FxRate[];
  sources: Source[];
  source_links: SourceLink[];
  conflicts: Conflict[];
  scenarios: ScenarioRow[];
  decisions: Decision[];
  open_questions: OpenQuestion[];
  guests: Guest[];
  votes: Vote[];
  comments: Comment[];
  decision_history: AuditRow[];
  payments: Payment[];
  audit_log: AuditRow[];
}

const LISTS = [
  'cities', 'options', 'assumptions', 'fx_rates', 'sources', 'source_links', 'conflicts', 'scenarios',
  'decisions', 'open_questions', 'guests', 'votes', 'comments', 'decision_history', 'payments', 'audit_log',
] as const;

/** Fill in empty lists for anything the role was not sent, and make numerics numbers. */
export function normaliseBundle(raw: Partial<Bundle> & { role: Role }): Bundle {
  const b = { published: false, settings: {}, ...raw } as Bundle;
  for (const k of LISTS) if (!Array.isArray(b[k])) (b as any)[k] = [];
  b.assumptions = b.assumptions.map((a) => ({ ...a, value: a.value === null ? null : Number(a.value) }));
  b.fx_rates = b.fx_rates.map((f) => ({ ...f, rate: Number(f.rate) }));
  return b;
}
