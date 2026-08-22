import os
import json
from fastapi import FastAPI, Request, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import razorpay_utils
import agent
from database import get_db
from models import Customer, RecoveryEvent

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
    events = db.query(RecoveryEvent).order_by(RecoveryEvent.created_at.desc()).limit(20).all()
    # Serialize for frontend
    return {"logs": [{"id": e.id, "amount": e.amount, "action": e.agent_action, "reasoning": e.agent_reasoning, "status": e.status} for e in events]}

@app.post("/api/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint for Razorpay webhooks.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing signature header")

    payload_body = await request.body()
    payload_str = payload_body.decode('utf-8')

    if os.getenv("RAZORPAY_WEBHOOK_SECRET"):
        is_valid = razorpay_utils.verify_webhook_signature(payload_str, x_razorpay_signature)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload_json = json.loads(payload_str)
    event_type = payload_json.get("event")

    if event_type == "payment.failed":
        payment_data = payload_json["payload"]["payment"]["entity"]
        customer_email = payment_data.get("email")
        
        # 1. Fetch Customer Context from DB
        customer = db.query(Customer).filter(Customer.email == customer_email).first()
        if not customer:
            # If unknown customer, use defaults
            customer_ltv = 0
            fraud_risk = False
        else:
            customer_ltv = customer.lifetime_value
            fraud_risk = customer.fraud_flag

        previous_failures = 0 # Mocked for now, in reality count events today

        # 2. Trigger the AI Agent
        ai_response = agent.analyze_and_recover(payment_data, customer_ltv, previous_failures)
        
        # 3. Parse Action & Reasoning
        action_type = "unknown"
        reasoning = ""
        if ai_response["status"] == "success":
            action_data = ai_response.get("agent_action", {})
            action_type = action_data.get("action", "unknown")
            reasoning = action_data.get("reasoning", "")

        # 4. Persist to DB
        new_event = RecoveryEvent(
            customer_id=customer.id if customer else None,
            amount=payment_data.get("amount"),
            currency=payment_data.get("currency"),
            failure_reason=payment_data.get("error_description"),
            agent_action=action_type,
            agent_reasoning=reasoning,
            status="intervention_sent" if action_type != "unknown" else "failed"
        )
        db.add(new_event)
        db.commit()

    return {"status": "ok"}

