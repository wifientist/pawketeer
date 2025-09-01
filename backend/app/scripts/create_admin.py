#!/usr/bin/env python3
"""
Script to create the first admin user.
Run this after setting up the database to create your first admin.

Usage (from backend directory):
source .venv/bin/activate
export PYTHONPATH=/home/omni/code/pawketeer/backend:$PYTHONPATH
python app/scripts/create_admin.py admin@example.com
"""

import sys
import os
import asyncio
from datetime import datetime

# Add backend directory to path to import app modules
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, backend_dir)

from sqlalchemy.orm import sessionmaker
from app.core.database import engine
from app.models.auth import User
from app.core.redis_client import redis_client


def create_admin_user(email: str):
    """Create an admin user directly in the database"""
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"User {email} already exists!")
            if existing_user.is_admin:
                print(f"User {email} is already an admin.")
                return
            else:
                # Make existing user an admin
                existing_user.is_admin = True
                existing_user.status = "approved"
                existing_user.approved_at = datetime.now()
                db.commit()
                print(f"✅ Made {email} an admin!")
                return
        
        # Create new admin user
        admin_user = User(
            email=email,
            status="approved",  # Auto-approve the first admin
            is_admin=True,
            approved_at=datetime.now()
        )
        
        db.add(admin_user)
        db.commit()
        
        print(f"✅ Created admin user: {email}")
        print(f"User ID: {admin_user.id}")
        print(f"Status: {admin_user.status}")
        print(f"Is Admin: {admin_user.is_admin}")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


async def remove_pending_timeout_if_exists(email: str):
    """Remove any pending timeout for the email"""
    try:
        await redis_client.remove_pending_timeout(email)
        print(f"Removed any pending timeout for {email}")
    except Exception as e:
        print(f"Note: Could not remove pending timeout (this is normal): {e}")


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/create_admin.py <admin_email>")
        print("Example: python scripts/create_admin.py admin@example.com")
        sys.exit(1)
    
    email = sys.argv[1].strip().lower()
    
    # Validate email format (basic check)
    if "@" not in email or "." not in email:
        print("❌ Please provide a valid email address")
        sys.exit(1)
    
    print(f"Creating admin user: {email}")
    
    # Create the admin user
    create_admin_user(email)
    
    # Clean up any Redis data
    asyncio.run(remove_pending_timeout_if_exists(email))
    
    print("\n🎉 Admin user setup complete!")
    print(f"The admin user {email} can now:")
    print("1. Request OTP codes via /auth/request-otp")
    print("2. Login with OTP via /auth/verify-otp") 
    print("3. Access admin endpoints at /admin/*")
    print("\nNext steps:")
    print("- Start your FastAPI server")
    print("- The admin can approve other user requests")
    print("- Check the API docs at http://localhost:8000/docs")


if __name__ == "__main__":
    main()