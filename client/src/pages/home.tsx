import { useState } from "react";
import SearchBar from "@/components/search-bar";
import SearchSidebar from "@/components/search-sidebar";
import LearningPlan from "@/components/learning-plan";
import MatrixBackground from "@/components/matrix-background";
import { useQuery } from "@tanstack/react-query";
import { LearningPlan as LearningPlanType, SearchHistory } from "@shared/schema";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<LearningPlanType | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchHistory = [] } = useQuery<SearchHistory[]>({
    queryKey: ['/api/search/history'],
    refetchOnMount: false,
  });

  const { data: activePlans = [] } = useQuery<LearningPlanType[]>({
    queryKey: ['/api/plans/active'],
    refetchOnMount: false,
  });

  const handleSearch = (plan: LearningPlanType) => {
    setCurrentPlan(plan);
    setIsSearching(false);
  };

  const handleSearchStart = () => {
    setIsSearching(true);
    setCurrentPlan(null);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex min-h-screen">
      <MatrixBackground />
      
      <SearchSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        searchHistory={searchHistory}
        activePlans={activePlans}
        onSelectPlan={setCurrentPlan}
      />

      <div 
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'ml-80' : 'ml-0'
        }`}
        data-testid="main-content"
      >
        {/* Header */}
        <header className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={toggleSidebar}
              className="text-primary hover:glow p-2"
              data-testid="button-toggle-sidebar"
            >
              <span className="text-xl">☰</span>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold glow-text glitch">RABBITHOLE_TERMINAL</h1>
              <div className="text-xs text-muted-foreground">// PERSONALIZED_LEARNING_SYSTEM v2.1.0</div>
            </div>
            <div className="text-xs text-accent">
              <div>STATUS: ONLINE</div>
              <div className="text-primary">USER: ANONYMOUS</div>
            </div>
          </div>
        </header>

        {/* ASCII Art Banner */}
        <div className="p-4 text-center text-xs text-primary overflow-hidden">
          <pre className="glow-text">
{`██████╗  █████╗ ██████╗ ██████╗ ██╗████████╗██╗  ██╗ ██████╗ ██╗     ███████╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██║  ██║██╔═══██╗██║     ██╔════╝
██████╔╝███████║██████╔╝██████╔╝██║   ██║   ███████║██║   ██║██║     █████╗  
██╔══██╗██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══██║██║   ██║██║     ██╔══╝  
██║  ██║██║  ██║██████╔╝██████╔╝██║   ██║   ██║  ██║╚██████╔╝███████╗███████╗
╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝`}
          </pre>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6">
          <SearchBar onSearch={handleSearch} onSearchStart={handleSearchStart} />
          
          {isSearching && (
            <div className="text-center py-8" data-testid="loading-state">
              <div className="text-primary text-lg mb-4 glow-text">
                <span className="inline-block animate-pulse">[</span>
                <span className="animate-pulse" style={{animationDelay: '0.1s'}}>■</span>
                <span className="animate-pulse" style={{animationDelay: '0.2s'}}>■</span>
                <span className="animate-pulse" style={{animationDelay: '0.3s'}}>■</span>
                <span className="inline-block animate-pulse">] GENERATING_LEARNING_MATRIX...</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="typewriter">{'>>> Analyzing topic complexity...'}</div>
                <div className="typewriter" style={{animationDelay: '1s'}}>{'>>> Generating subtopic hierarchy...'}</div>
                <div className="typewriter" style={{animationDelay: '2s'}}>{'>>> Distributing over timeline...'}</div>
                <div className="typewriter" style={{animationDelay: '3s'}}>{'>>> Fetching resources from knowledge base...'}</div>
              </div>
            </div>
          )}

          {currentPlan && !isSearching && (
            <LearningPlan plan={currentPlan} />
          )}
        </div>
      </div>
    </div>
  );
}
