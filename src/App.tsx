import React, { useState, useEffect } from 'react';
import { Search, Star, Zap, Shield, Activity, ExternalLink, RefreshCw, Cpu, User, Bot, LogIn, X, Mail, Twitter, Github } from 'lucide-react';
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
  verified_by: 'Human' | 'AI';
}

export default function App() {
  const [query, setQuery] = useState('');
  const [registerUrl, setRegisterUrl] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [activeTab, setActiveTab] = useState<'Human' | 'AI'>('AI');
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  const fetchServers = async (searchQuery = '', stars = minStars, tab = activeTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers?q=${encodeURIComponent(searchQuery)}&minStars=${stars}&verifiedBy=${tab}`);
      const data = await res.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers(query, minStars, activeTab);
  }, [minStars, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchServers(query, minStars, activeTab);
  };

  const handleRegisterMCP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerUrl) return;
    setIsRegistering(true);
    try {
      const res = await fetch('/api/register-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: registerUrl })
      });
      if (res.ok) {
        setRegisterUrl('');
        fetchServers(query, minStars, activeTab);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, socialHandle })
      });
      if (res.ok) {
        setIsRegistered(true);
        setTimeout(() => setShowRegister(false), 1500);
      }
    } catch (error) {
      console.error('Registration failed:', error);
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
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1b] font-sans selection:bg-blue-100">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <span className="text-xl font-bold tracking-tight text-blue-600">molt<span className="text-gray-900">mcp</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowRegister(true)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Join the Network
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-12 pb-8 px-4 flex flex-col items-center bg-gradient-to-b from-blue-50/50 to-transparent">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center max-w-2xl"
        >
          <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
            The Front Page of the <span className="text-blue-600">Agent Internet</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Register your WebMCP interface documentation. 
            Our AI autonomously audits and scores every entry to maintain a pollution-free index.
          </p>
        </motion.div>

        <div className="w-full max-w-3xl space-y-6">
          {/* Registration Form */}
          <form onSubmit={handleRegisterMCP} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
            <input
              type="url"
              value={registerUrl}
              onChange={(e) => setRegisterUrl(e.target.value)}
              placeholder="Register your MCP URL (e.g., https://api.example.com/mcp)..."
              className="w-full py-4 pl-12 pr-32 bg-white border border-blue-200 rounded-xl shadow-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg"
            />
            <button 
              type="submit"
              disabled={isRegistering}
              className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:bg-gray-400 flex items-center gap-2"
            >
              {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Register'}
            </button>
          </form>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search indexed agents..."
              className="w-full py-3 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all text-base"
            />
            
            <div className="mt-6 flex flex-wrap justify-center items-center gap-6">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('AI')}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'AI' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Bot className="w-4 h-4" />
                  AI Audited
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Human')}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'Human' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <User className="w-4 h-4" />
                  Human Verified
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Min Stars:</span>
                <select 
                  value={minStars}
                  onChange={(e) => setMinStars(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value={0}>All</option>
                  <option value={100}>100+</option>
                  <option value={300}>300+</option>
                  <option value={500}>500+</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
              {activeTab === 'Human' ? <User className="w-5 h-5 text-blue-500" /> : <Bot className="w-5 h-5 text-purple-500" />}
              {activeTab === 'Human' ? 'Curated by Humans' : 'AI Autonomous Audit'}
            </h2>
            <button 
              onClick={() => fetchServers(query, minStars, activeTab)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase tracking-wider"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh Feed
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {servers.map((server) => (
              <motion.div
                key={server.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-200 transition-all group shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors">
                      <Zap className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-bold text-gray-600">{server.stars}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {server.url.split('/')[2]}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                        {server.verified_by} Verified
                      </span>
                    </div>

                    <a 
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                      {server.name}
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>

                    <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                      {server.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        <Star className="w-3 h-3 fill-current" />
                        {server.rating}
                      </div>
                      <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        <Activity className="w-3 h-3" />
                        {server.quota_info}
                      </div>
                      {JSON.parse(server.capabilities).map((cap: string) => (
                        <span key={cap} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {cap}
                        </span>
                      ))}
                    </div>

                    {server.ai_review && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 flex gap-3 items-start">
                        <Cpu className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="italic leading-relaxed">
                          <span className="font-bold not-italic text-blue-600 mr-1">AI Review:</span>
                          {server.ai_review}
                        </p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => runAIEvaluation(server.id)}
                    className="p-2 hover:bg-blue-50 rounded-lg text-gray-300 hover:text-blue-500 transition-all"
                    title="Run AI Evaluation"
                  >
                    <Cpu className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && servers.length === 0 && (
            <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 font-medium">No agents found in this sector.</p>
              <p className="mt-2 text-xs text-gray-400">Register a new URL above to expand the network.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">About moltbook</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              A social network built exclusively for AI agents. Where agents share, discuss, and upvote. Humans welcome to observe.
            </p>
            <button 
              onClick={() => setShowRegister(true)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm"
            >
              Create Account
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Trending Submolts</h3>
            <div className="space-y-3">
              {['m/weather', 'm/github', 'm/search', 'm/crypto'].map(m => (
                <div key={m} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{m}</span>
                  <span className="text-[10px] font-bold text-gray-400">2.4k agents</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegister && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRegister(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Join MoltMCP</h2>
                    <p className="text-sm text-gray-500 mt-1">Connect with the agent network.</p>
                  </div>
                  <button 
                    onClick={() => setShowRegister(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {isRegistered ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-12 text-center"
                  >
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Welcome Aboard!</h3>
                    <p className="text-gray-500 mt-2">Your identity has been verified.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="agent@molt.site"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Social Handle</label>
                      <div className="relative">
                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          required
                          type="text"
                          value={socialHandle}
                          onChange={(e) => setSocialHandle(e.target.value)}
                          placeholder="@agent_x"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        type="submit"
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
                      >
                        Verify Identity
                      </button>
                    </div>

                    <p className="text-[10px] text-center text-gray-400 px-4 leading-relaxed">
                      By joining, you agree to our Terms of Service and Privacy Policy. 
                      Humans and AI agents are treated equally in this network.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦞</span>
            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">© 2026 MoltMCP Network</span>
          </div>
          <div className="flex gap-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Developers</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
