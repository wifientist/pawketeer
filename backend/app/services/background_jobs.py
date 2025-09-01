import asyncio
import schedule
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import sessionmaker
from sqlalchemy import and_

from core.database import engine  # Your database engine
from models.auth import User
from core.redis_client import redis_client


# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def cleanup_expired_pending_users():
    """
    Cleanup users who have been pending for more than 7 days.
    This runs as a background job.
    """
    print(f"[{datetime.now()}] Running cleanup of expired pending users...")
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.now() - timedelta(days=7)
        
        # Find expired pending users
        expired_users = (
            db.query(User)
            .filter(
                and_(
                    User.status == "pending",
                    User.created_at <= cutoff_date
                )
            )
            .all()
        )
        
        count = 0
        for user in expired_users:
            # Double-check with Redis timeout
            days_remaining = await redis_client.check_pending_timeout(user.email)
            if days_remaining == 0:
                print(f"Cleaning up expired pending user: {user.email}")
                db.delete(user)
                await redis_client.remove_pending_timeout(user.email)
                count += 1
        
        db.commit()
        print(f"Cleaned up {count} expired pending users")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()


async def cleanup_expired_redis_data():
    """
    Manual cleanup of Redis data (though Redis handles TTL automatically).
    This is mainly for logging and monitoring.
    """
    print(f"[{datetime.now()}] Redis cleanup check...")
    # Redis automatically expires keys with TTL, but we could add monitoring here
    # For example, check for orphaned keys, log statistics, etc.
    

def run_async_job(job_func):
    """Helper to run async jobs in sync scheduler"""
    asyncio.run(job_func())


def setup_background_jobs():
    """
    Setup scheduled background jobs.
    Call this when starting your FastAPI app.
    """
    # Schedule cleanup jobs
    schedule.every().day.at("02:00").do(
        run_async_job, cleanup_expired_pending_users
    )
    
    schedule.every().hour.do(
        run_async_job, cleanup_expired_redis_data
    )
    
    print("Background jobs scheduled:")
    print("- Expired pending users cleanup: Daily at 2:00 AM")
    print("- Redis cleanup check: Every hour")


def run_scheduler():
    """
    Run the background job scheduler.
    This should run in a separate thread or process.
    """
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


# For development/testing - manual cleanup functions
async def manual_cleanup():
    """Run cleanup manually for testing"""
    await cleanup_expired_pending_users()
    await cleanup_expired_redis_data()


if __name__ == "__main__":
    # For testing - run cleanup once
    asyncio.run(manual_cleanup())