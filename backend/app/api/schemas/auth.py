from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# Request schemas
class AccessRequestSchema(BaseModel):
    email: EmailStr


class OTPRequestSchema(BaseModel):
    email: EmailStr


class OTPVerifySchema(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class UserApprovalSchema(BaseModel):
    notes: Optional[str] = None


# Response schemas
class UserSchema(BaseModel):
    id: UUID
    email: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    is_admin: bool = False
    
    class Config:
        from_attributes = True


class PendingUserSchema(BaseModel):
    id: UUID
    email: str
    created_at: datetime
    days_remaining: int
    
    class Config:
        from_attributes = True


class AuthResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema


class MessageResponseSchema(BaseModel):
    message: str


class AdminStatsSchema(BaseModel):
    total_users: int
    pending_users: int
    approved_users: int
    rejected_users: int