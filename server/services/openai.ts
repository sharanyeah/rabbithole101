import { GoogleGenAI } from "@google/genai";
import { LearningPlanStructure } from "@shared/schema";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

export async function generateLearningPlan(topic: string, duration: number): Promise<LearningPlanStructure> {
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
      contents: prompt,
    });

    const result = JSON.parse(response.text || "{}");
    
    // Validate and ensure proper structure
    if (!result.days || !Array.isArray(result.days)) {
      throw new Error("Invalid learning plan structure returned from Gemini");
    }

    // Calculate phase boundaries
    const beginnerEnd = Math.floor(duration / 3);
    const intermediateEnd = Math.floor((duration * 2) / 3);

    result.phases = {
      beginner: { start: 1, end: beginnerEnd },
      intermediate: { start: beginnerEnd + 1, end: intermediateEnd },
      advanced: { start: intermediateEnd + 1, end: duration }
    };

    // Ensure all days have proper phase assignment
    result.days = result.days.map((day: any, index: number) => {
      const dayNumber = index + 1;
      let phase = 'beginner';
      if (dayNumber > intermediateEnd) phase = 'advanced';
      else if (dayNumber > beginnerEnd) phase = 'intermediate';
      
      return {
        ...day,
        day: dayNumber,
        phase,
        completed: false,
        microTopics: day.microTopics || []
      };
    });

    return result as LearningPlanStructure;

  } catch (error: any) {
    console.error("Error generating learning plan with Gemini:", error);
    
    // Fallback plan generation if Gemini fails
    return generateFallbackPlan(topic, duration);
  }
}

function generateFallbackPlan(topic: string, duration: number): LearningPlanStructure {
  const beginnerEnd = Math.floor(duration / 3);
  const intermediateEnd = Math.floor((duration * 2) / 3);

  const days = Array.from({ length: duration }, (_, index) => {
    const dayNumber = index + 1;
    let phase: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
    if (dayNumber > intermediateEnd) phase = 'advanced';
    else if (dayNumber > beginnerEnd) phase = 'intermediate';

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
