import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const learningPlans = pgTable("learning_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topic: text("topic").notNull(),
  duration: integer("duration").notNull(),
  plan: jsonb("plan").notNull(),
  progress: jsonb("progress").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => learningPlans.id),
  day: integer("day").notNull(),
  source: text("source").notNull(), // 'wikipedia', 'youtube', 'reddit', 'medium'
  data: jsonb("data").notNull(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).pick({
  query: true,
});

export const insertLearningPlanSchema = createInsertSchema(learningPlans).pick({
  topic: true,
  duration: true,
  plan: true,
});

export const insertResourceSchema = createInsertSchema(resources).pick({
  planId: true,
  day: true,
  source: true,
  data: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;

export type LearningPlan = typeof learningPlans.$inferSelect;
export type InsertLearningPlan = z.infer<typeof insertLearningPlanSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

// Learning plan structure types
export interface DayPlan {
  day: number;
  title: string;
  phase: 'beginner' | 'intermediate' | 'advanced';
  microTopics: string[];
  completed: boolean;
}

export interface LearningPlanStructure {
  topic: string;
  duration: number;
  phases: {
    beginner: { start: number; end: number };
    intermediate: { start: number; end: number };
    advanced: { start: number; end: number };
  };
  days: DayPlan[];
}

export interface ResourceItem {
  title: string;
  url: string;
  description: string;
  metadata?: any;
}

export interface ResourceGroup {
  wikipedia: ResourceItem[];
  youtube: ResourceItem[];
  reddit: ResourceItem[];
  medium: ResourceItem[];
}
