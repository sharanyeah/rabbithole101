import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LearningPlan } from "@shared/schema";

interface SearchBarProps {
  onSearch: (plan: LearningPlan) => void;
  onSearchStart: () => void;
}

export default function SearchBar({ onSearch, onSearchStart }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<number>(14);
  const [customDuration, setCustomDuration] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: async (data: { topic: string; duration: number }) => {
      const response = await apiRequest("POST", "/api/search/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      onSearch(data.plan);
      setQuery("");
      queryClient.invalidateQueries({ queryKey: ['/api/search/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/active'] });
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to generate learning plan",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const finalDuration = duration === 0 ? parseInt(customDuration) || 14 : duration;
    
    onSearchStart();
    searchMutation.mutate({ topic: query.trim(), duration: finalDuration });
  };

  const handleDurationSelect = (days: number) => {
    setDuration(days);
  };

  return (
    <div className="mb-8">
      <div className="text-sm text-accent mb-2">root@rabbithole:~$</div>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-input border border-border rounded glow">
          <span className="px-4 text-primary">{'>'}</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter learning topic (e.g., 'machine learning', 'react development')"
            className="flex-1 bg-transparent p-4 text-foreground placeholder-muted-foreground focus:outline-none terminal-input cursor"
            disabled={searchMutation.isPending}
            data-testid="input-search-query"
          />
          <button
            type="submit"
            disabled={searchMutation.isPending || !query.trim()}
            className="px-6 py-4 bg-primary text-primary-foreground hover:bg-accent transition-colors font-bold disabled:opacity-50"
            data-testid="button-execute-search"
          >
            {searchMutation.isPending ? "PROCESSING..." : "EXECUTE"}
          </button>
        </div>
      </form>

      {/* Duration Selector */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">DURATION:</span>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleDurationSelect(7)}
            className={`px-3 py-1 border border-border text-primary hover:bg-primary hover:text-black transition-colors ${
              duration === 7 ? 'bg-primary text-black' : ''
            }`}
            data-testid="button-duration-7"
          >
            7_DAYS
          </button>
          <button
            type="button"
            onClick={() => handleDurationSelect(14)}
            className={`px-3 py-1 border border-border text-primary hover:bg-primary hover:text-black transition-colors ${
              duration === 14 ? 'bg-primary text-black' : ''
            }`}
            data-testid="button-duration-14"
          >
            14_DAYS
          </button>
          <button
            type="button"
            onClick={() => handleDurationSelect(30)}
            className={`px-3 py-1 border border-border text-primary hover:bg-primary hover:text-black transition-colors ${
              duration === 30 ? 'bg-primary text-black' : ''
            }`}
            data-testid="button-duration-30"
          >
            30_DAYS
          </button>
          <button
            type="button"
            onClick={() => handleDurationSelect(0)}
            className={`px-3 py-1 border border-border text-primary hover:bg-primary hover:text-black transition-colors ${
              duration === 0 ? 'bg-primary text-black' : ''
            }`}
            data-testid="button-duration-custom"
          >
            CUSTOM
          </button>
          {duration === 0 && (
            <input
              type="number"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              placeholder="Days"
              className="px-3 py-1 bg-input border border-border text-primary w-20 terminal-input"
              min="1"
              max="365"
              data-testid="input-custom-duration"
            />
          )}
        </div>
      </div>
    </div>
  );
}
