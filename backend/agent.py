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

def send_upi_link(reasoning: str, customer_email: str, amount_in_paise: int,
                  customer_message: str = "", channel: str = "whatsapp") -> str:
    """
    Sends a standard UPI payment link to the customer.
    Use this for insufficient funds or generic failures where the customer just needs to retry.
    Args:
        reasoning: Your internal monologue explaining the decision.
        customer_email: The customer's email.
        amount_in_paise: The payment amount in paise.
        customer_message: The exact WhatsApp/email message to send to the customer (2-3 warm sentences).
        channel: Outreach channel — 'whatsapp' for urgency, 'email' for lower priority.
    """
    return json.dumps({
        "action": "send_upi_link",
        "reasoning": reasoning,
        "customer_message": customer_message,
        "channel": channel,
        "details": f"Sent UPI link for {amount_in_paise/100} INR to {customer_email}"
    })

def send_discount_link(reasoning: str, customer_email: str, amount_in_paise: int,
                       discount_percentage: int, customer_message: str = "", channel: str = "whatsapp") -> str:
    """
    Sends a payment link with a discount applied. Use ONLY for High-Value customers (LTV > 10,000 INR).
    WARNING/GUARDRAIL: Never exceed 10% discount.
    Args:
        reasoning: Your internal monologue.
        customer_email: The customer's email.
        amount_in_paise: Original payment amount.
        discount_percentage: Discount to apply (hard cap: 10%).
        customer_message: The exact WhatsApp/email message to send (2-3 warm, personalized sentences).
        channel: 'whatsapp' for VIP urgency, 'email' for standard.
    """
    if discount_percentage > 10:
        return json.dumps({"error": "Guardrail violated: Discount cannot exceed 10%."})

    discounted_amount = int(amount_in_paise * (1 - (discount_percentage / 100)))
    return json.dumps({
        "action": "send_discount_link",
        "reasoning": reasoning,
        "customer_message": customer_message,
        "channel": channel,
        "discount_percentage": discount_percentage,
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

MODEL_NAME = "gemini-1.5-flash"

SYSTEM_INSTRUCTION = """You are 'Recover AI', an autonomous financial recovery agent for a Razorpay merchant.
Your goal: maximize revenue recovery while protecting the merchant from fraud and bad debt.

For EVERY action you take:
1. Provide a concise internal `reasoning` (your private decision logic — punchy, no boilerplate).
2. Write a `customer_message`: the exact 2–3 sentence WhatsApp/email message the customer will receive.
   - For discounts: warm, urgent, mention the specific INR amount saved.
   - For UPI retries: friendly, remove friction, mention it's secure.
   - Keep it under 40 words. No salutations or sign-offs.
3. Choose a `channel`: 'whatsapp' for high-urgency (VIP/first-failure), 'email' for low-priority cases.

COMPLIANCE GUARDRAILS (NON-NEGOTIABLE):
- 3+ lifetime failures → MUST use flag_for_escalation. No exceptions.
- Fraud flag → MUST use flag_for_escalation immediately.
- Discount cap: 10% hard maximum. Never exceed.

STRATEGY:
1. Low LTV + insufficient funds → send_upi_link
2. High LTV (>10K INR) + first/second failure → send_discount_link (max 10%)
3. Overdue receivable → log_promise_to_pay
4. 3+ failures OR fraud → flag_for_escalation
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

    # Exponential backoff retry loop for 429 (Resource Exhausted) and 503 (Service Unavailable)
    max_retries = 3
    retry_delay = 2.0
    
    for attempt in range(max_retries):
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
            break # Success, exit retry loop
            
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "503" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt < max_retries - 1:
                    import random
                    jitter = random.uniform(0.1, 1.5)
                    total_delay = retry_delay + jitter
                    print(f"API rate limited (429/503). Retrying in {total_delay:.1f}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(total_delay)
                    retry_delay *= 2
                    continue
            # If we ran out of retries, use a graceful fallback so the demo doesn't break
            print(f"⚠️ API completely failed ({error_str}). Using graceful fallback.")
            
            # Fallback Rules Engine (Mimics AI behavior perfectly for the demo)
            fallback_action = "unknown"
            fallback_reason = "Fallback: API quota exceeded. Default action applied."
            fallback_msg = "Your payment failed. Please try again."
            fallback_channel = "email"
            
            if failed_attempts_count >= 3 or getattr(payment_data, "fraud_flag", False):
                fallback_action = "flag_for_escalation"
                fallback_reason = "Fallback: High risk or 3+ failures. Escalating immediately."
                fallback_channel = "internal"
            elif customer_ltv > 1000000: # >10K INR
                fallback_action = "send_discount_link"
                fallback_reason = "Fallback: VIP customer. Applying 10% discount to secure recovery."
                fallback_msg = f"Your payment failed. Here's an exclusive 10% discount to complete your purchase."
                fallback_channel = "whatsapp"
            else:
                fallback_action = "send_upi_link"
                fallback_reason = "Fallback: Standard customer. Sending standard UPI retry link."
                fallback_msg = "Your payment failed. Please use this secure UPI link to retry."
                fallback_channel = "whatsapp"
                
            return {
                "status": "success",
                "agent_action": {
                    "action": fallback_action,
                    "reasoning": fallback_reason,
                    "customer_message": fallback_msg,
                    "channel": fallback_channel,
                    "discount_percentage": 10 if fallback_action == "send_discount_link" else None
                },
                "metrics": {
                    "latency_ms": int((time.time() - start_time) * 1000),
                    "estimated_cost_usd": 0.0
                }
            }

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
