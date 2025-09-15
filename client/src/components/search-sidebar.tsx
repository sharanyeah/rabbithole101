import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SearchHistory, LearningPlan } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface SearchSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  searchHistory: SearchHistory[];
  activePlans: LearningPlan[];
  onSelectPlan: (plan: LearningPlan) => void;
}

export default function SearchSidebar({
  isOpen,
  onToggle,
  searchHistory,
  activePlans,
  onSelectPlan,
}: SearchSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/search/history", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/history'] });
      toast({
        title: "History Cleared",
        description: "Search history has been cleared successfully",
      });
    },
  });

  const calculateProgress = (plan: LearningPlan) => {
    const progress = plan.progress as any || {};
    const totalDays = plan.duration;
    const completedDays = Object.keys(progress).filter(day => progress[day]?.completed).length;
    return Math.round((completedDays / totalDays) * 100);
  };

  const getCurrentDay = (plan: LearningPlan) => {
    const progress = plan.progress as any || {};
    const completedDays = Object.keys(progress).filter(day => progress[day]?.completed).length;
    return completedDays + 1;
  };

  const getPlanData = (plan: LearningPlan) => {
    return plan.plan as any;
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full w-80 bg-card border-r border-border transform transition-transform duration-300 z-50 overflow-y-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      data-testid="sidebar"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold glow-text">// DASHBOARD</h2>
          <button
            onClick={onToggle}
            className="text-primary hover:glow p-1"
            data-testid="button-close-sidebar"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
      </div>

      {/* Search History Section */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold mb-3 text-accent">SEARCH_HISTORY.log</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {searchHistory.length === 0 ? (
            <div className="text-xs text-muted-foreground">No search history</div>
          ) : (
            searchHistory.map((search) => (
              <div
                key={search.id}
                className="text-xs bg-muted p-2 rounded cursor-pointer hover:bg-accent hover:text-background transition-colors"
                data-testid={`history-item-${search.id}`}
              >
                <div className="text-primary">{`> ${search.query}`}</div>
                <div className="text-muted-foreground">
                  {formatDistanceToNow(new Date(search.timestamp), { addSuffix: true })}
                </div>
              </div>
            ))
          )}
        </div>
        {searchHistory.length > 0 && (
          <button
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
            className="text-xs text-muted-foreground hover:text-destructive mt-2"
            data-testid="button-clear-history"
          >
            {clearHistoryMutation.isPending ? "CLEARING..." : "CLEAR_ALL"}
          </button>
        )}
      </div>

      {/* Learning Plans Dashboard */}
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-3 text-accent">ACTIVE_PLANS.json</h3>
        <div className="space-y-4">
          {activePlans.length === 0 ? (
            <div className="text-xs text-muted-foreground">No active learning plans</div>
          ) : (
            activePlans.map((plan) => {
              const planData = getPlanData(plan);
              const progress = calculateProgress(plan);
              const currentDay = getCurrentDay(plan);
              const todayPlan = planData?.days?.[currentDay - 1];

              return (
                <div
                  key={plan.id}
                  className="border border-border rounded p-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => onSelectPlan(plan)}
                  data-testid={`plan-item-${plan.id}`}
                >
                  <div className="text-sm font-semibold text-primary mb-2">
                    {plan.topic}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Day {currentDay} of {plan.duration}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div
                      className="progress-bar h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {todayPlan && (
                    <div className="text-xs text-accent">Today: {todayPlan.title}</div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlan(plan);
                    }}
                    className="text-xs text-primary hover:glow mt-1"
                    data-testid={`button-view-plan-${plan.id}`}
                  >
                    VIEW_PLAN
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
