from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.upload import Upload
from app.models.pcap import PcapFile, PcapAnalysis
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
    
    def create_upload(
        self,
        filename: str,
        file_size: int,
        file_content: bytes,
        client_ip: str = None,
        user_agent: str = None,
        reuse_existing_upload: bool = False,  # set True if you want to just return prior Upload on duplicates
    ) -> Upload:
        """Create Upload, ensure/attach PcapFile, and store file on disk by SHA-256."""

        self._ensure_upload_directory()

        # 1) Hash content
        file_hash = self._calculate_file_hash(file_content)
        file_extension = self._safe_ext(filename)

        # 2) If we've seen this hash before, reuse PcapFile (via any prior Upload)
        prior_upload = (
            self.db.query(Upload)
            .filter(Upload.file_hash == file_hash)
            .order_by(Upload.created_at.desc())
            .first()
        )

        if prior_upload:
            # Option A: return the existing Upload and skip new row
            if reuse_existing_upload:
                return prior_upload

            # Option B (default): create a NEW Upload row that points to the SAME file/pcap
            pcap_id = getattr(prior_upload, "pcap_id", None)
            file_path = prior_upload.file_path

            # If for any reason the prior upload wasn't linked yet, create PcapFile now.
            if not pcap_id:
                pcap = PcapFile(
                    filename=filename or prior_upload.original_filename or "capture.pcap",
                    file_path=file_path,
                    size_bytes=prior_upload.file_size or file_size,
                    uploaded_at=datetime.utcnow(),
                )
                self.db.add(pcap)
                self.db.commit()
                self.db.refresh(pcap)
                pcap_id = pcap.id

            upload = Upload(
                filename=prior_upload.filename,            # keep stored name
                original_filename=filename or prior_upload.original_filename,
                file_path=file_path,
                file_size=file_size,
                file_extension=file_extension or prior_upload.file_extension,
                file_hash=file_hash,
                status="uploaded",
                upload_ip=client_ip,
                user_agent=user_agent,
                pcap_id=pcap_id,
            )
            self.db.add(upload)
            self.db.commit()
            self.db.refresh(upload)
            return upload

        # 3) New file: write to disk using a stable hash-based path
        file_path = self._derive_hashed_path(filename or "capture.pcap", file_hash)
        if not os.path.exists(file_path):
            try:
                with open(file_path, "wb") as f:
                    f.write(file_content)
                print(f"💾 File saved: {file_path} ({file_size} bytes)")
            except Exception as e:
                print(f"❌ Error saving file: {e}")
                raise

        # 4) Create PcapFile (canonical record for analysis)
        pcap = PcapFile(
            filename=filename or os.path.basename(file_path),
            file_path=file_path,
            size_bytes=file_size,
            uploaded_at=datetime.utcnow(),
        )
        self.db.add(pcap)
        self.db.commit()
        self.db.refresh(pcap)

        # 5) Create Upload linked to that PcapFile
        # Keep your current "unique_id_prefix + original name" style if you like;
        # here we just mirror the original filename for clarity.
        unique_prefix = str(uuid.uuid4())[:8]
        stored_filename = f"{unique_prefix}_{filename}" if filename else f"{unique_prefix}.pcap"

        upload = Upload(
            filename=stored_filename,
            original_filename=filename or stored_filename,
            file_path=file_path,
            file_size=file_size,
            file_extension=file_extension,
            file_hash=file_hash,
            status="uploaded",
            upload_ip=client_ip,
            user_agent=user_agent,
            pcap_id=pcap.id,
        )

        try:
            self.db.add(upload)
            self.db.commit()
            self.db.refresh(upload)
            print(f"✅ DB upload created: ID={upload.id}, UUID={upload.uuid}, PCAP_ID={upload.pcap_id}")
        except Exception as e:
            print(f"❌ Database error: {e}")
            # Optional: do NOT delete the hashed file, since others might reference it
            # If you want cleanup on failure, ensure no one else references.
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

    def _safe_ext(self, filename: str) -> str:
        if not filename or "." not in filename:
            return ""
        return "." + filename.rsplit(".", 1)[1].lower()

    def _derive_hashed_path(self, filename: str, sha256: str) -> str:
        # organize by hash prefix; keep extension for convenience
        ext = self._safe_ext(filename)
        sub1, sub2 = sha256[:2], sha256[2:4]
        dirpath = os.path.join(settings.upload_directory, sub1, sub2)
        os.makedirs(dirpath, exist_ok=True)
        return os.path.join(dirpath, f"{sha256}{ext or '.pcap'}")

