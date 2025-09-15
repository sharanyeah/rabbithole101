import { 
  type User, 
  type InsertUser, 
  type SearchHistory, 
  type InsertSearchHistory,
  type LearningPlan,
  type InsertLearningPlan,
  type Resource,
  type InsertResource
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Search history operations
  getSearchHistory(): Promise<SearchHistory[]>;
  addSearchHistory(search: InsertSearchHistory): Promise<SearchHistory>;
  clearSearchHistory(): Promise<void>;
  
  // Learning plan operations
  createLearningPlan(plan: InsertLearningPlan): Promise<LearningPlan>;
  getLearningPlan(id: string): Promise<LearningPlan | undefined>;
  getActiveLearningPlans(): Promise<LearningPlan[]>;
  updateLearningPlanProgress(planId: string, day: number, completed: boolean): Promise<void>;
  
  // Resource operations
  addResource(resource: InsertResource): Promise<Resource>;
  getResourcesByPlanId(planId: string): Promise<Resource[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private searchHistory: SearchHistory[];
  private learningPlans: Map<string, LearningPlan>;
  private resources: Map<string, Resource>;

  constructor() {
    this.users = new Map();
    this.searchHistory = [];
    this.learningPlans = new Map();
    this.resources = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSearchHistory(): Promise<SearchHistory[]> {
    return [...this.searchHistory].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 50);
  }

  async addSearchHistory(search: InsertSearchHistory): Promise<SearchHistory> {
    const id = randomUUID();
    const timestamp = new Date();
    const historyItem: SearchHistory = {
      id,
      query: search.query,
      timestamp,
    };
    
    // Remove duplicate if exists
    this.searchHistory = this.searchHistory.filter(item => item.query !== search.query);
    this.searchHistory.push(historyItem);
    
    // Keep only last 50 searches
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(-50);
    }
    
    return historyItem;
  }

  async clearSearchHistory(): Promise<void> {
    this.searchHistory = [];
  }

  async createLearningPlan(plan: InsertLearningPlan): Promise<LearningPlan> {
    const id = randomUUID();
    const createdAt = new Date();
    const learningPlan: LearningPlan = {
      id,
      topic: plan.topic,
      duration: plan.duration,
      plan: plan.plan,
      progress: {},
      createdAt,
    };
    
    this.learningPlans.set(id, learningPlan);
    return learningPlan;
  }

  async getLearningPlan(id: string): Promise<LearningPlan | undefined> {
    return this.learningPlans.get(id);
  }

  async getActiveLearningPlans(): Promise<LearningPlan[]> {
    return Array.from(this.learningPlans.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  async updateLearningPlanProgress(planId: string, day: number, completed: boolean): Promise<void> {
    const plan = this.learningPlans.get(planId);
    if (plan) {
      const progress = plan.progress as any || {};
      progress[day] = { 
        completed, 
        timestamp: new Date().toISOString() 
      };
      plan.progress = progress;
      this.learningPlans.set(planId, plan);
    }
  }

  async addResource(resource: InsertResource): Promise<Resource> {
    const id = randomUUID();
    const resourceItem: Resource = {
      id,
      planId: resource.planId!,
      day: resource.day,
      source: resource.source,
      data: resource.data,
    };
    
    this.resources.set(id, resourceItem);
    return resourceItem;
  }

  async getResourcesByPlanId(planId: string): Promise<Resource[]> {
    return Array.from(this.resources.values())
      .filter(resource => resource.planId === planId)
      .sort((a, b) => a.day - b.day);
  }
}

export const storage = new MemStorage();
