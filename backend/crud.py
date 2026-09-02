from sqlalchemy.orm import Session
from models import Customer, RecoveryEvent

def get_customer_by_email(db: Session, email: str) -> Customer:
    """Fetch a customer profile by their email address."""
    return db.query(Customer).filter(Customer.email == email).first()

def get_recent_recovery_events(db: Session, limit: int = 20):
    """Fetch the most recent AI recovery interventions, newest first."""
    return db.query(RecoveryEvent).order_by(RecoveryEvent.id.desc()).limit(limit).all()

def check_event_processed(db: Session, razorpay_event_id: str) -> bool:
    """Check if we have already processed this webhook event (Idempotency Check)"""
    if not razorpay_event_id:
        return False
    return db.query(RecoveryEvent).filter(RecoveryEvent.razorpay_event_id == razorpay_event_id).first() is not None

def create_recovery_event(db: Session, customer_id: int, razorpay_event_id: str, amount: int, recovered_amount: int, currency: str,
                          failure_reason: str, agent_action: str, agent_reasoning: str, status: str,
                          latency_ms: int = 0, cost_usd: float = 0.0, payment_link_url: str = None,
                          recovery_message: str = None, channel: str = None) -> RecoveryEvent:
    """Log a new intervention attempted by the AI agent."""
    db_event = RecoveryEvent(
        customer_id=customer_id,
        razorpay_event_id=razorpay_event_id,
        amount=amount,
        recovered_amount=recovered_amount,
        currency=currency,
        failure_reason=failure_reason,
        agent_action=agent_action,
        agent_reasoning=agent_reasoning,
        recovery_message=recovery_message,
        channel=channel,
        payment_link_url=payment_link_url,
        status=status,
        latency_ms=latency_ms,
        cost_usd=cost_usd
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

def increment_failed_attempts(db: Session, customer_id: int) -> int:
    """Increment the failed attempts counter for a customer."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer:
        customer.failed_attempts_count += 1
        db.commit()
        db.refresh(customer)
        return customer.failed_attempts_count
    return 0

def log_promise_to_pay(db: Session, customer_id: int, promise_date) -> bool:
    """Finds an overdue receivable for this customer and logs a promise to pay."""
    from models import Receivable
    receivable = db.query(Receivable).filter(Receivable.customer_id == customer_id, Receivable.status == "overdue").first()
    if receivable:
        receivable.promise_to_pay_date = promise_date
        receivable.status = "promised"
        db.commit()
        return True
    return False

def get_metrics(db: Session):
    """Calculates batch metrics for the UI, including AI ROI."""
    from sqlalchemy import func
    from models import Receivable
    
    # Calculate total at-risk amount from all events + receivables
    at_risk = db.query(func.sum(RecoveryEvent.amount)).scalar() or 0
    at_risk_rec = db.query(func.sum(Receivable.amount)).filter(Receivable.status == "overdue").scalar() or 0
    
    # Calculate recovered amounts (success events + promised receivables)
    recovered_events = db.query(func.sum(RecoveryEvent.recovered_amount)).filter(RecoveryEvent.status == "success").scalar() or 0
    promised_rec = db.query(func.sum(Receivable.amount)).filter(Receivable.status == "promised").scalar() or 0
    
    total_at_risk = at_risk + at_risk_rec + promised_rec
    total_recovered = recovered_events + promised_rec
    
    # AI cost and ROI calculation
    total_cost_usd = db.query(func.sum(RecoveryEvent.cost_usd)).scalar() or 0.0
    USD_TO_INR = 84
    total_cost_inr_paise = int(total_cost_usd * USD_TO_INR * 100)  # Convert to paise
    # ROI: rupees recovered per rupee of AI spend
    ai_roi = round(total_recovered / total_cost_inr_paise, 1) if total_cost_inr_paise > 0 else 0

    # Decision breakdown
    total_events = db.query(func.count(RecoveryEvent.id)).scalar() or 0
    escalations = db.query(func.count(RecoveryEvent.id)).filter(RecoveryEvent.agent_action == "flag_for_escalation").scalar() or 0
    discounts = db.query(func.count(RecoveryEvent.id)).filter(RecoveryEvent.agent_action == "send_discount_link").scalar() or 0
    upi_retries = db.query(func.count(RecoveryEvent.id)).filter(RecoveryEvent.agent_action == "send_upi_link").scalar() or 0
    
    return {
        "at_risk_amount": total_at_risk,
        "recovered_amount": total_recovered,
        "recovery_percentage": round((total_recovered / total_at_risk * 100), 1) if total_at_risk > 0 else 0,
        "total_cost_usd": round(total_cost_usd, 6),
        "total_cost_inr_paise": total_cost_inr_paise,
        "ai_roi": ai_roi,  # Paise recovered per paise of AI cost
        "total_events": total_events,
        "escalations": escalations,
        "discounts": discounts,
        "upi_retries": upi_retries,
    }

def get_active_receivables(db: Session, limit: int = 5):
    """Fetch all outstanding or promised receivables."""
    from models import Receivable
    return db.query(Receivable).filter(Receivable.status.in_(["overdue", "promised"])).order_by(Receivable.due_date.asc()).limit(limit).all()

def mark_event_recovered(db: Session, customer_email: str) -> bool:
    """Marks the latest intervention for this customer as recovered."""
    customer = get_customer_by_email(db, customer_email)
    if not customer:
        return False
        
    event = db.query(RecoveryEvent).filter(RecoveryEvent.customer_id == customer.id).order_by(RecoveryEvent.created_at.desc()).first()
    if event:
        event.status = "recovered"
        db.commit()
        return True
    return False
