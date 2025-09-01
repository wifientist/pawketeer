# app/services/analysis.py
from .smart_analysis import smart_analyze_pcap

def analyze_pcap(path: str, smart_mode: bool = True) -> dict:
    """
    Main PCAP analysis entry point.
    
    Args:
        path: Path to PCAP file
        smart_mode: If True, uses intelligent analyzer selection based on traffic profile
                   If False, runs all analyzers (legacy mode)
    
    Returns:
        Analysis results with frame_mix, traffic profile, and specialized analyzer outputs
    """
    return smart_analyze_pcap(path, auto_select_analyzers=smart_mode)
