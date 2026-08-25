import os
import datetime
from database import engine, Base, SessionLocal
from models import Customer, RecoveryEvent, Receivable

def seed_db():
    print("Re-creating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    print("Seeding database with isolated sandbox and batch customers...")
    
    # --- SANDBOX CUSTOMERS (For individual manual button clicks) ---
    s_vip = Customer(email="vip@corp.com", contact="9999999999", lifetime_value=1500000, fraud_flag=False, failed_attempts_count=0)
    s_std = Customer(email="new@user.com", contact="8888888888", lifetime_value=50000, fraud_flag=False, failed_attempts_count=0)
    s_sus = Customer(email="anon@sus.com", contact="7777777777", lifetime_value=0, fraud_flag=True, failed_attempts_count=0)
    s_rep = Customer(email="repeat_offender@spam.com", contact="6666666666", lifetime_value=200000, fraud_flag=False, failed_attempts_count=3)
    
    # --- BATCH CUSTOMERS (For deterministic batch run demo) ---
    b_vip = Customer(email="batch_1_vip@corp.com", contact="9999999991", lifetime_value=2500000, fraud_flag=False, failed_attempts_count=0)
    b_std = Customer(email="batch_2_standard@user.com", contact="8888888882", lifetime_value=30000, fraud_flag=False, failed_attempts_count=0)
    b_sus = Customer(email="batch_3_fraud@sus.com", contact="7777777773", lifetime_value=10000, fraud_flag=True, failed_attempts_count=1)
    b_rep = Customer(email="batch_4_repeat@spam.com", contact="6666666664", lifetime_value=50000, fraud_flag=False, failed_attempts_count=3)

    db.add_all([s_vip, s_std, s_sus, s_rep, b_vip, b_std, b_sus, b_rep])
    db.commit()

    # --- SEED RECEIVABLES (To give the dashboard some data) ---
    r1 = Receivable(customer_id=s_vip.id, amount=500000, currency="INR", due_date=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=15), status="overdue")
    r2 = Receivable(customer_id=s_std.id, amount=100000, currency="INR", due_date=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=5), status="overdue")
    r3 = Receivable(customer_id=b_vip.id, amount=800000, currency="INR", due_date=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30), status="overdue")

    db.add_all([r1, r2, r3])
    db.commit()
    
    print("Database seeded successfully.")
    db.close()

if __name__ == "__main__":
    seed_db()
