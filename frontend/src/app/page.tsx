"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Smooth number counter ── */
function useCountUp(target: number, ms = 850) {
  const [n, setN] = useState(0);
  const prev = useRef(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === prev.current) return;
    const from = prev.current; prev.current = target;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return n;
}

/* ── Action colour map ── */
const accent = (action = "") => {
  if (action.includes("discount"))   return { color: "#34d399", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)",  bar: "#10b981", label: "DISCOUNT" };
  if (action.includes("escalation")) return { color: "#f87171", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.28)",  bar: "#ef4444", label: "ESCALATE" };
  return                                     { color: "#60a5fa", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.28)", bar: "#3b82f6", label: "UPI LINK" };
};

/* ── Scenarios ── */
const SCENARIOS = [
  { id:"high_ltv",   icon:"💎", title:"High-LTV Abandonment", hint:"→ Discount",      c:"#a78bfa", brd:"rgba(167,139,250,0.3)", bg:"rgba(124,58,237,0.08)"  },
  { id:"low_ltv",    icon:"🔗", title:"Standard Failure",      hint:"→ UPI Link",     c:"#60a5fa", brd:"rgba(59,130,246,0.3)",  bg:"rgba(59,130,246,0.08)"  },
  { id:"fraud",      icon:"🚨", title:"High Fraud Risk",       hint:"→ Escalation",   c:"#f87171", brd:"rgba(239,68,68,0.3)",   bg:"rgba(239,68,68,0.08)"   },
  { id:"compliance", icon:"⛔", title:"Compliance Violation",  hint:"→ Stop outreach",c:"#fb923c", brd:"rgba(251,146,60,0.3)",  bg:"rgba(251,146,60,0.08)"  },
];

const PIPE = [
  { icon:"📡", step:"Razorpay Webhook",  note:"payment.failed event"      },
  { icon:"⚡", step:"FastAPI Backend",   note:"Signature verified"         },
  { icon:"🗄️",step:"Customer Context", note:"LTV · History · Fraud score" },
  { icon:"🧠", step:"Gemini Agent",      note:"Single-hop reasoning"       },
  { icon:"✅", step:"Recovery Action",   note:"Discount / UPI / Escalate"  },
];

/* ── Framer variants ── */
const fade  = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:0.4,ease:[0.22,1,0.36,1]}} };
const stag  = { hidden:{}, show:{transition:{staggerChildren:0.06}} };
const card  = { hidden:{opacity:0,y:24,scale:0.98}, show:{opacity:1,y:0,scale:1,transition:{duration:0.45,ease:[0.22,1,0.36,1]}}, exit:{opacity:0,y:-10,transition:{duration:0.18}} };

export default function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<any>({ at_risk_amount:0,recovered_amount:0,recovery_percentage:0,ai_roi:0,escalations:0,discounts:0,upi_retries:0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [typed, setTyped] = useState<Record<string,string>>({});
  const done = useRef<Set<string>>(new Set());

  const atRisk   = useCountUp(Math.round(metrics.at_risk_amount    / 100));
  const recvd    = useCountUp(Math.round(metrics.recovered_amount  / 100));

  /* polling */
  useEffect(() => {
    const poll = async () => {
      try {
        const [a,b,c] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/logs").then(r=>r.json()),
          fetch("http://127.0.0.1:8000/api/metrics").then(r=>r.json()),
          fetch("http://127.0.0.1:8000/api/receivables").then(r=>r.json()),
        ]);
        if (a.logs) setLogs(a.logs);
        if (b)      setMetrics(b);
        if (c.receivables) setRecs(c.receivables);
      } catch {}
    };
    poll(); const id = setInterval(poll,2000); return ()=>clearInterval(id);
  },[]);

  /* typewriter */
  useEffect(()=>{
    logs.forEach(log=>{
      const k = String(log.id);
      if (done.current.has(k)||!log.reasoning) return;
      done.current.add(k);
      const full:string = log.reasoning;
      let i=0;
      const tick=()=>{ i++; setTyped(p=>({...p,[k]:full.slice(0,i)})); if(i<full.length) setTimeout(tick,11); };
      setTimeout(tick,60);
    });
  },[logs]);

  const call = async (url:string,body?:object)=>{
    try{ await fetch(url,{method:"POST",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined}); }catch{}
  };
  const batch = async()=>{ setBusy(true); await call("http://127.0.0.1:8000/api/sandbox/batch_simulate"); setBusy(false); };
  const sim   = async(s:string)=>{ setBusy(true); await call("http://127.0.0.1:8000/api/sandbox/simulate",{scenario:s}); setBusy(false); };
  const reset = async()=>{
    setBusy(true); done.current.clear(); setTyped({});
    await call("http://127.0.0.1:8000/api/sandbox/reset_db");
    setLogs([]); setMetrics({at_risk_amount:0,recovered_amount:0,recovery_percentage:0,ai_roi:0,escalations:0,discounts:0,upi_retries:0}); setRecs([]);
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh"}}>

      {/* ════════ HEADER ════════ */}
      <header style={{
        position:"sticky",top:0,zIndex:50,
        background:"rgba(7,9,15,0.88)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{maxWidth:1480,margin:"0 auto",padding:"0 2rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:68}}>

          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:10,overflow:"hidden",flexShrink:0,boxShadow:"0 0 0 1px rgba(109,40,217,0.5),0 0 18px rgba(109,40,217,0.4)"}}>
              <img src="/logo.jpg" alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            </div>
            <div>
              <div style={{fontSize:"1.35rem",fontWeight:800,letterSpacing:"-0.03em",background:"linear-gradient(120deg,#c4b5fd,#818cf8,#67e8f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                Recover AI
              </div>
              <div style={{fontSize:"0.6rem",color:"rgba(148,163,184,0.45)",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600,marginTop:1}}>
                Powered by Gemini · Razorpay Buildathon
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div style={{display:"flex",alignItems:"stretch",gap:0}}>
            {[
              {label:"At-Risk",    val:`₹${atRisk.toLocaleString()}`,   color:"#f87171", glow:"rgba(239,68,68,0.6)"     },
              {label:`Recovered`,  val:`₹${recvd.toLocaleString()}`,    color:"#34d399", glow:"rgba(16,185,129,0.6)"   },
            ].map((m,i)=>(
              <div key={m.label} style={{padding:"0 1.6rem",borderLeft:i?"1px solid rgba(255,255,255,0.06)":undefined,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"right"}}>
                <div style={{fontSize:"0.58rem",color:"rgba(148,163,184,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:2}}>{m.label} {i===1&&metrics.recovery_percentage>0?`(${metrics.recovery_percentage}%)`:""}</div>
                <div style={{fontSize:"1.7rem",fontWeight:800,color:m.color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"-0.025em",lineHeight:1,textShadow:`0 0 20px ${m.glow}`}}>{m.val}</div>
              </div>
            ))}

            {/* Progress bar */}
            <div style={{padding:"0 1.6rem",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",justifyContent:"center",minWidth:130}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.58rem",color:"rgba(148,163,184,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:7}}>
                <span>Recovery</span><span style={{color:"#34d399"}}>{metrics.recovery_percentage}%</span>
              </div>
              <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden"}}>
                <motion.div animate={{width:`${Math.min(metrics.recovery_percentage,100)}%`}} transition={{duration:0.9,ease:[0.22,1,0.36,1]}}
                  style={{height:"100%",background:"linear-gradient(90deg,#6d28d9,#10b981)",borderRadius:99,boxShadow:"0 0 8px rgba(16,185,129,0.5)"}}/>
              </div>
            </div>

            {/* ROI */}
            <div style={{padding:"0 1.6rem",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"right"}}>
              <div style={{fontSize:"0.58rem",color:"rgba(148,163,184,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:2}}>AI ROI</div>
              <div style={{fontSize:"1.7rem",fontWeight:800,background:"linear-gradient(120deg,#fbbf24,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"-0.025em",lineHeight:1}}>
                {metrics.ai_roi>0?(metrics.ai_roi>=1e6?`${(metrics.ai_roi/1e6).toFixed(1)}M×`:metrics.ai_roi>=1000?`${Math.round(metrics.ai_roi/1000)}K×`:`${metrics.ai_roi.toFixed(0)}×`):"—"}
              </div>
              <div style={{fontSize:"0.52rem",color:"rgba(148,163,184,0.28)",marginTop:2,letterSpacing:"0.04em"}}>recovered ÷ AI cost</div>
            </div>
          </div>
        </div>
      </header>

      {/* ════════ PIPELINE STRIP ════════ */}
      <div style={{background:"rgba(0,0,0,0.2)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{maxWidth:1480,margin:"0 auto",padding:"0.6rem 2rem",display:"flex",alignItems:"center",justifyContent:"center",gap:0,overflowX:"auto"}}>
          {PIPE.map((s,i)=>(
            <div key={s.step} style={{display:"flex",alignItems:"center",flexShrink:0}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"0 1.4rem"}}>
                <span style={{fontSize:"0.9rem"}}>{s.icon}</span>
                <span style={{fontSize:"0.64rem",fontWeight:700,color:"#e2e8f0",whiteSpace:"nowrap"}}>{s.step}</span>
                <span style={{fontSize:"0.53rem",color:"rgba(148,163,184,0.33)",whiteSpace:"nowrap"}}>{s.note}</span>
              </div>
              {i<PIPE.length-1&&(
                <div style={{display:"flex",alignItems:"center",flexShrink:0}}>
                  <div className="arch-conn" style={{width:20,height:1,background:"linear-gradient(90deg,rgba(109,40,217,0.15),rgba(109,40,217,0.65))"}}/>
                  <span style={{color:"#6d28d9",fontSize:"0.4rem",opacity:0.7}}>▶</span>
                  <div className="arch-conn" style={{width:20,height:1,background:"linear-gradient(90deg,rgba(109,40,217,0.65),rgba(109,40,217,0.15))"}}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ════════ MAIN CONTENT ════════ */}
      <div style={{maxWidth:1480,margin:"0 auto",padding:"1.6rem 2rem",display:"grid",gridTemplateColumns:"290px 1fr",gap:"1.4rem",alignItems:"start"}}>

        {/* ─── SIDEBAR ─── */}
        <motion.div variants={stag} initial="hidden" animate="show" style={{display:"flex",flexDirection:"column",gap:"0.85rem"}}>

          {/* Batch Run Card */}
          <motion.div variants={fade} style={{borderRadius:14,padding:"1.35rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5}}>
              <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#6d28d9,#5b21b6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",boxShadow:"0 4px 14px rgba(109,40,217,0.5)"}}>⚡</div>
              <span style={{fontSize:"0.9rem",fontWeight:700,color:"#f1f5f9"}}>Batch Recovery Run</span>
            </div>
            <p style={{fontSize:"0.72rem",color:"rgba(148,163,184,0.55)",lineHeight:1.55,marginBottom:"1rem",paddingLeft:37}}>
              Fires 4 recovery scenarios — discount, UPI retry, and escalations in sequence.
            </p>
            <motion.button onClick={batch} disabled={busy}
              whileHover={busy?{}:{scale:1.02,y:-1}} whileTap={busy?{}:{scale:0.97}}
              transition={{type:"spring",stiffness:380,damping:18}}
              style={{
                width:"100%",padding:"0.75rem",borderRadius:9,border:"none",fontFamily:"inherit",
                background:busy?"rgba(109,40,217,0.25)":"linear-gradient(135deg,#6d28d9,#5b21b6,#7c3aed)",
                color:"#fff",fontWeight:700,fontSize:"0.85rem",cursor:busy?"not-allowed":"pointer",
                boxShadow:busy?"none":"0 4px 20px rgba(109,40,217,0.5),inset 0 1px 0 rgba(255,255,255,0.12)",
                letterSpacing:"0.02em",
              }}
            >
              {busy ? "⏳  Processing…" : "▶  Run Batch Simulation"}
            </motion.button>
          </motion.div>

          {/* Sandbox */}
          <motion.div variants={fade} style={{borderRadius:14,padding:"1.35rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(16px)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:"0.95rem"}}>
              <div style={{width:28,height:28,borderRadius:7,background:"rgba(6,182,212,0.12)",border:"1px solid rgba(6,182,212,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem"}}>🧪</div>
              <span style={{fontSize:"0.88rem",fontWeight:700,color:"#f1f5f9"}}>Counterfactual Sandbox</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.45rem"}}>
              {SCENARIOS.map(s=>(
                <motion.button key={s.id} onClick={()=>sim(s.id)} disabled={busy}
                  whileHover={busy?{}:{x:4}} whileTap={busy?{}:{scale:0.97}}
                  style={{width:"100%",textAlign:"left",padding:"0.62rem 0.85rem",borderRadius:9,border:`1px solid ${s.brd}`,background:s.bg,cursor:busy?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:9,fontFamily:"inherit",opacity:busy?0.5:1}}>
                  <span style={{fontSize:"0.9rem",flexShrink:0}}>{s.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:"0.76rem",color:s.c,lineHeight:1.3}}>{s.title}</div>
                    <div style={{fontSize:"0.61rem",color:"rgba(148,163,184,0.38)"}}>{s.hint}</div>
                  </div>
                </motion.button>
              ))}
            </div>
            <div style={{marginTop:"0.65rem",paddingTop:"0.65rem",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <motion.button onClick={reset} disabled={busy} whileHover={busy?{}:{scale:1.01}} whileTap={busy?{}:{scale:0.97}}
                style={{width:"100%",padding:"0.55rem",borderRadius:9,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.05)",color:"#f87171",fontWeight:600,fontSize:"0.74rem",cursor:busy?"not-allowed":"pointer",fontFamily:"inherit"}}>
                🗑  Reset Database
              </motion.button>
            </div>
          </motion.div>

          {/* Guardrails */}
          <motion.div variants={fade} style={{borderRadius:14,padding:"1.1rem 1.35rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.13em",color:"rgba(148,163,184,0.33)",fontWeight:800,marginBottom:"0.6rem"}}>🛡 Compliance Guardrails</div>
            {["Max discount capped at 10%","Stop outreach after 3 failures","Fraud flag triggers immediate escalation"].map((t,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:7,marginBottom:i<2?6:0}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px rgba(16,185,129,0.7)",flexShrink:0,marginTop:5}}/>
                <span style={{fontSize:"0.73rem",color:"rgba(203,213,225,0.7)",lineHeight:1.45}}>{t}</span>
              </div>
            ))}
          </motion.div>

          {/* ── AI Impact vs Industry Baseline ── */}
          {metrics.at_risk_amount > 0 && (
            <motion.div variants={fade} style={{borderRadius:14,padding:"1.1rem 1.35rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(109,40,217,0.2)"}}>
              <div style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.13em",color:"rgba(148,163,184,0.33)",fontWeight:800,marginBottom:"0.85rem"}}>💡 AI Impact vs Industry</div>

              {/* WITHOUT AI row */}
              <div style={{marginBottom:"0.65rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.67rem",color:"rgba(148,163,184,0.45)",marginBottom:5,fontWeight:600}}>
                  <span>Without AI <span style={{opacity:0.5,fontWeight:400}}>(generic retry email)</span></span>
                  <span style={{color:"#f87171",fontFamily:"'JetBrains Mono',monospace"}}>~15%</span>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                  <motion.div
                    initial={{width:0}} animate={{width:"15%"}}
                    transition={{duration:0.9,ease:[0.22,1,0.36,1],delay:0.2}}
                    style={{height:"100%",background:"linear-gradient(90deg,#ef4444,#f87171)",borderRadius:99}}
                  />
                </div>
                <div style={{fontSize:"0.62rem",color:"rgba(148,163,184,0.3)",marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>
                  ₹{Math.round(metrics.at_risk_amount * 0.15 / 100).toLocaleString()} recovered
                </div>
              </div>

              {/* WITH AI row */}
              <div style={{marginBottom:"0.85rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.67rem",color:"rgba(148,163,184,0.45)",marginBottom:5,fontWeight:600}}>
                  <span style={{color:"#a78bfa"}}>With Recover AI</span>
                  <span style={{color:"#34d399",fontFamily:"'JetBrains Mono',monospace"}}>{metrics.recovery_percentage}%</span>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                  <motion.div
                    initial={{width:0}} animate={{width:`${Math.min(metrics.recovery_percentage,100)}%`}}
                    transition={{duration:1.1,ease:[0.22,1,0.36,1],delay:0.3}}
                    style={{height:"100%",background:"linear-gradient(90deg,#6d28d9,#10b981)",borderRadius:99,boxShadow:"0 0 8px rgba(16,185,129,0.4)"}}
                  />
                </div>
                <div style={{fontSize:"0.62rem",color:"#34d399",marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>
                  ₹{Math.round(metrics.recovered_amount / 100).toLocaleString()} recovered
                </div>
              </div>

              {/* Delta box */}
              {metrics.recovery_percentage > 15 && (
                <motion.div
                  initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                  transition={{duration:0.5,delay:0.6}}
                  style={{borderRadius:9,padding:"0.6rem 0.8rem",background:"linear-gradient(135deg,rgba(16,185,129,0.1),rgba(109,40,217,0.1))",border:"1px solid rgba(16,185,129,0.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                >
                  <div>
                    <div style={{fontSize:"0.58rem",color:"rgba(148,163,184,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Extra Revenue Saved</div>
                    <div style={{fontSize:"1.05rem",fontWeight:800,color:"#34d399",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"-0.02em"}}>
                      +₹{(Math.round(metrics.recovered_amount/100) - Math.round(metrics.at_risk_amount*0.15/100)).toLocaleString()}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"0.58rem",color:"rgba(148,163,184,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>vs Baseline</div>
                    <div style={{fontSize:"1.05rem",fontWeight:800,color:"#a78bfa",fontFamily:"'JetBrains Mono',monospace"}}>
                      +{(metrics.recovery_percentage - 15).toFixed(0)}pts
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Receivables */}
          {recs.length>0&&(
            <motion.div variants={fade} style={{borderRadius:14,padding:"1.1rem 1.35rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.13em",color:"rgba(148,163,184,0.33)",fontWeight:800,marginBottom:"0.6rem"}}>📋 Receivables</div>
              {recs.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.5rem 0.6rem",borderRadius:8,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",marginBottom:5}}>
                  <div>
                    <div style={{fontSize:"0.7rem",fontWeight:600,color:"#e2e8f0",marginBottom:1}}>{r.customer_email}</div>
                    <div style={{fontSize:"0.58rem",color:"rgba(100,116,139,0.6)"}}>{r.promise_to_pay_date?.split("T")[0]??""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:"#34d399",fontFamily:"'JetBrains Mono',monospace"}}>₹{(r.amount/100).toLocaleString()}</div>
                    <span style={{fontSize:"0.55rem",textTransform:"uppercase",fontWeight:700,padding:"1px 5px",borderRadius:4,background:r.status==="promised"?"rgba(59,130,246,0.12)":"rgba(239,68,68,0.1)",color:r.status==="promised"?"#60a5fa":"#f87171"}}>{r.status}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* ─── TRACE FEED ─── */}
        <div>
          {/* Feed header */}
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <h2 style={{fontSize:"1.05rem",fontWeight:800,margin:0,color:"#f1f5f9",letterSpacing:"-0.015em"}}>Agent Reasoning Trace</h2>
              <span className="live-badge" style={{padding:"2px 9px",borderRadius:99,fontSize:"0.6rem",fontWeight:800,background:"rgba(16,185,129,0.1)",color:"#34d399",border:"1px solid rgba(16,185,129,0.22)",letterSpacing:"0.08em",textTransform:"uppercase"}}>● Live</span>
            </div>
            <div style={{display:"flex",gap:7,alignItems:"center"}}>
              {metrics.discounts>0   && <Tag color="#34d399" bg="rgba(16,185,129,0.1)"  brd="rgba(16,185,129,0.2)">{metrics.discounts} discount{metrics.discounts!==1?"s":""}</Tag>}
              {metrics.upi_retries>0 && <Tag color="#60a5fa" bg="rgba(59,130,246,0.1)"  brd="rgba(59,130,246,0.2)">{metrics.upi_retries} UPI</Tag>}
              {metrics.escalations>0 && <Tag color="#f87171" bg="rgba(239,68,68,0.1)"   brd="rgba(239,68,68,0.2)" >{metrics.escalations} escalated</Tag>}
              <span style={{fontSize:"0.67rem",color:"rgba(100,116,139,0.4)"}}>{logs.length} event{logs.length!==1?"s":""}</span>
            </div>
          </motion.div>

          {/* Empty state */}
          <AnimatePresence>
            {logs.length===0&&(
              <motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:280,gap:12,border:"1px dashed rgba(255,255,255,0.06)",borderRadius:16,background:"rgba(255,255,255,0.01)"}}>
                <motion.div animate={{y:[0,-7,0]}} transition={{repeat:Infinity,duration:3,ease:"easeInOut"}} style={{fontSize:"2rem",opacity:0.18}}>🤖</motion.div>
                <p style={{color:"rgba(100,116,139,0.45)",margin:0,fontSize:"0.82rem",fontWeight:500}}>No events yet</p>
                <p style={{color:"rgba(100,116,139,0.28)",margin:0,fontSize:"0.7rem"}}>Click "Run Batch Simulation" to watch the agent reason in real-time</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cards */}
          <div style={{display:"flex",flexDirection:"column",gap:"0.8rem",maxHeight:"82vh",overflowY:"auto",paddingRight:6,paddingBottom:"2rem"}}>
            <AnimatePresence mode="popLayout">
              {logs.map(log=>{
                const ac   = accent(log.action);
                const k    = String(log.id);
                const text = typed[k] ?? log.reasoning ?? "";
                const typing = done.current.has(k) && text.length < (log.reasoning?.length??0);

                return (
                  <motion.div key={log.id} variants={card} initial="hidden" animate="show" exit="exit" layout
                    whileHover={{y:-3,boxShadow:"0 20px 50px rgba(0,0,0,0.55),0 0 0 1px rgba(109,40,217,0.2)"}}
                    style={{
                      borderRadius:14,padding:"1.2rem 1.3rem",
                      background:"rgba(10,13,28,0.92)",
                      border:"1px solid rgba(255,255,255,0.07)",
                      position:"relative",overflow:"visible",
                    }}
                  >
                    {/* Accent bar */}
                    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:ac.bar,borderRadius:"14px 0 0 14px"}}/>

                    <div style={{paddingLeft:"0.55rem"}}>

                      {/* Row 1: badge + amount + stats */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.9rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{padding:"4px 10px",borderRadius:8,fontSize:"0.64rem",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",background:ac.bg,color:ac.color,border:`1px solid ${ac.border}`}}>
                            {log.action?.replace(/_/g," ")||"unknown"}
                          </span>
                          <span style={{fontSize:"1.2rem",fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:log.action?.includes("escalation")?"rgba(148,163,184,0.3)":"#34d399",letterSpacing:"-0.02em"}}>
                            ₹{((log.recovered_amount??0)/100).toLocaleString()}
                          </span>
                        </div>
                        <div style={{display:"flex",gap:10,fontSize:"0.68rem",fontFamily:"'JetBrains Mono',monospace",color:"rgba(100,116,139,0.5)",background:"rgba(0,0,0,0.4)",padding:"4px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.04)"}}>
                          <span>⏱ {log.latency_ms}ms</span>
                          <span style={{color:"rgba(255,255,255,0.06)"}}>|</span>
                          <span>🪙 ₹{(log.cost_usd*84).toFixed(3)}</span>
                        </div>
                      </div>

                      {/* ── INTERNAL MONOLOGUE — always fully visible ── */}
                      <div style={{
                        background:"#050810",
                        borderRadius:10,
                        borderLeft:`3px solid ${ac.bar}`,
                        padding:"1rem 1.1rem",
                        marginBottom: (log.customer_ltv!==undefined||log.payment_link_url) ? "0.85rem" : 0,
                      }}>
                        <div style={{fontSize:"0.57rem",textTransform:"uppercase",letterSpacing:"0.15em",color:ac.color,fontWeight:800,marginBottom:9,opacity:0.8}}>
                          ◈  Internal Monologue
                        </div>
                        <p style={{
                          fontSize:"0.93rem",
                          color:"#ffffff",
                          fontFamily:"'JetBrains Mono','Fira Code',monospace",
                          lineHeight:1.8,
                          margin:0,
                          wordBreak:"break-word",
                          whiteSpace:"pre-wrap",
                          minHeight:"1.6rem",
                        }}>
                          {text
                            ? <>{text}{typing&&<span className="cursor"/>}</>
                            : <span style={{color:"rgba(255,255,255,0.15)",fontStyle:"italic"}}>Reasoning…</span>
                          }
                        </p>
                      </div>

                      {/* Context chips */}
                      {log.customer_ltv!==undefined&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:"0.75rem"}}>
                          <Chip accent={log.customer_ltv>1000000}>{`LTV ₹${(log.customer_ltv/100).toLocaleString()}`}</Chip>
                          <Chip warn={log.customer_failed_attempts>=3}>{`${log.customer_failed_attempts} failure${log.customer_failed_attempts!==1?"s":""}`}</Chip>
                          {log.customer_fraud_flag&&<span style={{fontSize:"0.61rem",padding:"3px 9px",borderRadius:7,fontWeight:700,background:"rgba(245,158,11,0.12)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.22)"}}>⚠ Fraud Flag</span>}
                          {log.failure_reason&&<span style={{fontSize:"0.61rem",padding:"3px 9px",borderRadius:7,background:"rgba(255,255,255,0.03)",color:"rgba(148,163,184,0.4)",border:"1px solid rgba(255,255,255,0.04)"}}>{log.failure_reason}</span>}
                          {log.channel&&<span style={{fontSize:"0.61rem",padding:"3px 9px",borderRadius:7,fontWeight:700,background:log.channel==="whatsapp"?"rgba(37,211,102,0.1)":"rgba(59,130,246,0.1)",color:log.channel==="whatsapp"?"#25d366":"#60a5fa",border:`1px solid ${log.channel==="whatsapp"?"rgba(37,211,102,0.25)":"rgba(59,130,246,0.25)"}`}}>{log.channel==="whatsapp"?"📱 WhatsApp":"📧 Email"}</span>}
                        </div>
                      )}

                      {/* ── AI-Generated Recovery Message ── */}
                      {log.recovery_message&&(
                        <motion.div
                          initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.35,delay:0.1}}
                          style={{marginBottom:log.payment_link_url?"0.75rem":0,borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)"}}
                        >
                          {/* Header */}
                          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                            <span style={{fontSize:"0.7rem"}}>{log.channel==="whatsapp"?"📱":"📧"}</span>
                            <span style={{fontSize:"0.58rem",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.12em",color:"rgba(148,163,184,0.45)"}}>
                              {log.channel==="whatsapp"?"WhatsApp Recovery Message":"Email Recovery Message"}
                            </span>
                            <span style={{marginLeft:"auto",fontSize:"0.55rem",color:"rgba(148,163,184,0.25)",fontStyle:"italic"}}>AI-generated · not sent in demo</span>
                          </div>
                          {/* Message body — styled like a chat bubble */}
                          <div style={{padding:"10px 14px",background:log.channel==="whatsapp"?"rgba(18,45,18,0.7)":"rgba(10,20,45,0.7)"}}>
                            <p style={{margin:0,fontSize:"0.85rem",color:"#e8f5e9",lineHeight:1.65,fontFamily:"'Inter',sans-serif",fontWeight:400}}>
                              {log.recovery_message}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Payment link */}
                      {log.payment_link_url&&(
                        <motion.a href={log.payment_link_url} target="_blank" rel="noopener noreferrer"
                          whileHover={{y:-2,boxShadow:"0 0 24px rgba(16,185,129,0.3)"}} whileTap={{scale:0.97}}
                          style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:9,fontSize:"0.73rem",fontWeight:700,textDecoration:"none",background:"linear-gradient(135deg,rgba(16,185,129,0.16),rgba(109,40,217,0.1))",color:"#34d399",border:"1px solid rgba(16,185,129,0.3)",letterSpacing:"0.02em"}}>
                          🔗 Open Razorpay Payment Link <span style={{opacity:0.4,fontSize:"0.6rem"}}>↗</span>
                        </motion.a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mini helpers ── */
function Tag({children,color,bg,brd}:{children:React.ReactNode,color:string,bg:string,brd:string}){
  return <span style={{fontSize:"0.61rem",padding:"2px 8px",borderRadius:6,background:bg,color,border:`1px solid ${brd}`,fontWeight:700}}>{children}</span>;
}
function Chip({children,accent=false,warn=false}:{children:React.ReactNode,accent?:boolean,warn?:boolean}){
  const c=accent?"#34d399":warn?"#f87171":"rgba(148,163,184,0.5)";
  const bg=accent?"rgba(16,185,129,0.1)":warn?"rgba(239,68,68,0.1)":"rgba(100,116,139,0.07)";
  const bd=accent?"rgba(16,185,129,0.2)":warn?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.04)";
  return <span style={{fontSize:"0.61rem",padding:"3px 9px",borderRadius:7,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:c,background:bg,border:`1px solid ${bd}`}}>{children}</span>;
}
