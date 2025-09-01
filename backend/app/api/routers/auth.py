from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.schemas.auth import (
    AccessRequestSchema, 
    OTPRequestSchema, 
    OTPVerifySchema,
    AuthResponseSchema,
    MessageResponseSchema,
    UserSchema
)
from app.services.auth import auth_service
from app.api.dependencies.auth import get_current_user


router = APIRouter(prefix="/auth")

@router.post("/request-access", response_model=MessageResponseSchema)
async def request_access(
    request: AccessRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Request access to the platform.
    Creates a pending user awaiting admin approval.
    """
    return await auth_service.request_access(request.email, db)


@router.post("/request-otp", response_model=MessageResponseSchema)
async def request_otp(
    request: OTPRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Request OTP for login.
    Only works for approved users.
    Rate limited to 5 requests per hour per email.
    """
    return await auth_service.request_otp(request.email, db)


@router.post("/verify-otp", response_model=AuthResponseSchema)
async def verify_otp(
    request: OTPVerifySchema,
    db: Session = Depends(get_db)
):
    """
    Verify OTP and get access token.
    Creates an authenticated session.
    """
    return await auth_service.verify_otp(request.email, request.otp_code, db)


@router.get("/me", response_model=UserSchema)
async def get_me(current_user = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    return current_user


@router.post("/logout", response_model=MessageResponseSchema)
async def logout(
    current_user = Depends(get_current_user)
):
    """
    Logout user and invalidate session.
    Note: With JWT, client should delete the token.
    This endpoint is here for consistency and future session management.
    """
    return {"message": "Successfully logged out"}


@router.get("/status")
async def auth_status():
    """
    Check if auth service is running.
    Public endpoint for health checks.
    """
    return {"status": "Auth service is running"}