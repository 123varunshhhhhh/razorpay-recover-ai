# Contributing to Recover AI

Thank you for your interest in Recover AI! This document outlines how to contribute to the project.

---

## Project Structure

```
Buildathon/
├── backend/           # FastAPI + Gemini AI agent
│   ├── agent.py       # Core AI agent with function-calling tools
│   ├── main.py        # API routes + webhook handler
│   ├── crud.py        # Database operations
│   ├── models.py      # SQLAlchemy models
│   ├── seed.py        # Demo data seeder
│   └── tests/         # pytest suite (47 tests)
└── frontend/          # Next.js dashboard
    └── src/app/
        ├── page.tsx   # Main dashboard (Framer Motion)
        └── globals.css
```

---

## Local Development Setup

### Backend

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # Add your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

All 47 tests must pass before submitting a PR.

---

## Guardrail Rules (Do Not Break)

The following business rules are enforced in `agent.py` and tested in `test_core.py`:

| Rule | Enforcement |
|---|---|
| Max discount: 10% | Hard-coded check in `send_discount_link()` |
| Stop on 3+ failures | Prompt instruction + `test_guardrail_escalation_on_3_strikes` |
| Fraud flag → escalate | Prompt instruction + `test_guardrail_escalation_on_fraud` |

Any PR that changes these values will fail CI.

---

## Commit Style

Follow conventional commits:

```
feat: add new recovery tool
fix: correct LTV unit from paise to INR
docs: update README with new API endpoint
chore: update dependencies
test: add edge case for malformed webhook
```

---

## Reporting Issues

Open a GitHub Issue with:
1. What you expected
2. What actually happened
3. Steps to reproduce

---

## License

This project is for the Razorpay AI Buildathon. All rights reserved.
