import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
from models import Customer
from crud import get_customer_by_email

# Use an in-memory SQLite database for fast, isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db():
    # Setup: Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Teardown: Drop tables
        Base.metadata.drop_all(bind=engine)

def test_create_and_fetch_customer(db):
    """Test that we can create a customer and fetch them via CRUD layer"""
    # 1. Arrange
    test_email = "test.vip@corp.com"
    new_customer = Customer(email=test_email, contact="1234567890", lifetime_value=150000)
    db.add(new_customer)
    db.commit()

    # 2. Act
    fetched_customer = get_customer_by_email(db, test_email)

    # 3. Assert
    assert fetched_customer is not None
    assert fetched_customer.email == test_email
    assert fetched_customer.lifetime_value == 150000
