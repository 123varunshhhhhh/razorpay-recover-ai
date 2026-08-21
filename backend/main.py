import os
import json
from fastapi import FastAPI, Request, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import razorpay_utils
import agent

load_dotenv()

app = FastAPI(title="Recover AI API")

# Setup CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database for demo purposes (will upgrade to SQLite/PostgreSQL later)
recovery_logs = []


@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Recover AI Backend"}


@app.get("/api/logs")
def get_logs():
    """Returns the recent recovery actions taken by the AI."""
    return {"logs": recovery_logs}


@app.post("/api/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None)
):
    """
    Endpoint for Razorpay webhooks.
    We will use the Razorpay CLI to trigger 'payment.failed' events here.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing signature header")

    payload_body = await request.body()
    payload_str = payload_body.decode('utf-8')

    # For local development with the CLI, we might bypass signature verification 
    # if the secret isn't set, but in a real competition we must verify it.
    if os.getenv("RAZORPAY_WEBHOOK_SECRET"):
        is_valid = razorpay_utils.verify_webhook_signature(payload_str, x_razorpay_signature)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload_json = json.loads(payload_str)
    event_type = payload_json.get("event")

    # We are specifically interested in payment failures
    if event_type == "payment.failed":
        payment_data = payload_json["payload"]["payment"]["entity"]
        
        # Log the raw event
        recovery_logs.append({
            "event": "payment_failed",
            "amount": payment_data.get("amount"),
            "reason": payment_data.get("error_description"),
            "customer_id": payment_data.get("customer_id"),
            "contact": payment_data.get("contact"),
            "email": payment_data.get("email"),
            "status": "pending_analysis"
        })

        # In a real app, we would fetch these from the database
        # For the hackathon demo, we can mock them based on the email or pass static values
        # We will use this to show the "counterfactual sandbox" in the UI later
        customer_ltv = 42000  # High LTV example
        previous_failures = 0
        
        # Trigger the AI Agent to analyze and act
        ai_response = agent.analyze_and_recover(payment_data, customer_ltv, previous_failures)
        recovery_logs.append({"event": "ai_action", "details": ai_response})

    return {"status": "ok"}
