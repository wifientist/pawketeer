# app/services/agent_bus.py
from scapy.all import RadioTap, Dot11

class Analyzer:
    """Interface for specialized analyzers."""
    def on_packet(self, pkt): ...
    def finalize(self) -> dict: return {}

def safe_dot11_decode(raw: bytes):
    try:
        return RadioTap(raw)
    except Exception:
        try:
            return Dot11(raw)
        except Exception:
            return None

def run_analyzers_over_stream(raw_iterable, analyzers: list[Analyzer]):
    """Feed a stream of raw frames to analyzers once."""
    for raw, _meta in raw_iterable:
        pkt = safe_dot11_decode(raw)
        if pkt is None or not pkt.haslayer(Dot11):
            continue
        for a in analyzers:
            a.on_packet(pkt)
    # collect
    out = {}
    for a in analyzers:
        out[a.__class__.__name__] = a.finalize()
    return out
