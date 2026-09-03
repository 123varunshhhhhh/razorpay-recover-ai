<div align="center">

# 🤖 Recover AI
### *Intelligent Revenue Recovery, Powered by Gemini*

**An autonomous AI agent that intercepts failed payments in real-time, reasons about the best recovery strategy per customer, and executes targeted actions — without any human intervention.**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-1.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Razorpay](https://img.shields.io/badge/Razorpay-Webhooks-02042B?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com)

</div>

---

## 📋 Table of Contents

1. [What Is Recover AI?](#-what-is-recover-ai)
2. [The Problem It Solves](#-the-problem-it-solves)
3. [Key Features](#-key-features)
4. [Tech Stack](#-tech-stack)
5. [System Architecture](#-system-architecture)
6. [How the AI Agent Works](#-how-the-ai-agent-works)
7. [Project Structure](#-project-structure)
8. [Quick Start](#-quick-start)
9. [Configuration](#-configuration)
10. [API Reference](#-api-reference)
11. [Demo Guide](#-demo-guide)
12. [Compliance & Guardrails](#-compliance--guardrails)
13. [Financial Accuracy](#-financial-accuracy)

---

## 💡 What Is Recover AI?

**Recover AI** is a fully autonomous, AI-powered payment recovery system built for merchants on the Razorpay platform. When a customer's payment fails, instead of doing nothing, Recover AI:

1. **Instantly intercepts** the failure via a Razorpay webhook
2. **Loads the customer's full profile** — their Lifetime Value (LTV), failure history, and fraud flags
3. **Feeds the context to a Gemini AI agent** that reasons like a senior revenue manager
4. **Executes the best possible recovery action** — a discount link for VIP customers, a standard UPI retry for regular customers, or an escalation flag for fraud suspects
5. **Logs everything** to a live, real-time dashboard with transparent AI reasoning

No human in the loop. No manual triage. Just autonomous intelligence working to recover every rupee.

---

## 🚨 The Problem It Solves

Every merchant loses revenue to failed payments. But the industry standard response is the same for everyone: a generic "payment failed" email and a hope that the customer retries.

This is wasteful. A ₹25,000 VIP customer who fails once deserves a completely different response than a suspected fraud account that has failed 4 times. Treating them the same loses money from both ends — either you give discounts to people who don't deserve them, or you lose high-value customers who needed a nudge.

**Recover AI solves this with a three-tier escalating intelligence strategy:**

| Customer Profile | AI Action | Business Logic |
|---|---|---|
| **High-LTV, 1st failure** | `SEND_DISCOUNT_LINK` | VIP save — prevent churn at all costs |
| **Low-LTV, any failure** | `SEND_UPI_LINK` | Cost-optimized retry — no margin given away |
| **3+ failures OR fraud flagged** | `FLAG_FOR_ESCALATION` | Deterministic fallback — never automate a bad actor |

By separating the probabilistic LLM layer from a strict deterministic fallback layer, we eliminate **false-positive costs** and guarantee safe financial execution.

---

## ✨ Key Features

### 🧠 AI-Powered Decision Making
- **Gemini-1.5-Flash Brain**: Uses the new `google-genai` SDK for low-latency, single-hop agentic reasoning.
- **AI Copywriting & Channel Selection**: The agent doesn't just decide the action; it writes the exact personalized WhatsApp or Email message the customer will receive based on urgency.
- **Graceful Fallback Engine**: If the Gemini API hits a rate limit or goes down during high traffic, the backend silently falls back to a deterministic rules engine that mimics the AI's logic, guaranteeing zero downtime.
- **Parallel Async Batch Simulation**: Sandbox scenarios process instantly using FastAPI `BackgroundTasks` and `asyncio.gather`, dramatically improving demo speed and UI responsiveness.
- **Deterministic Sandbox**: A built-in sandbox that lets you simulate curated failure scenarios (VIP failures, multi-strike repeat offenders, fraud) with one click to see the AI's varied responses in real-time.

### ⚡ Real-Time Webhook Processing
- Processes **Razorpay payment failure webhooks** in under 2 seconds average
- Built-in **idempotency protection** — duplicate webhook deliveries from Razorpay are silently deduplicated
- **Closed-loop recovery**: when the customer pays via the AI-sent link, Razorpay fires a `payment.captured` webhook and the dashboard immediately flips the event from *at-risk* to *recovered* — no manual refresh needed
- Structured **SQLite audit log** for every intervention

### 💰 Financially Honest Metrics & Telemetry
- **At-Risk Revenue** = the original cart value that was about to be lost
- **Recovered Revenue** = the *actual cash collected*, net of any discounts the AI chose to give
- Every decision logs rich **telemetry** (latency, API cost, reasoning trace) to a separate database column — the system never lies about margin cost.

### 🛡️ Compliance Guardrails (Code-Level)
- **Hard limit**: discounts cannot exceed 10% (enforced in Python, not just the prompt)
- **3-Strike Rule**: customers with 3+ failures are automatically escalated — automated outreach stops
- **Fraud Flag**: any customer marked `fraud_flag=True` is immediately escalated, no exceptions

### 🖥️ Live Dashboard
- Real-time **Agent Reasoning Trace** — a live feed of every AI decision as it happens
- **Counterfactual Sandbox** — 4 hand-crafted simulation buttons to demo specific scenarios
- **Upcoming Receivables** tracker for overdue B2B payments
- **One-click Database Reset** for clean, repeatable demos

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **AI Agent** | Google Gemini 3.5 Flash Lite | Fast, cheap, accurate function-calling in under 1.5 seconds |
| **Backend** | FastAPI (Python) | Async webhooks, automatic API docs, zero boilerplate |
| **Frontend** | Next.js 16 + TypeScript | React SSR, type safety, production-ready |
| **Database** | SQLite (via SQLAlchemy) | Zero-config, portable — perfect for a demo environment |
| **Payment Platform** | Razorpay Webhooks | Native Indian payment infrastructure |
| **Styling** | Vanilla CSS (dark glassmorphism) | Premium, zero-dependency UI |

---

## 🏗 System Architecture

### Design Decisions for Scale

We deliberately avoided bloated **multi-agent frameworks** and heavy **vector embeddings**. Payment webhooks require strict latency SLAs. By injecting rich SQL context directly into a single agent, we achieve extreme **token optimization**, keeping our context windows tiny, costs microscopic, and latency under 1.5 seconds.

```
┌─────────────────────────────────────────────────────────────────┐
│                       RECOVER AI SYSTEM                          │
│                                                                   │
│  ┌──────────────┐    Webhook     ┌──────────────────────────┐   │
│  │   Razorpay   │ ─────────────► │   FastAPI Backend        │   │
│  │   Platform   │                │   (main.py)              │   │
│  └──────────────┘                │                          │   │
│                                  │  1. Validates webhook    │   │
│  ┌──────────────┐                │  2. Loads customer from  │   │
│  │  Next.js     │  REST API      │     SQLite DB            │   │
│  │  Dashboard   │ ◄────────────► │  3. Calls AI Agent       │   │
│  │  (page.tsx)  │                │  4. Logs result to DB    │   │
│  └──────────────┘                └──────────┬───────────────┘   │
│                                             │                    │
│                                  ┌──────────▼───────────────┐   │
│                                  │   Gemini AI Agent        │   │
│                                  │   (agent.py)             │   │
│                                  │                          │   │
│                                  │  Tools available:        │   │
│                                  │  • send_upi_link         │   │
│                                  │  • send_discount_link    │   │
│                                  │  • flag_for_escalation   │   │
│                                  │  • simple_retry          │   │
│                                  │  • log_promise_to_pay    │   │
│                                  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow (Step by Step)

```
Payment Fails on Razorpay
        │
        ▼
Razorpay sends POST /api/webhook
        │
        ▼
FastAPI checks idempotency (already processed this event?)
        │ No
        ▼
Load Customer from DB (email lookup)
        │
        ▼
Call agent.analyze_and_recover(payment_data, ltv, failures)
        │
        ▼
Gemini returns a FunctionCall (e.g., send_discount_link)
        │
        ▼
FastAPI intercepts → runs Python function locally → parses JSON
        │
        ▼
Write RecoveryEvent to DB (amount, recovered_amount, action, reasoning)
        │
        ▼
Frontend polls /api/logs → Live trace card appears in UI
```

---

## 🧠 How the AI Agent Works

### The Core Concept: Function Calling

Gemini doesn't just generate text — it's given a set of Python **tools** and asked to pick the right one. Think of it like giving a very smart employee a rulebook and a set of buttons to press.

```python
# These are the "buttons" the AI can press
tools = [
    send_upi_link,        # Standard payment retry link
    send_discount_link,   # Payment link with % discount applied
    flag_for_escalation,  # Hand off to a human for review
    simple_retry,         # Silent background retry
    log_promise_to_pay,   # Record a B2B promise-to-pay date
]
```

### The Prompt

The AI receives a structured prompt for every payment failure:

```
Event: Payment Failed
- Amount: 2500000 paise
- Customer Email: vip@corp.com
- Failure Reason: Insufficient Funds
- Customer LTV: 25000 INR
- Session Failures Today: 0
- Lifetime Failed Attempts: 0 (CRITICAL: If >= 3, you MUST escalate)

Analyze and execute the best recovery tool.
```

### The Latency Optimization

The standard Gemini SDK forces **two** network round-trips. We skip the second one entirely by intercepting the FunctionCall locally:

```python
# OPTIMIZED: Single-hop interception
response = model.generate_content(prompt)

for part in response.parts:
    if part.function_call:
        tool_name = part.function_call.name
        args = dict(part.function_call.args)
        func = globals().get(tool_name)    # Find the Python function
        result = func(**args)              # Run it locally — NO second API call
        agent_action = json.loads(result)
        break
```

This cuts latency **in half**. Observed typical range is **1.5–3s** per call under normal conditions, with occasional variance on the free-tier Gemini API (rate-limit backoff can spike to 5–7s on burst runs).

---

## 📁 Project Structure

```
Buildathon/
│
├── README.md                    # You are here
│
├── backend/                     # Python FastAPI server
│   ├── main.py                  # 🎯 Central API — all endpoints & webhook logic
│   ├── agent.py                 # 🧠 Gemini AI agent — tools & inference engine
│   ├── models.py                # 🗄️ SQLAlchemy database models
│   ├── crud.py                  # 📊 Database operations & metrics calculations
│   ├── database.py              # 🔌 Database connection & session management
│   ├── seed.py                  # 🌱 Test data initialization script
│   ├── razorpay_utils.py        # 💳 Razorpay API helper functions
│   ├── .env                     # 🔑 API keys (NOT committed to git)
│   └── .env.example             # 📝 Template for required environment variables
│
└── frontend/                    # Next.js TypeScript dashboard
    ├── src/app/
    │   ├── page.tsx             # 🖥️ Main dashboard — all UI & state management
    │   ├── layout.tsx           # Root layout & global metadata
    │   └── globals.css          # Global styles & design tokens
    ├── package.json
    └── next.config.js
```

---

## 🧪 Evaluation Harness (Does it run?)

This repository includes a deterministic evaluation harness to prove execution safety.

```bash
# Run the evaluation harness
pytest backend/tests/
```
The test suite validates 23 edge cases, including idempotency, guardrail enforcement, and financial math correctness.

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **A Gemini API Key** — [Get one free](https://aistudio.google.com/app/apikey)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/123varunshhhhhh/razorpay-recover-ai.git
cd razorpay-recover-ai
```

### Step 2: Set Up the Backend

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install fastapi uvicorn sqlalchemy google-generativeai python-dotenv razorpay

# Create your .env file from the template
copy .env.example .env         # Windows
# cp .env.example .env         # Mac/Linux
```

### Step 3: Add Your API Key

Open `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=AIza...your_key_here
RAZORPAY_KEY_ID=rzp_test_...      # Optional, for live payment links
RAZORPAY_KEY_SECRET=...           # Optional
RAZORPAY_WEBHOOK_SECRET=...       # Optional
```

### Step 4: Initialize the Database

```bash
python seed.py
# Output: Database seeded successfully.
```

### Step 5: Start the Backend

```bash
uvicorn main:app --reload
# Running on http://127.0.0.1:8000
```

### Step 6: Start the Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

### Step 7: Open the Dashboard

Go to **[http://localhost:3000](http://localhost:3000)** 🎉

---

## ⚙️ Configuration

### Test Customer Profiles

**Sandbox Pool** (individual button clicks):

| Email | LTV | Fraud Flag | Attempts | Expected AI Action |
|---|---|---|---|---|
| `vip@corp.com` | ₹15,000 | No | 0 | `send_discount_link` |
| `new@user.com` | ₹500 | No | 0 | `send_upi_link` |
| `anon@sus.com` | ₹0 | **Yes** | 0 | `flag_for_escalation` |
| `repeat_offender@spam.com` | ₹2,000 | No | **3** | `flag_for_escalation` |

**Batch Pool** (the "Run Batch Simulation" button):

| Email | LTV | Profile | Expected AI Action |
|---|---|---|---|
| `batch_1_vip@corp.com` | ₹25,000 | VIP | `send_discount_link` → ₹22,500 |
| `batch_2_standard@user.com` | ₹300 | Low-LTV | `send_upi_link` → ₹500 |
| `batch_3_fraud@sus.com` | ₹100 | Fraud | `flag_for_escalation` → ₹0 |
| `batch_4_repeat@spam.com` | ₹500 | 3-strikes | `flag_for_escalation` → ₹0 |

---

## 📡 API Reference

All endpoints run at `http://127.0.0.1:8000`. Visit `/docs` for interactive Swagger UI.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/logs` | Recent AI recovery actions |
| `GET` | `/api/metrics` | Dashboard headline numbers |
| `GET` | `/api/receivables` | Overdue B2B receivables |
| `POST` | `/api/webhook` | Razorpay webhook receiver |
| `POST` | `/api/sandbox/simulate` | Fire a single test scenario |
| `POST` | `/api/sandbox/batch_simulate` | Fire all 4 scenarios |
| `POST` | `/api/sandbox/reset_db` | Wipe & re-seed the database |

### Example: `/api/metrics` Response

```json
{
  "at_risk_amount": 4010000,
  "recovered_amount": 2300000,
  "recovery_percentage": 57.4
}
```

> **Note:** Values reflect a representative post-batch-run state. At-risk is the sum of all failed event amounts; recovered is the net cash collected after any AI-applied discounts.

> All monetary values are in **paise** (1 INR = 100 paise). Divide by 100 to get INR.

---

## 🎬 Running a Demo — Step-by-Step Walkthrough

### Recommended Evaluation Sequence

**Setup (5s):** Click **"Reset Database (Demo Prep)"** — starts completely clean.

**Trigger (5s):** Click **"Run Batch Simulation"** — fires 4 AI decisions simultaneously.

**Narrate each card as it appears:**

1. **`FLAG_FOR_ESCALATION ₹0`** — *"4 lifetime failures. The AI halts automation and flags for human review. No phantom revenue attached."*

2. **`FLAG_FOR_ESCALATION ₹0`** — *"Issuer fraud flag. AI escalates instantly — zero automated outreach on a suspicious account."*

3. **`SEND_UPI_LINK ₹500`** — *"Low-LTV customer. Cost-optimized retry. The AI knows this customer isn't worth burning a discount on."*

4. **`SEND_DISCOUNT_LINK ₹22,500`** — *"₹25,000 VIP, first failure. The AI identifies the high value and applies a 10% discount to save the sale. The ₹22,500 is the actual cash collected — net of discount, not the gross order value."*

**Close:** *"0 + 0 + 500 + 22,500 = ₹23,000 recovered. Verified from the trace, not just claimed."*

---

### Key Talking Points

| Question | Answer |
|---|---|
| "Is ₹22,500 the discount or the sale?" | "That's the recovered transaction value — the AI applied 10% discount internally to save it." |
| "Why is one LTV ₹300?" | "Deliberately low — to prove the AI exercises cost-discipline and won't waste a discount on a low-value customer." |
| "How is the latency so low?" | "Single-hop inference — we intercept the AI's function call locally and skip the second cloud round-trip entirely." |
| "What stops the AI from giving a 50% discount?" | "A Python guardrail in the function itself. The code rejects any discount over 10%, regardless of what the AI requests." |

---

## 🛡️ Compliance & Guardrails

Recover AI has **three layers** of protection:

### Layer 1: System Prompt
AI instructed to never exceed 10% discount and always escalate on 3+ failures.

### Layer 2: Python Code (Hard Enforcement)
```python
def send_discount_link(discount_percentage: int, ...) -> str:
    if discount_percentage > 10:
        # Even if the AI requests 50%, this line stops it. In Python.
        return json.dumps({"error": "Guardrail violated: Discount cannot exceed 10%."})
```

### Layer 3: Audit Trail
Every action is logged permanently with timestamp, AI reasoning, at-risk amount, and actual recovered amount. The ledger is immutable.

---

## 💹 Financial Accuracy

The key design decision: **At-Risk Amount and Recovered Amount are separate database columns.**

```python
# models.py
amount           = Column(Integer)  # Original at-risk cart value (never changes)
recovered_amount = Column(Integer)  # Actual cash collected after AI action
```

**Example walkthrough:**
- VIP customer's payment of ₹25,000 fails → `amount = 2,500,000` paise
- AI applies 10% discount → `recovered_amount = 2,250,000` paise (₹22,500)
- `FLAG_FOR_ESCALATION` events always get → `recovered_amount = 0`

**Metrics query:**
```python
# At-Risk: what we stood to lose (all events)
at_risk = SUM(recovery_events.amount)

# Recovered: what actually landed (successful events only, discounted)
recovered = SUM(recovery_events.recovered_amount) WHERE status = 'success'
```

This means the recovery percentage can never be inflated by counting pre-discount cart values as revenue.

---

## 📈 Path to Production

While this repository is optimized for quick local evaluation, deploying Recover AI to Razorpay's production environment requires the following architectural upgrades:

1. **Decoupled Queueing**: Move webhook ingestion from synchronous FastAPI to an asynchronous **Kafka or Redis/Celery** queue to handle burst traffic during flash sales without blocking Razorpay's webhook delivery.
2. **Database Migration**: Swap SQLite for **PostgreSQL** with `asyncpg` to handle high-concurrency read/writes without locking.
3. **LLM Fault Tolerance**: Implement **Exponential Backoff** and a Dead-Letter Queue. If the Gemini API rate limits or fails, the system must deterministically default to a safe `send_upi_link` fallback.
4. **Zero-Trust Security**: Add strict cryptographic signature verification on the webhook endpoint and JWT auth for the dashboard API.

---

<div align="center">

**Built for the Razorpay Buildathon 2026**

*by Varun*

</div>
