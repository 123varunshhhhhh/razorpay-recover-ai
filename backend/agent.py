import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
import razorpay_utils

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not set.")


# ---------------------------------------------------------------------------
# AGENT TOOLS (Multi-Strategy Decision Tree)
# ---------------------------------------------------------------------------

def send_upi_link(reasoning: str, customer_email: str, amount_in_paise: int) -> str:
    """
    Sends a standard UPI payment link to the customer. 
    Use this for insufficient funds or generic failures where the customer just needs to retry.
    """
    # In a real app, this would call razorpay_utils.create_payment_link
    return json.dumps({
        "action": "send_upi_link",
        "reasoning": reasoning,
        "details": f"Sent UPI link for {amount_in_paise/100} INR to {customer_email}"
    })

def send_discount_link(reasoning: str, customer_email: str, amount_in_paise: int, discount_percentage: int) -> str:
    """
    Sends a payment link with a discount applied.
    Use this ONLY for High-Value customers (LTV > 10,000 INR) who abandon carts or fail payments.
    WARNING/GUARDRAIL: Never exceed 10% discount.
    """
    if discount_percentage > 10:
        return json.dumps({"error": "Guardrail violated: Discount cannot exceed 10%."})
        
    discounted_amount = int(amount_in_paise * (1 - (discount_percentage / 100)))
    return json.dumps({
        "action": "send_discount_link",
        "reasoning": reasoning,
        "details": f"Sent {discount_percentage}% discount link for {discounted_amount/100} INR to {customer_email}"
    })

def flag_for_escalation(reasoning: str, customer_email: str, fraud_risk: bool) -> str:
    """
    Flags the customer for human review.
    Use this for repeated failures on the same card, or if fraud is suspected.
    """
    return json.dumps({
        "action": "flag_for_escalation",
        "reasoning": reasoning,
        "details": f"Escalated {customer_email} to human support. Fraud Risk: {fraud_risk}"
    })

def simple_retry(reasoning: str, customer_email: str) -> str:
    """
    Simply schedules a silent retry of the payment mandate.
    Use this for low-value customers or temporary bank downtimes where no discount or notification is needed.
    """
    return json.dumps({
        "action": "simple_retry",
        "reasoning": reasoning,
        "details": f"Scheduled silent retry for {customer_email}"
    })

tools = [send_upi_link, send_discount_link, flag_for_escalation, simple_retry]

# ---------------------------------------------------------------------------
# AGENT INITIALIZATION
# ---------------------------------------------------------------------------

if GEMINI_API_KEY:
    model = genai.GenerativeModel(
        model_name='gemini-1.5-pro-latest',
        tools=tools,
        system_instruction="""You are 'Recover AI', an intelligent financial agent for a merchant.
Your goal is to maximize revenue recovery while minimizing costs.

You will be provided with a payment failure event, including the customer's Lifetime Value (LTV).
Analyze the event and choose exactly ONE tool to execute the recovery strategy.

STRATEGY GUIDELINES:
1. Low LTV + Insufficient Funds -> Use send_upi_link or simple_retry. Do NOT give discounts.
2. High LTV (> 10000 INR) + Cart Abandonment/Failure -> Use send_discount_link (MAX 10%).
3. Repeated Failures or Suspected Fraud -> Use flag_for_escalation.

You MUST provide your detailed internal monologue in the `reasoning` parameter of the tool you call, explaining step-by-step why you chose that action based on the LTV and failure reason.
"""
    )
else:
    model = None

def analyze_and_recover(payment_data: dict, customer_ltv: int, previous_failures: int) -> dict:
    """
    Feeds the payment data + context to the Agent.
    """
    import time
    start_time = time.time()
    
    if not model:
        return {"error": "AI Agent not initialized (missing API key)"}

    prompt = f"""
    Event: Payment Failed
    - Amount: {payment_data.get('amount')} paise
    - Customer Email: {payment_data.get('email')}
    - Failure Reason: {payment_data.get('error_description')}
    - Customer LTV: {customer_ltv} INR
    - Previous Failures Today: {previous_failures}
    
    Analyze and execute the best recovery tool.
    """
    
    try:
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(prompt)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # The agent's tool call result is returned in response.parts if auto function calling succeeded.
        # We'll extract the JSON dumped by our tool functions.
        agent_action = None
        for part in chat.history:
            if part.role == 'model' and part.parts:
                for p in part.parts:
                    if p.function_call:
                        # We captured the function call, but we want the actual executed output
                        pass
            if part.role == 'user' and part.parts: # The SDK returns function responses as 'user' role
                for p in part.parts:
                    if p.function_response:
                        # Parse the JSON returned by our tool
                        agent_action = p.function_response.response
                        if hasattr(agent_action, 'to_dict'):
                            agent_action = agent_action.to_dict()

        # Fallback if we can't extract the structured tool response
        if not agent_action:
            agent_action = {"raw_text": response.text}

        return {
            "status": "success",
            "agent_action": agent_action,
            "metrics": {
                "latency_ms": latency_ms,
                "estimated_cost_usd": 0.0004 # Approximate cost per call
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }
