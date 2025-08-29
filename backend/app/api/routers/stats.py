# api/routers/stats.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.upload_service import UploadService

router = APIRouter()

@router.get("/stats")
def get_storage_stats(db: Session = Depends(get_db)):
    upload_service = UploadService(db)
    stats = upload_service.get_storage_stats()
    return {"message": "Storage statistics", **stats}
