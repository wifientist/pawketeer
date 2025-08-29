# api/routers/uploads.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.config import settings
from app.core.database import get_db
from app.services.upload_service import UploadService
from app.models.upload import Upload

router = APIRouter()

def get_client_ip(request: Request) -> str:
    """Get client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host

@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a packet capture file and save to PostgreSQL"""
    
    # Read file content
    file_content = await file.read()
    
    # Check file size
    if len(file_content) > settings.max_file_size:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Max size: {settings.max_file_size / (1024*1024):.1f}MB"
        )
    
    # Check file extension
    file_extension = None
    if file.filename:
        file_extension = "." + file.filename.split(".")[-1].lower()
        if file_extension not in [ext.lower() for ext in settings.allowed_extensions]:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(settings.allowed_extensions)}"
            )
    
    # Get client info
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")
    
    # Create upload using service (this saves to disk AND database)
    upload_service = UploadService(db)
    upload = upload_service.create_upload(
        filename=file.filename,
        file_size=len(file_content),
        file_content=file_content,
        client_ip=client_ip,
        user_agent=user_agent
    )
    
    return {
        "message": "File uploaded successfully",
        "id": upload.id,
        "uuid": str(upload.uuid),
        "filename": upload.original_filename,
        "size": upload.file_size,
        "extension": upload.file_extension,
        "status": upload.status,
        "created_at": upload.created_at.isoformat(),
        "pcap_id": upload.pcap_id
    }

@router.get("/uploads")
async def list_uploads(
    limit: int = 100,
    offset: int = 0,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all uploaded files with pagination"""
    
    upload_service = UploadService(db)
    uploads = upload_service.get_all_uploads(limit=limit, offset=offset, status=status)
    total_count = upload_service.get_uploads_count(status=status)
    
    return {
        "uploads": [upload.to_dict() for upload in uploads],
        "count": len(uploads),
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "status_filter": status
    }

@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: int, db: Session = Depends(get_db)):
    """Get upload details by ID"""
    
    upload_service = UploadService(db)
    upload = upload_service.get_upload_by_id(upload_id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return upload.to_dict()

@router.delete("/uploads/{upload_id}")
async def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    """Delete an upload and its file"""
    
    upload_service = UploadService(db)
    success = upload_service.delete_upload(upload_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return {"message": "Upload deleted successfully", "id": upload_id}

# @router.get("/analysis/{upload_id}")
# async def get_analysis(upload_id: int, db: Session = Depends(get_db)):
#     """Get analysis results for an upload"""
    
#     upload_service = UploadService(db)
#     upload = upload_service.get_upload_by_id(upload_id)
    
#     if not upload:
#         raise HTTPException(status_code=404, detail="Upload not found")
    
#     # Check if we have stored analysis results
#     analysis_results = upload_service.get_analysis_results(upload_id)
    
#     if analysis_results:
#         return {
#             "id": upload_id,
#             "uuid": str(upload.uuid),
#             "filename": upload.original_filename,
#             "status": upload.status,
#             "file_info": {
#                 "size": upload.file_size,
#                 "extension": upload.file_extension,
#                 "created_at": upload.created_at.isoformat(),
#                 "file_path": upload.file_path
#             },
#             **analysis_results
#         }
    
#     # Generate and save placeholder analysis (for now)
#     placeholder_analysis = {
#         "summary": {
#             "total_packets": 1234,
#             "devices_found": 5,
#             "security_score": 85,
#             "analysis_time": "2.3s"
#         },
#         "message": "Analysis complete (placeholder data from PostgreSQL)"
#     }
    
#     # Save placeholder analysis to database
#     upload_service.save_analysis_results(upload_id, placeholder_analysis)
    
#     return {
#         "id": upload_id,
#         "uuid": str(upload.uuid),
#         "filename": upload.original_filename,
#         "status": "completed",
#         "file_info": {
#             "size": upload.file_size,
#             "extension": upload.file_extension,
#             "created_at": upload.created_at.isoformat(),
#             "file_path": upload.file_path
#         },
#         **placeholder_analysis
#     }

# @router.get("/stats")
# async def get_storage_stats(db: Session = Depends(get_db)):
#     """Get storage and upload statistics"""
    
#     upload_service = UploadService(db)
#     stats = upload_service.get_storage_stats()
    
#     return {
#         "message": "Storage statistics",
#         **stats
#     }

@router.get("/search")
async def search_uploads(
    q: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Search uploads by filename"""
    
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    upload_service = UploadService(db)
    uploads = upload_service.search_uploads(q.strip(), limit=limit)
    
    return {
        "query": q,
        "results": [upload.to_dict() for upload in uploads],
        "count": len(uploads)
    }
