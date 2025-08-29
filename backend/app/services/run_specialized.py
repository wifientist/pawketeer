# app/services/run_specialized.py
from app.services.agent_bus import run_analyzers
from app.services.analyzers import (
    DeauthDisassoc, EvilTwinHeuristic, HandshakePMKID, ProbePrivacy, WeakSecurity
)

def run_specialized(pcap_path: str) -> dict:
    analyzers = [
        DeauthDisassoc(burst_window_s=10, burst_threshold=40),
        EvilTwinHeuristic(),
        HandshakePMKID(),
        ProbePrivacy(),
        WeakSecurity(),
    ]
    return run_analyzers(pcap_path, analyzers)
