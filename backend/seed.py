from database import SessionLocal, engine, Base
from models import Customer

# Create all tables
Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    
    # Check if we already seeded
    if db.query(Customer).first():
        print("Database already seeded.")
        db.close()
        return

    # Seed mock customers with different profiles for our Sandbox scenarios
    customers = [
        Customer(email="vip@corp.com", contact="9999999991", lifetime_value=9500000, fraud_flag=False), # Very High LTV (95k INR)
        Customer(email="user@acme.com", contact="9999999992", lifetime_value=4200000, fraud_flag=False), # High LTV (42k INR)
        Customer(email="new@user.com", contact="9999999993", lifetime_value=50000, fraud_flag=False), # Low LTV (500 INR)
        Customer(email="anon@sus.com", contact="9999999994", lifetime_value=0, fraud_flag=True), # Suspected Fraud
    ]
    
    db.add_all(customers)
    db.commit()
    print("Database successfully seeded with mock customers!")
    db.close()

if __name__ == "__main__":
    seed_db()
