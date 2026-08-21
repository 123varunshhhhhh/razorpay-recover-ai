# ⚡ Recover AI — Autonomous Revenue Recovery Agent

> Built for the **Razorpay Buildathon 2026** — *Track 03: AI Revenue Recovery*

Recover AI is an autonomous, agentic revenue recovery system that intercepts payment and subscription failures in real time. Rather than relying on static retry rules, Recover AI performs multi-branch causal reasoning over customer lifetime value (LTV), failure codes, and risk signals to execute optimal, bounded recovery interventions via Razorpay APIs.

---

## 🎯 The Problem

1. **Blind Retries:** Traditional dunning systems blindly retry cards at random intervals, causing customer fatigue and bank-level blocking.
2. **One-Size-Fits-All Interventions:** High-LTV customers who abandon checkouts receive the same generic email as low-intent one-off visitors.
3. **Lack of Reasoning Transparency:** Merchants have zero visibility into *why* an intervention was chosen or its cost-benefit tradeoff.

---

## 🚀 Key Innovations & "Hard-to-Beat" Architecture

### 1. 🧠 Multi-Strategy Agentic Decision Tree
The agent chooses between distinct, bounded recovery paths:
- **Insufficient Funds / Bank Downtime:** Generates and dispatches a 1-click Razorpay UPI Payment Link.
- **High-LTV Abandonment:** Dynamically authorizes a time-limited 5–10% discount link (strictly bounded by guardrails).
- **Repeated Failures / Anomaly:** Flags for human escalation and halts automated retries.
- **Low-LTV / Transient Error:** Schedules a silent mandate retry to preserve merchant margins.

### 2. 🛡️ Visible Guardrails & Operational Constraints
- **Discount Ceiling:** Hardcoded guardrail prevents the AI from exceeding a 10% discount under any circumstance.
- **Frequency Caps:** Enforces at most one discount authorization per customer per 30-day window.
- **Circuit Breakers:** High fraud risk or 3+ failures automatically triggers human escalation.

### 3. 🔬 Real-Time Reasoning Trace Panel
The merchant dashboard displays the agent's internal monologue in real-time alongside execution metrics (Latency: ~800ms, Cost: ~$0.0004/eval).

### 4. 🎛️ Counterfactual Demo Sandbox
Allows judges and reviewers to simulate varying failure scenarios live and observe adaptive decision-making in real time.

---

## 🏗️ System Architecture

```
                               ┌────────────────────────┐
                               │ Razorpay Webhook Event │
                               │   (payment.failed)     │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  FastAPI Webhook Node  │
                               │  - Signature Verify    │
                               │  - Context Enrichment  │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │   Gemini 1.5 Agent     │
                               │   - Multi-Tool Calling │
                               │   - Guardrail Check    │
                               └───────────┬────────────┘
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
    ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
    │  send_upi_link()    │     │ send_discount_link()│     │ flag_for_escalation │
    │  (Razorpay API)     │     │  (Max 10% Bounded)  │     │  (Human-in-the-Loop)│
    └─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## 💻 Tech Stack

- **Backend:** Python 3.11+, FastAPI, Razorpay Python SDK, `google-generativeai`
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Glassmorphism Design System
- **Testing & Verification:** Razorpay CLI Webhook Simulation

---

## 🛠️ Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- Razorpay Sandbox Account

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt # or install fastapi uvicorn razorpay google-generativeai python-dotenv
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Live Recovery Dashboard & Sandbox.

---

## 🧪 Testing with Razorpay CLI

Simulate webhook events directly from terminal:
```bash
# Trigger a failed payment event
razorpay webhook trigger payment.failed
```

---

## 📜 License
MIT License. Built for Razorpay Buildathon 2026.
