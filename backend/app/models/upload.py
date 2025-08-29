from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
import uuid

class Upload(Base):
    __tablename__ = "uploads"
    
    # Primary key (using UUID for better scalability)
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    
    # File information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=False)
    file_extension = Column(String(10), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256 hash for duplicate detection
    
    # Status and timestamps
    status = Column(String(50), default="uploaded", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Analysis results (using JSONB for better querying)
    analysis_results = Column(JSONB, nullable=True)
    
    # Metadata
    upload_ip = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Processing information
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Indexes for better performance
    __table_args__ = (
        Index('ix_uploads_status_created', 'status', 'created_at'),
        Index('ix_uploads_file_extension', 'file_extension'),
    )
    
    def __repr__(self):
        return f"<Upload(id={self.id}, uuid='{self.uuid}', filename='{self.filename}', status='{self.status}')>"
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "filename": self.original_filename,
            "file_size": self.file_size,
            "file_extension": self.file_extension,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "processing_started_at": self.processing_started_at.isoformat() if self.processing_started_at else None,
            "processing_completed_at": self.processing_completed_at.isoformat() if self.processing_completed_at else None,
            "error_message": self.error_message,
        }