import React, { useState } from 'react';

export default function ClientDevices({ associationAnalysis }) {
  const [expandedDevice, setExpandedDevice] = useState(null);
  const [sortBy, setSortBy] = useState('clients');

  if (!associationAnalysis || !associationAnalysis.association_details) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📱</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Association Requests</h3>
        <p className="text-gray-600">No client association requests were found in this capture.</p>
      </div>
    );
  }

  const { association_details: details, device_fingerprints: fingerprints, assoc_req_count } = associationAnalysis;

  // Sort device fingerprints
  const sortedFingerprints = Object.entries(fingerprints).sort((a, b) => {
    if (sortBy === 'clients') return b[1].unique_clients - a[1].unique_clients;
    if (sortBy === 'requests') return b[1].count - a[1].count;
    return a[0].localeCompare(b[0]);
  });

  const getCapabilityColor = (hasCapability) => {
    return hasCapability ? 'text-green-600 bg-green-100' : 'text-gray-400 bg-gray-100';
  };

  const getStandardsBadge = (example) => {
    const standards = [];
    if (example.he_capabilities?.present) standards.push({ name: 'WiFi 6', color: 'bg-purple-100 text-purple-800' });
    if (example.vht_capabilities?.present) standards.push({ name: 'WiFi 5', color: 'bg-indigo-100 text-indigo-800' });
    if (example.ht_capabilities?.present) standards.push({ name: 'WiFi 4', color: 'bg-blue-100 text-blue-800' });
    
    if (standards.length === 0) return <span className="text-gray-400">Legacy (802.11a/b/g)</span>;
    
    return (
      <div className="flex gap-1">
        {standards.map(std => (
          <span key={std.name} className={`px-2 py-1 ${std.color} text-xs rounded font-medium`}>
            {std.name}
          </span>
        ))}
      </div>
    );
  };

  const getVendorInfo = (vendorElements) => {
    if (!vendorElements || vendorElements.length === 0) return 'Unknown';
    
    const vendors = [...new Set(vendorElements.map(v => v.vendor).filter(v => v !== 'Unknown'))];
    return vendors.length > 0 ? vendors.join(', ') : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <div>
              <div className="text-2xl font-bold text-blue-900">{assoc_req_count}</div>
              <div className="text-sm text-blue-700">Association Requests</div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <div className="text-2xl font-bold text-green-900">
                {Object.values(fingerprints).reduce((sum, fp) => sum + fp.unique_clients, 0)}
              </div>
              <div className="text-sm text-green-700">Unique Clients</div>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <div className="text-2xl font-bold text-purple-900">{Object.keys(fingerprints).length}</div>
              <div className="text-sm text-purple-700">Device Types</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Device Fingerprints</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="clients">Sort by Client Count</option>
          <option value="requests">Sort by Request Count</option>
          <option value="fingerprint">Sort by Fingerprint</option>
        </select>
      </div>

      {/* Device Fingerprints */}
      <div className="space-y-4">
        {sortedFingerprints.map(([fingerprint, info], index) => {
          const example = info.example;
          const isExpanded = expandedDevice === fingerprint;
          
          return (
            <div key={fingerprint} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedDevice(isExpanded ? null : fingerprint)}
                className="w-full px-4 py-4 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                      {getStandardsBadge(example)}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{info.unique_clients}</span> client{info.unique_clients !== 1 ? 's' : ''} • 
                      <span className="font-medium ml-1">{info.count}</span> request{info.count !== 1 ? 's' : ''}
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      Vendor: {getVendorInfo(example.vendor_elements)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Quick capability indicators */}
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${getCapabilityColor(example.capabilities?.privacy)}`}>
                        🔒 WEP
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${getCapabilityColor(example.capabilities?.qos)}`}>
                        ⚡ QoS
                      </span>
                    </div>
                    
                    <div className="text-gray-400">
                      {isExpanded ? '🔽' : '▶️'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 py-6 border-t border-gray-200 bg-white space-y-6">
                  {/* Capabilities Grid */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Client Capabilities</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {Object.entries(example.capabilities || {}).map(([cap, enabled]) => (
                        <div
                          key={cap}
                          className={`px-3 py-2 rounded text-xs font-medium ${
                            enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {cap.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supported Rates */}
                  {(example.supported_rates?.length > 0 || example.extended_rates?.length > 0) && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Supported Data Rates</h4>
                      <div className="flex flex-wrap gap-2">
                        {[...(example.supported_rates || []), ...(example.extended_rates || [])].map((rate, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 text-xs rounded ${
                              rate.basic ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {rate.rate} Mbps{rate.basic ? ' (Basic)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Power and Channels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {example.power_capability && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Power Capability</h4>
                        <div className="text-sm text-gray-600">
                          Min: {example.power_capability.min_power} dBm, 
                          Max: {example.power_capability.max_power} dBm
                        </div>
                      </div>
                    )}
                    
                    {example.supported_channels?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Supported Channels</h4>
                        <div className="text-sm text-gray-600">
                          {example.supported_channels.map((ch, idx) => (
                            <span key={idx}>
                              {ch.first_channel}-{ch.first_channel + ch.num_channels - 1}
                              {idx < example.supported_channels.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vendor Elements */}
                  {example.vendor_elements?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Vendor Information</h4>
                      <div className="space-y-2">
                        {example.vendor_elements.map((vendor, idx) => (
                          <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                            <div className="flex items-center gap-4">
                              <span className="font-medium">{vendor.vendor}</span>
                              <span className="text-gray-600">OUI: {vendor.oui}</span>
                              {vendor.oui_type !== null && (
                                <span className="text-gray-600">Type: {vendor.oui_type}</span>
                              )}
                            </div>
                            {vendor.data && (
                              <div className="mt-1 text-gray-500 font-mono text-xs">
                                Data: {vendor.data.substring(0, 40)}...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SSID Debug Info (if available) */}
                  {example.ssid_debug && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">SSID Analysis</h4>
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-yellow-800">Target SSID:</span>
                            <span className="ml-2 text-yellow-700">{example.ssid || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-yellow-800">Raw Length:</span>
                            <span className="ml-2 text-yellow-700">{example.ssid_debug.length} bytes</span>
                          </div>
                          <div>
                            <span className="font-medium text-yellow-800">Encoding Used:</span>
                            <span className="ml-2 text-yellow-700">{example.ssid_debug.encoding || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-yellow-800">Data Type:</span>
                            <span className="ml-2 text-yellow-700 font-mono">{example.ssid_debug.type}</span>
                          </div>
                        </div>
                        {example.ssid_debug.raw_bytes && (
                          <div className="mt-3">
                            <span className="font-medium text-yellow-800">Raw Hex:</span>
                            <div className="mt-1 font-mono text-xs text-yellow-700 bg-yellow-100 rounded p-2 break-all">
                              {example.ssid_debug.raw_bytes}
                            </div>
                          </div>
                        )}
                        {(example.ssid_debug.utf8_error || example.ssid_debug.latin1_error) && (
                          <div className="mt-3">
                            <span className="font-medium text-red-800">Encoding Errors:</span>
                            {example.ssid_debug.utf8_error && (
                              <div className="text-xs text-red-700 mt-1">UTF-8: {example.ssid_debug.utf8_error}</div>
                            )}
                            {example.ssid_debug.latin1_error && (
                              <div className="text-xs text-red-700 mt-1">Latin-1: {example.ssid_debug.latin1_error}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* HE (WiFi 6) Capabilities */}
                  {example.he_capabilities?.present && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">WiFi 6 (802.11ax) Capabilities</h4>
                      <div className="bg-purple-50 border border-purple-200 rounded p-3">
                        <div className="text-sm text-purple-700">
                          <div className="font-medium mb-2">Advanced Features Supported:</div>
                          <div className="space-y-1">
                            <div>• High Efficiency (HE) frame format</div>
                            <div>• OFDMA (Orthogonal Frequency Division Multiple Access)</div>
                            <div>• Enhanced spatial reuse</div>
                            <div>• Target Wake Time (TWT)</div>
                          </div>
                          {example.he_capabilities.raw_data && (
                            <div className="mt-3">
                              <span className="font-medium">Raw Capability Data:</span>
                              <div className="mt-1 font-mono text-xs bg-purple-100 rounded p-2 break-all">
                                {example.he_capabilities.raw_data}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VHT (WiFi 5) Capabilities */}
                  {example.vht_capabilities?.present && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">WiFi 5 (802.11ac) Capabilities</h4>
                      <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                        <div className="text-sm text-indigo-700">
                          <div className="font-medium mb-2">VHT Features:</div>
                          <div className="space-y-1">
                            <div>• Very High Throughput operation</div>
                            <div>• 80MHz/160MHz channel widths</div>
                            <div>• Multi-user MIMO (MU-MIMO)</div>
                            <div>• Advanced modulation schemes</div>
                          </div>
                          {example.vht_capabilities.raw_data && (
                            <div className="mt-3">
                              <span className="font-medium">Raw Capability Data:</span>
                              <div className="mt-1 font-mono text-xs bg-indigo-100 rounded p-2 break-all">
                                {example.vht_capabilities.raw_data}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced HT Info */}
                  {example.ht_capabilities?.present && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">WiFi 4 (802.11n) Details</h4>
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-blue-800">HT Capabilities:</span>
                            <div className="mt-1 text-blue-700 space-y-1">
                              <div>• MIMO spatial streams</div>
                              <div>• 40MHz channel bonding</div>
                              <div>• Frame aggregation (A-MSDU/A-MPDU)</div>
                              <div>• Short Guard Interval</div>
                            </div>
                          </div>
                          {example.ht_capabilities.raw_data && (
                            <div>
                              <span className="font-medium text-blue-800">Raw Data:</span>
                              <div className="mt-1 font-mono text-xs text-blue-700 bg-blue-100 rounded p-2 break-all">
                                {example.ht_capabilities.raw_data.substring(0, 40)}...
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Connection Target Info */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Connection Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-800">Target AP:</span>
                        <div className="mt-1 text-gray-600 font-mono">{example.ap_mac || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Client MAC:</span>
                        <div className="mt-1 text-gray-600 font-mono">{example.client_mac || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Target SSID:</span>
                        <div className="mt-1 text-gray-600">{example.ssid || 'Hidden/Unknown'}</div>
                      </div>
                      {example.channel && (
                        <div>
                          <span className="font-medium text-gray-800">Channel:</span>
                          <div className="mt-1 text-gray-600">{example.channel}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Device Signature */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Device Fingerprint</h4>
                    <div className="bg-gray-100 rounded p-3 font-mono text-xs text-gray-700 break-all">
                      {example.device_signature?.fingerprint || 'No fingerprint generated'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}