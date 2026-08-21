import os
import google.generativeai as genai
from google.generativeai.types import content_types
from dotenv import load_dotenv
import razorpay_utils

load_dotenv()

# Initialize Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not set.")

def create_payment_link_tool(amount_in_paise: int, description: str, customer_name: str, customer_email: str, customer_contact: str) -> str:
    """
    Creates a new payment link via Razorpay and sends it to the customer.
    This should be used when a previous payment fails and we want to offer the customer
    a quick way to try again, potentially with an alternative payment method.
    """
    customer_info = {
        "name": customer_name,
        "email": customer_email,
        "contact": customer_contact
    }
    try:
        response = razorpay_utils.create_payment_link(amount_in_paise, description, customer_info)
        return f"Payment link created successfully. Link: {response.get('short_url')}"
    except Exception as e:
        return f"Failed to create payment link: {str(e)}"

# Define the tools available to the model
tools = [create_payment_link_tool]

# Initialize the model with tools
if GEMINI_API_KEY:
    model = genai.GenerativeModel(
        model_name='gemini-1.5-pro-latest',
        tools=tools,
        system_instruction="""You are 'Recover AI', an intelligent financial agent for a merchant. 
Your job is to analyze failed payment webhooks and determine the best course of action to recover the revenue.
If a payment fails due to a temporary issue (like insufficient funds, or bank downtime), you should immediately
generate a new payment link and send it to the customer, encouraging them to use an alternative method like UPI.
Use the `create_payment_link_tool` to execute this action.
Respond with a JSON object explaining your reasoning and the action taken."""
    )
else:
    model = None

def analyze_and_recover(payment_data: dict) -> dict:
    """
    Takes the raw payment failure data from Razorpay, feeds it to Gemini, 
    and lets the agent decide on the recovery action.
    """
    if not model:
        return {"error": "AI Agent not initialized (missing API key)"}

    prompt = f"""
    A payment has just failed. Please analyze this event and take action to recover the revenue.
    
    Payment Details:
    - Amount (paise): {payment_data.get('amount')}
    - Currency: {payment_data.get('currency')}
    - Customer Email: {payment_data.get('email')}
    - Customer Contact: {payment_data.get('contact')}
    - Failure Reason: {payment_data.get('error_description')}
    - Error Source: {payment_data.get('error_source')}
    - Error Code: {payment_data.get('error_code')}
    
    Decide if you should generate a new payment link. If yes, execute the tool.
    Return your response explaining what you did.
    """
    
    try:
        chat = model.start_chat()
        response = chat.send_message(prompt)
        
        # If the model decided to call a tool, it will be handled implicitly by the SDK 
        # (if enable_automatic_function_calling=True is set on start_chat, but let's handle it manually if needed, 
        # or we just rely on the SDK's automatic handling).
        # Actually, let's use the explicit automatic handling:
        
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(prompt)

        return {
            "status": "success",
            "agent_response": response.text,
            "action_taken": True # Simplified for now
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }
