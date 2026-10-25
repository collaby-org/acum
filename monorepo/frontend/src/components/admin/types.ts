/**
 * The shapes the desk and the API agree on.
 *
 * They live here, apart from the queries, because the browser reads them
 * and the server writes them: the interface must know what a row looks
 * like without importing the module that reads the database.
 */
import type { CategoryId, Quality, ServerStatus } from "@/data/types";
import type { Plan } from "@/lib/supabase/plans";

export type { Plan, CategoryId };

export type Account = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: Plan;
  plan_until: string | null;
  bypass: boolean;
  note: string | null;
  created_at: string;
  last_seen_at: string | null;
  /** How much this account has watched today, in minutes. */
  minutes_today: number;
};

export type Message = {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  body: string;
  page: string | null;
  agent: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
};

export type DayPoint = {
  day: string;
  sign_ins: number;
  minutes_watched: number;
  paywalls: number;
  conversions: number;
};

export type Series = {
  days: DayPoint[];
  totals: {
    sign_ins: number;
    minutes_watched: number;
    paywalls: number;
    conversions: number;
  };
};

export type Today = {
  accounts: number;
  sign_ins: number;
  minutes_watched: number;
  paywalls: number;
  conversions: number;
  plans: { plan: Plan; count: number }[];
};

export type CatalogueRow = {
  id: string;
  name: string;
  family: string;
  category: CategoryId;
  status: ServerStatus;
  quality: Quality;
  logo: string | null;
  logoHd: string | null;
  views: number | null;
};

export type CatalogueSummary = {
  channels: number;
  feeds: number;
  live: number;
  withFallback: number;
  quality: { quality: Quality; count: number }[];
  status: { status: ServerStatus; count: number }[];
};

export type RecentRegistration = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: Plan;
  created_at: string;
};

export type OverviewPayload = {
  live: Record<string, number>;
  /** The channels people are watching right now, with their names. */
  liveTop: { id: string; name: string; count: number }[];
  total: number;
  today: Today;
  series: Series;
  recent: RecentRegistration[];
  catalogue: CatalogueSummary;
};

export type AccountsPayload = { accounts: Account[] };
export type MessagesPayload = { messages: Message[] };
export type CataloguePayload = {
  channels: CatalogueRow[];
  summary: CatalogueSummary;
  live: Record<string, number>;
  total: number;
};
