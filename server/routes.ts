
import type { Express } from "express";
import { createServer, type Server } from "http";
import { fileURLToPath } from "url";
import { storage } from "./storage";
import { z } from "zod";
import { insertSearchHistorySchema, insertLearningPlanSchema } from "@shared/schema";
import { generateLearningPlan } from "./services/openai";
import { spawn } from "child_process";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Search history endpoints
  app.get("/api/search/history", async (req, res) => {
    try {
      const history = await storage.getSearchHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/search/history", async (req, res) => {
    try {
      await storage.clearSearchHistory();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Learning plan generation endpoint
  app.post("/api/search/generate", async (req, res) => {
    try {
      const { topic, duration } = z.object({
        topic: z.string().min(1),
        duration: z.number().min(1).max(365)
      }).parse(req.body);

      // Add to search history
      await storage.addSearchHistory({ query: topic });

      // Generate learning plan using OpenAI
      const planStructure = await generateLearningPlan(topic, duration);
      
      // Save learning plan
      const plan = await storage.createLearningPlan({
        topic,
        duration,
        plan: planStructure,
      });

      // Fetch resources in background with better logging
      console.log("Starting resource fetch for plan:", plan.id);
      fetchResourcesForPlan(plan.id, planStructure).catch(error => {
        console.error("Background resource fetch failed:", error);
      });

      res.json({ plan });
    } catch (error: any) {
      console.error("Error generating learning plan:", error);
      res.status(500).json({ message: error.message || "Failed to generate learning plan" });
    }
  });

  // Active learning plans endpoint
  app.get("/api/plans/active", async (req, res) => {
    try {
      const plans = await storage.getActiveLearningPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update learning plan progress
  app.put("/api/plans/:planId/progress", async (req, res) => {
    try {
      const { planId } = req.params;
      const { day, completed } = z.object({
        day: z.number(),
        completed: z.boolean()
      }).parse(req.body);

      await storage.updateLearningPlanProgress(planId, day, completed);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get resources for a learning plan
  app.get("/api/resources/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const resources = await storage.getResourcesByPlanId(planId);
      
      console.log(`Found ${resources.length} resources for plan ${planId}`);
      
      // Group resources by day and source
      const groupedResources: Record<number, Record<string, any[]>> = {};
      
      resources.forEach(resource => {
        if (!groupedResources[resource.day]) {
          groupedResources[resource.day] = {};
        }
        groupedResources[resource.day][resource.source] = resource.data as any[];
        console.log(`Added ${(resource.data as any[]).length} ${resource.source} resources for day ${resource.day}`);
      });

      // If no resources found, try to trigger resource fetching again
      if (resources.length === 0) {
        const plan = await storage.getLearningPlan(planId);
        if (plan) {
          console.log("No resources found, triggering immediate fetch");
          fetchResourcesForPlan(plan.id, plan.plan as any).catch(console.error);
          
          // Return immediate fallback resources while background fetch happens
          const fallbackResources = await generateImmediateResources(plan.topic, plan.duration);
          res.json(fallbackResources);
          return;
        }
      }

      res.json(groupedResources);
    } catch (error: any) {
      console.error("Error getting resources:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Generate immediate fallback resources
async function generateImmediateResources(topic: string, duration: number) {
  const groupedResources: Record<number, Record<string, any[]>> = {};
  
  for (let day = 1; day <= Math.min(duration, 5); day++) {
    const searchQuery = `${topic} day ${day} fundamentals`;
    
    groupedResources[day] = {
      wikipedia: await fetchResourcesFromSource('wikipedia', searchQuery),
      youtube: await fetchResourcesFromSource('youtube', searchQuery),
      reddit: await fetchResourcesFromSource('reddit', searchQuery),
      medium: await fetchResourcesFromSource('medium', searchQuery)
    };
  }
  
  return groupedResources;
}

// Generate comprehensive search queries based on learning plan structure
function generateComprehensiveSearchQueries(planStructure: any, day: any): string[] {
  const queries = [];
  const baseTopic = planStructure.topic;
  const dayTitle = day.title;
  const microTopics = day.microTopics || [];
  const phase = day.phase || 'beginner';
  
  // Primary queries combining topic and day focus
  queries.push(`${baseTopic} ${dayTitle}`);
  queries.push(`${baseTopic} ${dayTitle} tutorial`);
  queries.push(`${baseTopic} ${dayTitle} guide`);
  
  // Phase-specific queries
  if (phase === 'beginner') {
    queries.push(`${baseTopic} ${dayTitle} fundamentals`);
    queries.push(`${baseTopic} ${dayTitle} basics`);
    queries.push(`learn ${baseTopic} ${dayTitle}`);
  } else if (phase === 'intermediate') {
    queries.push(`${baseTopic} ${dayTitle} practical`);
    queries.push(`${baseTopic} ${dayTitle} implementation`);
    queries.push(`${baseTopic} ${dayTitle} examples`);
  } else if (phase === 'advanced') {
    queries.push(`${baseTopic} ${dayTitle} advanced`);
    queries.push(`${baseTopic} ${dayTitle} optimization`);
    queries.push(`${baseTopic} ${dayTitle} best practices`);
  }
  
  // Micro-topic specific queries
  microTopics.forEach(microTopic => {
    queries.push(`${baseTopic} ${microTopic}`);
    queries.push(`${microTopic} explained`);
    queries.push(`${microTopic} tutorial`);
    
    // Combine micro-topics with day context
    queries.push(`${baseTopic} ${microTopic} ${phase}`);
  });
  
  // Technical documentation queries
  queries.push(`${baseTopic} documentation`);
  queries.push(`${baseTopic} reference`);
  queries.push(`${baseTopic} technical guide`);
  
  // Remove duplicates and limit
  return [...new Set(queries)].slice(0, 12);
}

// Optimize queries for specific sources
function optimizeQueriesForSource(source: string, baseQueries: string[], topic: string): string[] {
  const optimized = [...baseQueries];
  
  switch (source) {
    case 'youtube':
      // YouTube works better with tutorial and how-to queries
      optimized.push(`${topic} tutorial step by step`);
      optimized.push(`how to learn ${topic}`);
      optimized.push(`${topic} course`);
      optimized.push(`${topic} explained`);
      break;
      
    case 'medium':
      // Medium works better with technical and detailed queries
      optimized.push(`${topic} deep dive`);
      optimized.push(`${topic} comprehensive guide`);
      optimized.push(`mastering ${topic}`);
      optimized.push(`${topic} best practices`);
      break;
      
    case 'reddit':
      // Reddit works better with discussion and question-based queries
      optimized.push(`learning ${topic}`);
      optimized.push(`${topic} discussion`);
      optimized.push(`${topic} help`);
      optimized.push(`${topic} resources`);
      break;
      
    case 'wikipedia':
      // Wikipedia works better with formal and academic queries
      optimized.push(`${topic} overview`);
      optimized.push(`${topic} introduction`);
      optimized.push(`${topic} theory`);
      optimized.push(`${topic} principles`);
      break;
  }
  
  // Remove duplicates and limit per source
  return [...new Set(optimized)].slice(0, 8);
}

// Background function to fetch resources for each day of the learning plan
async function fetchResourcesForPlan(planId: string, planStructure: any) {
  try {
    const days = planStructure.days || [];
    console.log(`Fetching resources for ${days.length} days`);
    
    for (const day of days) {
      const dayNumber = day.day;
      
      // Generate comprehensive search queries for each day
      const searchQueries = generateComprehensiveSearchQueries(planStructure, day);
      
      console.log(`Day ${dayNumber}: Searching with ${searchQueries.length} targeted queries`);
      
      // Fetch from all sources with different query strategies
      const sources = ['wikipedia', 'youtube', 'reddit', 'medium'];
      
      for (const source of sources) {
        try {
          console.log(`Fetching ${source} resources for day ${dayNumber}`);
          
          // Use different query strategies for each source
          const sourceQueries = optimizeQueriesForSource(source, searchQueries, planStructure.topic);
          let allResources = [];
          
          for (const query of sourceQueries) {
            try {
              const resources = await fetchResourcesFromSource(source, query);
              if (resources && resources.length > 0) {
                // Filter out fallback results early
                const validResources = resources.filter(r => 
                  !r.metadata?.fallback && 
                  r.title !== 'Sorry peeps nothing to see here' &&
                  r.url && r.url.trim() !== ''
                );
                allResources = allResources.concat(validResources);
              }
              
              
              
            } catch (queryError) {
              console.error(`Error with query "${query}" for ${source}:`, queryError);
              continue;
            }
          }
          
          // Remove duplicates and limit results
          const uniqueResources = allResources.filter((resource, index, self) => 
            index === self.findIndex((r) => r.url === resource.url)
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

// Function to call Python scripts for resource fetching
async function fetchResourcesFromSource(source: string, query: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // Try simple scripts first, fallback to full scripts if needed
    const scriptPath = path.join(__dirname, '../server/utils', `fetch_${source}_simple.py`);
    
    // Set up environment with Python path to access installed packages
    const env = {
      ...process.env,
      PYTHONPATH: process.env.HOME + '/.pythonlibs/lib/python3.11/site-packages'
    };
    
    const python = spawn('python3', [scriptPath, query], { 
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0 && output.trim()) {
        try {
          const result = JSON.parse(output);
          // Filter out error results and fallbacks
          const validResults = result.filter(r => 
            r && r.title && r.title !== 'Module Import Error' && 
            r.title !== 'Sorry peeps nothing to see here'
          );
          resolve(validResults.length > 0 ? validResults : generateFallbackResults(source, query));
        } catch (error) {
          console.error(`Error parsing ${source} results:`, error, 'Output:', output);
          resolve(generateFallbackResults(source, query));
        }
      } else {
        if (errorOutput.trim()) {
          console.error(`${source} script error (code ${code}):`, errorOutput);
        }
        resolve(generateFallbackResults(source, query));
      }
    });
    
    python.on('error', (error) => {
      console.error(`Failed to start ${source} script:`, error);
      resolve(generateFallbackResults(source, query));
    });
    
    // Set timeout
    setTimeout(() => {
      python.kill();
      resolve(generateFallbackResults(source, query));
    }, 15000); // 15 second timeout
  });
}

// Generate fallback results when scripts fail
function generateFallbackResults(source: string, query: string): any[] {
  const fallbackContent = {
    wikipedia: {
      title: `${query} - Wikipedia Overview`,
      url: `https://en.wikipedia.org/wiki/Special:Search/${encodeURIComponent(query)}`,
      snippet: `Search Wikipedia for comprehensive information about ${query}. Click to explore detailed articles and references.`
    },
    youtube: {
      title: `${query} - Educational Videos`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' tutorial')}`,
      snippet: `Find video tutorials and educational content about ${query}. Learn through visual explanations and practical demonstrations.`
    },
    reddit: {
      title: `${query} - Community Discussions`,
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
      snippet: `Join community discussions about ${query}. Get insights, ask questions, and learn from experienced practitioners.`
    },
    medium: {
      title: `${query} - Technical Articles`,
      url: `https://medium.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Read in-depth technical articles about ${query}. Explore expert insights and practical implementation guides.`
    }
  };

  const content = fallbackContent[source as keyof typeof fallbackContent];
  
  return [{
    title: content.title,
    url: content.url,
    snippet: content.snippet,
    source: source,
    metadata: {
      source: source,
      type: 'fallback_search',
      note: 'Direct search link - click to find relevant content'
    }
  }];
}
