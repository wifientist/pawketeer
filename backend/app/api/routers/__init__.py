# api/routers/__init__.py
from fastapi import APIRouter
from .uploads import router as uploads_router
#from .analysis import router as analysis_router
from .stats import router as stats_router
from .pcap import router as pcap_router
from .config import router as config_router

api = APIRouter()
api.include_router(uploads_router, prefix="", tags=["uploads"])
#api.include_router(analysis_router, prefix="", tags=["analysis"])
api.include_router(stats_router, prefix="", tags=["stats"])
api.include_router(pcap_router, prefix="", tags=["pcaps"])
api.include_router(config_router, prefix="", tags=["config"])