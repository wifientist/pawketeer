# app/services/analyzers.py
from collections import defaultdict, deque
from time import time
from scapy.layers.dot11 import (
    Dot11, Dot11Deauth, Dot11Disas, Dot11Beacon, Dot11ProbeReq, Dot11ProbeResp, Dot11Elt
)
from .agent_bus import Analyzer

import string

PRINTABLE = set(bytes(string.printable, "ascii"))

def _ascii_printable(b: bytes) -> str | None:
    if not isinstance(b, (bytes, bytearray)):
        return None
    if len(b) == 0:
        return None  # wildcard SSID; ignore for PNL/EvilTwin
    s = bytes(b)
    # keep only printable ASCII (avoid control chars / binary)
    s = bytes(ch for ch in s if ch in PRINTABLE and ch not in b"\r\n\t\x0b\x0c")
    try:
        out = s.decode("utf-8", errors="ignore")
        return out if out else None
    except Exception:
        return None

def _addr_lower(x):
    return x.lower() if isinstance(x, str) else None

#def _addr_lower(x): return x.lower() if x else None

class DeauthDisassoc(Analyzer):
    def __init__(self, burst_window_s=5, burst_threshold=20):
        self.deauth = 0; self.disas = 0
        self.by_src = defaultdict(int)
        self.win = burst_window_s; self.th = burst_threshold
        self.events = deque()  # (ts, src)
        self.bursts = []

    def on_packet(self, pkt):
        d11 = pkt.getlayer(Dot11)
        ts = time()
        src = _addr_lower(getattr(d11, "addr2", None))
        if pkt.haslayer(Dot11Deauth):
            self.deauth += 1
            if src: self.by_src[src] += 1; self.events.append((ts, src))
        elif pkt.haslayer(Dot11Disas):
            self.disas += 1
            if src: self.by_src[src] += 1; self.events.append((ts, src))

        while self.events and ts - self.events[0][0] > self.win:
            self.events.popleft()
        if len(self.events) >= self.th:
            # attribute burst to most frequent source in window
            counts = defaultdict(int)
            for _, s in self.events:
                if s: counts[s] += 1
            if counts:
                top = max(counts.items(), key=lambda kv: kv[1])[0]
                self.bursts.append({"bssid": top, "count": len(self.events), "window_s": self.win})
            self.events.clear()

    def finalize(self):
        top = sorted(self.by_src.items(), key=lambda kv: kv[1], reverse=True)[:5]
        return {
            "total_deauth": self.deauth,
            "total_disassoc": self.disas,
            "top_sources": [{"mac": m, "count": c} for m,c in top],
            "suspicious_bursts": self.bursts,
        }


class EvilTwinHeuristic(Analyzer):
    def __init__(self):
        self.ssids = defaultdict(list)  # ssid -> [{bssid, chan, sec}]

    def on_packet(self, pkt):
        if not (pkt.haslayer(Dot11Beacon) or pkt.haslayer(Dot11ProbeResp)):
            return
        d11 = pkt[Dot11]
        bssid = _addr_lower(d11.addr2)
        ssid, chan, sec = None, None, "Open"

        elt = pkt.getlayer(Dot11Elt)
        while elt:
            if elt.ID == 0:
                ssid = _ascii_printable(elt.info)
            elif elt.ID == 3:
                # DS Parameter Set – channel number
                if elt.info and len(elt.info) >= 1:
                    chan = int(elt.info[0])
            elif elt.ID == 48:
                sec = "RSN"  # coarse; refine later with RSN parser
            elt = elt.payload.getlayer(Dot11Elt)

        if bssid and ssid is not None:
            self.ssids[ssid].append({"bssid": bssid, "chan": chan, "sec": sec})

    def finalize(self):
        suspects = []
        for ssid, lst in self.ssids.items():
            secs = {e["sec"] for e in lst}
            chans = {e["chan"] for e in lst if e["chan"] is not None}
            if ("Open" in secs and len(secs) > 1):
                suspects.append({"ssid": ssid, "reason": "open+secure mismatch"})
            elif len(chans) > 1 and len(lst) >= 2:
                suspects.append({"ssid": ssid, "reason": "channel discrepancy"})
        # JSON-safe copy
        return {
            "ssids": {ssid: lst for ssid, lst in self.ssids.items()},
            "suspected_evil_twins": suspects,
        }


class ProbePrivacy(Analyzer):
    def __init__(self):
        self.pnls = defaultdict(set)  # sta -> {ssid}

    def on_packet(self, pkt):
        if not pkt.haslayer(Dot11ProbeReq):
            return
        d11 = pkt[Dot11]
        sta = _addr_lower(getattr(d11, "addr2", None))
        if not sta:
            return
        elt = pkt.getlayer(Dot11Elt)
        while elt:
            if elt.ID == 0:
                ssid = _ascii_printable(elt.info)
                if ssid:  # drop wildcard/garbage
                    self.pnls[sta].add(ssid)
            elt = elt.payload.getlayer(Dot11Elt)

    def finalize(self):
        clients = [{"sta": k, "pnl": sorted(list(v))} for k, v in self.pnls.items()]
        big = [{"sta": c["sta"], "count": len(c["pnl"])} for c in clients if len(c["pnl"]) >= 5]
        return {"clients": clients, "clients_with_large_pnl": big, "risky_matches": []}


class WeakSecurity(Analyzer):
    def __init__(self):
        self.aps = {}  # bssid -> {ssid, security, pmf}
    def on_packet(self, pkt):
        if not pkt.haslayer(Dot11Beacon): return
        d11 = pkt[Dot11]; bssid = _addr_lower(d11.addr2)
        ssid, pmf, security = None, "unknown", "Open"
        elt = pkt.getlayer(Dot11Elt)
        while elt:
            if elt.ID == 0: ssid = (elt.info or b"").decode(errors="ignore")
            if elt.ID == 48: security = "WPA2/3"  # coarse for now
            # PMF lives in RSN Capabilities; omitted in this first pass
            elt = elt.payload.getlayer(Dot11Elt)
        if bssid: self.aps[bssid] = {"bssid": bssid, "ssid": ssid, "security": security, "pmf": pmf}
    def finalize(self):
        weak = [a for a in self.aps.values() if a["security"] == "Open"]
        return {"aps": list(self.aps.values()), "weak_aps": weak}
