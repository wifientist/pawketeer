from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
#from app.api.routes import router
from app.api.routers import api
from app.core.config import settings
from app.core.database import create_tables, test_connection

# Test database connection and create tables
print("🔍 Testing database connection...")
if test_connection():
    print("🚀 Creating database tables...")
    create_tables()
else:
    print("❌ Database connection failed! Check your settings.")
    exit(1)

app = FastAPI(
    title=settings.app_name,
    description="Pawketeer Wi-Fi packet analysis with PostgreSQL database storage",
    version=settings.app_version,
    debug=settings.debug
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  #set back to True if using cookies/auth
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(api, prefix="")


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "database": "connected" if test_connection() else "disconnected"
    }