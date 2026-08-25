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
        "discounted_amount_paise": discounted_amount,
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

def log_promise_to_pay(reasoning: str, customer_email: str, promised_date_iso: str) -> str:
    """
    Logs a promise-to-pay date for an overdue receivable.
    Use this when the user indicates they will pay by a certain date.
    """
    return json.dumps({
        "action": "log_promise_to_pay",
        "reasoning": reasoning,
        "details": f"Logged promise-to-pay date {promised_date_iso} for {customer_email}"
    })

tools = [send_upi_link, send_discount_link, flag_for_escalation, simple_retry, log_promise_to_pay]

# ---------------------------------------------------------------------------
# AGENT INITIALIZATION
# ---------------------------------------------------------------------------

if GEMINI_API_KEY:
    model = genai.GenerativeModel(
        model_name='gemini-3.5-flash-lite',
        tools=tools,
        system_instruction="""You are 'Recover AI', an intelligent financial agent for a merchant.
Your goal is to maximize revenue recovery while minimizing costs.

You will be provided with a payment failure event, including the customer's Lifetime Value (LTV).
Analyze the event and choose exactly ONE tool to execute the recovery strategy.

COMPLIANCE & GUARDRAILS (STRICT):
- If the customer has 3 or more failed attempts, you MUST use `flag_for_escalation` and stop automated outreach.

STRATEGY GUIDELINES:
1. Low LTV + Insufficient Funds -> Use send_upi_link or simple_retry. Do NOT give discounts.
2. High LTV (> 10000 INR) + Cart Abandonment/Failure -> Use send_discount_link (MAX 10%).
3. Overdue Receivables / Promise to pay -> Use log_promise_to_pay with the provided ISO date.
4. Repeated Failures (>= 3) or Suspected Fraud -> Use flag_for_escalation.

You MUST provide your internal monologue in the `reasoning` parameter. Be extremely concise and punchy. Do not use repetitive boilerplate phrases like "Per the strict compliance guardrails...". Just state the logic directly (e.g. "LTV is 50K, customer is VIP. Sending 10% discount to prevent churn." or "3+ strikes reached. Escalating immediately.")
"""
    )
else:
    model = None

def analyze_and_recover(payment_data: dict, customer_ltv: int, previous_failures: int, failed_attempts_count: int) -> dict:
    """
    Feeds the payment data + context to the Agent.
    """
    import time
    start_time = time.time()
    
    if not model:
        return {"status": "error", "error_message": "AI Agent not initialized. Please add GEMINI_API_KEY to backend/.env"}

    prompt = f"""
    Event: Payment Failed
    - Amount: {payment_data.get('amount')} paise
    - Customer Email: {payment_data.get('email')}
    - Failure Reason: {payment_data.get('error_description')}
    - Customer LTV: {customer_ltv / 100} INR
    - Session Failures Today: {previous_failures}
    - Lifetime Failed Attempts: {failed_attempts_count} (CRITICAL: If >= 3, you MUST escalate)
    
    Analyze and execute the best recovery tool.
    """
    
    try:
        # We DO NOT use enable_automatic_function_calling=True because that forces the SDK
        # to execute the function and send the result back to Gemini for a second round-trip.
        # By manually parsing the first function_call, we cut latency in HALF.
        response = model.generate_content(prompt)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        agent_action = None
        for part in response.parts:
            if part.function_call:
                tool_name = part.function_call.name
                args = dict(part.function_call.args)
                
                # Dynamically call the corresponding Python function in this module
                func = globals().get(tool_name)
                if func:
                    raw_json_str = func(**args)
                    agent_action = json.loads(raw_json_str)
                    break

        # Fallback if we can't extract the structured tool response
        if not agent_action:
            agent_action = {"action": "unknown", "reasoning": "Failed to extract action from AI", "raw_text": response.text}

        estimated_cost_usd = 0.0004
        try:
            if hasattr(response, 'usage_metadata'):
                in_tokens = response.usage_metadata.prompt_token_count
                out_tokens = response.usage_metadata.candidates_token_count
                estimated_cost_usd = (in_tokens * 0.000000075) + (out_tokens * 0.00000030)
        except Exception:
            pass

        return {
            "status": "success",
            "agent_action": agent_action,
            "metrics": {
                "latency_ms": latency_ms,
                "estimated_cost_usd": estimated_cost_usd
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }
