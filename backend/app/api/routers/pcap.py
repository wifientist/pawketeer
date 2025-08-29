# api/routers/pcap.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB
import json
from app.core.database import get_db, SessionLocal  # <-- import the session factory
from app.models.pcap import PcapFile, PcapAnalysis
from app.services.analysis import analyze_pcap

router = APIRouter(prefix="/pcaps", tags=["pcaps"])

def _run_analysis(analysis_id: int):
    """
    Background task:
      - open a fresh SessionLocal()
      - mark 'running'
      - run analyze_pcap(file_path)
      - persist results or error
    """    
    db: Session = SessionLocal()
    try:
        analysis = db.get(PcapAnalysis, analysis_id)
        if not analysis:
            return  # nothing to do

        pcap = db.get(PcapFile, analysis.pcap_id)
        if not pcap:
            analysis.status = "error"
            analysis.error = "pcap missing"
            analysis.completed_at = datetime.utcnow()
            db.commit()
            return

        analysis.status = "running"
        if not analysis.started_at:
            analysis.started_at = datetime.utcnow()
        analysis.error = None
        db.commit()

        result = analyze_pcap(pcap.file_path)  # <- your scapy-based analyzer

        analysis.total_packets   = result.get("total_packets", 0)
        analysis.unique_devices  = result.get("unique_devices", 0)
        analysis.unique_aps      = result.get("unique_aps", 0)
        analysis.unique_clients  = result.get("unique_clients", 0)
        analysis.ssid_count      = result.get("ssid_count", 0)
        analysis.duration_ms     = result.get("duration_ms", 0.0)
        analysis.status          = "ok"
        analysis.frame_mix       = result.get("frame_mix", {})
        analysis.details         = result.get("details", {})
        #if hasattr(analysis, "details"):
        #    analysis.details = result.get("details", {})
        if not analysis.completed_at:
            analysis.completed_at = datetime.utcnow()

        #print("\n-$--$--$-\nDetails about to save: %s", json.dumps(result.get("details", {}), indent=2)[:500])

        db.commit()

    except Exception as e:
        # best-effort failure record
        try:
            analysis = db.get(PcapAnalysis, analysis_id)
            if analysis:
                analysis.status = "error"
                analysis.error = str(e)
                analysis.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/{pcap_id:int}/analyze")
def start_analysis(pcap_id: int, bg: BackgroundTasks, db: Session = Depends(get_db)):
    pcap = db.get(PcapFile, pcap_id)
    if not pcap:
        raise HTTPException(404, "pcap not found")

    # Optional: prevent piling up jobs if one is already recent/pending/running
    latest = (
        db.query(PcapAnalysis)
          .filter(PcapAnalysis.pcap_id == pcap_id)
          .order_by(PcapAnalysis.id.desc())
          .first()
    )
    if latest and latest.status in ("pending", "running"):
        return {"analysis_id": latest.id, "status": latest.status, "message": "Already in progress"}

    analysis = PcapAnalysis(
        pcap_id=pcap.id,
        status="pending",
        started_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # Launch background task with the ANALYSIS ID only (not the session)
    bg.add_task(_run_analysis, analysis.id)
    return {"analysis_id": analysis.id, "status": "queued"}


@router.get("/{pcap_id:int}/analysis/latest")
def get_latest(pcap_id: int, db: Session = Depends(get_db)):
    a = (
        db.query(PcapAnalysis)
          .filter(PcapAnalysis.pcap_id == pcap_id)
          .order_by(PcapAnalysis.id.desc())
          .first()
    )
    if not a:
        raise HTTPException(404, "no analysis yet")
    return {
        "id": a.id,
        "status": a.status,
        "error": a.error,
        "started_at": a.started_at,
        "completed_at": a.completed_at,
        "duration_ms": a.duration_ms,
        "total_packets": a.total_packets,
        "unique_devices": a.unique_devices,
        "unique_aps": a.unique_aps,
        "unique_clients": a.unique_clients,
        "ssid_count": a.ssid_count,
        "frame_mix": getattr(a, "frame_mix", None),
        "details": getattr(a, "details", None),
    }

@router.get("/list")
def list_pcaps(db: Session = Depends(get_db)):
    """
    List all pcaps with their latest analysis (if any).
    """
    # subquery: latest analysis id per pcap
    latest = (
        db.query(
            PcapAnalysis.pcap_id.label("pcap_id"),
            func.max(PcapAnalysis.id).label("latest_id"),
        )
        .group_by(PcapAnalysis.pcap_id)
        .subquery()
    )

    # join pcap_files -> latest -> pcap_analyses (nullable)
    rows = (
        db.query(PcapFile, PcapAnalysis)
        .outerjoin(latest, latest.c.pcap_id == PcapFile.id)
        .outerjoin(PcapAnalysis, PcapAnalysis.id == latest.c.latest_id)
        .order_by(PcapFile.uploaded_at.desc())
        .all()
    )

    out = []
    for pcap, ana in rows:
        out.append({
            "pcap": {
                "id": pcap.id,
                "filename": pcap.filename,
                "file_path": pcap.file_path,
                "size_bytes": pcap.size_bytes,
                "uploaded_at": pcap.uploaded_at,
            },
            "latest_analysis": None if ana is None else {
                "id": ana.id,
                "status": ana.status,
                "error": ana.error,
                "started_at": ana.started_at,
                "completed_at": getattr(ana, "completed_at", None),
                "duration_ms": ana.duration_ms,
                "total_packets": ana.total_packets,
                "unique_devices": ana.unique_devices,
                "unique_aps": ana.unique_aps,
                "unique_clients": ana.unique_clients,
                "ssid_count": ana.ssid_count,
                "frame_mix": getattr(ana, "frame_mix", None),
                "details": getattr(ana, "details", None),
            },
        })
    return out


@router.get("/{pcap_id:int}/combo")
def get_pcap_with_analyses(
    pcap_id: int,
    latest_only: bool = Query(False, description="If true, return only the latest analysis"),
    db: Session = Depends(get_db),
):
    """
    Return a single PCAP and either all analyses or only the latest.
    """
    pcap = db.get(PcapFile, pcap_id)
    if not pcap:
        raise HTTPException(404, "pcap not found")

    if latest_only:
        ana = (
            db.query(PcapAnalysis)
            .filter(PcapAnalysis.pcap_id == pcap_id)
            .order_by(PcapAnalysis.id.desc())
            .first()
        )
        analyses = [] if not ana else [ana]
    else:
        analyses = (
            db.query(PcapAnalysis)
            .filter(PcapAnalysis.pcap_id == pcap_id)
            .order_by(PcapAnalysis.id.desc())
            .all()
        )

    return {
        "pcap": {
            "id": pcap.id,
            "filename": pcap.filename,
            "file_path": pcap.file_path,
            "size_bytes": pcap.size_bytes,
            "uploaded_at": pcap.uploaded_at,
        },
        "analyses": [
            {
                "id": a.id,
                "status": a.status,
                "error": a.error,
                "started_at": a.started_at,
                "completed_at": getattr(a, "completed_at", None),
                "duration_ms": a.duration_ms,
                "total_packets": a.total_packets,
                "unique_devices": a.unique_devices,
                "unique_aps": a.unique_aps,
                "unique_clients": a.unique_clients,
                "ssid_count": a.ssid_count,
                "frame_mix": getattr(a, "frame_mix", None),
                "details": getattr(a, "details", None),
            }
            for a in analyses
        ],
    }