import React, { useState, useEffect, useRef } from 'react';
import { Shield, Activity, Lock, Terminal, Settings, Save, AlertTriangle, ListFilter, Download, RefreshCcw } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [currentAttempt, setCurrentAttempt] = useState("");
  const [status, setStatus] = useState("LOCKED");
  const [connected, setConnected] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [recentLogsData, setRecentLogsData] = useState([]); 
  const [threats, setThreats] = useState(0);
  
  const [uptimeStr, setUptimeStr] = useState("00h 00m 00s");
  const [configParams, setConfigParams] = useState({ pin: "404", timeout: 5000 });
  const [lockoutTimer, setLockoutTimer] = useState(0);
  
  const [liveLogs, setLiveLogs] = useState([
    `[${new Date().toLocaleTimeString()}] SYSTEM: Initializing UI interface...`
  ]);

  const addLog = (message) => {
    setLiveLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`].slice(-100)); 
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('http://localhost:8000/analytics');
      const data = await res.json();
      setChartData(data.recent_attempts || []);
      setRecentLogsData(data.recent_logs || []); 
      setThreats(data.recent_attempts.filter(a => a.status === 'DENIED').length);
      setConfigParams(data.current_config);
      
      const hours = Math.floor(data.uptime_seconds / 3600);
      const minutes = Math.floor((data.uptime_seconds % 3600) / 60);
      const seconds = data.uptime_seconds % 60;
      setUptimeStr(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
    } catch (err) {}
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 1000);

    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
      setConnected(true);
      addLog("SYSTEM: Connected to Logic Brain.");
    };
    
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const rawData = event.data;
      addLog(`RECV: ${rawData}`);
      
      const data = JSON.parse(rawData);
      
      if (data.type === "LIVE_PREVIEW") {
        setCurrentAttempt(data.current);
      } else if (data.type === "AUTH_RESULT") {
        setStatus(data.status === "SUCCESS" ? "UNLOCKED" : "LOCKED");
        if (data.status === "SUCCESS") {
            addLog("SUCCESS: Node Unlocked.");
        }
        if (data.status === "LOCKED") setCurrentAttempt("");
        fetchAnalytics(); 
      } else if (data.type === "SYSTEM_LOCKOUT") {
        setStatus("LOCKED_OUT");
        setLockoutTimer(data.duration);
        setCurrentAttempt("BLK");
        addLog(`LOCKOUT: Threat detected. Node frozen for ${data.duration}s.`);
      }
    };

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setTimeout(() => setLockoutTimer(lockoutTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (status === "LOCKED_OUT" && lockoutTimer === 0) {
      setStatus("LOCKED");
      setCurrentAttempt("");
    }
  }, [lockoutTimer, status]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <aside className="w-64 border-r border-slate-800/50 bg-slate-900/20 flex flex-col p-6 z-20">
        <div className="flex items-center gap-3 mb-10 text-indigo-500 font-bold text-xl">
          <Shield size={32} />
          <span className="tracking-tighter">Cipher-Node</span>
        </div>
        <nav className="space-y-4 flex-1">
          <SidebarItem icon={<Activity size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Lock size={20}/>} label="Data Security" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
          <SidebarItem icon={<Terminal size={20}/>} label="Live Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <header className="flex justify-between items-center mb-10 relative z-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              {activeTab === 'dashboard' && 'Security Command'}
              {activeTab === 'security' && 'Node Configuration'}
              {activeTab === 'logs' && 'System Terminal'}
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Monitoring Edge Node:</span>
              {connected ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div> ONLINE</span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400 font-medium"><div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]"></div> OFFLINE</span>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 h-full">
          {activeTab === 'dashboard' && <DashboardView currentAttempt={currentAttempt} status={status} threats={threats} chartData={chartData} connected={connected} uptimeStr={uptimeStr} lockoutTimer={lockoutTimer} configParams={configParams} recentLogsData={recentLogsData} />}
          {activeTab === 'security' && <SecurityView configParams={configParams} fetchAnalytics={fetchAnalytics} addLog={addLog} />}
          {activeTab === 'logs' && <LogsView logs={liveLogs} />}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  if (active) {
    return <div onClick={onClick} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)] cursor-pointer">{icon} <span className="font-medium">{label}</span></div>;
  }
  return <div onClick={onClick} className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all cursor-pointer">{icon} <span className="font-medium">{label}</span></div>;
}

function DashboardView({ currentAttempt, status, threats, chartData, connected, uptimeStr, lockoutTimer, configParams, recentLogsData }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-6 mb-8">
          <div className={`glass p-6 rounded-3xl relative overflow-hidden group ${status === "LOCKED_OUT" ? "border-rose-500/50 bg-rose-500/10" : ""}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-500 blur-3xl opacity-20"></div>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">Live Input <Activity size={12}/></p>
            <h2 className={`text-4xl font-mono font-bold mb-1 tracking-widest h-10 ${status === "LOCKED_OUT" ? "text-rose-400" : "text-white"}`}>{status === "LOCKED_OUT" ? `WAIT ${lockoutTimer}s` : (currentAttempt || "---")}</h2>
            <p className="text-[10px] text-slate-400 font-medium">{status === "LOCKED_OUT" ? "Hardware frozen." : (currentAttempt ? "Sequencing..." : "Awaiting input")}</p>
          </div>

          <div className={`glass p-6 rounded-3xl relative overflow-hidden transition-all duration-500 ${status === "UNLOCKED" ? "border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : status === "LOCKED_OUT" ? "border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.2)] bg-rose-500/5" : ""}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 ${status === "UNLOCKED" ? "bg-emerald-500" : "bg-gradient-to-br from-fuchsia-500 to-rose-500"}`}></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Status</p>
            <h2 className={`text-3xl font-bold mb-1 tracking-tighter ${status === "UNLOCKED" ? "text-emerald-400" : "text-rose-400"}`}>{status.replace('_', ' ')}</h2>
            <p className="text-[10px] text-slate-400 font-medium">Hardware Relay</p>
          </div>

          <div className="glass p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 blur-3xl opacity-10"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Node Uptime</p>
            <h2 className="text-2xl font-bold mb-1 tracking-tight text-white font-mono">{uptimeStr}</h2>
            <p className="text-[10px] text-slate-400 font-medium">Session Active</p>
          </div>

          <div className="glass p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-500 blur-3xl opacity-10"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Threats</p>
            <h2 className="text-3xl font-bold mb-1 tracking-tighter text-white">{threats.toString().padStart(2, '0')}</h2>
            <p className="text-[10px] text-slate-400 font-medium">Failed Attempts</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
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
                    <Tooltip contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)'}} itemStyle={{color: '#fff'}} labelStyle={{color: '#94a3b8'}} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <Area type="monotone" dataKey={(d) => d.status === "SUCCESS" ? 2 : 1} name="Outcome (Pass=2, Fail=1)" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
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
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50"><span className="text-slate-400">Watchdog Timer</span><span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs">ACTIVE</span></div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50"><span className="text-slate-400">Auto-Lock</span><span className="font-mono text-indigo-300">{configParams.timeout}ms</span></div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50"><span className="text-slate-400">Baud Rate</span><span className="font-mono text-slate-300">9600</span></div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50"><span className="text-slate-400">Protocol</span><span className="font-mono text-slate-300">JSON/Serial</span></div>
            </div>
            <div className="mt-6 p-4 bg-[#020617]/80 rounded-xl border border-slate-800/50 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Live Socket Status</p>
                <code className={`text-xs ${connected ? 'text-indigo-300' : 'text-rose-400'}`}>{connected ? '> ws://localhost:8000/ws [OK]' : '> Socket disconnected...'}</code>
            </div>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-2 mb-4">
             <ListFilter size={20} className="text-indigo-400" />
             <h3 className="font-bold text-lg text-white">System Event Ledger</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-800/50">
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                   <tr>
                      <th className="px-5 py-4 font-bold">Time</th>
                      <th className="px-5 py-4 font-bold">Event Log</th>
                      <th className="px-5 py-4 font-bold">Details</th>
                   </tr>
                </thead>
                <tbody>
                   {recentLogsData.length === 0 ? (
                      <tr><td colSpan="3" className="px-5 py-6 text-center text-slate-500 italic">No events currently recorded in database.</td></tr>
                   ) : (
                      recentLogsData.map((log, i) => (
                         <tr key={i} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors bg-black/20">
                            <td className="px-5 py-3 text-slate-400 font-mono text-xs">{log.time}</td>
                            <td className="px-5 py-3 text-indigo-300 font-medium capitalize">{log.event.replace('_', ' ')}</td>
                            <td className="px-5 py-3 text-slate-300 font-mono text-xs">{log.details}</td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
        </div>
    </>
  )
}

function SecurityView({ configParams, fetchAnalytics, addLog }) {
  const [pin, setPin] = useState(configParams.pin);
  const [timeout, setTimeoutVal] = useState(configParams.timeout);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [wipeMessage, setWipeMessage] = useState("");

  const handleUpdate = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch("http://localhost:8000/update_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_pin: pin, timeout: parseInt(timeout) })
      });
      const data = await response.json();
      if (data.status === "success") {
        setMessage("✅ Configuration securely updated.");
        fetchAnalytics();
      } else {
        setMessage("❌ Failed to save configuration.");
      }
    } catch (err) { setMessage("❌ Communication error with the Brain."); }
    setIsSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleWipe = async () => {
    try {
      const res = await fetch("http://localhost:8000/wipe_logs", { method: "DELETE" });
      if (res.ok) {
        setWipeMessage("✅ Database purged.");
        fetchAnalytics();
        addLog("SYSTEM: Admin initiated database purge.");
        setTimeout(() => setWipeMessage(""), 3000);
      }
    } catch (e) { setWipeMessage("❌ Purge failed."); }
  };

  return (
    <div className="h-[85%] grid grid-cols-1 lg:grid-cols-5 gap-8">
      
      {/* Main Config Column */}
      <div className="col-span-3 glass p-10 rounded-3xl flex flex-col border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-6">
            <Settings size={28} className="text-indigo-400"/>
            <h2 className="text-2xl font-bold text-white tracking-tight">Access Control Panel</h2>
        </div>
        
        <div className="space-y-8 flex-1">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Node Admin PIN</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-500" />
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white text-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono shadow-inner" />
            </div>
            <p className="text-xs text-slate-500 mt-2.5 font-medium">Live updates immediately. Saved to node NVRAM.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Auto-Lock Timeout (ms)</label>
            <div className="relative">
              <Activity size={18} className="absolute left-4 top-3.5 text-slate-500" />
              <input type="number" value={timeout} onChange={(e) => setTimeoutVal(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white text-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono shadow-inner" />
            </div>
            <p className="text-xs text-slate-500 mt-2.5 font-medium">How long the physical relay remains open before auto-securing.</p>
          </div>
        </div>

        <div className="pt-8 mt-4 border-t border-slate-800 flex items-center justify-between">
          <button onClick={handleUpdate} disabled={isSaving} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            <Save size={20} /> {isSaving ? "Applying..." : "Apply Configuration"}
          </button>
          {message && <span className="text-sm font-bold text-emerald-400 animate-pulse bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20">{message}</span>}
        </div>
      </div>

      {/* Danger Zone Column */}
      <div className="col-span-2 flex flex-col gap-8">
        <div className="glass p-10 rounded-3xl border border-rose-500/20 bg-gradient-to-b from-rose-500/5 to-transparent flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-6">
                <AlertTriangle size={28} className="text-rose-500" />
                <h2 className="text-2xl font-bold text-rose-400 tracking-tight">Danger Zone</h2>
            </div>
            
            <p className="text-base text-rose-400/80 mb-6 leading-relaxed flex-1">
                Wiping the audit database will permanently delete all threat logs and traffic analysis history. 
                <br/><br/>
                This action cannot be reversed and will immediately clear the Dashboard's event ledger.
            </p>

            <div className="flex flex-col gap-4">
                <button onClick={handleWipe} className="flex items-center justify-center gap-2 w-full bg-rose-500 hover:bg-rose-600 text-white px-6 py-4 rounded-xl text-base font-bold transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                    <RefreshCcw size={18} /> Purge SQLite Database
                </button>
                {wipeMessage && <span className="text-sm font-bold text-rose-400 text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20 animate-pulse">{wipeMessage}</span>}
            </div>
        </div>
      </div>

    </div>
  )
}

function LogsView({ logs }) {
  const scrollRef = useRef(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, filter]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    if (filter === 'SYSTEM') return log.includes('SYSTEM:');
    if (filter === 'HARDWARE') return log.includes('RECV:');
    if (filter === 'SECURITY') return log.includes('SUCCESS') || log.includes('DENIED') || log.includes('LOCKOUT');
    return true;
  });

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cipher_node_logs_${new Date().getTime()}.txt`;
    a.click();
  };

  return (
    <div className="glass rounded-3xl h-[85%] flex flex-col overflow-hidden border border-slate-700/50 shadow-2xl">
      <div className="bg-slate-900/80 px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-indigo-400" />
          <h3 className="font-mono text-sm font-bold text-slate-300">Live Hardware Stream</h3>
        </div>
        
        <div className="flex gap-2 bg-[#020617] p-1 rounded-xl border border-slate-800">
            <button onClick={() => setFilter('ALL')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-colors ${filter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>ALL</button>
            <button onClick={() => setFilter('HARDWARE')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-colors ${filter === 'HARDWARE' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>HARDWARE</button>
            <button onClick={() => setFilter('SYSTEM')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-colors ${filter === 'SYSTEM' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>SYSTEM</button>
            <button onClick={() => setFilter('SECURITY')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-colors ${filter === 'SECURITY' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>SECURITY</button>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={downloadLogs} className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <Download size={14}/> Export
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-black/60 p-6 overflow-y-auto font-mono text-sm leading-relaxed" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">No logs match the current filter...</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="mb-1">
              <span className="text-slate-500">{log.substring(0, 13)}</span>
              <span className={`${log.includes('RECV:') ? 'text-indigo-400' : log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('DENIED') || log.includes('LOCKOUT') ? 'text-rose-400' : 'text-slate-300'}`}>
                {log.substring(13)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}