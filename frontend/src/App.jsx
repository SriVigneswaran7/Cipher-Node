import React, { useState, useEffect } from 'react';
import { Shield, Activity, Lock, Terminal, Bell, Settings } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [currentAttempt, setCurrentAttempt] = useState("");
  const [status, setStatus] = useState("LOCKED");
  const [connected, setConnected] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [threats, setThreats] = useState(0);

  // Fetch Database Analytics
  const fetchAnalytics = async () => {
    try {
      const res = await fetch('http://localhost:8000/analytics');
      const data = await res.json();
      setChartData(data.recent_attempts || []);
      
      // Calculate threats (failed attempts)
      const deniedCount = data.recent_attempts.filter(a => a.status === 'DENIED').length;
      setThreats(deniedCount);
    } catch (err) {
      console.error("Failed to fetch analytics. Is the backend running?");
    }
  };

  useEffect(() => {
    fetchAnalytics(); // Initial load
    const interval = setInterval(fetchAnalytics, 5000); // Poll DB just in case

    // Connect to FastAPI "Brain"
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "LIVE_PREVIEW") {
        setCurrentAttempt(data.current);
      } else if (data.type === "AUTH_RESULT") {
        setStatus(data.status === "SUCCESS" ? "UNLOCKED" : "LOCKED");
        fetchAnalytics(); // Instantly update chart
        
        // Auto-revert UI after hardware locks
        setTimeout(() => {
          setCurrentAttempt("");
          setStatus("LOCKED");
        }, 5000);
      }
    };

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-slate-800/50 bg-slate-900/20 flex flex-col p-6 z-20">
        <div className="flex items-center gap-3 mb-10 text-indigo-500 font-bold text-xl">
          <Shield size={32} />
          <span className="tracking-tighter">CIPHER_NODE</span>
        </div>
        <nav className="space-y-4 flex-1">
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)] cursor-default">
            <Activity size={20}/> <span className="font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            <Lock size={20}/> <span className="font-medium">Data Security</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            <Terminal size={20}/> <span className="font-medium">Live Logs</span>
          </div>
        </nav>
        <div className="p-4 glass rounded-2xl bg-gradient-to-br from-indigo-600/10 to-fuchsia-600/10 border border-indigo-500/20">
            <p className="text-xs font-semibold mb-2 text-indigo-300">PRO STATUS</p>
            <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 text-white">Upgrade Now</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Background Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Header */}
        <header className="flex justify-between items-center mb-10 relative z-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Security Command</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Monitoring Edge Node:</span>
              {connected ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div> ONLINE</span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400 font-medium"><div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]"></div> OFFLINE</span>
              )}
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="p-3 glass rounded-xl cursor-pointer hover:bg-white/5 transition-colors"><Bell size={20} className="text-slate-300"/></div>
            <div className="flex items-center gap-3 glass p-2 px-4 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-200">VIGNESWARAN</p>
                <p className="text-[10px] text-slate-400">Admin Account</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center font-bold text-white shadow-lg">V</div>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8 relative z-10">
          <div className="glass p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-500 blur-3xl opacity-20"></div>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">Live Input <Activity size={12}/></p>
            <h2 className="text-4xl font-mono font-bold mb-1 tracking-widest text-white h-10">{currentAttempt || "---"}</h2>
            <p className="text-[10px] text-slate-400 font-medium">{currentAttempt ? "Sequencing..." : "Awaiting input"}</p>
          </div>

          <div className={`glass p-6 rounded-3xl relative overflow-hidden transition-all duration-500 ${status === "UNLOCKED" ? "border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : ""}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 ${status === "UNLOCKED" ? "bg-emerald-500" : "bg-gradient-to-br from-fuchsia-500 to-rose-500"}`}></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Status</p>
            <h2 className={`text-3xl font-bold mb-1 tracking-tighter ${status === "UNLOCKED" ? "text-emerald-400" : "text-rose-400"}`}>{status}</h2>
            <p className="text-[10px] text-slate-400 font-medium">Hardware Relay</p>
          </div>

          <div className="glass p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 blur-3xl opacity-10"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Uptime</p>
            <h2 className="text-3xl font-bold mb-1 tracking-tighter text-white">99.9%</h2>
            <p className="text-[10px] text-slate-400 font-medium">Network Stable</p>
          </div>

          <div className="glass p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-500 blur-3xl opacity-10"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Threats</p>
            <h2 className="text-3xl font-bold mb-1 tracking-tighter text-white">{threats.toString().padStart(2, '0')}</h2>
            <p className="text-[10px] text-slate-400 font-medium">Failed Attempts</p>
          </div>
        </div>

        {/* Bottom Section: Chart + Info */}
        <div className="grid grid-cols-3 gap-6 relative z-10">
          
          <div className="col-span-2 glass p-6 rounded-3xl min-h-[350px] flex flex-col border border-white/5">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-white">Traffic Analysis</h3>
                <span className="text-xs font-medium px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/20">Last 7 Attempts</span>
            </div>
            <div className="flex-1 w-full relative">
              {chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-sm">Awaiting database entries...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)'}} 
                      itemStyle={{color: '#fff'}}
                      labelStyle={{color: '#94a3b8'}}
                    />
                    <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    {/* Visual trick: map string to numbers to draw a wave. Pass=2, Fail=1 */}
                    <Area 
                        type="monotone" 
                        dataKey={(d) => d.status === "SUCCESS" ? 2 : 1} 
                        name="Outcome (Pass=2, Fail=1)"
                        stroke="#8b5cf6" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorVal)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <Settings size={20} className="text-indigo-400"/>
                <h3 className="font-bold text-lg text-white">Node Settings</h3>
            </div>
            <div className="space-y-5 text-sm flex-1">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                    <span className="text-slate-400">Watchdog Timer</span>
                    <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs">ACTIVE</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                    <span className="text-slate-400">Auto-Lock</span>
                    <span className="font-mono text-indigo-300">5000ms</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                    <span className="text-slate-400">Baud Rate</span>
                    <span className="font-mono text-slate-300">9600</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                    <span className="text-slate-400">Protocol</span>
                    <span className="font-mono text-slate-300">JSON/Serial</span>
                </div>
            </div>
            
            <div className="mt-6 p-4 bg-[#020617]/80 rounded-xl border border-slate-800/50 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Live Socket Status</p>
                <code className={`text-xs ${connected ? 'text-indigo-300' : 'text-rose-400'}`}>
                    {connected ? '> ws://localhost:8000/ws [OK]' : '> Socket disconnected...'}
                </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}