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
    
    events = relationship("RecoveryEvent", back_populates="customer")

class RecoveryEvent(Base):
    __tablename__ = "recovery_events"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    
    amount = Column(Integer)
    currency = Column(String, default="INR")
    failure_reason = Column(String)
    
    # The action the AI agent decided to take
    agent_action = Column(String, nullable=True)
    agent_reasoning = Column(String, nullable=True)
    
    # Track the outcome of our intervention
    status = Column(String, default="pending_analysis") # pending_analysis, intervention_sent, recovered, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer", back_populates="events")
