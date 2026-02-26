import React, { useState, useEffect } from 'react';
import { Search, Star, Zap, Shield, Activity, ExternalLink, RefreshCw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MCPServer {
  id: number;
  url: string;
  name: string;
  description: string;
  capabilities: string;
  quota_info: string;
  rating: number;
  stars: number;
  last_checked: string;
  ai_review?: string;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);

  const fetchServers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchServers(query);
  };

  const triggerCrawl = async () => {
    setIsCrawling(true);
    try {
      await fetch('/api/crawl', { method: 'POST' });
      await fetchServers(query);
    } finally {
      setIsCrawling(false);
    }
  };

  const runAIEvaluation = async (serverId: number) => {
    try {
      await fetch('/api/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });
      fetchServers(query);
    } catch (error) {
      console.error('AI evaluation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] font-sans">
      {/* Header / Search Area */}
      <header className="pt-8 pb-4 px-4 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-5xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2">
            <span className="text-blue-500">M</span>
            <span className="text-red-500">o</span>
            <span className="text-yellow-500">l</span>
            <span className="text-blue-500">t</span>
            <span className="text-green-500">M</span>
            <span className="text-red-500">C</span>
            <span className="text-blue-500">P</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-widest">Autonomous WebMCP Indexer</p>
        </motion.div>

        <form onSubmit={handleSearch} className="w-full max-w-2xl relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search WebMCP interfaces, tools, or capabilities..."
            className="w-full py-3.5 pl-12 pr-4 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md focus:shadow-md focus:outline-none focus:border-transparent transition-all text-lg"
          />
          <div className="mt-6 flex justify-center gap-3">
            <button 
              type="submit"
              className="px-6 py-2 bg-[#f8f9fa] border border-transparent hover:border-gray-300 hover:shadow-sm rounded text-sm font-medium transition-all"
            >
              MCP Search
            </button>
            <button 
              type="button"
              onClick={triggerCrawl}
              disabled={isCrawling}
              className="px-6 py-2 bg-[#f8f9fa] border border-transparent hover:border-gray-300 hover:shadow-sm rounded text-sm font-medium transition-all flex items-center gap-2"
            >
              {isCrawling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-500" />}
              I'm Feeling Autonomous
            </button>
          </div>
        </form>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4 text-sm text-gray-500">
          {loading ? 'Searching...' : `About ${servers.length} results indexed autonomously`}
        </div>

        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {servers.map((server) => (
              <motion.div
                key={server.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1 truncate max-w-md">
                      {server.url}
                    </div>
                    <a 
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xl text-[#1a0dab] hover:underline decoration-1 flex items-center gap-2"
                    >
                      {server.name}
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <p className="mt-1 text-[#4d5156] text-sm leading-relaxed max-w-2xl">
                      {server.description}
                    </p>
                    
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                        <Star className="w-3 h-3 fill-current" />
                        {server.rating} Rating
                      </div>
                      <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <Activity className="w-3 h-3" />
                        {server.quota_info}
                      </div>
                      <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded">
                        <Shield className="w-3 h-3" />
                        Verified
                      </div>
                      <div className="text-gray-400">
                        Last checked: {new Date(server.last_checked).toLocaleDateString()}
                      </div>
                    </div>

                    {server.ai_review && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-3 bg-indigo-50/50 border-l-4 border-indigo-400 rounded-r text-sm italic text-indigo-900 flex gap-3"
                      >
                        <Cpu className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div>
                          <span className="font-bold not-italic text-xs uppercase tracking-tighter mr-2">AI Insight:</span>
                          {server.ai_review}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button 
                      onClick={() => runAIEvaluation(server.id)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-indigo-600"
                      title="Run AI Evaluation"
                    >
                      <Cpu className="w-5 h-5" />
                    </button>
                    <a 
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
                      title="Jump to Interface"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && servers.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500">No WebMCP interfaces found for "{query}"</p>
              <button 
                onClick={triggerCrawl}
                className="mt-4 text-blue-600 hover:underline font-medium"
              >
                Trigger autonomous discovery
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-auto py-6 border-t border-gray-200 bg-[#f2f2f2]">
        <div className="max-w-4xl mx-auto px-4 flex justify-between text-sm text-gray-600">
          <div className="flex gap-6">
            <a href="#" className="hover:underline">About MoltMCP</a>
            <a href="#" className="hover:underline">Autonomous Protocol</a>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <a href="#" className="hover:underline">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
