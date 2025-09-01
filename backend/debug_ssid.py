#!/usr/bin/env python3
"""
Debug script to test SSID extraction directly without the full API stack.
Run this to troubleshoot SSID detection issues.
"""

import sys
import os
import logging

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.smart_analysis import debug_ssid_extraction, debug_frame_categorization, debug_association_requests
from app.services.agent_bus import safe_dot11_decode
from scapy.all import RawPcapReader
from scapy.layers.dot11 import Dot11

# Setup simple logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def analyze_raw_packets(pcap_path, max_packets=100):
    """Analyze raw packet structure to understand what's in the PCAP."""
    print("🔬 Raw packet analysis:")
    
    dot11_packets = 0
    non_dot11_packets = 0
    parse_errors = 0
    sample_packets = []
    
    try:
        raw_iter = RawPcapReader(pcap_path)
        for i, (pkt_bytes, meta) in enumerate(raw_iter):
            if i >= max_packets:
                break
                
            # Try to decode
            pkt = safe_dot11_decode(pkt_bytes)
            if pkt is None:
                parse_errors += 1
                continue
                
            # Check if it has 802.11 layer
            dot11 = pkt.getlayer(Dot11)
            if dot11:
                dot11_packets += 1
                if len(sample_packets) < 5:
                    sample_packets.append({
                        'packet_num': i,
                        'has_dot11': True,
                        'type': getattr(dot11, 'type', None),
                        'subtype': getattr(dot11, 'subtype', None),
                        'addr1': getattr(dot11, 'addr1', None),
                        'addr2': getattr(dot11, 'addr2', None),
                    })
            else:
                non_dot11_packets += 1
                if len(sample_packets) < 10:
                    # Try to identify what it actually is
                    layers = []
                    layer = pkt
                    while layer:
                        layers.append(layer.__class__.__name__)
                        layer = layer.payload if hasattr(layer, 'payload') else None
                        if len(layers) > 5:  # Prevent infinite loops
                            break
                    
                    sample_packets.append({
                        'packet_num': i,
                        'has_dot11': False,
                        'layers': layers[:3],  # First 3 layers
                        'size': len(pkt_bytes)
                    })
    
    except Exception as e:
        print(f"Error reading PCAP: {e}")
        return
    
    print(f"  802.11 packets: {dot11_packets}")
    print(f"  Non-802.11 packets: {non_dot11_packets}")
    print(f"  Parse errors: {parse_errors}")
    print(f"  Total analyzed: {dot11_packets + non_dot11_packets + parse_errors}")
    
    print("\nSample packets:")
    for sample in sample_packets:
        if sample['has_dot11']:
            print(f"  Packet {sample['packet_num']}: 802.11 type={sample['type']} subtype={sample['subtype']}")
        else:
            print(f"  Packet {sample['packet_num']}: Non-802.11 layers={sample['layers']} size={sample['size']}")
    
    print()

def test_pcap_ssid(pcap_path, max_packets=1000):
    """Test SSID extraction on a specific PCAP file."""
    
    if not os.path.exists(pcap_path):
        print(f"❌ PCAP file not found: {pcap_path}")
        return
    
    print(f"🔍 Testing SSID extraction on: {pcap_path}")
    print("-" * 50)
    
    # First, analyze raw packet structure
    analyze_raw_packets(pcap_path, 100)
    
    # First, check what frame types are in the PCAP
    print("📊 Frame categorization:")
    frame_debug = debug_frame_categorization(pcap_path, max_packets)
    print(f"Total packets processed: {frame_debug['total_processed']}")
    print(f"Unique frame types: {frame_debug['unique_frame_types']}")
    
    # Show top frame types
    for frame_type, count in list(frame_debug['frame_breakdown'].items())[:10]:
        print(f"  {frame_type}: {count}")
    
    print("\n" + "="*50)
    
    # Now test SSID extraction
    print("🏷️ SSID extraction debug:")
    ssid_debug = debug_ssid_extraction(pcap_path, max_packets)
    
    print(f"Beacons found: {ssid_debug['beacon_count']}")
    print(f"Probe responses found: {ssid_debug['probe_resp_count']}")
    print(f"Packets with SSID elements: {ssid_debug['packets_with_ssid_element']}")
    print(f"Empty/hidden SSIDs: {ssid_debug['empty_ssid_elements']}")
    print(f"SSID decode errors: {ssid_debug['ssid_decode_errors']}")
    print(f"Unique SSIDs found: {ssid_debug['ssid_count']}")
    
    if ssid_debug['unique_ssids']:
        print("\nSSIDs detected:")
        for ssid in ssid_debug['unique_ssids'][:20]:  # Show first 20
            print(f"  '{ssid}'")
    else:
        print("\n❌ No SSIDs detected!")
        
    # Show debug samples
    if ssid_debug['debug_samples']:
        print(f"\nDebug samples (first {len(ssid_debug['debug_samples'])}):")
        for i, sample in enumerate(ssid_debug['debug_samples'][:5]):
            print(f"  Sample {i+1}:")
            print(f"    Frame type: {sample['frame_type']}")
            print(f"    Elements found: {sample['elements_found']}")
            print(f"    SSID: {sample['ssid_found']}")
            print(f"    SSID length: {sample['ssid_length']}")
            print()
    
    # Association request analysis
    print("\n" + "="*50)
    print("🤝 Association Request Analysis:")
    assoc_debug = debug_association_requests(pcap_path, max_packets)
    
    print(f"Association requests found: {assoc_debug['assoc_req_count']}")
    print(f"Unique device types: {assoc_debug['unique_device_types']}")
    
    if assoc_debug['device_fingerprints']:
        print("\nDevice fingerprints:")
        for i, (fingerprint, info) in enumerate(list(assoc_debug['device_fingerprints'].items())[:5]):
            print(f"  Type {i+1}: {info['unique_clients']} client(s)")
            example = info['example']
            print(f"    Capabilities: Privacy={example['capabilities'].get('privacy', False)}, QoS={example['capabilities'].get('qos', False)}")
            print(f"    Standards: HT={example.get('ht_capabilities', {}).get('present', False)}, VHT={example.get('vht_capabilities', {}).get('present', False)}")
            if example['vendor_elements']:
                vendors = [v['vendor'] for v in example['vendor_elements']]
                print(f"    Vendors: {', '.join(set(vendors))}")
            print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_ssid.py <pcap_file_path> [max_packets]")
        print("Example: python debug_ssid.py /path/to/capture.pcap 500")
        sys.exit(1)
    
    pcap_path = sys.argv[1]
    max_packets = int(sys.argv[2]) if len(sys.argv) > 2 else 100000
    
    test_pcap_ssid(pcap_path, max_packets)
