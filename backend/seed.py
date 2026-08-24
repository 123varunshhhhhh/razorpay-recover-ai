import os
import datetime
from database import engine, Base, SessionLocal
from models import Customer, RecoveryEvent, Receivable

def seed_db():
    print("Re-creating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if already seeded
    if db.query(Customer).count() == 0:
        print("Seeding database with test customers and receivables...")
        
        # High LTV customer
        c1 = Customer(
            email="vip@corp.com",
            contact="9999999999",
            lifetime_value=1500000, # 15,000 INR
            fraud_flag=False,
            failed_attempts_count=0
        )
        
        # Low LTV customer
        c2 = Customer(
            email="new@user.com",
            contact="8888888888",
            lifetime_value=50000, # 500 INR
            fraud_flag=False,
            failed_attempts_count=0
        )
        
        # Suspected Fraud customer
        c3 = Customer(
            email="anon@sus.com",
            contact="7777777777",
            lifetime_value=0,
            fraud_flag=True,
            failed_attempts_count=0
        )
        
        db.add(c1)
        db.add(c2)
        db.add(c3)
        db.commit()

        # Seed some overdue receivables for the Batch Runner to process
        r1 = Receivable(
            customer_id=c1.id,
            amount=500000, # 5000 INR overdue
            currency="INR",
            due_date=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=15),
            status="overdue"
        )
        r2 = Receivable(
            customer_id=c2.id,
            amount=100000, # 1000 INR overdue
            currency="INR",
            due_date=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=5),
            status="overdue"
        )
        db.add(r1)
        db.add(r2)
        db.commit()
        
        print("Database seeded successfully.")
    else:
        print("Database already contains data.")
        
    db.close()

if __name__ == "__main__":
    seed_db()
