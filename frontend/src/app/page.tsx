"use client";

import { useState, useEffect, useRef } from 'react';

// ── Tympanus-style animated number odometer ──
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === prevRef.current) return;
    const from = prevRef.current;
    prevRef.current = target;
    const startTime = performance.now();

    const animate = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}

export default function Dashboard() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0,
    ai_roi: 0, total_cost_usd: 0, total_events: 0,
    escalations: 0, discounts: 0, upi_retries: 0,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);

  // ── Typewriter state ──
  const [displayReasonings, setDisplayReasonings] = useState<Record<string, string>>({});
  const typedIdsRef = useRef<Set<string>>(new Set());

  // ── Magnetic button ref ──
  const batchBtnRef = useRef<HTMLButtonElement>(null);

  // ── Animated metric counters ──
  const atRiskDisplay = useCountUp(Math.round(metrics.at_risk_amount / 100));
  const recoveredDisplay = useCountUp(Math.round(metrics.recovered_amount / 100));

  // ── Data polling ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, metricsRes, recRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/logs"),
          fetch("http://127.0.0.1:8000/api/metrics"),
          fetch("http://127.0.0.1:8000/api/receivables"),
        ]);
        const logsData = await logsRes.json();
        const metricsData = await metricsRes.json();
        const recData = await recRes.json();
        if (logsData.logs) setLogs(logsData.logs);
        if (metricsData) setMetrics(metricsData);
        if (recData.receivables) setReceivables(recData.receivables);
      } catch (e) { console.error("Failed to fetch data", e); }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Typewriter effect for new cards ──
  useEffect(() => {
    logs.forEach(log => {
      const key = String(log.id);
      if (!typedIdsRef.current.has(key) && log.reasoning) {
        typedIdsRef.current.add(key);
        const full: string = log.reasoning;
        let i = 0;
        const tick = () => {
          i++;
          setDisplayReasonings(prev => ({ ...prev, [key]: full.slice(0, i) }));
          if (i < full.length) setTimeout(tick, 14);
        };
        setTimeout(tick, 80);
      }
    });
  }, [logs]);

  // ── Magnetic button handlers ──
  const onBtnMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = batchBtnRef.current;
    if (!btn || isSimulating) return;
    const rect = btn.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    btn.style.transform = `translate(${dx * 0.13}px, ${dy * 0.13}px) scale(1.03)`;
    btn.style.transition = 'transform 0.1s ease';
  };
  const onBtnMouseLeave = () => {
    const btn = batchBtnRef.current;
    if (!btn) return;
    btn.style.transform = 'translate(0, 0) scale(1)';
    btn.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
  };

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
    } catch (e) { console.error("Batch failed", e); }
    setIsSimulating(false);
  };

  const triggerReset = async () => {
    setIsSimulating(true);
    typedIdsRef.current.clear();
    setDisplayReasonings({});
    try {
      await fetch("http://127.0.0.1:8000/api/sandbox/reset_db", { method: "POST" });
      setLogs([]);
      setMetrics({ at_risk_amount: 0, recovered_amount: 0, recovery_percentage: 0, ai_roi: 0, total_cost_usd: 0, total_events: 0, escalations: 0, discounts: 0, upi_retries: 0 });
      setReceivables([]);
    } catch (e) { console.error("Reset failed", e); }
    setIsSimulating(false);
  };

  const getActionStyle = (action: string) => {
    if (!action) return { badge: '', bar: '' };
    if (action.includes('discount'))  return { isDiscount: true,  isEscalation: false };
    if (action.includes('escalation')) return { isDiscount: false, isEscalation: true };
    return { isDiscount: false, isEscalation: false };
  };

  // Architecture pipeline steps
  const archSteps = [
    { icon: '📡', label: 'Razorpay Webhook', sub: 'payment.failed event', delay: '0s' },
    { icon: '⚡', label: 'FastAPI Backend',  sub: 'Signature verified',   delay: '0.1s' },
    { icon: '🗄️', label: 'Customer Context', sub: 'LTV · Failures · Fraud', delay: '0.2s' },
    { icon: '🧠', label: 'Gemini Agent',     sub: 'Single-hop inference', delay: '0.3s' },
    { icon: '✅', label: 'Recovery Action',  sub: 'Discount · UPI · Escalate', delay: '0.4s' },
  ];

  return (
    <main style={{ padding: 0, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,10,40,0.92) 50%, rgba(59,130,246,0.08) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        padding: '0 2rem',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 0' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 24px rgba(99,102,241,0.55)' }}>
              <img src="/logo.jpg" alt="Recover AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <h1 className="glitch" data-text="Recover AI" style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #a5b4fc, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', position: 'relative' }}>
                Recover AI
              </h1>
              <p style={{ fontSize: '0.7rem', color: 'rgba(148,163,184,0.8)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Intelligent Revenue Rescue · Powered by Gemini
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0', fontWeight: '600' }}>Total At-Risk</p>
              <p className="glow-rose" style={{ fontSize: '1.9rem', fontWeight: '800', margin: 0, color: '#fb7185', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
                ₹{atRiskDisplay.toLocaleString()}
              </p>
            </div>

            <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.08)' }} />

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0', fontWeight: '600' }}>
                Recovered ({metrics.recovery_percentage}%)
              </p>
              <p className="glow-emerald" style={{ fontSize: '1.9rem', fontWeight: '800', margin: 0, color: '#34d399', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
                ₹{recoveredDisplay.toLocaleString()}
              </p>
            </div>

            {/* Recovery bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)' }}>
                <span>Recovery Rate</span>
                <span style={{ color: '#34d399', fontWeight: '700' }}>{metrics.recovery_percentage}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '99px', width: `${Math.min(metrics.recovery_percentage, 100)}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)', transition: 'width 0.9s cubic-bezier(0.23,1,0.32,1)', boxShadow: '0 0 12px rgba(16,185,129,0.5)' }} />
              </div>
            </div>

            <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.08)' }} />

            {/* AI ROI */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0', fontWeight: '600' }}>AI ROI</p>
              <p style={{ fontSize: '1.9rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
                {metrics.ai_roi > 0 ? (
                  metrics.ai_roi >= 1000000 ? `${(metrics.ai_roi / 1000000).toFixed(1)}M×`
                  : metrics.ai_roi >= 1000  ? `${Math.round(metrics.ai_roi / 1000)}K×`
                  : `${metrics.ai_roi.toFixed(0)}×`
                ) : '—'}
              </p>
              <p style={{ fontSize: '0.58rem', color: 'rgba(148,163,184,0.45)', margin: '2px 0 0 0', letterSpacing: '0.04em' }}>₹ recovered / ₹ AI cost</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Architecture Pipeline Strip ── */}
      <div style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0.85rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, overflowX: 'auto' }}>
            {archSteps.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
                <div className="arch-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '0 1.5rem', animationDelay: step.delay }}>
                  <span style={{ fontSize: '1.1rem' }}>{step.icon}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{step.label}</span>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(148,163,184,0.45)', whiteSpace: 'nowrap' }}>{step.sub}</span>
                </div>
                {i < archSteps.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: '0 0 auto' }}>
                    <div className="arch-connector-line" style={{ width: '28px', height: '1px', background: 'linear-gradient(90deg, rgba(99,102,241,0.3), rgba(99,102,241,0.7))' }} />
                    <span style={{ color: '#6366f1', fontSize: '0.5rem', opacity: 0.8 }}>▶</span>
                    <div className="arch-connector-line" style={{ width: '28px', height: '1px', background: 'linear-gradient(90deg, rgba(99,102,241,0.7), rgba(99,102,241,0.3))' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.75rem', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Batch Run */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem', borderColor: 'rgba(16,185,129,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: '#fff' }}>Batch Recovery Run</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.7)', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
              Fires 4 curated AI recovery events sequentially — one discount, one UPI, two escalations.
            </p>
            {/* ── Magnetic Button ── */}
            <button
              ref={batchBtnRef}
              className="magnetic-btn"
              onClick={triggerBatchSimulation}
              disabled={isSimulating}
              onMouseMove={onBtnMouseMove}
              onMouseLeave={onBtnMouseLeave}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
                background: isSimulating ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #059669, #10b981)',
                color: '#fff', fontWeight: '700', fontSize: '0.875rem',
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                boxShadow: isSimulating ? 'none' : '0 4px 24px rgba(16,185,129,0.4)',
                letterSpacing: '0.02em',
              }}
            >
              {isSimulating ? '⏳  Processing Batch...' : '▶  Run Batch Simulation'}
            </button>
          </div>

          {/* Sandbox */}
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <span>🧪</span>
              <h2 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, color: '#fff', letterSpacing: '0.01em' }}>Counterfactual Sandbox</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { id: 'high_ltv',   label: 'Simulate High-LTV Abandonment', sub: 'Expects: Discount generation',     color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.25)',  emoji: '💎' },
                { id: 'low_ltv',    label: 'Simulate Standard Failure',      sub: 'Expects: UPI Link (Cost optimized)', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', emoji: '🔗' },
                { id: 'fraud',      label: 'Simulate High Fraud Risk',       sub: 'Expects: Human Escalation Flag',  color: '#fb7185', bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.25)',  emoji: '🚨' },
                { id: 'compliance', label: 'Simulate Compliance Violation',  sub: 'Expects: Escalation on 3+ strikes', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', emoji: '⛔' },
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => triggerSimulation(btn.id)}
                  disabled={isSimulating}
                  style={{ width: '100%', textAlign: 'left', padding: '0.7rem 0.9rem', borderRadius: '10px', border: `1px solid ${btn.border}`, background: btn.bg, cursor: isSimulating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isSimulating ? 0.6 : 1 }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#f87171', fontWeight: '600', fontSize: '0.78rem', cursor: isSimulating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', letterSpacing: '0.02em' }}
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
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#e2e8f0', margin: '0 0 2px 0' }}>{r.customer_email}</p>
                      <p style={{ fontSize: '0.65rem', color: 'rgba(100,116,139,0.8)', margin: 0 }}>Due: {r.promise_to_pay_date ? r.promise_to_pay_date.split('T')[0] : 'TBD'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.8rem', fontFamily: "'JetBrains Mono',monospace", fontWeight: '600', color: '#34d399', margin: '0 0 2px 0' }}>₹{(r.amount / 100).toLocaleString()}</p>
                      <span style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700', color: r.status === 'promised' ? '#60a5fa' : '#fb7185', background: r.status === 'promised' ? 'rgba(59,130,246,0.15)' : 'rgba(244,63,94,0.15)', padding: '1px 6px', borderRadius: '4px' }}>{r.status}</span>
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
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: '#fff', letterSpacing: '-0.01em' }}>Agent Reasoning Trace</h2>
              <span className="live-badge" style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '700', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>● Live</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {logs.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {metrics.discounts > 0 && <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', fontWeight: '600' }}>{metrics.discounts} discount{metrics.discounts !== 1 ? 's' : ''}</span>}
                  {metrics.upi_retries > 0 && <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontWeight: '600' }}>{metrics.upi_retries} UPI</span>}
                  {metrics.escalations > 0 && <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.2)', fontWeight: '600' }}>{metrics.escalations} escalated</span>}
                </div>
              )}
              <span style={{ fontSize: '0.72rem', color: 'rgba(100,116,139,0.6)' }}>{logs.length} event{logs.length !== 1 ? 's' : ''} recorded</span>
            </div>
          </div>

          {/* Empty state */}
          {logs.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🤖</div>
              <p style={{ color: 'rgba(100,116,139,0.6)', margin: 0, fontSize: '0.85rem' }}>Awaiting payment events...</p>
              <p style={{ color: 'rgba(100,116,139,0.4)', margin: 0, fontSize: '0.75rem' }}>Click "Run Batch Simulation" to start</p>
            </div>
          )}

          {/* Trace Cards — staggered cascade fly-in */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px', paddingBottom: '1.5rem' }}>
            {logs.map((log, index) => {
              const isEscalation = log.action?.includes('escalation');
              const isDiscount   = log.action?.includes('discount');
              const key = String(log.id);
              const reasoningText = displayReasonings[key] ?? log.reasoning ?? '';
              const isTyping = typedIdsRef.current.has(key) && reasoningText.length < (log.reasoning?.length ?? 0);
              const showCursor = displayReasonings[key] !== undefined && displayReasonings[key].length < (log.reasoning?.length ?? 0);

              return (
                <div
                  key={log.id}
                  className="glass-card"
                  style={{
                    borderRadius: '14px', padding: '1.1rem 1.25rem',
                    position: 'relative', overflow: 'hidden',
                    animationDelay: `${Math.min(index, 5) * 0.07}s`,
                    animationFillMode: 'both',
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                    const spot = e.currentTarget.querySelector('.evervault-spot') as HTMLElement;
                    if (spot) spot.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const spot = e.currentTarget.querySelector('.evervault-spot') as HTMLElement;
                    if (spot) spot.style.opacity = '0';
                  }}
                >
                  {/* Evervault cursor-following spotlight */}
                  <div aria-hidden="true" className="evervault-spot" />

                  {/* Left color bar — sits above spotlight */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: isDiscount ? 'linear-gradient(180deg, #34d399, #059669)' : isEscalation ? 'linear-gradient(180deg, #fb7185, #e11d48)' : 'linear-gradient(180deg, #60a5fa, #2563eb)', borderRadius: '14px 0 0 14px', zIndex: 2 }} />

                  {/* Content wrapper — above spotlight */}
                  <div style={{ position: 'relative', zIndex: 1 }}>

                    {/* Top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '7px', fontSize: '0.68rem', fontFamily: "'JetBrains Mono',monospace", fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', background: isDiscount ? 'rgba(16,185,129,0.12)' : isEscalation ? 'rgba(244,63,94,0.12)' : 'rgba(59,130,246,0.12)', color: isDiscount ? '#34d399' : isEscalation ? '#fb7185' : '#60a5fa', border: `1px solid ${isDiscount ? 'rgba(16,185,129,0.25)' : isEscalation ? 'rgba(244,63,94,0.25)' : 'rgba(59,130,246,0.25)'}` }}>
                          {log.action?.replace(/_/g, ' ') || 'unknown'}
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: '800', fontFamily: "'JetBrains Mono',monospace", color: isEscalation ? 'rgba(148,163,184,0.5)' : '#34d399', letterSpacing: '-0.01em' }}>
                          ₹{((log.recovered_amount ?? 0) / 100).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', fontFamily: "'JetBrains Mono',monospace", color: 'rgba(100,116,139,0.7)', background: 'rgba(0,0,0,0.25)', padding: '3px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span>⏱ {log.latency_ms}ms</span>
                        <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                        <span>🪙 ₹{(log.cost_usd * 84).toFixed(3)}</span>
                      </div>
                    </div>

                    {/* Typewriter reasoning box */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.05)', marginLeft: '0.4rem' }}>
                      <p style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.6)', margin: '0 0 5px 0', fontWeight: '700' }}>
                        Internal Monologue
                      </p>
                      <p style={{ fontSize: '0.82rem', color: '#c7d2fe', fontFamily: "'JetBrains Mono',monospace", lineHeight: '1.6', margin: 0 }}>
                        {reasoningText}
                        {showCursor && <span className="typewriter-cursor" />}
                      </p>
                    </div>

                    {/* Customer context chips */}
                    {log.customer_ltv !== undefined && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: '0.4rem', marginTop: '0.6rem' }}>
                        <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '6px', fontWeight: '600', background: log.customer_ltv > 1000000 ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', color: log.customer_ltv > 1000000 ? '#34d399' : 'rgba(148,163,184,0.6)', border: `1px solid ${log.customer_ltv > 1000000 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`, fontFamily: "'JetBrains Mono',monospace" }}>
                          LTV ₹{(log.customer_ltv / 100).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '6px', fontWeight: '600', background: log.customer_failed_attempts >= 3 ? 'rgba(244,63,94,0.12)' : 'rgba(100,116,139,0.12)', color: log.customer_failed_attempts >= 3 ? '#fb7185' : 'rgba(148,163,184,0.6)', border: `1px solid ${log.customer_failed_attempts >= 3 ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.05)'}`, fontFamily: "'JetBrains Mono',monospace" }}>
                          {log.customer_failed_attempts} prior failure{log.customer_failed_attempts !== 1 ? 's' : ''}
                        </span>
                        {log.customer_fraud_flag && (
                          <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>⚠ Fraud Flag</span>
                        )}
                        {log.failure_reason && (
                          <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '6px', fontWeight: '500', background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>{log.failure_reason}</span>
                        )}
                      </div>
                    )}

                    {/* Razorpay payment link */}
                    {log.payment_link_url && (
                      <a
                        href={log.payment_link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '0.4rem', marginTop: '0.75rem', padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', textDecoration: 'none', background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(59,130,246,0.2))', color: '#34d399', border: '1px solid rgba(16,185,129,0.5)', letterSpacing: '0.02em', boxShadow: '0 0 16px rgba(16,185,129,0.15)', transition: 'all 0.2s ease' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 28px rgba(16,185,129,0.35)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 16px rgba(16,185,129,0.15)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>🔗</span> Open Razorpay Payment Link <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>↗</span>
                      </a>
                    )}
                  </div>{/* end content wrapper */}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
