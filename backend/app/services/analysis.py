# app/services/analysis.py
from time import perf_counter
from collections import defaultdict, Counter
from scapy.all import RawPcapReader
from scapy.layers.dot11 import Dot11, Dot11Beacon, Dot11ProbeReq, Dot11ProbeResp, Dot11Deauth, Dot11Disas
from .agent_bus import run_analyzers_over_stream, safe_dot11_decode
from .analyzers import DeauthDisassoc, EvilTwinHeuristic, ProbePrivacy, WeakSecurity

def analyze_pcap(path: str) -> dict:
    """
    Returns a dict with:
      total_packets, unique_devices, unique_aps, unique_clients, ssid_count, duration_ms, details
    details: results of specialized analyzers keyed by class name
    """
    t0 = perf_counter()

    total_packets = 0
    devices = set()
    aps = set()
    clients = set()
    ssids = set()

    # Instantiate specialized analyzers
    analyzers = [
        DeauthDisassoc(burst_window_s=10, burst_threshold=40),
        EvilTwinHeuristic(),
        ProbePrivacy(),
        WeakSecurity(),
        # HandshakePMKID()  # add once implemented robustly
    ]

    frame_mix = Counter()

    # Stream once and update both the summary + analyzers
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, _meta) in raw_iter:
        total_packets += 1

        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue

        dot11 = pkt.getlayer(Dot11)
        if not dot11:
            continue

        if pkt.haslayer(Dot11Beacon): frame_mix["beacon"] += 1
        if pkt.haslayer(Dot11ProbeReq): frame_mix["probe_req"] += 1
        if pkt.haslayer(Dot11ProbeResp): frame_mix["probe_resp"] += 1
        if pkt.haslayer(Dot11Deauth): frame_mix["deauth"] += 1
        if pkt.haslayer(Dot11Disas): frame_mix["disassoc"] += 1

        # summary: devices
        for addr in (getattr(dot11, "addr1", None), getattr(dot11, "addr2", None),
                     getattr(dot11, "addr3", None), getattr(dot11, "addr4", None)):
            if addr:
                devices.add(addr.lower())

        # summary: APs / SSIDs
        if pkt.haslayer(Dot11Beacon) or pkt.haslayer(Dot11ProbeResp):
            if dot11.addr2:
                aps.add(dot11.addr2.lower())
            elt = pkt.getlayer("Dot11Elt")
            while elt is not None:
                if getattr(elt, "ID", None) == 0:
                    info = getattr(elt, "info", b"")
                    if isinstance(info, (bytes, bytearray)):
                        ssids.add(info.decode(errors="ignore"))
                elt = elt.payload.getlayer("Dot11Elt")

        # summary: clients (probe requests)
        if pkt.haslayer(Dot11ProbeReq):
            if dot11.addr2:
                clients.add(dot11.addr2.lower())

        # feed the specialized analyzers
        for a in analyzers:
            a.on_packet(pkt)

    # finalize
    duration_ms = round((perf_counter() - t0) * 1000.0, 2)
    details = {a.__class__.__name__: a.finalize() for a in analyzers}

    return {
        "total_packets": total_packets,
        "unique_devices": len(devices),
        "unique_aps": len(aps),
        "unique_clients": len(clients),
        "ssid_count": len(ssids),
        "duration_ms": duration_ms,
        "frame_mix": dict(frame_mix),
        "details": details,  # <-- specialized outputs
    }
