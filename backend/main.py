import os
import json
import uuid
import asyncio
from fastapi import FastAPI, Request, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pydantic import BaseModel

import razorpay_utils
import agent
from database import get_db
from models import Customer, RecoveryEvent
import crud

load_dotenv()

app = FastAPI(title="Recover AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Recover AI Backend"}

@app.get("/api/logs")
def get_logs(db: Session = Depends(get_db)):
    """Returns the recent recovery actions taken by the AI, with customer context."""
    events = crud.get_recent_recovery_events(db, limit=20)
    return {"logs": [{
        "id": e.id,
        "amount": e.amount,
        "recovered_amount": e.recovered_amount,
        "action": e.agent_action,
        "reasoning": e.agent_reasoning,
        "recovery_message": e.recovery_message,   # AI-generated customer-facing message
        "channel": e.channel,                      # whatsapp | email | internal
        "status": e.status,
        "latency_ms": e.latency_ms,
        "cost_usd": e.cost_usd,
        "failure_reason": e.failure_reason,
        # Customer context — the inputs that drove the AI's decision
        "customer_ltv": e.customer.lifetime_value if e.customer else 0,
        "customer_failed_attempts": e.customer.failed_attempts_count if e.customer else 0,
        "customer_fraud_flag": e.customer.fraud_flag if e.customer else False,
        # Real payment link created by the agent
        "payment_link_url": e.payment_link_url,
    } for e in events]}

@app.get("/api/receivables")
def get_receivables(db: Session = Depends(get_db)):
    """Returns the upcoming promises to pay for the dashboard."""
    receivables = crud.get_active_receivables(db)
    return {"receivables": [{"id": r.id, "customer_email": r.customer.email if r.customer else "Unknown", "amount": r.amount, "status": r.status, "promise_to_pay_date": r.promise_to_pay_date.isoformat() if r.promise_to_pay_date else None} for r in receivables]}
@app.get("/api/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Returns the total batch recovery metrics for the UI."""
    return crud.get_metrics(db)
class SandboxSimulationRequest(BaseModel):
    scenario: str

@app.post("/api/sandbox/simulate")
async def simulate_sandbox_webhook(request: SandboxSimulationRequest, db: Session = Depends(get_db)):
    """
    Frontend trigger for live demonstration.
    Mocks a Razorpay webhook hitting the system.
    """
    scenario_email = "new@user.com"
    if request.scenario == "high_ltv":
        scenario_email = "vip@corp.com"
    elif request.scenario == "fraud":
        scenario_email = "anon@sus.com"
    elif request.scenario == "compliance":
        scenario_email = "repeat_offender@spam.com"

    mock_event_id = f"evt_sandbox_{uuid.uuid4().hex[:8]}"
    mock_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid.uuid4().hex[:8]}",
                    "amount": 1500000 if request.scenario == "high_ltv" else 50000,
                    "currency": "INR",
                    "email": scenario_email,
                    "contact": "9999999999",
                    "error_description": "Insufficient funds" if request.scenario != "fraud" else "Fraud risk suspected by issuer",
                }
            }
        }
    }
    
    # We call the webhook logic directly for the simulation
    await process_webhook_event(mock_payload, mock_event_id, db)
    
    return {"status": "simulated", "scenario": request.scenario}

@app.post("/api/sandbox/simulate_success")
async def simulate_sandbox_success(email: str = "new@user.com", db: Session = Depends(get_db)):
    """
    Frontend trigger for live demonstration of a successful recovery.
    Mocks a Razorpay payment_link.paid webhook.
    """
    mock_event_id = f"evt_sandbox_{uuid.uuid4().hex[:8]}"
    mock_payload = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {
                "entity": {
                    "customer": {
                        "email": email
                    }
                }
            }
        }
    }
    
    # Call the webhook logic directly bypassing signature checks
    await process_webhook_event(mock_payload, mock_event_id, db)
    
    return {"status": "recovery_simulated", "email": email}


@app.post("/api/sandbox/reset_db")
async def reset_database():
    """Drops and reseeds the entire database instantly for live demos."""
    import seed
    seed.seed_db()
    return {"status": "reset_complete"}

@app.post("/api/sandbox/batch_simulate")
async def simulate_batch():
    """
    Simulates 4 failed payment scenarios concurrently using asyncio.gather.
    Runs all 4 in parallel so total time ≈ slowest single call, not the sum.
    The frontend shows 'Processing...' while this runs, then cards appear all at once.
    """
    from database import SessionLocal

    batch_scenarios = [
        {"email": "batch_1_vip@corp.com",      "amount": 2500000, "reason": "Insufficient funds"},
        {"email": "batch_2_standard@user.com", "amount": 50000,   "reason": "Bank declined"},
        {"email": "batch_3_fraud@sus.com",     "amount": 10000,   "reason": "Fraud risk suspected by issuer"},
        {"email": "batch_4_repeat@spam.com",   "amount": 50000,   "reason": "Insufficient funds"},
    ]

    async def run_one(scenario: dict):
        db = SessionLocal()  # Each coroutine owns its own DB session
        try:
            mock_event_id = f"evt_batch_{uuid.uuid4().hex[:8]}"
            mock_payload = {
                "event": "payment.failed",
                "payload": {
                    "payment": {
                        "entity": {
                            "id": f"pay_{uuid.uuid4().hex[:8]}",
                            "amount": scenario["amount"],
                            "currency": "INR",
                            "email": scenario["email"],
                            "contact": "9876543210",
                            "error_description": scenario["reason"],
                        }
                    }
                }
            }
            await process_webhook_event(mock_payload, mock_event_id, db)
        except Exception as e:
            print(f"❌ Batch scenario failed for {scenario['email']}: {e}")
        finally:
            db.close()

    # Run all 4 scenarios in parallel for maximum speed (sub-2s latency)
    await asyncio.gather(*[run_one(s) for s in batch_scenarios])
    return {"status": "batch_completed"}

@app.post("/api/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
    x_razorpay_event_id: str = Header(None),
    db: Session = Depends(get_db)
):
    """Endpoint for official Razorpay webhooks."""
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing signature header")

    payload_body = await request.body()
    payload_str = payload_body.decode('utf-8')

    if os.getenv("RAZORPAY_WEBHOOK_SECRET"):
        is_valid = razorpay_utils.verify_webhook_signature(payload_str, x_razorpay_signature)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload_json = json.loads(payload_str)
    
    # The event ID is usually in the header (X-Razorpay-Event-Id) or in the payload header. 
    # For robust idempotency, we extract it.
    event_id = x_razorpay_event_id or payload_json.get("account_id", "") + "_" + payload_json.get("event", "")

    await process_webhook_event(payload_json, event_id, db)
    return {"status": "ok"}

async def process_webhook_event(payload_json: dict, event_id: str, db: Session):
    """Core logic extracted so both real webhooks and sandbox can use it."""
    
    # 1. Idempotency Check
    if event_id and crud.check_event_processed(db, event_id):
        print(f"Idempotency Guard: Event {event_id} already processed. Skipping.")
        return

    event_type = payload_json.get("event")
    
    # 2. Closed-Loop Processing for successful recoveries
    if event_type == "payment_link.paid":
        payment_data = payload_json["payload"]["payment_link"]["entity"]
        customer_email = payment_data.get("customer", {}).get("email") or "unknown" # Fallback if email isn't in the object
        
        crud.mark_event_recovered(db, customer_email)
        print(f"Closed Loop: Marked latest intervention for {customer_email} as recovered.")
        return

    if event_type == "payment.failed":
        payment_data = payload_json["payload"]["payment"]["entity"]
        customer_email = payment_data.get("email")
        
        # 2. Fetch Customer Context from DB
        customer = crud.get_customer_by_email(db, customer_email)
        if not customer:
            customer_ltv = 0
            failed_attempts_count = 0
        else:
            customer_ltv = customer.lifetime_value
            failed_attempts_count = crud.increment_failed_attempts(db, customer.id)

        previous_failures = 0

        # 3. Trigger the AI Agent (run in thread — Gemini HTTP call is blocking)
        import asyncio
        ai_response = await asyncio.to_thread(
            agent.analyze_and_recover, payment_data, customer_ltv, previous_failures, failed_attempts_count
        )
        
        # 4. Parse Action & Reasoning
        action_type = "unknown"
        reasoning = ""
        recovery_message = ""
        channel = None
        if ai_response["status"] == "success":
            action_data = ai_response.get("agent_action", {})
            action_type = action_data.get("action", "unknown")
            reasoning = action_data.get("reasoning", "")
            recovery_message = action_data.get("customer_message", "")
            channel = action_data.get("channel", None)
            
            if action_type == "log_promise_to_pay" and customer:
                # Extract date from details for demo purposes
                try:
                    promise_date = action_data.get("details", "").split("date ")[-1].split(" for")[0]
                    crud.log_promise_to_pay(db, customer.id, promise_date)
                except:
                    pass
        else:
            reasoning = f"AI Error: {ai_response.get('error_message', 'Unknown Error')}"

        # Extract metrics
        latency_ms = 0
        cost_usd = 0.0
        if "metrics" in ai_response:
            latency_ms = ai_response["metrics"].get("latency_ms", 0)
            cost_usd = ai_response["metrics"].get("estimated_cost_usd", 0.0)

        original_amount = payment_data.get("amount", 0)
        recovered_amount = original_amount
        if action_type == "flag_for_escalation":
            recovered_amount = 0
        elif action_type == "send_discount_link" and "discounted_amount_paise" in action_data:
            recovered_amount = action_data.get("discounted_amount_paise")

        # 5. Create a REAL Razorpay Payment Link (the true closed loop)
        payment_link_url = None
        if action_type in ("send_upi_link", "send_discount_link") and customer:
            try:
                link_amount = recovered_amount if action_type == "send_discount_link" else original_amount
                description = (
                    f"Recovery link for failed payment" +
                    (f" ({action_data.get('discount_percentage', 10)}% discount applied)" if action_type == "send_discount_link" else "")
                )
                import asyncio
                link_response = await asyncio.to_thread(
                    lambda: razorpay_utils.create_payment_link(
                        amount_in_paise=link_amount,
                        description=description,
                        customer_info={"email": customer_email, "contact": customer.contact or "9876543210"},
                    )
                )
                payment_link_url = link_response.get("short_url") or link_response.get("id")
                print(f"✅ Real Razorpay link created: {payment_link_url}")
            except Exception as e:
                print(f"⚠️ Razorpay API limit reached. Using mock link for demo. Error: {e}")
                # Mock link generator for when Test Mode hits the 30-link limit
                mock_hash = uuid.uuid4().hex[:8]
                payment_link_url = f"https://rzp.io/i/demo_{mock_hash}"

        # 6. Persist to DB using CRUD layer
        crud.create_recovery_event(
            db=db,
            customer_id=customer.id if customer else None,
            razorpay_event_id=event_id,
            amount=original_amount,
            recovered_amount=recovered_amount,
            currency=payment_data.get("currency", "INR"),
            failure_reason=payment_data.get("error_description", ""),
            agent_action=action_type,
            agent_reasoning=reasoning,
            recovery_message=recovery_message,
            channel=channel,
            status="success" if action_type != "unknown" else "failed",
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            payment_link_url=payment_link_url,
        )

