# api/routers/config.py
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/config")
def get_config():
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "max_file_size": settings.max_file_size,
        "allowed_extensions": settings.allowed_extensions,
    }
