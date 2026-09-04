"""
Recover AI - Comprehensive Edge Case Test Suite
Run from backend/ folder: pytest tests/test_comprehensive.py -v
"""
import pytest
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Customer, RecoveryEvent
import crud
import agent

from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture()
def seeded_db(db):
    vip    = Customer(email="vip@corp.com",      contact="9999", lifetime_value=2500000, fraud_flag=False, failed_attempts_count=0)
    low    = Customer(email="new@user.com",       contact="8888", lifetime_value=30000,   fraud_flag=False, failed_attempts_count=0)
    fraud  = Customer(email="fraud@sus.com",      contact="7777", lifetime_value=0,       fraud_flag=True,  failed_attempts_count=0)
    repeat = Customer(email="repeat@spam.com",    contact="6666", lifetime_value=50000,   fraud_flag=False, failed_attempts_count=3)
    almost = Customer(email="almost@limit.com",   contact="5555", lifetime_value=100000,  fraud_flag=False, failed_attempts_count=2)
    zero   = Customer(email="zero_ltv@user.com",  contact="4444", lifetime_value=0,       fraud_flag=False, failed_attempts_count=0)
    db.add_all([vip, low, fraud, repeat, almost, zero])
    db.commit()
    return db

# -- SECTION 1: Agent Guardrails ----------------------------------------------

class TestAgentGuardrails:

    def test_discount_above_10pct_is_blocked(self):
        result = json.loads(agent.send_discount_link(
            reasoning="Test", customer_email="t@t.com",
            amount_in_paise=100000, discount_percentage=15))
        assert "error" in result, "15% discount should be blocked by Python guardrail"

    def test_discount_at_11pct_is_blocked(self):
        result = json.loads(agent.send_discount_link(
            reasoning="Test", customer_email="t@t.com",
            amount_in_paise=100000, discount_percentage=11))
        assert "error" in result

    def test_discount_at_10pct_is_allowed(self):
        result = json.loads(agent.send_discount_link(
            reasoning="Max", customer_email="vip@corp.com",
            amount_in_paise=2500000, discount_percentage=10))
        assert "error" not in result
        assert result["discounted_amount_paise"] == 2250000

    def test_discount_at_9pct_is_allowed(self):
        result = json.loads(agent.send_discount_link(
            reasoning="Under max", customer_email="t@t.com",
            amount_in_paise=1000000, discount_percentage=9))
        assert result["discounted_amount_paise"] == 910000

    def test_discount_math_exact_22500(self):
        """The demo number: 25000 - 10% = 22500 exactly."""
        result = json.loads(agent.send_discount_link(
            reasoning="VIP save", customer_email="vip@corp.com",
            amount_in_paise=2500000, discount_percentage=10))
        assert result["discounted_amount_paise"] == 2250000  # ?22,500

    def test_upi_link_structure(self):
        result = json.loads(agent.send_upi_link(
            reasoning="Bank declined", customer_email="new@user.com", amount_in_paise=50000))
        assert result["action"] == "send_upi_link"
        assert "reasoning" in result

    def test_escalation_structure(self):
        result = json.loads(agent.flag_for_escalation(
            reasoning="Fraud", customer_email="fraud@sus.com", fraud_risk=True))
        assert result["action"] == "flag_for_escalation"

    def test_simple_retry_structure(self):
        result = json.loads(agent.simple_retry(
            reasoning="Temp downtime", customer_email="t@t.com"))
        assert result["action"] == "simple_retry"

    def test_promise_to_pay_structure(self):
        result = json.loads(agent.log_promise_to_pay(
            reasoning="Promised", customer_email="t@t.com", promised_date_iso="2026-09-01"))
        assert result["action"] == "log_promise_to_pay"
        assert "2026-09-01" in result["details"]

# -- SECTION 2: Financial Accounting ------------------------------------------

class TestFinancialAccounting:

    def _add_event(self, db, email, amount, recovered, action, status):
        c = crud.get_customer_by_email(db, email)
        crud.create_recovery_event(db,
            customer_id=c.id,
            razorpay_event_id=f"pay_test_{email}_{amount}",
            amount=amount,
            recovered_amount=recovered,
            currency="INR",
            failure_reason="Insufficient Funds",
            agent_action=action,
            agent_reasoning="test",
            status=status,
            latency_ms=1200,
            cost_usd=0.000008)

    def test_at_risk_and_recovered_are_independent(self, seeded_db):
        self._add_event(seeded_db, "vip@corp.com", 2500000, 2250000, "send_discount_link", "success")
        m = crud.get_metrics(seeded_db)
        assert m["at_risk_amount"] == 2500000
        assert m["recovered_amount"] == 2250000
        assert m["at_risk_amount"] != m["recovered_amount"]

    def test_escalations_contribute_zero_revenue(self, seeded_db):
        self._add_event(seeded_db, "fraud@sus.com", 500000, 0, "flag_for_escalation", "escalated")
        m = crud.get_metrics(seeded_db)
        assert m["recovered_amount"] == 0

    def test_batch_totals_match_demo_numbers(self, seeded_db):
        """0 + 0 + 500 + 22500 = 23000 INR recovered."""
        events = [
            ("fraud@sus.com",   500000,  0,       "flag_for_escalation", "escalated"),
            ("repeat@spam.com", 1500000, 0,       "flag_for_escalation", "escalated"),
            ("new@user.com",    50000,   50000,   "send_upi_link",       "success"),
            ("vip@corp.com",    2500000, 2250000, "send_discount_link",  "success"),
        ]
        for email, amt, rec, action, status in events:
            self._add_event(seeded_db, email, amt, rec, action, status)
        m = crud.get_metrics(seeded_db)
        assert m["recovered_amount"] == 2300000, f"Expected ?23,000 (2300000 paise), got {m['recovered_amount']}"
        assert m["at_risk_amount"] == 4550000

    def test_empty_db_returns_all_zeros(self, db):
        m = crud.get_metrics(db)
        assert m["at_risk_amount"] == 0
        assert m["recovered_amount"] == 0
        assert m["recovery_percentage"] == 0

    def test_recovery_percentage_is_correct(self, seeded_db):
        self._add_event(seeded_db, "vip@corp.com", 1000000, 500000, "send_discount_link", "success")
        m = crud.get_metrics(seeded_db)
        assert m["recovery_percentage"] == 50.0

# -- SECTION 3: Customer CRUD --------------------------------------------------

class TestCustomerLookups:

    def test_fetch_existing_customer(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "vip@corp.com")
        assert c is not None
        assert c.lifetime_value == 2500000

    def test_fetch_unknown_customer_returns_none(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "ghost@nobody.com")
        assert c is None

    def test_fraud_flag_is_set(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "fraud@sus.com")
        assert c.fraud_flag is True

    def test_repeat_offender_has_3_strikes(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "repeat@spam.com")
        assert c.failed_attempts_count >= 3

    def test_almost_at_limit_has_2_strikes(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "almost@limit.com")
        assert c.failed_attempts_count == 2
        assert c.failed_attempts_count < 3  # not yet blocked

    def test_zero_ltv_customer_is_valid(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "zero_ltv@user.com")
        assert c is not None
        assert c.lifetime_value == 0

# -- SECTION 4: Idempotency ----------------------------------------------------

class TestIdempotency:

    def test_duplicate_event_id_is_detected(self, seeded_db):
        c = crud.get_customer_by_email(seeded_db, "vip@corp.com")
        event_id = "pay_test_idempotency_001"
        assert crud.check_event_processed(seeded_db, event_id) is False

        crud.create_recovery_event(seeded_db,
            customer_id=c.id,
            razorpay_event_id=event_id,
            amount=2500000,
            recovered_amount=2250000,
            currency="INR",
            failure_reason="Insufficient Funds",
            agent_action="send_discount_link",
            agent_reasoning="VIP",
            status="success",
            latency_ms=1200,
            cost_usd=0.000008)

        assert crud.check_event_processed(seeded_db, event_id) is True

        events = crud.get_recent_recovery_events(seeded_db, limit=20)
        matching = [e for e in events if e.razorpay_event_id == event_id]
        assert len(matching) == 1, "Event must only exist once in the DB"

# -- SECTION 5: Logs API -------------------------------------------------------

class TestLogs:

    def _add_n_events(self, db, email, n):
        c = crud.get_customer_by_email(db, email)
        for i in range(n):
            crud.create_recovery_event(db,
                customer_id=c.id,
                razorpay_event_id=f"pay_log_test_{i}",
                amount=100000 * (i + 1),
                recovered_amount=90000,
                currency="INR",
                failure_reason="Insufficient Funds",
                agent_action="send_discount_link",
                agent_reasoning=f"Event {i}",
                status="success",
                latency_ms=1200,
                cost_usd=0.000008)

    def test_logs_respects_limit(self, seeded_db):
        self._add_n_events(seeded_db, "vip@corp.com", 25)
        logs = crud.get_recent_recovery_events(seeded_db, limit=20)
        assert len(logs) == 20

    def test_logs_newest_first(self, seeded_db):
        self._add_n_events(seeded_db, "vip@corp.com", 5)
        logs = crud.get_recent_recovery_events(seeded_db, limit=10)
        ids = [l.id for l in logs]
        assert ids == sorted(ids, reverse=True), "Logs must be newest-first"
