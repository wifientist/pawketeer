from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.auth import User, UserApprovalLog
from app.api.schemas.auth import (
    UserSchema,
    PendingUserSchema, 
    UserApprovalSchema,
    MessageResponseSchema,
    AdminStatsSchema
)
from app.services.auth import auth_service
from app.core.redis_client import redis_client
from app.api.dependencies.auth import get_current_admin_user


router = APIRouter(prefix="/admin")


@router.get("/stats", response_model=AdminStatsSchema)
async def get_admin_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get admin dashboard statistics.
    """
    total_users = db.query(User).count()
    pending_users = db.query(User).filter(User.status == "pending").count()
    approved_users = db.query(User).filter(User.status == "approved").count()
    rejected_users = db.query(User).filter(User.status == "rejected").count()
    
    return AdminStatsSchema(
        total_users=total_users,
        pending_users=pending_users,
        approved_users=approved_users,
        rejected_users=rejected_users
    )


@router.get("/pending-users", response_model=List[PendingUserSchema])
async def get_pending_users(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get list of pending users awaiting approval.
    Includes days remaining before timeout.
    """
    pending_users = (
        db.query(User)
        .filter(User.status == "pending")
        .order_by(User.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    # Add days remaining for each user
    result = []
    for user in pending_users:
        days_remaining = await redis_client.check_pending_timeout(user.email)
        result.append(PendingUserSchema(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
            days_remaining=days_remaining
        ))
    
    return result


@router.get("/users", response_model=List[UserSchema])
async def get_all_users(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(None, regex="^(pending|approved|rejected)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all users with optional status filtering.
    """
    query = db.query(User)
    
    if status_filter:
        query = query.filter(User.status == status_filter)
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.post("/approve-user/{user_id}", response_model=MessageResponseSchema)
async def approve_user(
    user_id: str,
    approval_data: UserApprovalSchema,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Approve a pending user.
    """
    # Get the user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not pending approval"
        )
    
    # Update user status
    user.status = "approved"
    user.approved_at = datetime.now()
    user.approved_by = current_admin.id
    
    # Log the approval
    approval_log = UserApprovalLog(
        user_id=user.id,
        admin_id=current_admin.id,
        action="approved",
        notes=approval_data.notes
    )
    db.add(approval_log)
    
    # Remove pending timeout from Redis
    await redis_client.remove_pending_timeout(user.email)
    
    db.commit()
    
    # Send approval notification email
    await auth_service.send_approval_notification(user.email)
    
    return {"message": f"User {user.email} has been approved"}


@router.post("/reject-user/{user_id}", response_model=MessageResponseSchema)
async def reject_user(
    user_id: str,
    rejection_data: UserApprovalSchema,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Reject a pending user.
    """
    # Get the user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not pending approval"
        )
    
    # Update user status
    user.status = "rejected"
    
    # Log the rejection
    rejection_log = UserApprovalLog(
        user_id=user.id,
        admin_id=current_admin.id,
        action="rejected",
        notes=rejection_data.notes
    )
    db.add(rejection_log)
    
    # Remove pending timeout from Redis
    await redis_client.remove_pending_timeout(user.email)
    
    db.commit()
    
    return {"message": f"User {user.email} has been rejected"}


@router.get("/user/{user_id}", response_model=UserSchema)
async def get_user_details(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.get("/approval-logs/{user_id}")
async def get_user_approval_logs(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get approval/rejection history for a user.
    """
    logs = (
        db.query(UserApprovalLog)
        .filter(UserApprovalLog.user_id == user_id)
        .order_by(UserApprovalLog.created_at.desc())
        .all()
    )
    
    return [
        {
            "id": log.id,
            "action": log.action,
            "notes": log.notes,
            "created_at": log.created_at,
            "admin_email": log.admin.email
        }
        for log in logs
    ]


@router.post("/make-admin/{user_id}", response_model=MessageResponseSchema)
async def make_user_admin(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Grant admin privileges to a user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be approved first"
        )
    
    if user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an admin"
        )
    
    user.is_admin = True
    db.commit()
    
    return {"message": f"User {user.email} has been granted admin privileges"}


@router.delete("/revoke-admin/{user_id}", response_model=MessageResponseSchema)
async def revoke_admin_privileges(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Revoke admin privileges from a user.
    """
    if str(current_admin.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke your own admin privileges"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an admin"
        )
    
    user.is_admin = False
    db.commit()
    
    return {"message": f"Admin privileges revoked from {user.email}"}


@router.delete("/cleanup-expired")
async def cleanup_expired_pending_users(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger cleanup of expired pending users (7+ days old).
    This would normally be handled by a background job.
    """
    cutoff_date = datetime.now() - timedelta(days=7)
    
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
        # Check if Redis timeout has also expired
        days_remaining = await redis_client.check_pending_timeout(user.email)
        if days_remaining == 0:
            db.delete(user)
            await redis_client.remove_pending_timeout(user.email)
            count += 1
    
    db.commit()
    
    return {"message": f"Cleaned up {count} expired pending users"}