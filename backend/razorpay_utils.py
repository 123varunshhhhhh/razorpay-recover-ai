import os
import razorpay
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

# Initialize Razorpay Client
# Handle missing keys gracefully for local development if needed, but error out in production.
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
else:
    client = None
    print("WARNING: Razorpay keys not set. API calls will fail.")


def verify_webhook_signature(payload: str, signature: str) -> bool:
    """Verifies the webhook signature using the razorpay SDK."""
    if not WEBHOOK_SECRET or not client:
        return False
    
    try:
        # Note: utility.verify_webhook_signature raises an exception if invalid
        client.utility.verify_webhook_signature(payload, signature, WEBHOOK_SECRET)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False

def create_payment_link(amount_in_paise: int, description: str, customer_info: dict) -> dict:
    """Creates a payment link via Razorpay."""
    if not client:
        raise Exception("Razorpay client not initialized.")
        
    payment_link_request = {
        "amount": amount_in_paise,
        "currency": "INR",
        "accept_partial": False,
        "description": description,
        "customer": customer_info,
        "notify": {
            "sms": True,
            "email": True
        },
        "reminder_enable": True,
        "notes": {
            "purpose": "revenue_recovery"
        }
    }
    
    return client.payment_link.create(payment_link_request)
