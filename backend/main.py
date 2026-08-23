import os
import json
import uuid
import asyncio
from fastapi import FastAPI, Request, HTTPException, Header, Depends
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
    """Returns the recent recovery actions taken by the AI."""
    events = crud.get_recent_recovery_events(db, limit=20)
    return {"logs": [{"id": e.id, "amount": e.amount, "action": e.agent_action, "reasoning": e.agent_reasoning, "status": e.status} for e in events]}

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
    
    if event_type == "payment.failed":
        payment_data = payload_json["payload"]["payment"]["entity"]
        customer_email = payment_data.get("email")
        
        # 2. Fetch Customer Context from DB
        customer = crud.get_customer_by_email(db, customer_email)
        if not customer:
            customer_ltv = 0
        else:
            customer_ltv = customer.lifetime_value

        previous_failures = 0

        # 3. Trigger the AI Agent
        ai_response = agent.analyze_and_recover(payment_data, customer_ltv, previous_failures)
        
        # 4. Parse Action & Reasoning
        action_type = "unknown"
        reasoning = ""
        if ai_response["status"] == "success":
            action_data = ai_response.get("agent_action", {})
            action_type = action_data.get("action", "unknown")
            reasoning = action_data.get("reasoning", "")

        # 5. Persist to DB using CRUD layer
        crud.create_recovery_event(
            db=db,
            customer_id=customer.id if customer else None,
            razorpay_event_id=event_id,
            amount=payment_data.get("amount", 0),
            currency=payment_data.get("currency", "INR"),
            failure_reason=payment_data.get("error_description", ""),
            agent_action=action_type,
            agent_reasoning=reasoning,
            status="success" if action_type != "unknown" else "failed"
        )

