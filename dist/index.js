// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { fileURLToPath } from "url";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.searchHistory = [];
    this.learningPlans = /* @__PURE__ */ new Map();
    this.resources = /* @__PURE__ */ new Map();
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getSearchHistory() {
    return [...this.searchHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 50);
  }
  async addSearchHistory(search) {
    const id = randomUUID();
    const timestamp = /* @__PURE__ */ new Date();
    const historyItem = {
      id,
      query: search.query,
      timestamp
    };
    this.searchHistory = this.searchHistory.filter((item) => item.query !== search.query);
    this.searchHistory.push(historyItem);
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(-50);
    }
    return historyItem;
  }
  async clearSearchHistory() {
    this.searchHistory = [];
  }
  async createLearningPlan(plan) {
    const id = randomUUID();
    const createdAt = /* @__PURE__ */ new Date();
    const learningPlan = {
      id,
      topic: plan.topic,
      duration: plan.duration,
      plan: plan.plan,
      progress: {},
      createdAt
    };
    this.learningPlans.set(id, learningPlan);
    return learningPlan;
  }
  async getLearningPlan(id) {
    return this.learningPlans.get(id);
  }
  async getActiveLearningPlans() {
    return Array.from(this.learningPlans.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  }
  async updateLearningPlanProgress(planId, day, completed) {
    const plan = this.learningPlans.get(planId);
    if (plan) {
      const progress = plan.progress || {};
      progress[day] = {
        completed,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      plan.progress = progress;
      this.learningPlans.set(planId, plan);
    }
  }
  async addResource(resource) {
    const id = randomUUID();
    const resourceItem = {
      id,
      planId: resource.planId,
      day: resource.day,
      source: resource.source,
      data: resource.data
    };
    this.resources.set(id, resourceItem);
    return resourceItem;
  }
  async getResourcesByPlanId(planId) {
    return Array.from(this.resources.values()).filter((resource) => resource.planId === planId).sort((a, b) => a.day - b.day);
  }
};
var storage = new MemStorage();

// server/routes.ts
import { z } from "zod";

// server/services/openai.ts
import { GoogleGenAI } from "@google/genai";
var ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
async function generateLearningPlan(topic, duration) {
  try {
    const prompt = `Create a comprehensive ${duration}-day learning plan for "${topic}".

Structure the plan into 3 phases:
- Beginner (first 1/3 of days): Fundamentals and basics
- Intermediate (middle 1/3): Building skills and understanding
- Advanced (final 1/3): Complex topics and practical application

For each day, provide:
- A clear, specific title for what to learn that day
- 3-5 micro-topics that break down the day's learning into digestible pieces
- Ensure logical progression from day to day

Return the response in this exact JSON format:
{
  "topic": "${topic}",
  "duration": ${duration},
  "phases": {
    "beginner": {"start": 1, "end": X},
    "intermediate": {"start": X+1, "end": Y}, 
    "advanced": {"start": Y+1, "end": ${duration}}
  },
  "days": [
    {
      "day": 1,
      "title": "Day title here",
      "phase": "beginner",
      "microTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"],
      "completed": false
    }
  ]
}

Make sure the learning plan is practical, well-structured, and progresses logically from basic concepts to advanced applications.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: "You are an expert learning curriculum designer. Create detailed, practical learning plans that progress logically from beginner to advanced concepts. Always respond with valid JSON in the exact format requested.",
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            topic: { type: "string" },
            duration: { type: "number" },
            phases: {
              type: "object",
              properties: {
                beginner: {
                  type: "object",
                  properties: {
                    start: { type: "number" },
                    end: { type: "number" }
                  }
                },
                intermediate: {
                  type: "object",
                  properties: {
                    start: { type: "number" },
                    end: { type: "number" }
                  }
                },
                advanced: {
                  type: "object",
                  properties: {
                    start: { type: "number" },
                    end: { type: "number" }
                  }
                }
              }
            },
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "number" },
                  title: { type: "string" },
                  phase: { type: "string" },
                  microTopics: {
                    type: "array",
                    items: { type: "string" }
                  },
                  completed: { type: "boolean" }
                }
              }
            }
          },
          required: ["topic", "duration", "phases", "days"]
        }
      },
      contents: prompt
    });
    const result = JSON.parse(response.text || "{}");
    if (!result.days || !Array.isArray(result.days)) {
      throw new Error("Invalid learning plan structure returned from Gemini");
    }
    const beginnerEnd = Math.floor(duration / 3);
    const intermediateEnd = Math.floor(duration * 2 / 3);
    result.phases = {
      beginner: { start: 1, end: beginnerEnd },
      intermediate: { start: beginnerEnd + 1, end: intermediateEnd },
      advanced: { start: intermediateEnd + 1, end: duration }
    };
    result.days = result.days.map((day, index) => {
      const dayNumber = index + 1;
      let phase = "beginner";
      if (dayNumber > intermediateEnd) phase = "advanced";
      else if (dayNumber > beginnerEnd) phase = "intermediate";
      return {
        ...day,
        day: dayNumber,
        phase,
        completed: false,
        microTopics: day.microTopics || []
      };
    });
    return result;
  } catch (error) {
    console.error("Error generating learning plan with Gemini:", error);
    return generateFallbackPlan(topic, duration);
  }
}
function generateFallbackPlan(topic, duration) {
  const beginnerEnd = Math.floor(duration / 3);
  const intermediateEnd = Math.floor(duration * 2 / 3);
  const days = Array.from({ length: duration }, (_, index) => {
    const dayNumber = index + 1;
    let phase = "beginner";
    if (dayNumber > intermediateEnd) phase = "advanced";
    else if (dayNumber > beginnerEnd) phase = "intermediate";
    return {
      day: dayNumber,
      title: `${topic} - Day ${dayNumber} (${phase})`,
      phase,
      microTopics: [
        `Introduction to Day ${dayNumber} concepts`,
        `Core principles and theory`,
        `Practical examples and applications`,
        `Review and practice exercises`
      ],
      completed: false
    };
  });
  return {
    topic,
    duration,
    phases: {
      beginner: { start: 1, end: beginnerEnd },
      intermediate: { start: beginnerEnd + 1, end: intermediateEnd },
      advanced: { start: intermediateEnd + 1, end: duration }
    },
    days
  };
}

// server/routes.ts
import { spawn } from "child_process";
import path from "path";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
async function registerRoutes(app2) {
  app2.get("/api/search/history", async (req, res) => {
    try {
      const history = await storage.getSearchHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/search/history", async (req, res) => {
    try {
      await storage.clearSearchHistory();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/search/generate", async (req, res) => {
    try {
      const { topic, duration } = z.object({
        topic: z.string().min(1),
        duration: z.number().min(1).max(365)
      }).parse(req.body);
      await storage.addSearchHistory({ query: topic });
      const planStructure = await generateLearningPlan(topic, duration);
      const plan = await storage.createLearningPlan({
        topic,
        duration,
        plan: planStructure
      });
      console.log("Starting resource fetch for plan:", plan.id);
      fetchResourcesForPlan(plan.id, planStructure).catch((error) => {
        console.error("Background resource fetch failed:", error);
      });
      res.json({ plan });
    } catch (error) {
      console.error("Error generating learning plan:", error);
      res.status(500).json({ message: error.message || "Failed to generate learning plan" });
    }
  });
  app2.get("/api/plans/active", async (req, res) => {
    try {
      const plans = await storage.getActiveLearningPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.put("/api/plans/:planId/progress", async (req, res) => {
    try {
      const { planId } = req.params;
      const { day, completed } = z.object({
        day: z.number(),
        completed: z.boolean()
      }).parse(req.body);
      await storage.updateLearningPlanProgress(planId, day, completed);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/resources/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const resources = await storage.getResourcesByPlanId(planId);
      console.log(`Found ${resources.length} resources for plan ${planId}`);
      const groupedResources = {};
      resources.forEach((resource) => {
        if (!groupedResources[resource.day]) {
          groupedResources[resource.day] = {};
        }
        groupedResources[resource.day][resource.source] = resource.data;
        console.log(`Added ${resource.data.length} ${resource.source} resources for day ${resource.day}`);
      });
      if (resources.length === 0) {
        const plan = await storage.getLearningPlan(planId);
        if (plan) {
          console.log("No resources found, triggering immediate fetch");
          fetchResourcesForPlan(plan.id, plan.plan).catch(console.error);
          const fallbackResources = await generateImmediateResources(plan.topic, plan.duration);
          res.json(fallbackResources);
          return;
        }
      }
      res.json(groupedResources);
    } catch (error) {
      console.error("Error getting resources:", error);
      res.status(500).json({ message: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function generateImmediateResources(topic, duration) {
  const groupedResources = {};
  for (let day = 1; day <= Math.min(duration, 5); day++) {
    const searchQuery = `${topic} day ${day} fundamentals`;
    groupedResources[day] = {
      wikipedia: await fetchResourcesFromSource("wikipedia", searchQuery),
      youtube: await fetchResourcesFromSource("youtube", searchQuery),
      reddit: await fetchResourcesFromSource("reddit", searchQuery),
      medium: await fetchResourcesFromSource("medium", searchQuery)
    };
  }
  return groupedResources;
}
function generateComprehensiveSearchQueries(planStructure, day) {
  const queries = [];
  const baseTopic = planStructure.topic;
  const dayTitle = day.title;
  const microTopics = day.microTopics || [];
  const phase = day.phase || "beginner";
  queries.push(`${baseTopic} ${dayTitle}`);
  queries.push(`${baseTopic} ${dayTitle} tutorial`);
  queries.push(`${baseTopic} ${dayTitle} guide`);
  if (phase === "beginner") {
    queries.push(`${baseTopic} ${dayTitle} fundamentals`);
    queries.push(`${baseTopic} ${dayTitle} basics`);
    queries.push(`learn ${baseTopic} ${dayTitle}`);
  } else if (phase === "intermediate") {
    queries.push(`${baseTopic} ${dayTitle} practical`);
    queries.push(`${baseTopic} ${dayTitle} implementation`);
    queries.push(`${baseTopic} ${dayTitle} examples`);
  } else if (phase === "advanced") {
    queries.push(`${baseTopic} ${dayTitle} advanced`);
    queries.push(`${baseTopic} ${dayTitle} optimization`);
    queries.push(`${baseTopic} ${dayTitle} best practices`);
  }
  microTopics.forEach((microTopic) => {
    queries.push(`${baseTopic} ${microTopic}`);
    queries.push(`${microTopic} explained`);
    queries.push(`${microTopic} tutorial`);
    queries.push(`${baseTopic} ${microTopic} ${phase}`);
  });
  queries.push(`${baseTopic} documentation`);
  queries.push(`${baseTopic} reference`);
  queries.push(`${baseTopic} technical guide`);
  return [...new Set(queries)].slice(0, 12);
}
function optimizeQueriesForSource(source, baseQueries, topic) {
  const optimized = [...baseQueries];
  switch (source) {
    case "youtube":
      optimized.push(`${topic} tutorial step by step`);
      optimized.push(`how to learn ${topic}`);
      optimized.push(`${topic} course`);
      optimized.push(`${topic} explained`);
      break;
    case "medium":
      optimized.push(`${topic} deep dive`);
      optimized.push(`${topic} comprehensive guide`);
      optimized.push(`mastering ${topic}`);
      optimized.push(`${topic} best practices`);
      break;
    case "reddit":
      optimized.push(`learning ${topic}`);
      optimized.push(`${topic} discussion`);
      optimized.push(`${topic} help`);
      optimized.push(`${topic} resources`);
      break;
    case "wikipedia":
      optimized.push(`${topic} overview`);
      optimized.push(`${topic} introduction`);
      optimized.push(`${topic} theory`);
      optimized.push(`${topic} principles`);
      break;
  }
  return [...new Set(optimized)].slice(0, 8);
}
async function fetchResourcesForPlan(planId, planStructure) {
  try {
    const days = planStructure.days || [];
    console.log(`Fetching resources for ${days.length} days`);
    for (const day of days) {
      const dayNumber = day.day;
      const searchQueries = generateComprehensiveSearchQueries(planStructure, day);
      console.log(`Day ${dayNumber}: Searching with ${searchQueries.length} targeted queries`);
      const sources = ["wikipedia", "youtube", "reddit", "medium"];
      for (const source of sources) {
        try {
          console.log(`Fetching ${source} resources for day ${dayNumber}`);
          const sourceQueries = optimizeQueriesForSource(source, searchQueries, planStructure.topic);
          let allResources = [];
          for (const query of sourceQueries) {
            try {
              const resources = await fetchResourcesFromSource(source, query);
              if (resources && resources.length > 0) {
                const validResources = resources.filter(
                  (r) => !r.metadata?.fallback && r.title !== "Sorry peeps nothing to see here" && r.url && r.url.trim() !== ""
                );
                allResources = allResources.concat(validResources);
              }
            } catch (queryError) {
              console.error(`Error with query "${query}" for ${source}:`, queryError);
              continue;
            }
          }
          const uniqueResources = allResources.filter(
            (resource, index, self) => index === self.findIndex((r) => r.url === resource.url)
          ).slice(0, 5);
          console.log(`Got ${uniqueResources.length} ${source} resources for day ${dayNumber}`);
          if (uniqueResources.length > 0) {
            await storage.addResource({
              planId,
              day: dayNumber,
              source,
              data: uniqueResources
            });
            console.log(`Saved ${uniqueResources.length} ${source} resources for day ${dayNumber}`);
          }
        } catch (error) {
          console.error(`Error fetching ${source} resources for day ${dayNumber}:`, error);
        }
      }
    }
    console.log("Finished fetching all resources for plan:", planId);
  } catch (error) {
    console.error("Error fetching resources for plan:", error);
  }
}
async function fetchResourcesFromSource(source, query) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../server/utils", `fetch_${source}_simple.py`);
    const env = {
      ...process.env,
      PYTHONPATH: process.env.HOME + "/.pythonlibs/lib/python3.11/site-packages"
    };
    const python = spawn("python3", [scriptPath, query], { env });
    let output = "";
    let errorOutput = "";
    python.stdout.on("data", (data) => {
      output += data.toString();
    });
    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    python.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error(`Error parsing ${source} results:`, error);
          resolve([]);
        }
      } else {
        console.error(`${source} script error:`, errorOutput);
        resolve([]);
      }
    });
    setTimeout(() => {
      python.kill();
      resolve([]);
    }, 1e4);
  });
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(__dirname2, "client", "src"),
      "@shared": path2.resolve(__dirname2, "shared"),
      "@assets": path2.resolve(__dirname2, "attached_assets")
    }
  },
  root: path2.resolve(__dirname2, "client"),
  build: {
    outDir: path2.resolve(__dirname2, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    hmr: {
      port: 5e3
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __dirname3 = path3.dirname(fileURLToPath3(import.meta.url));
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        __dirname3,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(__dirname3, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
