# app/services/traffic_profiler.py
from collections import Counter
from typing import Dict

class TrafficProfiler:
    """Analyze frame_mix to understand PCAP content and suggest analysis strategies"""
    
    @staticmethod
    def analyze_traffic_profile(frame_mix: Dict[str, int], total_packets: int) -> Dict:
        """
        Analyze frame composition to understand what kind of capture this is
        and suggest which specialized analyzers would be most valuable.
        """
        if total_packets == 0:
            return {"profile": "empty", "suggestions": []}
        
        # Calculate percentages
        percentages = {k: (v / total_packets) * 100 for k, v in frame_mix.items()}
        
        # Classify the traffic profile
        profile = TrafficProfiler._classify_profile(percentages)
        
        # Suggest relevant analyzers based on profile
        suggestions = TrafficProfiler._suggest_analyzers(profile, percentages)
        
        # Identify potential security events
        security_indicators = TrafficProfiler._check_security_indicators(percentages)
        
        return {
            "profile": profile,
            "frame_percentages": percentages,
            "analyzer_suggestions": suggestions,
            "security_indicators": security_indicators,
            "interpretation": TrafficProfiler._interpret_profile(profile, percentages)
        }
    
    @staticmethod
    def _classify_profile(percentages: Dict[str, float]) -> str:
        """Classify the type of WiFi capture based on frame distribution"""
        deauth_pct = percentages.get('deauth', 0)
        disassoc_pct = percentages.get('disassoc', 0)
        beacon_pct = percentages.get('beacon', 0)
        probe_req_pct = percentages.get('probe_req', 0)
        probe_resp_pct = percentages.get('probe_resp', 0)
        
        # Attack scenarios
        if deauth_pct > 10 or disassoc_pct > 5:
            return "deauth_attack"
        
        # Active scanning
        if probe_req_pct > 30:
            return "active_scanning"
        
        # Passive monitoring
        if beacon_pct > 60 and probe_req_pct < 10:
            return "passive_monitoring" 
            
        # Client activity
        if probe_req_pct > 15 and beacon_pct < 40:
            return "client_activity"
            
        # Mixed/normal activity
        return "normal_mixed"
    
    @staticmethod
    def _suggest_analyzers(profile: str, percentages: Dict[str, float]) -> list:
        """Suggest which analyzers would be most valuable for this traffic"""
        suggestions = []
        
        if profile == "deauth_attack":
            suggestions.extend([
                {"analyzer": "DeauthDisassoc", "priority": "high", "reason": "High deauth/disassoc activity detected"},
                {"analyzer": "EvilTwinHeuristic", "priority": "medium", "reason": "Potential evil twin attacks"}
            ])
        
        elif profile == "active_scanning":
            suggestions.extend([
                {"analyzer": "ProbePrivacy", "priority": "high", "reason": "High probe request activity"},
                {"analyzer": "EvilTwinHeuristic", "priority": "medium", "reason": "Check for honeypot APs"}
            ])
        
        elif profile == "passive_monitoring":
            suggestions.extend([
                {"analyzer": "WeakSecurity", "priority": "high", "reason": "Good beacon coverage for AP analysis"},
                {"analyzer": "EvilTwinHeuristic", "priority": "medium", "reason": "Compare AP configurations"}
            ])
            
        elif profile == "client_activity":
            suggestions.extend([
                {"analyzer": "ProbePrivacy", "priority": "high", "reason": "Client behavior analysis"},
                {"analyzer": "HandshakePMKID", "priority": "medium", "reason": "Potential authentication activity"}
            ])
        
        # Always suggest basic analyzers for mixed traffic
        if profile == "normal_mixed":
            suggestions.extend([
                {"analyzer": "WeakSecurity", "priority": "medium", "reason": "General security assessment"},
                {"analyzer": "ProbePrivacy", "priority": "low", "reason": "Privacy analysis"}
            ])
        
        return suggestions
    
    @staticmethod
    def _check_security_indicators(percentages: Dict[str, float]) -> list:
        """Identify potential security concerns from frame distribution"""
        indicators = []
        
        if percentages.get('deauth', 0) > 5:
            indicators.append({
                "type": "deauth_flood", 
                "severity": "high",
                "description": f"{percentages['deauth']:.1f}% deauth frames - possible DoS attack"
            })
        
        if percentages.get('probe_req', 0) > 40:
            indicators.append({
                "type": "excessive_probing",
                "severity": "medium", 
                "description": f"{percentages['probe_req']:.1f}% probe requests - intensive scanning"
            })
        
        return indicators
    
    @staticmethod
    def _interpret_profile(profile: str, percentages: Dict[str, float]) -> str:
        """Human-readable interpretation of the traffic profile"""
        interpretations = {
            "deauth_attack": "This capture appears to contain deauthentication attack activity. High levels of deauth/disassoc frames suggest potential DoS or evil twin attacks.",
            "active_scanning": "This capture shows intensive WiFi scanning activity. High probe request rates indicate active network discovery.",
            "passive_monitoring": "This capture appears to be from passive WiFi monitoring. High beacon percentage suggests background AP discovery.", 
            "client_activity": "This capture shows significant client-side activity with probe requests and potential authentication attempts.",
            "normal_mixed": "This capture shows typical mixed WiFi traffic with balanced frame types."
        }
        return interpretations.get(profile, "Unable to classify traffic pattern.")