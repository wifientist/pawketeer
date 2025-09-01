import redis
import json
from typing import Optional, Any
from datetime import datetime, timedelta

from app.core.config import settings

class RedisClient:
    def __init__(self):
        self.redis_client = redis.from_url(
            settings.redis_url_with_password,
            decode_responses=True
        )
    
    # OTP operations
    async def store_otp(self, email: str, otp_code: str, expires_in_minutes: int = None):
        """Store OTP with expiration"""
        if expires_in_minutes is None:
            expires_in_minutes = settings.otp_expire_minutes
            
        key = f"otp:{email}"
        data = {
            "code": otp_code,
            "attempts": 0,
            "expires_at": (datetime.now() + timedelta(minutes=expires_in_minutes)).isoformat()
        }
        self.redis_client.setex(key, timedelta(minutes=expires_in_minutes), json.dumps(data))
    
    async def get_otp(self, email: str) -> Optional[dict]:
        """Get OTP data"""
        key = f"otp:{email}"
        data = self.redis_client.get(key)
        return json.loads(data) if data else None
    
    async def increment_otp_attempts(self, email: str) -> int:
        """Increment OTP attempt count"""
        otp_data = await self.get_otp(email)
        if not otp_data:
            return 0
        
        otp_data["attempts"] += 1
        key = f"otp:{email}"
        ttl = self.redis_client.ttl(key)
        if ttl > 0:
            self.redis_client.setex(key, ttl, json.dumps(otp_data))
        return otp_data["attempts"]
    
    async def delete_otp(self, email: str):
        """Delete OTP after successful verification"""
        self.redis_client.delete(f"otp:{email}")
    
    # Session operations
    async def store_session(self, session_id: str, user_id: str, expires_in_hours: int = None):
        """Store user session"""
        if expires_in_hours is None:
            expires_in_hours = settings.access_token_expire_hours
            
        key = f"session:{session_id}"
        data = {
            "user_id": user_id,
            "expires_at": (datetime.now() + timedelta(hours=expires_in_hours)).isoformat()
        }
        self.redis_client.setex(key, timedelta(hours=expires_in_hours), json.dumps(data))
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data"""
        key = f"session:{session_id}"
        data = self.redis_client.get(key)
        return json.loads(data) if data else None
    
    async def delete_session(self, session_id: str):
        """Delete session"""
        self.redis_client.delete(f"session:{session_id}")
    
    # Rate limiting
    async def check_rate_limit(self, key: str, limit: int = None, window_minutes: int = None) -> tuple[bool, int]:
        """Check if rate limit is exceeded. Returns (is_allowed, remaining_attempts)"""
        if limit is None:
            limit = settings.otp_rate_limit_count
        if window_minutes is None:
            window_minutes = settings.otp_rate_limit_window_minutes
            
        current = self.redis_client.get(key)
        if not current:
            self.redis_client.setex(key, timedelta(minutes=window_minutes), 1)
            return True, limit - 1
        
        current = int(current)
        if current >= limit:
            return False, 0
        
        self.redis_client.incr(key)
        return True, limit - current - 1
    
    # Pending user timeout tracking
    async def set_pending_timeout(self, email: str, days: int = None):
        """Set timeout for pending user approval"""
        if days is None:
            days = settings.pending_user_expire_days
            
        key = f"pending_timeout:{email}"
        self.redis_client.setex(key, timedelta(days=days), "1")
    
    async def check_pending_timeout(self, email: str) -> int:
        """Check remaining days for pending approval"""
        key = f"pending_timeout:{email}"
        ttl = self.redis_client.ttl(key)
        return max(0, ttl // 86400) if ttl > 0 else 0  # Convert seconds to days
    
    async def remove_pending_timeout(self, email: str):
        """Remove pending timeout after approval/rejection"""
        self.redis_client.delete(f"pending_timeout:{email}")


# Global instance
redis_client = RedisClient()