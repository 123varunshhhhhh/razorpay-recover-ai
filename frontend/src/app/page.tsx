"use client";

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [metrics, setMetrics] = useState({ at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);

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
    } catch (e) { console.error("Simulation failed", e); }
    setIsSimulating(false);
  };

  const triggerBatchSimulation = async () => {
    setIsSimulating(true);
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/batch_simulate", { method: "POST" });
    } catch (e) { console.error("Batch simulation failed", e); }
    setIsSimulating(false);
  };

  const triggerReset = async () => {
    setIsSimulating(true);
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/reset_db", { method: "POST" });
      setLogs([]);
      setMetrics({ at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0 });
      setReceivables([]);
    } catch (e) { console.error("Reset failed", e); }
    setIsSimulating(false);
  };

  const getActionStyle = (action: string) => {
    if (!action) return { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30', bar: 'bg-slate-500' };
    if (action.includes('discount')) return { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', bar: 'bg-gradient-to-b from-emerald-400 to-emerald-600' };
    if (action.includes('upi') || action.includes('retry')) return { badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30', bar: 'bg-gradient-to-b from-blue-400 to-blue-600' };
    if (action.includes('escalation')) return { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30', bar: 'bg-gradient-to-b from-rose-400 to-rose-600' };
    return { badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', bar: 'bg-gradient-to-b from-indigo-400 to-indigo-600' };
  };

  return (
    <main style={{ padding: '0', minHeight: '100vh' }}>

      {/* ── Top Header Bar ── */}
      <header style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,10,40,0.9) 50%, rgba(59,130,246,0.08) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        padding: '0 2rem',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 0' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>🤖</div>
            <div>
              <h1 style={{
                fontSize: '1.5rem', fontWeight: '800', margin: 0,
                background: 'linear-gradient(135deg, #a5b4fc, #60a5fa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>Recover AI</h1>
              <p style={{ fontSize: '0.7rem', color: 'rgba(148,163,184,0.8)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Intelligent Revenue Rescue · Powered by Gemini
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0', fontWeight: '600' }}>
                Total At-Risk
              </p>
              <p className="glow-rose" style={{
                fontSize: '1.9rem', fontWeight: '800', margin: 0, color: '#fb7185',
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em',
              }}>
                ₹{(metrics.at_risk_amount / 100).toLocaleString()}
              </p>
            </div>

            <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.08)' }} />

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0', fontWeight: '600' }}>
                Recovered ({metrics.recovery_percentage}%)
              </p>
              <p className="glow-emerald" style={{
                fontSize: '1.9rem', fontWeight: '800', margin: 0, color: '#34d399',
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em',
              }}>
                ₹{(metrics.recovered_amount / 100).toLocaleString()}
              </p>
            </div>

            {/* Recovery bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)' }}>
                <span>Recovery Rate</span>
                <span style={{ color: '#34d399', fontWeight: '700' }}>{metrics.recovery_percentage}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px',
                  width: `${Math.min(metrics.recovery_percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #6366f1, #10b981)',
                  transition: 'width 0.8s ease',
                  boxShadow: '0 0 12px rgba(16,185,129,0.5)',
                }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.75rem', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Batch Run Card */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem', borderColor: 'rgba(16,185,129,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: '#fff' }}>Batch Recovery Run</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.7)', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
              Fires 4 curated AI recovery events sequentially — one discount, one UPI, two escalations.
            </p>
            <button
              onClick={triggerBatchSimulation}
              disabled={isSimulating}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
                background: isSimulating
                  ? 'rgba(16,185,129,0.3)'
                  : 'linear-gradient(135deg, #059669, #10b981)',
                color: '#fff', fontWeight: '700', fontSize: '0.875rem',
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isSimulating ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
                letterSpacing: '0.02em',
              }}
            >
              {isSimulating ? '⏳  Processing Batch...' : '▶  Run Batch Simulation'}
            </button>
          </div>

          {/* Sandbox Card */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <span>🧪</span>
              <h2 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, color: '#fff', letterSpacing: '0.01em' }}>Counterfactual Sandbox</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { id: 'high_ltv', label: 'Simulate High-LTV Abandonment', sub: 'Expects: Discount generation', color: '#818cf8', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', emoji: '💎' },
                { id: 'low_ltv', label: 'Simulate Standard Failure', sub: 'Expects: UPI Link (Cost optimized)', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', emoji: '🔗' },
                { id: 'fraud', label: 'Simulate High Fraud Risk', sub: 'Expects: Human Escalation Flag', color: '#fb7185', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.25)', emoji: '🚨' },
                { id: 'compliance', label: 'Simulate Compliance Violation', sub: 'Expects: Escalation on 3+ strikes', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', emoji: '⛔' },
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => triggerSimulation(btn.id)}
                  disabled={isSimulating}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.7rem 0.9rem',
                    borderRadius: '10px', border: `1px solid ${btn.border}`,
                    background: btn.bg, cursor: isSimulating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', opacity: isSimulating ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!isSimulating) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.3)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{btn.emoji}</span>
                    <div>
                      <span style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: btn.color }}>{btn.label}</span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(148,163,184,0.6)' }}>{btn.sub}</span>
                    </div>
                  </div>
                </button>
              ))}

              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                  onClick={triggerReset}
                  disabled={isSimulating}
                  style={{
                    width: '100%', padding: '0.6rem', borderRadius: '10px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.07)', color: '#f87171',
                    fontWeight: '600', fontSize: '0.78rem', cursor: isSimulating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', letterSpacing: '0.02em',
                  }}
                >
                  {isSimulating ? 'Resetting...' : '🗑  Reset Database (Demo Prep)'}
                </button>
              </div>
            </div>

            {isSimulating && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="status-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#818cf8' }} />
                <p style={{ fontSize: '0.75rem', color: '#818cf8', margin: 0, fontStyle: 'italic' }}>Agent is thinking...</p>
              </div>
            )}
          </div>

          {/* Compliance Panel */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(148,163,184,0.5)', margin: '0 0 0.75rem 0', fontWeight: '700' }}>🛡  Compliance Guardrails</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                'Max Discount: 10% (hard-coded in Python)',
                'Stop Outreach on 3+ failed attempts',
                'Fraud Flag → immediate escalation',
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'rgba(203,213,225,0.8)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Receivables Panel */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(148,163,184,0.5)', margin: '0 0 0.75rem 0', fontWeight: '700' }}>📋  Upcoming Receivables</p>
            {receivables.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'rgba(100,116,139,0.7)', margin: 0 }}>No active receivables.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {receivables.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.75rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#e2e8f0', margin: '0 0 2px 0' }}>{r.customer_email}</p>
                      <p style={{ fontSize: '0.65rem', color: 'rgba(100,116,139,0.8)', margin: 0 }}>
                        Due: {r.promise_to_pay_date ? r.promise_to_pay_date.split('T')[0] : 'TBD'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600', color: '#34d399', margin: '0 0 2px 0' }}>
                        ₹{(r.amount / 100).toLocaleString()}
                      </p>
                      <span style={{
                        fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700',
                        color: r.status === 'promised' ? '#60a5fa' : '#fb7185',
                        background: r.status === 'promised' ? 'rgba(59,130,246,0.15)' : 'rgba(244,63,94,0.15)',
                        padding: '1px 6px', borderRadius: '4px',
                      }}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Agent Trace ── */}
        <div>
          {/* Trace Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: '#fff', letterSpacing: '-0.01em' }}>
                Agent Reasoning Trace
              </h2>
              <span className="live-badge" style={{
                padding: '3px 10px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '700',
                background: 'rgba(16,185,129,0.15)', color: '#34d399',
                border: '1px solid rgba(16,185,129,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>● Live</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'rgba(100,116,139,0.6)' }}>
              {logs.length} event{logs.length !== 1 ? 's' : ''} recorded
            </span>
          </div>

          {/* Empty state */}
          {logs.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '300px', gap: '12px',
              border: '1px dashed rgba(255,255,255,0.07)', borderRadius: '16px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🤖</div>
              <p style={{ color: 'rgba(100,116,139,0.6)', margin: 0, fontSize: '0.85rem' }}>Awaiting payment events...</p>
              <p style={{ color: 'rgba(100,116,139,0.4)', margin: 0, fontSize: '0.75rem' }}>Click "Run Batch Simulation" to start</p>
            </div>
          )}

          {/* Trace Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px' }}>
            {logs.map((log, index) => {
              const style = getActionStyle(log.action);
              const isEscalation = log.action?.includes('escalation');
              const isDiscount = log.action?.includes('discount');
              return (
                <div key={log.id} className="glass-card" style={{ borderRadius: '14px', padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
                  
                  {/* Left color bar */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                    background: isDiscount ? 'linear-gradient(180deg, #34d399, #059669)' :
                                isEscalation ? 'linear-gradient(180deg, #fb7185, #e11d48)' :
                                'linear-gradient(180deg, #60a5fa, #2563eb)',
                    borderRadius: '14px 0 0 14px',
                  }} />

                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '7px', fontSize: '0.68rem',
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: '600',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: isDiscount ? 'rgba(16,185,129,0.12)' : isEscalation ? 'rgba(244,63,94,0.12)' : 'rgba(59,130,246,0.12)',
                        color: isDiscount ? '#34d399' : isEscalation ? '#fb7185' : '#60a5fa',
                        border: `1px solid ${isDiscount ? 'rgba(16,185,129,0.25)' : isEscalation ? 'rgba(244,63,94,0.25)' : 'rgba(59,130,246,0.25)'}`,
                      }}>
                        {log.action?.replace(/_/g, ' ') || 'unknown'}
                      </span>
                      <span style={{
                        fontSize: '1rem', fontWeight: '800',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: isEscalation ? 'rgba(148,163,184,0.5)' : '#34d399',
                        letterSpacing: '-0.01em',
                      }}>
                        ₹{((log.recovered_amount ?? 0) / 100).toLocaleString()}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace",
                      color: 'rgba(100,116,139,0.7)',
                      background: 'rgba(0,0,0,0.25)', padding: '3px 10px', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span>⏱ {log.latency_ms}ms</span>
                      <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                      <span>🪙 ₹{(log.cost_usd * 84).toFixed(3)}</span>
                    </div>
                  </div>

                  {/* Reasoning box */}
                  <div style={{
                    background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '0.75rem 1rem',
                    border: '1px solid rgba(255,255,255,0.05)', marginLeft: '0.4rem',
                  }}>
                    <p style={{
                      fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: 'rgba(100,116,139,0.6)', margin: '0 0 5px 0', fontWeight: '700',
                    }}>
                      Internal Monologue
                    </p>
                    <p style={{
                      fontSize: '0.82rem', color: '#c7d2fe',
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: '1.6', margin: 0,
                    }}>
                      {log.reasoning}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

