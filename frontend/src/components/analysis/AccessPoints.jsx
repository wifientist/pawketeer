import React, { useState } from 'react';

export default function AccessPoints({ accessPointAnalysis }) {
  const [expandedAP, setExpandedAP] = useState(null);
  const [sortBy, setSortBy] = useState('beacons');
  const [filterBy, setFilterBy] = useState('all');

  if (!accessPointAnalysis || !accessPointAnalysis.access_points) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📡</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Access Points</h3>
        <p className="text-gray-600">No access point beacons were found in this capture.</p>
      </div>
    );
  }

  const { access_points: aps, statistics, insights, beacon_count, unique_aps } = accessPointAnalysis;

  // Convert object to array and filter
  const apArray = Object.entries(aps).filter(([bssid, ap]) => {
    if (filterBy === 'all') return true;
    if (filterBy === 'open') return ap.details.security.open;
    if (filterBy === 'wep') return ap.details.security.wep;
    if (filterBy === 'enterprise') return ap.details.security.enterprise;
    if (filterBy === 'suspicious') return ap.analysis.channel_hopping || ap.analysis.ssid_changes || ap.analysis.security_changes;
    if (filterBy === 'modern') return ap.details.he_info?.present || ap.details.vht_info?.present;
    return true;
  });

  // Sort APs
  const sortedAPs = apArray.sort((a, b) => {
    const [, apA] = a;
    const [, apB] = b;
    
    if (sortBy === 'beacons') return apB.beacon_count - apA.beacon_count;
    if (sortBy === 'ssid') return (apA.ssid || '').localeCompare(apB.ssid || '');
    if (sortBy === 'channel') return (apA.details.channel || 0) - (apB.details.channel || 0);
    if (sortBy === 'security') {
      const secA = apA.security_assessment.overall_score;
      const secB = apB.security_assessment.overall_score;
      return secB - secA;
    }
    return 0;
  });

  const getSecurityBadge = (security) => {
    if (security.wpa3) return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-bold">WPA3</span>;
    if (security.wpa2) return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">WPA2</span>;
    if (security.wpa) return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">WPA</span>;
    if (security.wep) return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">WEP</span>;
    if (security.open) return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Open</span>;
    return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Unknown</span>;
  };

  const getStandardsBadges = (details) => {
    const standards = [];
    if (details.he_info?.present) standards.push({ name: 'WiFi 6', color: 'bg-purple-100 text-purple-800' });
    if (details.vht_info?.present) standards.push({ name: 'WiFi 5', color: 'bg-indigo-100 text-indigo-800' });
    if (details.ht_info?.present) standards.push({ name: 'WiFi 4', color: 'bg-blue-100 text-blue-800' });
    
    if (standards.length === 0) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Legacy</span>;
    }
    
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

  const getDeviceTypeIcon = (deviceType) => {
    if (deviceType === 'enterprise_ap') return '🏢';
    if (deviceType === 'high_end_consumer_ap') return '🏠';
    if (deviceType === 'consumer_ap') return '📡';
    if (deviceType === 'mobile_hotspot') return '📱';
    return '❓';
  };

  const getSecurityScore = (score) => {
    if (score >= 80) return { color: 'text-green-600 bg-green-100', label: 'Excellent' };
    if (score >= 60) return { color: 'text-blue-600 bg-blue-100', label: 'Good' };
    if (score >= 40) return { color: 'text-yellow-600 bg-yellow-100', label: 'Fair' };
    if (score >= 20) return { color: 'text-orange-600 bg-orange-100', label: 'Poor' };
    return { color: 'text-red-600 bg-red-100', label: 'Critical' };
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📡</span>
            <div>
              <div className="text-2xl font-bold text-blue-900">{unique_aps}</div>
              <div className="text-sm text-blue-700">Access Points</div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <div className="text-2xl font-bold text-green-900">{beacon_count}</div>
              <div className="text-sm text-green-700">Beacon Frames</div>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📶</span>
            <div>
              <div className="text-2xl font-bold text-purple-900">
                {insights.most_active_channel || 'N/A'}
              </div>
              <div className="text-sm text-purple-700">Most Active Channel</div>
            </div>
          </div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="text-2xl font-bold text-red-900">
                {insights.security_issues.open_networks + insights.security_issues.wep_networks}
              </div>
              <div className="text-sm text-red-700">Security Issues</div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Distribution */}
      {statistics.security_distribution && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Security Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {Object.entries(statistics.security_distribution).map(([type, count]) => (
              <div key={type} className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-600 uppercase">{type.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspicious Behaviors Alert */}
      {insights.suspicious_behaviors && insights.suspicious_behaviors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Suspicious Behaviors Detected</h3>
          <div className="space-y-2">
            {insights.suspicious_behaviors.map((behavior, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium text-yellow-900">{behavior.ap}:</span>
                <span className="text-yellow-700 ml-2">{behavior.behavior} - {behavior.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Access Points ({sortedAPs.length})</h3>
        
        <div className="flex gap-2">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Networks</option>
            <option value="open">Open Networks</option>
            <option value="wep">WEP Networks</option>
            <option value="enterprise">Enterprise</option>
            <option value="modern">Modern Standards</option>
            <option value="suspicious">Suspicious</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="beacons">Sort by Beacon Count</option>
            <option value="ssid">Sort by SSID</option>
            <option value="channel">Sort by Channel</option>
            <option value="security">Sort by Security Score</option>
          </select>
        </div>
      </div>

      {/* Access Points List */}
      <div className="space-y-4">
        {sortedAPs.map(([bssid, ap], index) => {
          const isExpanded = expandedAP === bssid;
          const securityScore = getSecurityScore(ap.security_assessment.overall_score);
          
          return (
            <div key={bssid} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedAP(isExpanded ? null : bssid)}
                className="w-full px-4 py-4 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getDeviceTypeIcon(ap.estimated_device_type)}</span>
                      <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                    </div>
                    
                    <div>
                      <div className="font-semibold text-gray-900">
                        {ap.ssid || '<Hidden>'}
                      </div>
                      <div className="text-sm text-gray-600 font-mono">{bssid}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Ch {ap.details.channel || 'Unknown'}</span>
                      {getSecurityBadge(ap.details.security)}
                      {getStandardsBadges(ap.details)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {ap.beacon_count} beacon{ap.beacon_count !== 1 ? 's' : ''}
                      </div>
                      <div className={`px-2 py-1 text-xs rounded font-medium ${securityScore.color}`}>
                        {ap.security_assessment.overall_score}/100 {securityScore.label}
                      </div>
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
                  
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Device Info</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="text-gray-600">Type:</span> {ap.estimated_device_type.replace('_', ' ')}</div>
                        <div><span className="text-gray-600">Beacon Interval:</span> {ap.details.beacon_interval || 'Unknown'}</div>
                        <div><span className="text-gray-600">Country:</span> {ap.details.country?.code || 'Unknown'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Performance</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="text-gray-600">Max Speed:</span> {ap.performance_profile.max_theoretical_speed}</div>
                        <div><span className="text-gray-600">Channel Width:</span> {ap.performance_profile.channel_width}</div>
                        <div><span className="text-gray-600">Tier:</span> {ap.performance_profile.performance_tier}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Activity</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="text-gray-600">Channels:</span> {ap.channels_seen.join(', ')}</div>
                        <div><span className="text-gray-600">SSIDs:</span> {ap.ssids_seen.length}</div>
                        <div><span className="text-gray-600">Frequency:</span> {(ap.analysis.beacon_frequency * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Security Assessment */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Security Assessment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ap.security_assessment.strengths.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-green-800 mb-2">✅ Strengths</h5>
                          <ul className="text-sm text-green-700 space-y-1">
                            {ap.security_assessment.strengths.map((strength, idx) => (
                              <li key={idx}>• {strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {ap.security_assessment.issues.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-red-800 mb-2">⚠️ Issues</h5>
                          <ul className="text-sm text-red-700 space-y-1">
                            {ap.security_assessment.issues.map((issue, idx) => (
                              <li key={idx}>• {issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {ap.security_assessment.recommendations.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">💡 Recommendations</h5>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {ap.security_assessment.recommendations.map((rec, idx) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Standards & Capabilities */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Standards & Capabilities</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Supported Standards</h5>
                        <div className="flex flex-wrap gap-2">
                          {ap.performance_profile.standards_supported.map((std, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {std}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Key Capabilities</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(ap.details.capabilities || {}).filter(([,enabled]) => enabled).slice(0, 6).map(([cap, enabled]) => (
                            <div key={cap} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              {cap.replace('_', ' ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor Information */}
                  {ap.vendor_fingerprints.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Vendor Information</h4>
                      <div className="flex flex-wrap gap-2">
                        {ap.vendor_fingerprints.map((vendor, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded">
                            {vendor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Behavioral Flags */}
                  {(ap.analysis.channel_hopping || ap.analysis.ssid_changes || ap.analysis.security_changes) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Suspicious Behaviors</h4>
                      <div className="space-y-1 text-sm">
                        {ap.analysis.channel_hopping && (
                          <div className="text-yellow-700">• Channel hopping detected (channels: {ap.channels_seen.join(', ')})</div>
                        )}
                        {ap.analysis.ssid_changes && (
                          <div className="text-yellow-700">• SSID changes detected ({ap.ssids_seen.length} different SSIDs)</div>
                        )}
                        {ap.analysis.security_changes && (
                          <div className="text-yellow-700">• Security configuration changes detected</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {sortedAPs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No access points match the current filter criteria.
        </div>
      )}
    </div>
  );
}