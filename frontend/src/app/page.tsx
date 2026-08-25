"use client";

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [metrics, setMetrics] = useState({ at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);

  // Fetch live logs and metrics from FastAPI backend every 2 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, metricsRes, recRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/logs"),
          fetch("http://127.0.0.1:8000/api/metrics"),
          fetch("http://127.0.0.1:8000/api/receivables")
        ]);
        const logsData = await logsRes.json();
        const metricsData = await metricsRes.json();
        const recData = await recRes.json();
        
        if (logsData.logs) setLogs(logsData.logs);
        if (metricsData) setMetrics(metricsData);
        if (recData.receivables) setReceivables(recData.receivables);
      } catch (e) {
        console.error("Failed to fetch data", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async (scenario: string) => {
    setIsSimulating(true);
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
    } catch (e) {
      console.error("Simulation failed", e);
    }
    setIsSimulating(false);
  }

  const triggerBatchSimulation = async () => {
    setIsSimulating(true);
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/batch_simulate", {
        method: "POST"
      });
    } catch (e) {
      console.error("Batch simulation failed", e);
    }
    setIsSimulating(false);
  }

  const triggerReset = async () => {
    setIsSimulating(true);
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/reset_db", {
        method: "POST"
      });
      // Clear local state immediately for snappy UI
      setLogs([]);
      setMetrics({ at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0 });
      setReceivables([]);
    } catch (e) {
      console.error("Reset failed", e);
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
        <div className="text-right flex gap-8">
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Total At-Risk Revenue</p>
            <p className="text-3xl font-mono font-bold text-rose-400">₹{(metrics.at_risk_amount / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Recovered Revenue ({metrics.recovery_percentage}%)</p>
            <p className="text-4xl font-mono font-bold text-emerald-400">₹{(metrics.recovered_amount / 100).toLocaleString()}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Sandbox Control */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-xl p-6 border border-emerald-500/30 bg-emerald-500/5">
            <h2 className="text-xl font-semibold mb-2 text-white/90">Batch Recovery Run</h2>
            <p className="text-slate-400 text-sm mb-4">
              Simulate 4 random failed payment events in bulk to see the recovery metrics climb.
            </p>
            <button onClick={triggerBatchSimulation} disabled={isSimulating} className="w-full text-center px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">
              {isSimulating ? "Processing Batch..." : "Run Batch Simulation"}
            </button>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-white/90">Counterfactual Sandbox</h2>
            
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
              
              <button onClick={() => triggerSimulation('compliance')} disabled={isSimulating} className="w-full text-left px-4 py-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-colors">
                <span className="block font-medium text-orange-300">Simulate Compliance Violation</span>
                <span className="text-xs text-slate-400">Expects: Escalation on 3+ strikes</span>
              </button>

              <div className="pt-4 mt-4 border-t border-white/10">
                <button onClick={triggerReset} disabled={isSimulating} className="w-full text-center px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium transition-colors">
                  {isSimulating ? "Resetting..." : "Reset Database (Demo Prep)"}
                </button>
              </div>
            </div>
            {isSimulating && <p className="text-sm text-indigo-400 mt-4 animate-pulse">Agent is thinking...</p>}
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-3">Compliance Guardrails</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Max Discount: 10%</li>
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Log Promise-to-Pay dates</li>
              <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Stop Outreach on 3+ fails</li>
            </ul>
          </div>
          
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-3">Upcoming Receivables</h3>
            {receivables.length === 0 ? (
              <p className="text-sm text-slate-500">No active promises to pay.</p>
            ) : (
              <div className="space-y-3">
                {receivables.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{r.customer_email}</p>
                      <p className="text-xs text-slate-400 mt-1">Due: {r.promise_to_pay_date ? r.promise_to_pay_date.split('T')[0] : 'TBD'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-emerald-400">₹{(r.amount / 100).toLocaleString()}</p>
                      <p className={`text-[10px] uppercase tracking-wider mt-1 ${r.status === 'promised' ? 'text-blue-400' : 'text-rose-400'}`}>{r.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Reasoning Feed */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            Agent Reasoning Trace
            <span className="ml-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 animate-pulse">Live</span>
          </h2>
          
          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
            {logs.map(log => (
              <div key={log.id} className="glass-card rounded-xl p-5 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="inline-block px-2 py-1 rounded bg-white/10 text-white/80 text-xs font-mono mr-3 uppercase">{log.action}</span>
                    <span className="font-mono text-emerald-400">₹{(log.recovered_amount / 100).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-slate-500 bg-black/30 px-2 py-1 rounded">
                      ⏱ {log.latency_ms}ms | 🪙 ₹{(log.cost_usd * 84).toFixed(3)}
                    </span>
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
