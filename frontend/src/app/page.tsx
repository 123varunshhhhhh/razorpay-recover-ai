"use client";

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [recoveredAmount, setRecoveredAmount] = useState(18400);
  const [logs, setLogs] = useState<any[]>([]);

  // Fetch live logs from FastAPI backend every 2 seconds
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/logs");
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      } catch (e) {
        console.error("Failed to fetch logs. Is backend running?", e);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async (scenario: string) => {
    setIsSimulating(true);
    try {
      await fetch("http://localhost:8000/api/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      
      // Optimistically update the recovered amount for the demo feel
      if (scenario === 'high_ltv') setRecoveredAmount(prev => prev + 12000);
      else if (scenario === 'low_ltv') setRecoveredAmount(prev => prev + 500);

    } catch (e) {
      console.error("Simulation failed", e);
    }
    setIsSimulating(false);
  }

  return (
    <main className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Recover AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">Intelligent Revenue Rescue</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Session Revenue Recovered</p>
          <p className="text-4xl font-mono font-bold text-emerald-400">₹{recoveredAmount.toLocaleString()}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Sandbox Control */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-white/90">Counterfactual Sandbox</h2>
            <p className="text-slate-400 text-sm mb-6">
              Simulate webhook events to test the agent's decision tree live.
            </p>
            
            <div className="space-y-3">
              <button onClick={() => triggerSimulation('high_ltv')} disabled={isSimulating} className="w-full text-left px-4 py-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors">
                <span className="block font-medium text-indigo-300">Simulate High-LTV Abandonment</span>
                <span className="text-xs text-slate-400">Expects: Discount generation</span>
              </button>
              
              <button onClick={() => triggerSimulation('low_ltv')} disabled={isSimulating} className="w-full text-left px-4 py-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors">
                <span className="block font-medium text-blue-300">Simulate Standard Failure</span>
                <span className="text-xs text-slate-400">Expects: UPI Link (Cost optimized)</span>
              </button>

              <button onClick={() => triggerSimulation('fraud')} disabled={isSimulating} className="w-full text-left px-4 py-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors">
                <span className="block font-medium text-rose-300">Simulate High Fraud Risk</span>
                <span className="text-xs text-slate-400">Expects: Human Escalation Flag</span>
              </button>
            </div>
            {isSimulating && <p className="text-sm text-indigo-400 mt-4 animate-pulse">Agent is thinking...</p>}
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-3">Live Guardrails</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Max Discount: 10%</li>
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Only 1 discount per 30 days</li>
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Force human review on 3+ fails</li>
            </ul>
          </div>
        </div>

        {/* Right Col: Reasoning Feed */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            Agent Reasoning Trace
            <span className="ml-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 animate-pulse">Live</span>
          </h2>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {logs.map(log => (
              <div key={log.id} className="glass-card rounded-xl p-5 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                
                <div className="flex justify-between items-start mb-3">
                  <p className="font-medium text-slate-200">{log.message}</p>
                  <div className="flex gap-2 text-xs font-mono text-slate-500">
                    <span className="bg-white/5 px-2 py-1 rounded">Cost: {log.cost}</span>
                    <span className="bg-white/5 px-2 py-1 rounded">Lat: {log.latency}</span>
                  </div>
                </div>
                
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Internal Monologue</p>
                  <p className="text-sm text-indigo-200 font-mono leading-relaxed">{log.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
