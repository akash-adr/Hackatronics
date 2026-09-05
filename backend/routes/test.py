from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import TestPing

router = APIRouter()

class TestPingCreate(BaseModel):
    message: str

@router.get("/api/ping")
def ping():
    return {"status": "ok", "message": "backend is alive"}

@router.post("/api/test-db")
def create_test_ping(ping_data: TestPingCreate, db: Session = Depends(get_db)):
    new_ping = TestPing(message=ping_data.message)
    db.add(new_ping)
    db.commit()
    db.refresh(new_ping)
    return new_ping

@router.get("/api/test-db")
def get_test_pings(db: Session = Depends(get_db)):
    return db.query(TestPing).all()
