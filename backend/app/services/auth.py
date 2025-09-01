import secrets
import string
import requests
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.auth import User
from app.core.redis_client import redis_client


class AuthService:
    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = "HS256"
        self.mailgun_api_key = settings.mailgun_api_key
        self.mailgun_domain = settings.mailgun_domain
        self.mailgun_base_url = settings.mailgun_base_url
        self.email_from_name = settings.email_from_name
    
    def generate_otp(self) -> str:
        """Generate 6-digit OTP"""
        return ''.join(secrets.choice(string.digits) for _ in range(6))
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.access_token_expire_hours)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str):
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    async def send_otp_email(self, email: str, otp_code: str):
        """Send OTP via Mailgun"""
        print(f"Sending OTP to {email}: {otp_code}")
        try:
            response = requests.post(
                f"{self.mailgun_base_url}/{self.mailgun_domain}/messages",
                auth=("api", self.mailgun_api_key),
                data={
                    "from": f"{self.email_from_name} <noreply@{self.mailgun_domain}>",
                    "to": [email],
                    "subject": f"Your {settings.app_name} Login Code",
                    "text": f"""
                    Your login code is: {otp_code}
                    
                    This code will expire in {settings.otp_expire_minutes} minutes.
                    If you didn't request this code, please ignore this email.
                    """,
                    "html": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Your {settings.app_name} Login Code</h2>
                        <p>Your login code is:</p>
                        <div style="font-size: 24px; font-weight: bold; color: #007bff; margin: 20px 0;">
                            {otp_code}
                        </div>
                        <p>This code will expire in {settings.otp_expire_minutes} minutes.</p>
                        <p>If you didn't request this code, please ignore this email.</p>
                    </div>
                    """
                }
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False
    
    async def send_approval_notification(self, email: str):
        """Send approval notification email"""
        try:
            response = requests.post(
                f"{self.mailgun_base_url}/{self.mailgun_domain}/messages",
                auth=("api", self.mailgun_api_key),
                data={
                    "from": f"{self.email_from_name} <noreply@{self.mailgun_domain}>",
                    "to": [email],
                    "subject": f"{settings.app_name} - Account Approved",
                    "text": f"""
                    Great news! Your {settings.app_name} account has been approved.
                    
                    You can now request a login code to access the platform.
                    Visit: {settings.frontend_url}
                    """,
                    "html": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Account Approved!</h2>
                        <p>Great news! Your {settings.app_name} account has been approved.</p>
                        <p>You can now request a login code to access the platform.</p>
                        <p><a href="{settings.frontend_url}" style="color: #007bff;">Access {settings.app_name}</a></p>
                    </div>
                    """
                }
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Failed to send approval email: {e}")
            return False
    
    async def request_access(self, email: str, db: Session) -> dict:
        """Request access - create pending user"""
        # Check if user already exists
        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.status == "approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User already approved"
                )
            elif user.status == "pending":
                # Check if still within timeout period
                days_remaining = await redis_client.check_pending_timeout(email)
                if days_remaining > 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Access request still pending. {days_remaining} days remaining."
                    )
                else:
                    # Reset pending status if timeout expired
                    user.status = "pending"
                    user.created_at = datetime.now()
                    await redis_client.set_pending_timeout(email)
            else:  # rejected
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Access request was rejected"
                )
        else:
            # Create new pending user
            user = User(email=email, status="pending")
            db.add(user)
            await redis_client.set_pending_timeout(email)
        
        db.commit()
        return {"message": "Access request submitted. Awaiting admin approval."}
    
    async def request_otp(self, email: str, db: Session) -> dict:
        """Request OTP for approved user"""
        # Check rate limiting
        rate_limit_key = f"rate_limit:otp:{email}"
        is_allowed, remaining = await redis_client.check_rate_limit(rate_limit_key)
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many OTP requests. Please try again later. (Limit: {settings.otp_rate_limit_count} per {settings.otp_rate_limit_window_minutes} minutes)"
            )
        
        # Check if user exists and is approved
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not approved"
            )
        
        # Generate and store OTP
        otp_code = self.generate_otp()
        await redis_client.store_otp(email, otp_code)
        
        # Send OTP email
        email_sent = await self.send_otp_email(email, otp_code)
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send OTP email"
            )
        
        return {"message": "OTP sent to your email"}
    
    async def verify_otp(self, email: str, otp_code: str, db: Session) -> dict:
        """Verify OTP and create session"""
        # Get stored OTP
        otp_data = await redis_client.get_otp(email)
        if not otp_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP not found or expired"
            )
        
        # Check attempts
        if otp_data["attempts"] >= settings.max_otp_attempts:
            await redis_client.delete_otp(email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Too many failed attempts. Please request a new OTP. (Max attempts: {settings.max_otp_attempts})"
            )
        
        # Verify OTP
        if otp_data["code"] != otp_code:
            await redis_client.increment_otp_attempts(email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP"
            )
        
        # Get user
        user = db.query(User).filter(User.email == email).first()
        if not user or user.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found or not approved"
            )
        
        # Update last login
        user.last_login = datetime.now()
        db.commit()
        
        # Clean up OTP
        await redis_client.delete_otp(email)
        
        # Create access token
        access_token = self.create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        # Store session in Redis
        session_id = secrets.token_urlsafe(32)
        await redis_client.store_session(session_id, str(user.id))
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
        #             # Reset pending status if timeout expired
        #             user.status = "pending"
        #             user.created_at = datetime.now()
        #             await redis_client.set_pending_timeout(email)
        #     else:  # rejected
        #         raise HTTPException(
        #             status_code=status.HTTP_400_BAD_REQUEST,
        #             detail="Access request was rejected"
        #         )
        # else:
        #     # Create new pending user
        #     user = User(email=email, status="pending")
        #     db.add(user)
        #     await redis_client.set_pending_timeout(email)
        
        # db.commit()
        # return {"message": "Access request submitted. Awaiting admin approval."}
    
    async def request_otp(self, email: str, db: Session) -> dict:
        """Request OTP for approved user"""
        # Check rate limiting
        rate_limit_key = f"rate_limit:otp:{email}"
        is_allowed, remaining = await redis_client.check_rate_limit(
            rate_limit_key, limit=5, window_minutes=60
        )
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP requests. Please try again later."
            )
        
        # Check if user exists and is approved
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not approved"
            )
        
        # Generate and store OTP
        otp_code = self.generate_otp()
        await redis_client.store_otp(email, otp_code)
        
        # Send OTP email
        email_sent = await self.send_otp_email(email, otp_code)
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send OTP email"
            )
        
        return {"message": "OTP sent to your email"}
    
    async def verify_otp(self, email: str, otp_code: str, db: Session) -> dict:
        """Verify OTP and create session"""
        # Get stored OTP
        otp_data = await redis_client.get_otp(email)
        if not otp_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP not found or expired"
            )
        
        # Check attempts
        if otp_data["attempts"] >= 3:
            await redis_client.delete_otp(email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please request a new OTP."
            )
        
        # Verify OTP
        if otp_data["code"] != otp_code:
            await redis_client.increment_otp_attempts(email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP"
            )
        
        # Get user
        user = db.query(User).filter(User.email == email).first()
        if not user or user.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found or not approved"
            )
        
        # Update last login
        user.last_login = datetime.now()
        db.commit()
        
        # Clean up OTP
        await redis_client.delete_otp(email)
        
        # Create access token
        access_token = self.create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        # Store session in Redis
        session_id = secrets.token_urlsafe(32)
        await redis_client.store_session(session_id, str(user.id))
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }


# Global instance
auth_service = AuthService()