from sqlalchemy.orm import Session
from models import Customer, RecoveryEvent

def get_customer_by_email(db: Session, email: str) -> Customer:
    """Fetch a customer profile by their email address."""
    return db.query(Customer).filter(Customer.email == email).first()

def get_recent_recovery_events(db: Session, limit: int = 20):
    """Fetch the most recent AI recovery interventions."""
    return db.query(RecoveryEvent).order_by(RecoveryEvent.created_at.desc()).limit(limit).all()

def check_event_processed(db: Session, razorpay_event_id: str) -> bool:
    """Check if we have already processed this webhook event (Idempotency Check)"""
    if not razorpay_event_id:
        return False
    return db.query(RecoveryEvent).filter(RecoveryEvent.razorpay_event_id == razorpay_event_id).first() is not None

def create_recovery_event(db: Session, customer_id: int, razorpay_event_id: str, amount: int, currency: str, 
                          failure_reason: str, agent_action: str, agent_reasoning: str, status: str) -> RecoveryEvent:
    """Log a new intervention attempted by the AI agent."""
    db_event = RecoveryEvent(
        customer_id=customer_id,
        razorpay_event_id=razorpay_event_id,
        amount=amount,
        currency=currency,
        failure_reason=failure_reason,
        agent_action=agent_action,
        agent_reasoning=agent_reasoning,
        status=status
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event
