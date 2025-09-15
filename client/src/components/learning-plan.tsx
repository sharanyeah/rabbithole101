import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LearningPlan as LearningPlanType, ResourceGroup } from "@shared/schema";

interface LearningPlanProps {
  plan: LearningPlanType;
}

export default function LearningPlan({ plan }: LearningPlanProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [checkedTopics, setCheckedTopics] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const planData = plan.plan as any;
  const progress = plan.progress as any || {};

  const toggleDay = (dayNumber: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayNumber)) {
      newExpanded.delete(dayNumber);
    } else {
      newExpanded.add(dayNumber);
    }
    setExpandedDays(newExpanded);
  };

  const { data: resourcesData } = useQuery({
    queryKey: ['/api/resources', plan.id],
    enabled: !!plan.id,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { planId: string; day: number; completed: boolean }) => {
      await apiRequest("PUT", `/api/plans/${data.planId}/progress`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plans/active'] });
      toast({
        title: "Progress Updated",
        description: "Day marked as completed",
      });
    },
  });

  const toggleTopicCheck = (dayNumber: number, topicIndex: number) => {
    const key = `${dayNumber}-${topicIndex}`;
    setCheckedTopics(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getTopicProgress = (dayNumber: number, totalTopics: number) => {
    if (!totalTopics || totalTopics === 0) return 0;
    let checkedCount = 0;
    for (let i = 0; i < totalTopics; i++) {
      const key = `${dayNumber}-${i}`;
      if (checkedTopics[key]) checkedCount++;
    }
    return Math.round((checkedCount / totalTopics) * 100);
  };

  const calculateProgress = () => {
    const totalDays = plan.duration;
    const completedDays = Object.keys(progress).filter(day => progress[day]?.completed).length;
    return Math.round((completedDays / totalDays) * 100);
  };

  const getCurrentDay = () => {
    const completedDays = Object.keys(progress).filter(day => progress[day]?.completed).length;
    return completedDays + 1;
  };

  const isCompleted = (dayNumber: number) => {
    return progress[dayNumber]?.completed || false;
  };

  const isLocked = (dayNumber: number) => {
    // Never lock any day - all days are accessible
    return false;
  };

  const getPhase = (dayNumber: number) => {
    if (!planData.phases) return 'beginner';
    if (dayNumber <= planData.phases.beginner.end) return 'beginner';
    if (dayNumber <= planData.phases.intermediate.end) return 'intermediate';
    return 'advanced';
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'beginner': return 'BEGINNER_PHASE';
      case 'intermediate': return 'INTERMEDIATE_PHASE';
      case 'advanced': return 'ADVANCED_PHASE';
      default: return 'UNKNOWN_PHASE';
    }
  };

  const ResourceSection = ({ day, source, resources }: { day: number; source: string; resources: any[] }) => {
    const sourceIcons: Record<string, string> = {
      wikipedia: '📖',
      youtube: '🎥',
      reddit: '💬',
      medium: '📝',
    };

    const sourceLabels: Record<string, string> = {
      wikipedia: 'WIKIPEDIA_RESOURCES',
      youtube: 'YOUTUBE_RESOURCES',
      reddit: 'REDDIT_DISCUSSIONS',
      medium: 'MEDIUM_RESOURCES',
    };

    // Check if this is a fallback message
    const isFallback = resources && resources.length === 1 && 
      resources[0].title === 'Sorry peeps nothing to see here';

    if (!resources || resources.length === 0) {
      return (
        <div className="border border-border rounded p-3 opacity-50">
          <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            {sourceIcons[source]} {sourceLabels[source]}
            <span className="text-xs text-muted-foreground">(Loading...)</span>
          </h5>
          <div className="text-xs text-muted-foreground">
            Fetching resources from {source}...
          </div>
        </div>
      );
    }

    if (isFallback) {
      return (
        <div className="border border-border rounded p-3 bg-destructive/10">
          <h5 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
            {sourceIcons[source]} {sourceLabels[source]}
            <span className="text-xs text-muted-foreground">(No Results)</span>
          </h5>
          <div className="text-xs text-destructive">
            Sorry peeps nothing to see here
          </div>
        </div>
      );
    }

    return (
      <div className="border border-border rounded p-3 bg-card">
        <h5 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
          {sourceIcons[source]} {sourceLabels[source]}
          <span className="text-xs text-accent">({resources.length} results)</span>
        </h5>
        <div className="space-y-2 text-xs">
          {resources.slice(0, 3).map((resource, index) => (
            <div
              key={index}
              className={`bg-muted p-2 rounded transition-colors border-l-2 border-l-primary ${
                resource.url ? 'hover:bg-primary hover:text-black cursor-pointer' : 'opacity-50'
              }`}
              onClick={() => resource.url && window.open(resource.url, '_blank')}
              data-testid={`resource-${source}-${index}`}
            >
              <div className="font-semibold text-primary hover:text-black">{resource.title}</div>
              <div className="text-muted-foreground mt-1 hover:text-black">{resource.description}</div>
              {resource.url && (
                <div className="text-xs text-accent mt-1 hover:text-black">
                  Click to open → {source.charAt(0).toUpperCase() + source.slice(1)}
                </div>
              )}
            </div>
          ))}
          {resources.length > 3 && (
            <button 
              className="text-primary hover:text-accent text-xs mt-2 underline"
              data-testid={`button-show-more-${source}`}
            >
              ↳ SHOW_ALL_RESOURCES ({resources.length - 3} more)
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!planData || !planData.days) {
    return (
      <div className="text-center py-8">
        <div className="text-destructive">Error loading learning plan</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="learning-plan">
      {/* Plan Header */}
      <div className="border border-border rounded p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary glow-text">
            LEARNING_PLAN: {plan.topic.replace(/\s+/g, '_')}
          </h2>
          <div className="text-sm text-muted-foreground">DURATION: {plan.duration} DAYS</div>
        </div>

        {planData.phases && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
            <div className="bg-muted p-3 rounded">
              <div className="text-accent font-semibold">BEGINNER_PHASE</div>
              <div className="text-muted-foreground">
                Days {planData.phases.beginner.start}-{planData.phases.beginner.end}
              </div>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="text-accent font-semibold">INTERMEDIATE_PHASE</div>
              <div className="text-muted-foreground">
                Days {planData.phases.intermediate.start}-{planData.phases.intermediate.end}
              </div>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="text-accent font-semibold">ADVANCED_PHASE</div>
              <div className="text-muted-foreground">
                Days {planData.phases.advanced.start}-{planData.phases.advanced.end}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>PROGRESS</span>
            <span>{getCurrentDay() - 1}/{plan.duration} DAYS COMPLETED</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="progress-bar h-3 rounded-full transition-all" 
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="space-y-4">
        {planData.days.map((day: any, index: number) => {
          const dayNumber = index + 1;
          const completed = isCompleted(dayNumber);
          const locked = isLocked(dayNumber);
          const current = dayNumber === getCurrentDay();
          const phase = getPhase(dayNumber);
          const resources = (resourcesData as any)?.[dayNumber] || {};

          return (
            <div
              key={dayNumber}
              className={`border rounded bg-card overflow-hidden ${
                current ? 'border-primary glow' : 'border-border'
              } ${locked ? 'opacity-50' : ''}`}
              data-testid={`day-${dayNumber}`}
            >
              <button
                onClick={() => !locked && toggleDay(dayNumber)}
                disabled={locked}
                className={`w-full p-4 text-left flex items-center justify-between transition-colors ${
                  current 
                    ? 'bg-accent text-background hover:bg-primary' 
                    : 'bg-muted hover:bg-accent hover:text-background'
                } ${locked ? 'cursor-not-allowed' : ''}`}
                data-testid={`button-toggle-day-${dayNumber}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${current ? '' : 'text-primary'}`}>
                    DAY_{dayNumber.toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm">{day.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    completed 
                      ? 'bg-primary text-background' 
                      : current 
                        ? 'bg-primary text-background' 
                        : locked 
                          ? 'bg-muted-foreground text-background' 
                          : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {completed ? 'COMPLETED' : current ? 'ACTIVE' : locked ? 'LOCKED' : 'PENDING'}
                  </span>
                </div>
                <span className={current ? '' : 'text-primary'}>
                  {locked ? '🔒' : expandedDays.has(dayNumber) ? '▲' : '▼'}
                </span>
              </button>

              {expandedDays.has(dayNumber) && (
                <div className="p-4 border-t border-border" data-testid={`day-${dayNumber}-content`}>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-accent mb-2">
                      MICRO_TOPICS: [{getPhaseLabel(phase)}]
                      {day.microTopics && day.microTopics.length > 0 && (
                        <span className="ml-2 text-xs text-primary">
                          {getTopicProgress(dayNumber, day.microTopics.length)}% Complete
                        </span>
                      )}
                    </h4>
                    <div className="space-y-2">
                      {day.microTopics && day.microTopics.length > 0 ? day.microTopics.map((topic: string, topicIndex: number) => {
                        const key = `${dayNumber}-${topicIndex}`;
                        const isChecked = checkedTopics[key] || false;
                        return (
                          <div 
                            key={topicIndex} 
                            className="flex items-center gap-2 text-xs hover:bg-muted p-2 rounded cursor-pointer transition-colors"
                            onClick={() => toggleTopicCheck(dayNumber, topicIndex)}
                            data-testid={`topic-${dayNumber}-${topicIndex}`}
                          >
                            <div className={`w-4 h-4 border border-primary rounded flex items-center justify-center ${
                              isChecked ? 'bg-primary text-black' : 'bg-transparent'
                            }`}>
                              {isChecked && <span className="text-xs">✓</span>}
                            </div>
                            <span className={`${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {topic}
                            </span>
                          </div>
                        );
                      }) : (
                        <div className="text-xs text-muted-foreground p-2">
                          No specific topics defined for this day
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resources Section */}
                  <div className="space-y-4">
                    <ResourceSection day={dayNumber} source="wikipedia" resources={resources.wikipedia || []} />
                    <ResourceSection day={dayNumber} source="youtube" resources={resources.youtube || []} />
                    <ResourceSection day={dayNumber} source="medium" resources={resources.medium || []} />
                    <ResourceSection day={dayNumber} source="reddit" resources={resources.reddit || []} />
                  </div>

                  {current && !completed && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => updateProgressMutation.mutate({
                          planId: plan.id,
                          day: dayNumber,
                          completed: true
                        })}
                        disabled={updateProgressMutation.isPending}
                        className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-accent transition-colors"
                        data-testid={`button-complete-day-${dayNumber}`}
                      >
                        {updateProgressMutation.isPending ? 'PROCESSING...' : 'MARK_AS_COMPLETED'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}