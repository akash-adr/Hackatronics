from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class TestPing(Base):
    __tablename__ = "test_pings"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
