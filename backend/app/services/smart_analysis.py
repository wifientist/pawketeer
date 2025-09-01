# app/services/smart_analysis.py
from time import perf_counter
from collections import Counter
from scapy.all import RawPcapReader
from scapy.layers.dot11 import (
    Dot11, Dot11Beacon, Dot11ProbeReq, Dot11ProbeResp, Dot11Deauth, Dot11Disas,
    Dot11AssoReq, Dot11AssoResp, Dot11ReassoReq, Dot11ReassoResp,
    Dot11Auth, Dot11ATIM, Dot11QoS, RadioTap
)
from scapy.layers.dot11 import Dot11WEP, Dot11TKIP, Dot11CCMP

from .agent_bus import safe_dot11_decode
from .analyzers import DeauthDisassoc, EvilTwinHeuristic, ProbePrivacy, WeakSecurity, HandshakePMKID
from .traffic_profiler import TrafficProfiler

def _extract_ssids_from_packet(pkt, ssids_set):
    """
    Robust SSID extraction from beacon/probe response packets.
    Handles various encoding issues and edge cases.
    """
    try:
        # Try multiple approaches to find SSID elements
        elt = pkt.getlayer("Dot11Elt")
        while elt is not None:
            if hasattr(elt, "ID") and elt.ID == 0:  # SSID element (ID=0)
                info = getattr(elt, "info", b"")
                
                # Handle different info types
                if isinstance(info, str):
                    # Already decoded string
                    if info.strip():  # Non-empty after stripping
                        ssids_set.add(info.strip())
                elif isinstance(info, (bytes, bytearray)):
                    if len(info) > 0:  # Non-empty SSID
                        # Try multiple encoding strategies
                        ssid = None
                        
                        # Strategy 1: UTF-8 (most common)
                        try:
                            ssid = info.decode('utf-8').strip()
                            if ssid:
                                ssids_set.add(ssid)
                                break
                        except UnicodeDecodeError:
                            pass
                        
                        # Strategy 2: Latin-1 (fallback for weird encodings)
                        try:
                            ssid = info.decode('latin-1').strip()
                            if ssid and ssid.isprintable():
                                ssids_set.add(ssid)
                                break
                        except UnicodeDecodeError:
                            pass
                        
                        # Strategy 3: UTF-8 with replacement characters
                        try:
                            ssid = info.decode('utf-8', errors='replace').strip()
                            if ssid and '�' not in ssid:  # No replacement chars
                                ssids_set.add(ssid)
                        except Exception:
                            # Last resort: hex representation for debugging
                            hex_ssid = info.hex()
                            if len(hex_ssid) <= 64:  # Max SSID is 32 bytes = 64 hex chars
                                ssids_set.add(f"<hex:{hex_ssid}>")
                
            elt = elt.payload.getlayer("Dot11Elt") if hasattr(elt, 'payload') else None
            
    except Exception as e:
        # Log the error but don't break the analysis
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"SSID extraction error: {e}")

def _categorize_802_11_frame(pkt) -> str:
    """
    Categorize 802.11 frame into specific type with priority-based detection.
    Each packet gets exactly one category to avoid double-counting.
    Handles RadioTap headers properly.
    """
    if not pkt:
        return "non_802_11"
    
    # Handle RadioTap headers - look for 802.11 layer inside
    dot11 = pkt.getlayer(Dot11)
    if not dot11:
        # If no 802.11 layer found, check if it's a RadioTap packet
        if pkt.haslayer(RadioTap):
            return "radiotap_no_dot11"
        return "non_802_11"
    
    # Priority-based categorization (most specific first)
    # Management frames - Authentication/Association
    if pkt.haslayer(Dot11Auth):
        return "auth"
    elif pkt.haslayer(Dot11AssoReq):
        return "assoc_req"
    elif pkt.haslayer(Dot11AssoResp):
        return "assoc_resp"
    elif pkt.haslayer(Dot11ReassoReq):
        return "reassoc_req"
    elif pkt.haslayer(Dot11ReassoResp):
        return "reassoc_resp"
    
    # Management frames - Discovery
    elif pkt.haslayer(Dot11Beacon):
        return "beacon"
    elif pkt.haslayer(Dot11ProbeReq):
        return "probe_req"
    elif pkt.haslayer(Dot11ProbeResp):
        return "probe_resp"
    
    # Management frames - Disconnection
    elif pkt.haslayer(Dot11Deauth):
        return "deauth"
    elif pkt.haslayer(Dot11Disas):
        return "disassoc"
    
    # Other management frames
    elif pkt.haslayer(Dot11ATIM):
        return "atim"
    
    # Data frames
    elif pkt.haslayer(Dot11QoS):
        return "qos_data"
    else:
        # Check frame type/subtype from Dot11 header
        dot11 = pkt.getlayer(Dot11)
        frame_type = (dot11.type, dot11.subtype) if hasattr(dot11, 'type') and hasattr(dot11, 'subtype') else None
        
        if frame_type:
            type_val, subtype_val = frame_type
            
            # Management frames (type 0)
            if type_val == 0:
                return "mgmt_other"
            
            # Control frames (type 1)  
            elif type_val == 1:
                if subtype_val == 11:  # RTS
                    return "rts"
                elif subtype_val == 12:  # CTS
                    return "cts"
                elif subtype_val == 13:  # ACK
                    return "ack"
                elif subtype_val == 10:  # PS-Poll
                    return "ps_poll"
                elif subtype_val == 9:   # CF-End
                    return "cf_end"
                elif subtype_val == 8:   # CF-End + CF-Ack
                    return "cf_end_ack"
                else:
                    return "control_other"
            
            # Data frames (type 2)
            elif type_val == 2:
                if subtype_val == 0:  # Data
                    return "data"
                elif subtype_val == 1:  # Data + CF-Ack
                    return "data_cf_ack"
                elif subtype_val == 2:  # Data + CF-Poll
                    return "data_cf_poll"
                elif subtype_val == 3:  # Data + CF-Ack + CF-Poll
                    return "data_cf_ack_poll"
                elif subtype_val == 4:  # Null (no data)
                    return "null_data"
                elif subtype_val == 5:  # CF-Ack (no data)
                    return "cf_ack"
                elif subtype_val == 6:  # CF-Poll (no data)
                    return "cf_poll"
                elif subtype_val == 7:  # CF-Ack + CF-Poll (no data)
                    return "cf_ack_poll"
                else:
                    return "data_other"
            
            # Reserved or unknown frame type
            else:
                return "reserved"
        
        return "unknown"

def smart_analyze_pcap(path: str, auto_select_analyzers: bool = True) -> dict:
    """
    Enhanced PCAP analysis with intelligent analyzer selection.
    
    Phase 1: Quick frame_mix analysis
    Phase 2: Smart analyzer selection based on traffic profile
    Phase 3: Targeted analysis execution
    """
    import logging
    logger = logging.getLogger(__name__)
    
    t0 = perf_counter()
    logger.info(f"🔍 Starting PCAP analysis: {path}")
    
    # Phase 1: Fast frame counting and basic stats
    logger.info("📊 Phase 1: Analyzing frame composition...")
    basic_stats = _get_basic_stats_and_frame_mix(path)
    logger.info(f"📈 Found {basic_stats['total_packets']} packets: {basic_stats['frame_mix']}")
    
    # Phase 2: Traffic profiling and analyzer selection
    logger.info("🧠 Phase 2: Profiling traffic and selecting analyzers...")
    profile_analysis = TrafficProfiler.analyze_traffic_profile(
        basic_stats["frame_mix"], 
        basic_stats["total_packets"]
    )
    logger.info(f"🏷️ Traffic profile: {profile_analysis['profile']}")
    
    # Phase 3: Run selected analyzers
    if auto_select_analyzers:
        selected_analyzers = _select_analyzers_from_profile(profile_analysis)
        selection_reasoning = _get_selection_reasoning(profile_analysis, selected_analyzers)
        logger.info(f"🎯 Selected {len(selected_analyzers)} analyzers based on profile: {[a.__class__.__name__ for a in selected_analyzers]}")
    else:
        # Run all analyzers (current behavior)
        selected_analyzers = [
            DeauthDisassoc(burst_window_s=10, burst_threshold=40),
            EvilTwinHeuristic(),
            ProbePrivacy(), 
            WeakSecurity(),
        ]
        selection_reasoning = {
            "mode": "manual",
            "reason": "All analyzers selected manually",
            "selected": [a.__class__.__name__ for a in selected_analyzers],
            "skipped": []
        }
        logger.info(f"📋 Running all {len(selected_analyzers)} analyzers (manual mode)")
    
    # Log security indicators
    for indicator in profile_analysis.get("security_indicators", []):
        logger.warning(f"⚠️ Security indicator: {indicator['description']} (severity: {indicator['severity']})")
    
    # Run the selected analyzers
    logger.info("⚙️ Phase 3: Running selected analyzers...")
    analyzer_results = _run_selected_analyzers(path, selected_analyzers)
    
    duration_ms = round((perf_counter() - t0) * 1000.0, 2)
    logger.info(f"✅ Analysis complete in {duration_ms}ms")
    
    # Log interesting findings
    _log_analysis_findings(analyzer_results)
    
    # Phase 4: Extract association request details if present
    assoc_analysis = None
    try:
        if basic_stats['frame_mix'].get('assoc_req', 0) > 0:
            logger.info("🤝 Phase 4: Analyzing association requests...")
            assoc_analysis = analyze_association_requests(path)
            if assoc_analysis:
                logger.info(f"   Found {assoc_analysis['assoc_req_count']} association requests from {assoc_analysis['unique_device_types']} device types")
            else:
                logger.warning("   Association analysis failed")
    except Exception as e:
        logger.error(f"Association analysis error: {e}")
        assoc_analysis = None
    
    # Phase 5: Comprehensive access point analysis
    ap_analysis = None
    try:
        if basic_stats['frame_mix'].get('beacon', 0) > 0:
            logger.info("📡 Phase 5: Analyzing access points...")
            ap_analysis = analyze_access_points(path)
            if ap_analysis:
                logger.info(f"   Found {ap_analysis['unique_aps']} access points from {ap_analysis['beacon_count']} beacons")
                security_issues = ap_analysis['insights']['security_issues']
                if security_issues['open_networks'] > 0:
                    logger.warning(f"   ⚠️ {security_issues['open_networks']} open networks detected")
                if security_issues['wep_networks'] > 0:
                    logger.warning(f"   ⚠️ {security_issues['wep_networks']} WEP networks detected")
            else:
                logger.warning("   Access point analysis failed")
    except Exception as e:
        logger.error(f"Access point analysis error: {e}")
        ap_analysis = None
    
    return {
        **basic_stats,
        "duration_ms": duration_ms,
        "traffic_profile": profile_analysis,
        "selected_analyzers": [a.__class__.__name__ for a in selected_analyzers],
        "analyzer_selection": selection_reasoning,
        "association_analysis": assoc_analysis,
        "access_point_analysis": ap_analysis,
        "details": analyzer_results,
    }

def _get_basic_stats_and_frame_mix(path: str) -> dict:
    """Fast first pass to get frame_mix and basic device counts"""
    total_packets = 0
    devices = set()
    aps = set()
    clients = set()
    ssids = set()
    frame_mix = Counter()
    
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, meta) in raw_iter:
        total_packets += 1
        
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue
        
        # Categorize frame type (each packet gets exactly one category)
        frame_type = _categorize_802_11_frame(pkt)
        frame_mix[frame_type] += 1
        
        # Only process 802.11 packets for device/SSID extraction
        # Skip non-802.11 and RadioTap-only packets
        if frame_type in ["non_802_11", "radiotap_no_dot11"]:
            continue
            
        dot11 = pkt.getlayer(Dot11)
        if not dot11:
            continue
        
        # Track APs and clients based on frame type
        if frame_type == "beacon" and dot11.addr2:
            aps.add(dot11.addr2.lower())
        elif frame_type == "probe_req" and dot11.addr2:
            clients.add(dot11.addr2.lower())
        elif frame_type == "assoc_req" and dot11.addr2:
            clients.add(dot11.addr2.lower())
        elif frame_type == "auth" and dot11.addr1 and dot11.addr2:
            # In auth frames, addr1 is usually the AP
            aps.add(dot11.addr1.lower())
            clients.add(dot11.addr2.lower())
        
        # Collect all MAC addresses
        for addr in (getattr(dot11, "addr1", None), getattr(dot11, "addr2", None),
                     getattr(dot11, "addr3", None), getattr(dot11, "addr4", None)):
            if addr:
                devices.add(addr.lower())
        
        # Extract SSIDs from beacons/probe responses/probe requests
        if frame_type in ["beacon", "probe_resp", "probe_req"]:
            _extract_ssids_from_packet(pkt, ssids)
    
    return {
        "total_packets": total_packets,
        "unique_devices": len(devices),
        "unique_aps": len(aps),
        "unique_clients": len(clients),
        "ssid_count": len(ssids),
        "frame_mix": dict(frame_mix),
    }

def _select_analyzers_from_profile(profile_analysis: dict) -> list:
    """Select analyzers based on traffic profile suggestions"""
    analyzers = []
    suggestions = profile_analysis.get("analyzer_suggestions", [])
    
    # Create analyzer instances based on suggestions
    analyzer_map = {
        "DeauthDisassoc": lambda: DeauthDisassoc(burst_window_s=10, burst_threshold=40),
        "EvilTwinHeuristic": lambda: EvilTwinHeuristic(),
        "ProbePrivacy": lambda: ProbePrivacy(),
        "WeakSecurity": lambda: WeakSecurity(),
        "HandshakePMKID": lambda: HandshakePMKID(),
    }
    
    # Add high priority analyzers
    for suggestion in suggestions:
        if suggestion["priority"] == "high":
            analyzer_name = suggestion["analyzer"]
            if analyzer_name in analyzer_map:
                analyzers.append(analyzer_map[analyzer_name]())
    
    # Add medium priority analyzers if we have fewer than 3
    if len(analyzers) < 3:
        for suggestion in suggestions:
            if suggestion["priority"] == "medium":
                analyzer_name = suggestion["analyzer"]
                if analyzer_name in analyzer_map and analyzer_name not in [a.__class__.__name__ for a in analyzers]:
                    analyzers.append(analyzer_map[analyzer_name]())
    
    # Always include at least one analyzer
    if not analyzers:
        analyzers.append(WeakSecurity())  # Safe default
    
    return analyzers

def _get_selection_reasoning(profile_analysis: dict, selected_analyzers: list) -> dict:
    """Generate detailed reasoning for analyzer selection"""
    all_possible = ["DeauthDisassoc", "EvilTwinHeuristic", "ProbePrivacy", "WeakSecurity", "HandshakePMKID"]
    selected_names = [a.__class__.__name__ for a in selected_analyzers]
    skipped = [name for name in all_possible if name not in selected_names]
    
    suggestions = profile_analysis.get("analyzer_suggestions", [])
    reasoning = {
        "mode": "automatic",
        "profile": profile_analysis.get("profile"),
        "selected": selected_names,
        "skipped": skipped,
        "selection_details": []
    }
    
    # Add detailed reasoning for each suggestion
    for suggestion in suggestions:
        reasoning["selection_details"].append({
            "analyzer": suggestion["analyzer"],
            "selected": suggestion["analyzer"] in selected_names,
            "priority": suggestion["priority"],
            "reason": suggestion["reason"]
        })
    
    return reasoning

def _log_analysis_findings(analyzer_results: dict):
    """Log interesting findings from analyzers"""
    import logging
    logger = logging.getLogger(__name__)
    
    for analyzer_name, results in analyzer_results.items():
        if analyzer_name == "DeauthDisassoc":
            if results.get("total_deauth", 0) > 0 or results.get("total_disassoc", 0) > 0:
                logger.info(f"🚨 {analyzer_name}: Found {results.get('total_deauth', 0)} deauth + {results.get('total_disassoc', 0)} disassoc frames")
                if results.get("suspicious_bursts"):
                    logger.warning(f"⚠️ Detected {len(results['suspicious_bursts'])} suspicious deauth bursts")
        
        elif analyzer_name == "EvilTwinHeuristic":
            suspects = results.get("suspected_evil_twins", [])
            if suspects:
                logger.warning(f"👥 {analyzer_name}: Found {len(suspects)} potential evil twin SSIDs")
                for suspect in suspects[:3]:  # Log first 3
                    logger.warning(f"   - SSID '{suspect['ssid']}': {suspect['reason']}")
        
        elif analyzer_name == "ProbePrivacy":
            large_pnl = results.get("clients_with_large_pnl", [])
            if large_pnl:
                logger.info(f"📡 {analyzer_name}: Found {len(large_pnl)} clients with large preferred network lists")
        
        elif analyzer_name == "WeakSecurity":
            weak_aps = results.get("weak_aps", [])
            if weak_aps:
                logger.warning(f"🔓 {analyzer_name}: Found {len(weak_aps)} open/weak security APs")

def _run_selected_analyzers(path: str, analyzers: list) -> dict:
    """Run the selected analyzers on the PCAP"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Second pass through PCAP for detailed analysis
    logger.info("🔄 Second pass: Running detailed analysis...")
    raw_iter = RawPcapReader(path)
    packet_count = 0
    
    for (pkt_bytes, _meta) in raw_iter:
        packet_count += 1
        if packet_count % 10000 == 0:
            logger.debug(f"   Processed {packet_count} packets...")
            
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None or not pkt.haslayer(Dot11):
            continue
        
        # Feed packet to all selected analyzers
        for analyzer in analyzers:
            analyzer.on_packet(pkt)
    
    # Finalize and collect results
    logger.info(f"🔬 Finalizing analysis results for {len(analyzers)} analyzers...")
    return {analyzer.__class__.__name__: analyzer.finalize() for analyzer in analyzers}

def analyze_frame_types(path: str) -> dict:
    """
    Analyze 802.11 frame type distribution in the PCAP.
    Returns comprehensive breakdown of frame types found.
    """
    frame_counts = Counter()
    total_processed = 0
    
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, _meta) in raw_iter:
        total_processed += 1
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue
            
        frame_type = _categorize_802_11_frame(pkt)
        frame_counts[frame_type] += 1
    
    # Sort by count descending
    sorted_results = dict(sorted(frame_counts.items(), key=lambda x: x[1], reverse=True))
    
    return {
        "total_processed": total_processed,
        "frame_breakdown": sorted_results,
        "unique_frame_types": len(sorted_results),
    }

def analyze_ssid_detection(path: str) -> dict:
    """
    Analyze SSID detection from beacon and probe response frames.
    Identifies encoding issues, hidden networks, and extraction problems.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    ssids_found = set()
    beacon_count = 0
    probe_resp_count = 0
    packets_with_ssid_element = 0
    empty_ssid_elements = 0
    ssid_decode_errors = 0
    total_processed = 0
    debug_info = []
    
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, _meta) in raw_iter:
        total_processed += 1
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue
            
        frame_type = _categorize_802_11_frame(pkt)
        
        # Focus on beacon and probe response frames
        if frame_type in ["beacon", "probe_resp"]:
            if frame_type == "beacon":
                beacon_count += 1
            else:
                probe_resp_count += 1
                
            # Debug SSID extraction
            elt = pkt.getlayer("Dot11Elt")
            packet_debug = {
                "frame_type": frame_type,
                "elements_found": [],
                "ssid_found": None,
                "ssid_length": 0
            }
            
            while elt is not None:
                if hasattr(elt, "ID"):
                    packet_debug["elements_found"].append(elt.ID)
                    
                    if elt.ID == 0:  # SSID element
                        packets_with_ssid_element += 1
                        info = getattr(elt, "info", b"")
                        packet_debug["ssid_length"] = len(info) if info else 0
                        
                        if isinstance(info, (bytes, bytearray)):
                            if info:  # Non-empty SSID
                                try:
                                    ssid = info.decode('utf-8')
                                    ssids_found.add(ssid)
                                    packet_debug["ssid_found"] = ssid
                                except UnicodeDecodeError:
                                    try:
                                        ssid = info.decode('utf-8', errors='replace')
                                        ssids_found.add(ssid)
                                        packet_debug["ssid_found"] = f"{ssid} (decode errors)"
                                        ssid_decode_errors += 1
                                    except Exception as e:
                                        packet_debug["ssid_found"] = f"Decode failed: {e}"
                                        ssid_decode_errors += 1
                            else:
                                empty_ssid_elements += 1
                                packet_debug["ssid_found"] = "<hidden/empty>"
                        else:
                            packet_debug["ssid_found"] = f"Wrong type: {type(info)}"
                
                elt = elt.payload.getlayer("Dot11Elt")
            
            # Store debug info for first 10 packets of each type
            if (frame_type == "beacon" and beacon_count <= 10) or (frame_type == "probe_resp" and probe_resp_count <= 10):
                debug_info.append(packet_debug)
    
    logger.info(f"🔍 SSID Debug Results:")
    logger.info(f"📦 Processed {total_processed} packets")
    logger.info(f"📡 Found {beacon_count} beacons, {probe_resp_count} probe responses")
    logger.info(f"🏷️ {packets_with_ssid_element} packets had SSID elements")
    logger.info(f"📛 {empty_ssid_elements} empty/hidden SSIDs")
    logger.info(f"⚠️ {ssid_decode_errors} SSID decode errors")
    logger.info(f"✅ Found {len(ssids_found)} unique SSIDs: {list(ssids_found)[:10]}")
    
    return {
        "total_processed": total_processed,
        "beacon_count": beacon_count,
        "probe_resp_count": probe_resp_count,
        "packets_with_ssid_element": packets_with_ssid_element,
        "empty_ssid_elements": empty_ssid_elements,
        "ssid_decode_errors": ssid_decode_errors,
        "unique_ssids": list(ssids_found),
        "ssid_count": len(ssids_found),
        "debug_samples": debug_info
    }

def extract_association_details(pkt) -> dict:
    """
    Extract detailed information from association request frames.
    Returns client capabilities, supported rates, and device fingerprinting info.
    """
    try:
        if not pkt or not pkt.haslayer(Dot11AssoReq):
            return None
            
        assoc_req = pkt.getlayer(Dot11AssoReq)
        dot11 = pkt.getlayer(Dot11)
        
        details = {
            "timestamp": None,
            "client_mac": getattr(dot11, 'addr2', None),
            "ap_mac": getattr(dot11, 'addr1', None),
            "bssid": getattr(dot11, 'addr3', None),
            "capabilities": {},
            "supported_rates": [],
            "extended_rates": [],
            "ssid": None,
            "information_elements": [],
            "vendor_elements": [],
            "device_signature": {}
        }
        
        # Extract capability flags
        if hasattr(assoc_req, 'cap'):
            cap = assoc_req.cap
            details["capabilities"] = {
                "ess": bool(cap & 0x0001),           # Extended Service Set
                "ibss": bool(cap & 0x0002),          # Independent BSS
                "cf_pollable": bool(cap & 0x0004),   # CF-Pollable
                "cf_poll_req": bool(cap & 0x0008),   # CF-Poll Request
                "privacy": bool(cap & 0x0010),       # Privacy (WEP)
                "short_preamble": bool(cap & 0x0020), # Short Preamble
                "pbcc": bool(cap & 0x0040),          # PBCC
                "channel_agility": bool(cap & 0x0080), # Channel Agility
                "spectrum_mgmt": bool(cap & 0x0100), # Spectrum Management
                "qos": bool(cap & 0x0200),           # QoS
                "short_slot_time": bool(cap & 0x0400), # Short Slot Time
                "apsd": bool(cap & 0x0800),          # APSD
                "radio_measurement": bool(cap & 0x1000), # Radio Measurement
                "dsss_ofdm": bool(cap & 0x2000),     # DSSS-OFDM
                "delayed_block_ack": bool(cap & 0x4000), # Delayed Block Ack
                "immediate_block_ack": bool(cap & 0x8000)  # Immediate Block Ack
            }
    
        # Parse Information Elements
        elt = pkt.getlayer("Dot11Elt")
        while elt is not None:
            element_info = {
                "id": getattr(elt, "ID", None),
                "length": getattr(elt, "len", 0),
                "info": getattr(elt, "info", b"")
            }
        
            if element_info["id"] is not None:
                # SSID (ID=0)
                if element_info["id"] == 0:
                    info = element_info["info"]
                    details["ssid_debug"] = {
                        "raw_bytes": info.hex() if info else "",
                        "length": len(info) if info else 0,
                        "type": str(type(info))
                    }
                    
                    try:
                        if isinstance(info, (bytes, bytearray)):
                            if len(info) == 0:
                                details["ssid"] = "<hidden/empty>"
                            else:
                                # Try UTF-8 first
                                try:
                                    ssid = info.decode('utf-8')
                                    details["ssid"] = ssid if ssid.strip() else "<empty_string>"
                                    details["ssid_debug"]["encoding"] = "utf-8"
                                except UnicodeDecodeError as e:
                                    details["ssid_debug"]["utf8_error"] = str(e)
                                    # Try latin-1 as fallback
                                    try:
                                        ssid = info.decode('latin-1')
                                        details["ssid"] = ssid if ssid.strip() and ssid.isprintable() else f"<non_printable:{info.hex()}>"
                                        details["ssid_debug"]["encoding"] = "latin-1"
                                    except UnicodeDecodeError as e2:
                                        details["ssid_debug"]["latin1_error"] = str(e2)
                                        # Try with replacement characters
                                        try:
                                            ssid = info.decode('utf-8', errors='replace')
                                            details["ssid"] = f"<decode_with_errors:{ssid}>"
                                            details["ssid_debug"]["encoding"] = "utf-8-replace"
                                        except Exception as e3:
                                            details["ssid_debug"]["final_error"] = str(e3)
                                            details["ssid"] = f"<raw_hex:{info.hex()}>"
                        elif isinstance(info, str):
                            details["ssid"] = info if info.strip() else "<empty_string>"
                            details["ssid_debug"]["encoding"] = "already_string"
                        else:
                            details["ssid"] = f"<unknown_type:{type(info)}>"
                    except Exception as e:
                        details["ssid_debug"]["extraction_error"] = str(e)
                        details["ssid"] = "<decode_error>"
                
                # Supported Rates (ID=1)
                elif element_info["id"] == 1:
                    rates = []
                    for byte in element_info["info"]:
                        rate = (byte & 0x7F) * 0.5  # Rate in Mbps
                        basic = bool(byte & 0x80)   # Basic rate flag
                        rates.append({"rate": rate, "basic": basic})
                    details["supported_rates"] = rates
                
                # DS Parameter Set (Channel) (ID=3)
                elif element_info["id"] == 3 and len(element_info["info"]) >= 1:
                    details["channel"] = element_info["info"][0]
                
                # Extended Supported Rates (ID=50)
                elif element_info["id"] == 50:
                    rates = []
                    for byte in element_info["info"]:
                        rate = (byte & 0x7F) * 0.5
                        basic = bool(byte & 0x80)
                        rates.append({"rate": rate, "basic": basic})
                    details["extended_rates"] = rates
                
                # Power Capability (ID=33)
                elif element_info["id"] == 33 and len(element_info["info"]) >= 2:
                    details["power_capability"] = {
                        "min_power": int.from_bytes(element_info["info"][:1], 'big', signed=True),
                        "max_power": int.from_bytes(element_info["info"][1:2], 'big', signed=True)
                    }
                
                # Supported Channels (ID=36)
                elif element_info["id"] == 36:
                    channels = []
                    info = element_info["info"]
                    for i in range(0, len(info), 2):
                        if i + 1 < len(info):
                            first_channel = info[i]
                            num_channels = info[i + 1]
                            channels.append({
                                "first_channel": first_channel,
                                "num_channels": num_channels
                            })
                    details["supported_channels"] = channels
                
                # HT Capabilities (ID=45)
                elif element_info["id"] == 45:
                    details["ht_capabilities"] = {
                        "present": True,
                        "raw_data": element_info["info"].hex() if element_info["info"] else ""
                    }
                
                # VHT Capabilities (ID=191)
                elif element_info["id"] == 191:
                    details["vht_capabilities"] = {
                        "present": True,
                        "raw_data": element_info["info"].hex() if element_info["info"] else ""
                    }
                
                # Vendor Specific (ID=221)
                elif element_info["id"] == 221 and len(element_info["info"]) >= 3:
                    oui = element_info["info"][:3].hex()
                    vendor_info = {
                        "oui": oui,
                        "oui_type": element_info["info"][3] if len(element_info["info"]) > 3 else None,
                        "data": element_info["info"][4:].hex() if len(element_info["info"]) > 4 else ""
                    }
                    
                    # Identify common vendors
                    vendor_names = {
                        "0050f2": "Microsoft",
                        "00037f": "Atheros", 
                        "001018": "Broadcom",
                        "000fac": "Wi-Fi Alliance",
                        "0017f2": "Apple"
                    }
                    vendor_info["vendor"] = vendor_names.get(oui, "Unknown")
                    details["vendor_elements"].append(vendor_info)
            
            details["information_elements"].append(element_info)
            elt = elt.payload.getlayer("Dot11Elt") if hasattr(elt, 'payload') else None
        
        # Create device signature for fingerprinting
        signature_components = []
        if details.get("supported_rates"):
            rates_str = ",".join([f"{r['rate']}" for r in details["supported_rates"]])
            signature_components.append(f"rates:{rates_str}")
        
        if details.get("capabilities"):
            cap_flags = [k for k, v in details["capabilities"].items() if v]
            signature_components.append(f"caps:{','.join(cap_flags)}")
        
        if details.get("ht_capabilities", {}).get("present"):
            signature_components.append("ht:yes")
        
        if details.get("vht_capabilities", {}).get("present"):
            signature_components.append("vht:yes")
        
        details["device_signature"]["fingerprint"] = "|".join(signature_components)
                
        return details
    
    except Exception as e:
        # Log the error but don't break the analysis
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Error extracting association details: {e}")
        return None

def analyze_association_requests(path: str) -> dict:
    """
    Analyze association request frames to extract detailed client information.
    Provides device fingerprinting and capability analysis.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    association_details = []
    assoc_req_count = 0
    total_processed = 0
    
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, _meta) in raw_iter:
        total_processed += 1
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue
            
        frame_type = _categorize_802_11_frame(pkt)
        
        if frame_type == "assoc_req":
            assoc_req_count += 1
            details = extract_association_details(pkt)
            if details:
                association_details.append(details)
                
                # Log interesting findings
                if len(association_details) <= 5:  # Log first 5
                    logger.info(f"🤝 Association Request #{assoc_req_count}:")
                    logger.info(f"   Client: {details['client_mac']}")
                    logger.info(f"   AP: {details['ap_mac']}")
                    logger.info(f"   SSID: {details['ssid']}")
                    logger.info(f"   Capabilities: Privacy={details['capabilities'].get('privacy', False)}, QoS={details['capabilities'].get('qos', False)}")
                    logger.info(f"   HT: {details.get('ht_capabilities', {}).get('present', False)}, VHT: {details.get('vht_capabilities', {}).get('present', False)}")
                    if details['vendor_elements']:
                        vendors = [v['vendor'] for v in details['vendor_elements']]
                        logger.info(f"   Vendors: {', '.join(set(vendors))}")
    
    logger.info(f"📊 Association Request Summary:")
    logger.info(f"   Total processed: {total_processed}")
    logger.info(f"   Association requests found: {assoc_req_count}")
    
    # Analyze device types
    device_fingerprints = {}
    for detail in association_details:
        fp = detail["device_signature"]["fingerprint"]
        if fp not in device_fingerprints:
            device_fingerprints[fp] = {
                "count": 0,
                "clients": set(),
                "example_detail": detail
            }
        device_fingerprints[fp]["count"] += 1
        device_fingerprints[fp]["clients"].add(detail["client_mac"])
    
    return {
        "total_processed": total_processed,
        "assoc_req_count": assoc_req_count,
        "association_details": association_details,
        "device_fingerprints": {k: {
            "count": v["count"],
            "unique_clients": len(v["clients"]),
            "example": v["example_detail"]
        } for k, v in device_fingerprints.items()},
        "unique_device_types": len(device_fingerprints)
    }


def extract_beacon_details(pkt) -> dict:
    """
    Extract detailed information from beacon frames.
    Returns AP capabilities, supported rates, security info, and device fingerprinting.
    """
    try:
        if not pkt or not pkt.haslayer(Dot11Beacon):
            return None
            
        beacon = pkt.getlayer(Dot11Beacon)
        dot11 = pkt.getlayer(Dot11)
        
        details = {
            "timestamp": None,
            "bssid": getattr(dot11, 'addr2', None),  # AP MAC is in addr2 for beacons
            "destination": getattr(dot11, 'addr1', None),  # Usually broadcast
            "source": getattr(dot11, 'addr3', None),  # Same as BSSID typically
            "beacon_interval": getattr(beacon, 'beacon_interval', None),
            "capabilities": {},
            "supported_rates": [],
            "extended_rates": [],
            "ssid": None,
            "channel": None,
            "country": None,
            "power_constraint": None,
            "security": {
                "open": False,
                "wep": False,
                "wpa": False,
                "wpa2": False,
                "wpa3": False,
                "enterprise": False
            },
            "ht_info": {},
            "vht_info": {},
            "he_info": {},
            "vendor_elements": [],
            "information_elements": [],
            "device_signature": {}
        }
        
        # Extract capability flags from beacon
        if hasattr(beacon, 'cap'):
            cap = beacon.cap
            details["capabilities"] = {
                "ess": bool(cap & 0x0001),           # Extended Service Set (AP mode)
                "ibss": bool(cap & 0x0002),          # Independent BSS (Ad-hoc)
                "cf_pollable": bool(cap & 0x0004),   # CF-Pollable
                "cf_poll_req": bool(cap & 0x0008),   # CF-Poll Request
                "privacy": bool(cap & 0x0010),       # Privacy (WEP/WPA)
                "short_preamble": bool(cap & 0x0020), # Short Preamble
                "pbcc": bool(cap & 0x0040),          # PBCC
                "channel_agility": bool(cap & 0x0080), # Channel Agility
                "spectrum_mgmt": bool(cap & 0x0100), # Spectrum Management
                "qos": bool(cap & 0x0200),           # QoS
                "short_slot_time": bool(cap & 0x0400), # Short Slot Time
                "apsd": bool(cap & 0x0800),          # APSD
                "radio_measurement": bool(cap & 0x1000), # Radio Measurement
                "dsss_ofdm": bool(cap & 0x2000),     # DSSS-OFDM
                "delayed_block_ack": bool(cap & 0x4000), # Delayed Block Ack
                "immediate_block_ack": bool(cap & 0x8000)  # Immediate Block Ack
            }
            
            # Basic security detection from privacy bit
            details["security"]["open"] = not details["capabilities"]["privacy"]
            if details["capabilities"]["privacy"]:
                details["security"]["wep"] = True  # Will be refined by RSN/WPA elements
    
        # Parse Information Elements
        elt = pkt.getlayer("Dot11Elt")
        while elt is not None:
            element_info = {
                "id": getattr(elt, "ID", None),
                "length": getattr(elt, "len", 0),
                "info": getattr(elt, "info", b"")
            }
        
            if element_info["id"] is not None:
                # SSID (ID=0)
                if element_info["id"] == 0:
                    try:
                        if element_info["info"]:
                            ssid = element_info["info"].decode('utf-8', errors='replace')
                            details["ssid"] = ssid if ssid.strip() else "<empty>"
                        else:
                            details["ssid"] = "<hidden>"
                    except:
                        details["ssid"] = "<decode_error>"
                
                # Supported Rates (ID=1)
                elif element_info["id"] == 1:
                    rates = []
                    for byte in element_info["info"]:
                        rate = (byte & 0x7F) * 0.5  # Rate in Mbps
                        basic = bool(byte & 0x80)   # Basic rate flag
                        rates.append({"rate": rate, "basic": basic})
                    details["supported_rates"] = rates
                
                # DS Parameter Set (Channel) (ID=3)
                elif element_info["id"] == 3 and len(element_info["info"]) >= 1:
                    details["channel"] = element_info["info"][0]
                
                # Country Information (ID=7)
                elif element_info["id"] == 7 and len(element_info["info"]) >= 3:
                    try:
                        country_code = element_info["info"][:2].decode('ascii', errors='replace')
                        environment = element_info["info"][2]
                        details["country"] = {
                            "code": country_code,
                            "environment": environment,
                            "raw": element_info["info"].hex()
                        }
                    except:
                        details["country"] = {"raw": element_info["info"].hex()}
                
                # Power Constraint (ID=32)
                elif element_info["id"] == 32 and len(element_info["info"]) >= 1:
                    details["power_constraint"] = element_info["info"][0]
                
                # RSN Information (ID=48) - WPA2
                elif element_info["id"] == 48:
                    details["security"]["wpa2"] = True
                    details["security"]["wep"] = False  # Override WEP detection
                    details["rsn_info"] = {
                        "present": True,
                        "raw_data": element_info["info"].hex()
                    }
                    
                    # Try to parse RSN details
                    try:
                        if len(element_info["info"]) >= 8:
                            # Check for enterprise (802.1X) authentication
                            info_hex = element_info["info"].hex()
                            # Look for 802.1X AKM suite (00-0f-ac-01)
                            if "000fac01" in info_hex.lower():
                                details["security"]["enterprise"] = True
                            # Look for SAE (WPA3) AKM suite (00-0f-ac-08)
                            if "000fac08" in info_hex.lower():
                                details["security"]["wpa3"] = True
                    except:
                        pass
                
                # Extended Supported Rates (ID=50)
                elif element_info["id"] == 50:
                    rates = []
                    for byte in element_info["info"]:
                        rate = (byte & 0x7F) * 0.5
                        basic = bool(byte & 0x80)
                        rates.append({"rate": rate, "basic": basic})
                    details["extended_rates"] = rates
                
                # HT Capabilities (ID=45)
                elif element_info["id"] == 45:
                    details["ht_info"] = {
                        "present": True,
                        "raw_data": element_info["info"].hex()
                    }
                    
                    # Basic HT parsing
                    if len(element_info["info"]) >= 26:
                        try:
                            ht_cap_info = int.from_bytes(element_info["info"][:2], 'little')
                            details["ht_info"]["channel_width_40mhz"] = bool(ht_cap_info & 0x0002)
                            details["ht_info"]["short_gi_20mhz"] = bool(ht_cap_info & 0x0020)
                            details["ht_info"]["short_gi_40mhz"] = bool(ht_cap_info & 0x0040)
                        except:
                            pass
                
                # HT Operation (ID=61)
                elif element_info["id"] == 61:
                    if len(element_info["info"]) >= 22:
                        try:
                            primary_channel = element_info["info"][0]
                            details["ht_info"]["primary_channel"] = primary_channel
                            
                            ht_op_info = element_info["info"][1]
                            details["ht_info"]["secondary_channel_offset"] = (ht_op_info & 0x03)
                            details["ht_info"]["sta_channel_width"] = bool(ht_op_info & 0x04)
                        except:
                            pass
                
                # VHT Capabilities (ID=191)
                elif element_info["id"] == 191:
                    details["vht_info"] = {
                        "present": True,
                        "raw_data": element_info["info"].hex()
                    }
                    
                    # Basic VHT parsing
                    if len(element_info["info"]) >= 12:
                        try:
                            vht_cap_info = int.from_bytes(element_info["info"][:4], 'little')
                            details["vht_info"]["max_mpdu_length"] = (vht_cap_info & 0x03)
                            details["vht_info"]["supported_channel_width"] = (vht_cap_info >> 2) & 0x03
                            details["vht_info"]["short_gi_80mhz"] = bool(vht_cap_info & 0x0020)
                            details["vht_info"]["short_gi_160mhz"] = bool(vht_cap_info & 0x0040)
                        except:
                            pass
                
                # VHT Operation (ID=192)
                elif element_info["id"] == 192:
                    if len(element_info["info"]) >= 3:
                        try:
                            channel_width = element_info["info"][0]
                            center_freq_1 = element_info["info"][1]
                            center_freq_2 = element_info["info"][2]
                            
                            details["vht_info"]["channel_width"] = channel_width
                            details["vht_info"]["center_frequency_1"] = center_freq_1
                            details["vht_info"]["center_frequency_2"] = center_freq_2
                        except:
                            pass
                
                # HE Capabilities (ID=255, Extension=35)
                elif element_info["id"] == 255 and len(element_info["info"]) >= 1:
                    extension_id = element_info["info"][0]
                    if extension_id == 35:  # HE Capabilities
                        details["he_info"] = {
                            "present": True,
                            "raw_data": element_info["info"].hex()
                        }
                
                # Vendor Specific (ID=221)
                elif element_info["id"] == 221 and len(element_info["info"]) >= 3:
                    oui = element_info["info"][:3].hex()
                    vendor_info = {
                        "oui": oui,
                        "oui_type": element_info["info"][3] if len(element_info["info"]) > 3 else None,
                        "data": element_info["info"][4:].hex() if len(element_info["info"]) > 4 else ""
                    }
                    
                    # Identify common vendors and WPA
                    vendor_names = {
                        "0050f2": "Microsoft",
                        "00037f": "Atheros", 
                        "001018": "Broadcom",
                        "000fac": "Wi-Fi Alliance",
                        "0017f2": "Apple",
                        "001cf0": "Intel",
                        "0040f4": "Motorola",
                        "001a11": "Google"
                    }
                    vendor_info["vendor"] = vendor_names.get(oui, "Unknown")
                    
                    # Check for WPA (Microsoft OUI with type 1)
                    if oui == "0050f2" and vendor_info["oui_type"] == 1:
                        details["security"]["wpa"] = True
                        details["security"]["wep"] = False
                        vendor_info["wpa_info"] = True
                    
                    details["vendor_elements"].append(vendor_info)
            
            details["information_elements"].append(element_info)
            elt = elt.payload.getlayer("Dot11Elt") if hasattr(elt, 'payload') else None
        
        # Create device signature for AP fingerprinting
        signature_components = []
        
        # Include supported rates
        if details.get("supported_rates"):
            rates_str = ",".join([f"{r['rate']}" for r in details["supported_rates"]])
            signature_components.append(f"rates:{rates_str}")
        
        # Include capabilities
        if details.get("capabilities"):
            cap_flags = [k for k, v in details["capabilities"].items() if v]
            signature_components.append(f"caps:{','.join(cap_flags)}")
        
        # Include wireless standards
        standards = []
        if details.get("ht_info", {}).get("present"):
            standards.append("n")
        if details.get("vht_info", {}).get("present"):
            standards.append("ac")
        if details.get("he_info", {}).get("present"):
            standards.append("ax")
        if standards:
            signature_components.append(f"std:{','.join(standards)}")
        
        # Include security info
        security_types = [k for k, v in details["security"].items() if v and k != "open"]
        if security_types:
            signature_components.append(f"sec:{','.join(security_types)}")
        elif details["security"]["open"]:
            signature_components.append("sec:open")
        
        # Include vendor info
        vendors = list(set([v["vendor"] for v in details["vendor_elements"] if v["vendor"] != "Unknown"]))
        if vendors:
            signature_components.append(f"vendor:{','.join(vendors[:2])}")  # Limit to 2 vendors
                
        details["device_signature"]["fingerprint"] = "|".join(signature_components)
                
        return details
    
    except Exception as e:
        # Log the error but don't break the analysis
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Error extracting beacon details: {e}")
        return None

def analyze_access_points(path: str) -> dict:
    """
    Comprehensive access point analysis from beacon frames.
    Extracts detailed information about all APs discovered in the PCAP.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    access_points = {}
    beacon_count = 0
    total_processed = 0
    
    raw_iter = RawPcapReader(path)
    for (pkt_bytes, _meta) in raw_iter:
        total_processed += 1
        pkt = safe_dot11_decode(pkt_bytes)
        if pkt is None:
            continue
            
        frame_type = _categorize_802_11_frame(pkt)
        
        if frame_type == "beacon":
            beacon_count += 1
            details = extract_beacon_details(pkt)
            if details and details["bssid"]:
                bssid = details["bssid"].lower()
                
                if bssid not in access_points:
                    access_points[bssid] = {
                        "bssid": bssid,
                        "ssid": details["ssid"],
                        "first_seen": beacon_count,
                        "last_seen": beacon_count,
                        "beacon_count": 0,
                        "details": details,
                        "channels_seen": set(),
                        "ssids_seen": set(),
                        "security_evolution": [],
                        "vendor_fingerprints": set()
                    }
                
                # Update AP information
                ap = access_points[bssid]
                ap["last_seen"] = beacon_count
                ap["beacon_count"] += 1
                
                # Track channel changes
                if details.get("channel"):
                    ap["channels_seen"].add(details["channel"])
                
                # Track SSID changes (for evil twin detection)
                if details.get("ssid") and details["ssid"] not in ["<hidden>", "<empty>", "<decode_error>"]:
                    ap["ssids_seen"].add(details["ssid"])
                
                # Track security changes
                security_summary = [k for k, v in details["security"].items() if v]
                current_security = ",".join(sorted(security_summary)) if security_summary else "none"
                if not ap["security_evolution"] or ap["security_evolution"][-1] != current_security:
                    ap["security_evolution"].append(current_security)
                
                # Track vendor elements for fingerprinting
                for vendor_elem in details.get("vendor_elements", []):
                    if vendor_elem["vendor"] != "Unknown":
                        ap["vendor_fingerprints"].add(vendor_elem["vendor"])
                
                # Update with latest details (overwrite previous)
                ap["details"] = details
                
                # Log interesting findings for first few APs
                if len(access_points) <= 5 and ap["beacon_count"] == 1:
                    logger.info(f"📡 Access Point #{len(access_points)}:")
                    logger.info(f"   BSSID: {details['bssid']}")
                    logger.info(f"   SSID: {details['ssid']}")
                    logger.info(f"   Channel: {details.get('channel', 'Unknown')}")
                    
                    # Security info
                    security_info = [k for k, v in details['security'].items() if v]
                    logger.info(f"   Security: {', '.join(security_info) if security_info else 'Open'}")
                    
                    # Standards supported
                    standards = []
                    if details.get('ht_info', {}).get('present'):
                        standards.append('802.11n')
                    if details.get('vht_info', {}).get('present'):
                        standards.append('802.11ac') 
                    if details.get('he_info', {}).get('present'):
                        standards.append('802.11ax')
                    logger.info(f"   Standards: {', '.join(standards) if standards else '802.11a/b/g'}")
                    
                    # Vendor info
                    vendors = [v['vendor'] for v in details.get('vendor_elements', []) if v['vendor'] != 'Unknown']
                    if vendors:
                        logger.info(f"   Vendors: {', '.join(set(vendors))}")
    
    # Convert sets to lists for JSON serialization and add derived data
    for bssid, ap in access_points.items():
        ap["channels_seen"] = sorted(list(ap["channels_seen"]))
        ap["ssids_seen"] = sorted(list(ap["ssids_seen"]))
        ap["vendor_fingerprints"] = sorted(list(ap["vendor_fingerprints"]))
        
        # Add derived analysis
        ap["analysis"] = {
            "channel_hopping": len(ap["channels_seen"]) > 1,
            "ssid_changes": len(ap["ssids_seen"]) > 1,
            "security_changes": len(ap["security_evolution"]) > 1,
            "vendor_diversity": len(ap["vendor_fingerprints"]),
            "beacon_frequency": ap["beacon_count"] / beacon_count if beacon_count > 0 else 0
        }
        
        # Device type estimation based on capabilities and vendors
        ap["estimated_device_type"] = _estimate_ap_device_type(ap["details"], ap["vendor_fingerprints"])
        
        # Security assessment
        ap["security_assessment"] = _assess_ap_security(ap["details"])
        
        # Performance characteristics
        ap["performance_profile"] = _analyze_ap_performance(ap["details"])
    
    # Generate overall statistics and insights
    channel_usage = {}
    security_distribution = {"open": 0, "wep": 0, "wpa": 0, "wpa2": 0, "wpa3": 0, "enterprise": 0}
    standards_distribution = {"legacy": 0, "n": 0, "ac": 0, "ax": 0}
    vendor_distribution = {}
    
    for ap in access_points.values():
        # Channel usage
        for channel in ap["channels_seen"]:
            channel_usage[channel] = channel_usage.get(channel, 0) + 1
        
        # Security distribution
        security = ap["details"]["security"]
        if security["open"]:
            security_distribution["open"] += 1
        if security["wep"]:
            security_distribution["wep"] += 1
        if security["wpa"]:
            security_distribution["wpa"] += 1
        if security["wpa2"]:
            security_distribution["wpa2"] += 1
        if security["wpa3"]:
            security_distribution["wpa3"] += 1
        if security["enterprise"]:
            security_distribution["enterprise"] += 1
        
        # Standards distribution
        details = ap["details"]
        if details.get("he_info", {}).get("present"):
            standards_distribution["ax"] += 1
        elif details.get("vht_info", {}).get("present"):
            standards_distribution["ac"] += 1
        elif details.get("ht_info", {}).get("present"):
            standards_distribution["n"] += 1
        else:
            standards_distribution["legacy"] += 1
        
        # Vendor distribution
        for vendor in ap["vendor_fingerprints"]:
            vendor_distribution[vendor] = vendor_distribution.get(vendor, 0) + 1
    
    logger.info(f"📊 Access Point Summary:")
    logger.info(f"   Total processed packets: {total_processed}")
    logger.info(f"   Beacon frames: {beacon_count}")
    logger.info(f"   Unique access points: {len(access_points)}")
    logger.info(f"   Channels in use: {sorted(channel_usage.keys())}")
    logger.info(f"   Security distribution: {security_distribution}")
    
    return {
        "total_processed": total_processed,
        "beacon_count": beacon_count,
        "unique_aps": len(access_points),
        "access_points": access_points,
        "statistics": {
            "channel_usage": channel_usage,
            "security_distribution": security_distribution, 
            "standards_distribution": standards_distribution,
            "vendor_distribution": vendor_distribution
        },
        "insights": {
            "most_active_channel": max(channel_usage.items(), key=lambda x: x[1])[0] if channel_usage else None,
            "security_issues": {
                "open_networks": security_distribution["open"],
                "wep_networks": security_distribution["wep"],
                "legacy_security": security_distribution["wep"] + security_distribution["wpa"]
            },
            "modern_standards": standards_distribution["ac"] + standards_distribution["ax"],
            "legacy_standards": standards_distribution["legacy"] + standards_distribution["n"],
            "suspicious_behaviors": [
                {"ap": bssid, "behavior": "Channel hopping", "details": f"Seen on channels {ap['channels_seen']}"}
                for bssid, ap in access_points.items() if ap["analysis"]["channel_hopping"]
            ] + [
                {"ap": bssid, "behavior": "SSID changes", "details": f"SSIDs: {ap['ssids_seen']}"}
                for bssid, ap in access_points.items() if ap["analysis"]["ssid_changes"]  
            ] + [
                {"ap": bssid, "behavior": "Security changes", "details": f"Evolution: {' -> '.join(ap['security_evolution'])}"}
                for bssid, ap in access_points.items() if ap["analysis"]["security_changes"]
            ]
        }
    }

def _estimate_ap_device_type(details: dict, vendor_fingerprints: list) -> str:
    """Estimate the type of access point device based on capabilities and vendor info"""
    
    # Check for enterprise features
    enterprise_indicators = 0
    if details.get("capabilities", {}).get("spectrum_mgmt"):
        enterprise_indicators += 1
    if details.get("capabilities", {}).get("radio_measurement"): 
        enterprise_indicators += 1
    if details.get("security", {}).get("enterprise"):
        enterprise_indicators += 2
    if details.get("country"):
        enterprise_indicators += 1
    if details.get("power_constraint") is not None:
        enterprise_indicators += 1
    
    # Check for high-end features
    high_end_indicators = 0
    if details.get("vht_info", {}).get("present"):
        high_end_indicators += 1
    if details.get("he_info", {}).get("present"):
        high_end_indicators += 2
    if details.get("ht_info", {}).get("channel_width_40mhz"):
        high_end_indicators += 1
    
    # Vendor-based classification
    vendor_type = "unknown"
    enterprise_vendors = {"Cisco", "Aruba", "Ruckus", "Meraki"}
    consumer_vendors = {"Netgear", "Linksys", "D-Link", "TP-Link"}
    mobile_vendors = {"Apple", "Samsung", "Google"}
    
    for vendor in vendor_fingerprints:
        if any(ev in vendor for ev in enterprise_vendors):
            vendor_type = "enterprise"
            break
        elif any(cv in vendor for cv in consumer_vendors):
            vendor_type = "consumer"
        elif any(mv in vendor for mv in mobile_vendors):
            vendor_type = "mobile_hotspot"
    
    # Decision logic
    if enterprise_indicators >= 3:
        return "enterprise_ap"
    elif vendor_type == "enterprise":
        return "enterprise_ap"  
    elif vendor_type == "mobile_hotspot":
        return "mobile_hotspot"
    elif high_end_indicators >= 2:
        return "high_end_consumer_ap"
    elif vendor_type == "consumer":
        return "consumer_ap"
    elif details.get("capabilities", {}).get("ibss"):
        return "ad_hoc_device"
    else:
        return "unknown_ap"

def _assess_ap_security(details: dict) -> dict:
    """Assess the security posture of an access point"""
    security = details.get("security", {})
    
    assessment = {
        "overall_score": 0,  # 0-100
        "issues": [],
        "strengths": [],
        "recommendations": []
    }
    
    # Score based on security protocols
    if security.get("wpa3"):
        assessment["overall_score"] += 40
        assessment["strengths"].append("WPA3 support (latest security)")
    elif security.get("wpa2"):
        assessment["overall_score"] += 30
        assessment["strengths"].append("WPA2 support")
    elif security.get("wpa"):
        assessment["overall_score"] += 15
        assessment["issues"].append("Using legacy WPA (deprecated)")
        assessment["recommendations"].append("Upgrade to WPA2 or WPA3")
    elif security.get("wep"):
        assessment["overall_score"] += 5
        assessment["issues"].append("Using WEP (critically vulnerable)")
        assessment["recommendations"].append("Immediately upgrade to WPA2/WPA3")
    elif security.get("open"):
        assessment["overall_score"] += 0
        assessment["issues"].append("Open network (no encryption)")
        assessment["recommendations"].append("Enable WPA2/WPA3 encryption")
    
    # Enterprise security bonus
    if security.get("enterprise"):
        assessment["overall_score"] += 20
        assessment["strengths"].append("Enterprise authentication (802.1X)")
    
    # Additional security features
    capabilities = details.get("capabilities", {})
    if capabilities.get("privacy"):
        assessment["overall_score"] += 10
    
    # Modern standards bonus (indicates recent firmware)
    if details.get("he_info", {}).get("present"):  # WiFi 6
        assessment["overall_score"] += 15
        assessment["strengths"].append("WiFi 6 support (recent firmware)")
    elif details.get("vht_info", {}).get("present"):  # WiFi 5
        assessment["overall_score"] += 10
        assessment["strengths"].append("WiFi 5 support")
    
    # Management features
    if capabilities.get("spectrum_mgmt"):
        assessment["overall_score"] += 5
        assessment["strengths"].append("Spectrum management enabled")
    
    # Ensure score doesn't exceed 100
    assessment["overall_score"] = min(assessment["overall_score"], 100)
    
    return assessment

def _analyze_ap_performance(details: dict) -> dict:
    """Analyze the performance characteristics of an access point"""
    
    profile = {
        "max_theoretical_speed": "Unknown",
        "channel_width": "20MHz",  # Default
        "spatial_streams": "Unknown",
        "standards_supported": [],
        "performance_tier": "basic"
    }
    
    # Determine supported standards
    if details.get("he_info", {}).get("present"):
        profile["standards_supported"].append("802.11ax (WiFi 6)")
        profile["performance_tier"] = "premium"
    if details.get("vht_info", {}).get("present"):
        profile["standards_supported"].append("802.11ac (WiFi 5)")
        if profile["performance_tier"] == "basic":
            profile["performance_tier"] = "high_end"
    if details.get("ht_info", {}).get("present"):
        profile["standards_supported"].append("802.11n (WiFi 4)")
        if profile["performance_tier"] == "basic":
            profile["performance_tier"] = "standard"
    
    # Determine channel width
    vht_info = details.get("vht_info", {})
    ht_info = details.get("ht_info", {})
    
    if vht_info.get("channel_width") == 1:  # VHT 80MHz
        profile["channel_width"] = "80MHz"
    elif vht_info.get("channel_width") == 2:  # VHT 160MHz
        profile["channel_width"] = "160MHz"  
    elif vht_info.get("channel_width") == 3:  # VHT 80+80MHz
        profile["channel_width"] = "80+80MHz"
    elif ht_info.get("channel_width_40mhz"):
        profile["channel_width"] = "40MHz"
    
    # Estimate theoretical speed (simplified)
    if "802.11ax" in str(profile["standards_supported"]):
        if "160MHz" in profile["channel_width"]:
            profile["max_theoretical_speed"] = "2.4+ Gbps"
        elif "80MHz" in profile["channel_width"]:
            profile["max_theoretical_speed"] = "1.2+ Gbps"
        else:
            profile["max_theoretical_speed"] = "600+ Mbps"
    elif "802.11ac" in str(profile["standards_supported"]):
        if "160MHz" in profile["channel_width"]:
            profile["max_theoretical_speed"] = "1.7+ Gbps"
        elif "80MHz" in profile["channel_width"]:
            profile["max_theoretical_speed"] = "867+ Mbps"
        else:
            profile["max_theoretical_speed"] = "433+ Mbps"
    elif "802.11n" in str(profile["standards_supported"]):
        if "40MHz" in profile["channel_width"]:
            profile["max_theoretical_speed"] = "300+ Mbps"
        else:
            profile["max_theoretical_speed"] = "150+ Mbps"
    else:
        profile["max_theoretical_speed"] = "54 Mbps or less"
    
    return profile