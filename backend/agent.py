import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
import razorpay_utils

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
if not GEMINI_API_KEY:
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
# AGENT CONFIG
# ---------------------------------------------------------------------------

MODEL_NAME = "gemini-2.0-flash"

SYSTEM_INSTRUCTION = """You are 'Recover AI', an intelligent financial agent for a merchant.
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

def analyze_and_recover(payment_data: dict, customer_ltv: int, previous_failures: int, failed_attempts_count: int) -> dict:
    """
    Feeds the payment data + context to the Gemini Agent.
    Uses the google-genai SDK with manual function-call parsing (single-hop, no second LLM round-trip).
    """
    import time
    start_time = time.time()

    if not _client:
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
        # Single-hop inference: manually parse the function_call instead of
        # using automatic_function_calling, which would add a second round-trip.
        response = _client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=tools,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )

        latency_ms = int((time.time() - start_time) * 1000)
        
        agent_action = None
        candidate = response.candidates[0] if response.candidates else None
        if candidate:
            for part in candidate.content.parts:
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
            raw_text = ""
            try:
                raw_text = response.text
            except Exception:
                pass
            agent_action = {"action": "unknown", "reasoning": "Failed to extract action from AI", "raw_text": raw_text}

        estimated_cost_usd = 0.0004
        try:
            um = response.usage_metadata
            if um:
                in_tokens  = um.prompt_token_count or 0
                out_tokens = um.candidates_token_count or 0
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
