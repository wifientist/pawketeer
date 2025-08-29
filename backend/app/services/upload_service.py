from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.upload import Upload
from app.core.config import settings
import os
import uuid
import hashlib
from datetime import datetime
from typing import List, Optional

class UploadService:
    """Service for handling upload operations with PostgreSQL"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA-256 hash of file content"""
        return hashlib.sha256(file_content).hexdigest()
    
    def _ensure_upload_directory(self):
        """Ensure upload directory exists"""
        os.makedirs(settings.upload_directory, exist_ok=True)
        print(f"📁 Upload directory: {os.path.abspath(settings.upload_directory)}")
    
    def create_upload(self, filename: str, file_size: int, file_content: bytes, 
                     client_ip: str = None, user_agent: str = None) -> Upload:
        """Create a new upload record and save file"""
        
        self._ensure_upload_directory()
        
        # Calculate file hash for duplicate detection
        file_hash = self._calculate_file_hash(file_content)
        
        # Check for existing file with same hash
        existing = self.db.query(Upload).filter(Upload.file_hash == file_hash).first()
        if existing:
            print(f"🔄 Found duplicate file: {existing.original_filename}")
            return existing
        
        # Extract file extension
        file_extension = None
        if filename:
            file_extension = "." + filename.split(".")[-1].lower()
        
        # Generate unique filename to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = f"{unique_id}_{filename}" if filename else f"{unique_id}.pcap"
        
        # Save file to disk
        file_path = os.path.join(settings.upload_directory, safe_filename)
        try:
            with open(file_path, "wb") as f:
                f.write(file_content)
            print(f"💾 File saved: {file_path} ({file_size} bytes)")
        except Exception as e:
            print(f"❌ Error saving file: {e}")
            raise
        
        # Create database record
        upload = Upload(
            filename=safe_filename,
            original_filename=filename,
            file_path=file_path,
            file_size=file_size,
            file_extension=file_extension,
            file_hash=file_hash,
            status="uploaded",
            upload_ip=client_ip,
            user_agent=user_agent
        )
        
        try:
            self.db.add(upload)
            self.db.commit()
            self.db.refresh(upload)
            print(f"✅ Database record created: ID={upload.id}, UUID={upload.uuid}")
        except Exception as e:
            print(f"❌ Database error: {e}")
            # Clean up file if database insert fails
            if os.path.exists(file_path):
                os.remove(file_path)
            raise
        
        return upload
    
    def get_upload_by_id(self, upload_id: int) -> Optional[Upload]:
        """Get upload by ID"""
        return self.db.query(Upload).filter(Upload.id == upload_id).first()
    
    def get_upload_by_uuid(self, upload_uuid: str) -> Optional[Upload]:
        """Get upload by UUID"""
        return self.db.query(Upload).filter(Upload.uuid == upload_uuid).first()
    
    def get_all_uploads(self, limit: int = 100, offset: int = 0, 
                       status: str = None) -> List[Upload]:
        """Get all uploads with pagination and optional status filter"""
        query = self.db.query(Upload)
        
        if status:
            query = query.filter(Upload.status == status)
        
        return query.order_by(Upload.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_uploads_count(self, status: str = None) -> int:
        """Get total count of uploads with optional status filter"""
        query = self.db.query(Upload)
        
        if status:
            query = query.filter(Upload.status == status)
            
        return query.count()
    
    def update_upload_status(self, upload_id: int, status: str, 
                           error_message: str = None) -> Optional[Upload]:
        """Update upload status with optional error message"""
        upload = self.get_upload_by_id(upload_id)
        if upload:
            upload.status = status
            upload.updated_at = datetime.utcnow()
            
            if status == "processing":
                upload.processing_started_at = datetime.utcnow()
            elif status in ["completed", "failed"]:
                upload.processing_completed_at = datetime.utcnow()
            
            if error_message:
                upload.error_message = error_message
            
            self.db.commit()
            self.db.refresh(upload)
        return upload
    
    def save_analysis_results(self, upload_id: int, analysis_data: dict) -> Optional[Upload]:
        """Save analysis results to upload (using JSONB)"""
        upload = self.get_upload_by_id(upload_id)
        if upload:
            upload.analysis_results = analysis_data  # Direct assignment to JSONB column
            upload.status = "completed"
            upload.updated_at = datetime.utcnow()
            upload.processing_completed_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(upload)
            print(f"💾 Analysis results saved for upload {upload_id}")
        return upload
    
    def get_analysis_results(self, upload_id: int) -> Optional[dict]:
        """Get analysis results for upload"""
        upload = self.get_upload_by_id(upload_id)
        if upload and upload.analysis_results:
            return upload.analysis_results  # JSONB returns dict directly
        return None
    
    def search_uploads(self, search_term: str, limit: int = 50) -> List[Upload]:
        """Search uploads by filename"""
        return (
            self.db.query(Upload)
            .filter(Upload.original_filename.ilike(f"%{search_term}%"))
            .order_by(Upload.created_at.desc())
            .limit(limit)
            .all()
        )
    
    def get_uploads_by_status(self, status: str) -> List[Upload]:
        """Get all uploads with specific status"""
        return (
            self.db.query(Upload)
            .filter(Upload.status == status)
            .order_by(Upload.created_at.desc())
            .all()
        )
    
    def delete_upload(self, upload_id: int) -> bool:
        """Delete upload and associated file"""
        upload = self.get_upload_by_id(upload_id)
        if upload:
            # Delete file from disk
            if upload.file_path and os.path.exists(upload.file_path):
                try:
                    os.remove(upload.file_path)
                    print(f"🗑️  File deleted: {upload.file_path}")
                except OSError as e:
                    print(f"⚠️  Error deleting file {upload.file_path}: {e}")
            
            # Delete from database
            self.db.delete(upload)
            self.db.commit()
            print(f"🗑️  Database record deleted: ID={upload_id}")
            return True
        return False
    
    def get_storage_stats(self) -> dict:
        """Get storage statistics"""
        total_uploads = self.get_uploads_count()
        total_size = self.db.query(func.sum(Upload.file_size)).scalar() or 0
        
        status_counts = {}
        for status in ["uploaded", "processing", "completed", "failed"]:
            status_counts[status] = self.get_uploads_count(status)
        
        return {
            "total_uploads": total_uploads,
            "total_size_bytes": total_size,
            "total_size_human": self._format_bytes(total_size),
            "status_counts": status_counts,
            "upload_directory": os.path.abspath(settings.upload_directory)
        }
    
    def _format_bytes(self, bytes_value: int) -> str:
        """Format bytes to human readable format"""
        if bytes_value == 0:
            return "0 B"
        
        sizes = ["B", "KB", "MB", "GB", "TB"]
        import math
        i = int(math.floor(math.log(bytes_value, 1024)))
        p = math.pow(1024, i)
        s = round(bytes_value / p, 2)
        return f"{s} {sizes[i]}"
