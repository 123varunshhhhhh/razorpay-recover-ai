from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    contact = Column(String, nullable=True)
    lifetime_value = Column(Integer, default=0) # Stored in paise/cents
    fraud_flag = Column(Boolean, default=False)
    failed_attempts_count = Column(Integer, default=0)
    opt_out = Column(Boolean, default=False)
    
    events = relationship("RecoveryEvent", back_populates="customer")
    receivables = relationship("Receivable", back_populates="customer")

class Receivable(Base):
    __tablename__ = "receivables"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    
    amount = Column(Integer)
    currency = Column(String, default="INR")
    due_date = Column(DateTime(timezone=True))
    
    status = Column(String, default="overdue") # overdue, promised, paid
    promise_to_pay_date = Column(DateTime(timezone=True), nullable=True)
    
    customer = relationship("Customer", back_populates="receivables")

class RecoveryEvent(Base):
    __tablename__ = "recovery_events"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    
    razorpay_event_id = Column(String, unique=True, index=True, nullable=True) # Idempotency key
    amount = Column(Integer) # Original at-risk amount
    recovered_amount = Column(Integer) # The actual amount collected (after discounts, 0 if escalated)
    currency = Column(String, default="INR")
    failure_reason = Column(String)
    
    # The action the AI agent decided to take
    agent_action = Column(String, nullable=True)
    agent_reasoning = Column(String, nullable=True)
    payment_link_url = Column(String, nullable=True)  # Real Razorpay payment link created by the agent
    
    # Track the outcome of our intervention
    status = Column(String, default="pending_analysis") # pending_analysis, intervention_sent, recovered, failed
    latency_ms = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer", back_populates="events")
