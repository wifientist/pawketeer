# models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict

from datetime import datetime
from app.core.database import Base


class PcapFile(Base):
    __tablename__ = "pcap_files"
    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)      # original upload name
    file_path = Column(String, nullable=False)     # path on disk
    size_bytes = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    # relationship
    analyses = relationship("PcapAnalysis", back_populates="pcap", cascade="all,delete")
    upload = relationship("Upload", back_populates="pcap", uselist=False)


class PcapAnalysis(Base):
    __tablename__ = "pcap_analyses"
    id = Column(Integer, primary_key=True)
    pcap_id = Column(Integer, ForeignKey("pcap_files.id"), nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Float)                    # how long the run took
    status = Column(String, default="pending")     # pending|ok|error
    error = Column(Text)
    details = Column(MutableDict.as_mutable(JSONB), nullable=True)

    total_packets = Column(Integer, default=0)
    unique_devices = Column(Integer, default=0)
    unique_aps = Column(Integer, default=0)
    unique_clients = Column(Integer, default=0)
    ssid_count = Column(Integer, default=0)        # optional, for a fun metric

    pcap = relationship("PcapFile", back_populates="analyses")
