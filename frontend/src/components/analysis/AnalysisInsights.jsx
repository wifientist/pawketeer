import React, { useState } from 'react';
import FrameMixChart from './FrameMixChart';
import TrafficProfile from './TrafficProfile';
import AnalyzerSelection from './AnalyzerSelection';
import ClientDevices from './ClientDevices';
import AccessPoints from './AccessPoints';

export default function AnalysisInsights({ analysis }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis || analysis.status !== 'ok') {
    return null;
  }

  // Extract smart analysis data from the details field
  const smartData = analysis.details || {};
  const trafficProfile = smartData.traffic_profile || null;
  const analyzerSelection = smartData.analyzer_selection || null;
  const associationAnalysis = smartData.association_analysis || null;
  const accessPointAnalysis = smartData.access_point_analysis || null;
  
  // Create enhanced analysis object with smart data at root level
  const enhancedAnalysis = {
    ...analysis,
    traffic_profile: trafficProfile,
    analyzer_selection: analyzerSelection,
    selected_analyzers: smartData.selected_analyzers || []
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'frames', label: 'Frame Mix', icon: '🔄' },
    { id: 'profile', label: 'Traffic Profile', icon: '🏷️' },
    { id: 'aps', label: 'Access Points', icon: '📡' },
    { id: 'devices', label: 'Client Devices', icon: '📱' },
    { id: 'selection', label: 'Analyzer Selection', icon: '🎯' },
    { id: 'findings', label: 'Findings', icon: '🔍' }
  ];

  // Check for findings in the analyzer results (excluding smart analysis metadata)  
  const analyzerResults = Object.fromEntries(
    Object.entries(smartData).filter(([key]) => 
      !key.startsWith('traffic_profile') && 
      !key.startsWith('analyzer_selection') && 
      !key.startsWith('selected_analyzers')
    )
  );
  
  const hasFindings = Object.keys(analyzerResults).length > 0;
  const hasSecurityFindings = hasFindings && Object.values(analyzerResults).some(detail => {
    return (detail && typeof detail === 'object') && (
      (detail.suspicious_bursts && detail.suspicious_bursts.length > 0) ||
      (detail.suspected_evil_twins && detail.suspected_evil_twins.length > 0) ||
      (detail.clients_with_large_pnl && detail.clients_with_large_pnl.length > 0) ||
      (detail.weak_aps && detail.weak_aps.length > 0)
    );
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'findings' && hasSecurityFindings && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-semibold">
                  !
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab analysis={enhancedAnalysis} hasSecurityFindings={hasSecurityFindings} />
        )}
        
        {activeTab === 'frames' && (
          <FrameMixChart 
            frameMix={enhancedAnalysis.frame_mix} 
            totalPackets={enhancedAnalysis.total_packets} 
          />
        )}
        
        {activeTab === 'profile' && (
          <TrafficProfile 
            profile={enhancedAnalysis.traffic_profile}
            securityIndicators={enhancedAnalysis.traffic_profile?.security_indicators}
          />
        )}
        
        {activeTab === 'aps' && (
          <AccessPoints 
            accessPointAnalysis={accessPointAnalysis}
          />
        )}
        
        {activeTab === 'devices' && (
          <ClientDevices 
            associationAnalysis={associationAnalysis}
          />
        )}
        
        {activeTab === 'selection' && (
          <AnalyzerSelection 
            analyzerSelection={enhancedAnalysis.analyzer_selection}
            trafficProfile={enhancedAnalysis.traffic_profile}
          />
        )}
        
        {activeTab === 'findings' && (
          <FindingsTab analysis={{...enhancedAnalysis, details: analyzerResults}} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analysis, hasSecurityFindings }) {
  const stats = [
    { label: 'Total Packets', value: analysis.total_packets?.toLocaleString() || '0', icon: '📦' },
    { label: 'Unique Devices', value: analysis.unique_devices || '0', icon: '📱' },
    { label: 'Access Points', value: analysis.unique_aps || '0', icon: '📡' },
    { label: 'Client Devices', value: analysis.unique_clients || '0', icon: '💻' },
    { label: 'SSIDs Found', value: analysis.ssid_count || '0', icon: '🏷️' },
    { label: 'Analysis Time', value: `${analysis.duration_ms || 0}ms`, icon: '⏱️' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Analysis Overview</h3>
          <p className="text-gray-600 mt-1">
            {analysis.traffic_profile?.profile && (
              <span className="capitalize">
                {analysis.traffic_profile.profile.replace('_', ' ')} traffic pattern detected
              </span>
            )}
          </p>
        </div>
        
        {hasSecurityFindings && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-sm font-medium">Security findings detected</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Frame Mix Preview */}
      {analysis.frame_mix && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">Frame Distribution Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {Object.entries(analysis.frame_mix).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="font-bold text-blue-900">{count.toLocaleString()}</div>
                <div className="text-blue-700 capitalize">{type.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingsTab({ analysis }) {
  const findings = [];

  if (analysis.details) {
    Object.entries(analysis.details).forEach(([analyzerName, results]) => {
      if (analyzerName === 'DeauthDisassoc') {
        if (results.total_deauth > 0 || results.total_disassoc > 0) {
          findings.push({
            analyzer: analyzerName,
            type: 'deauth_activity',
            severity: results.suspicious_bursts?.length > 0 ? 'high' : 'medium',
            title: 'Deauthentication Activity',
            description: `Found ${results.total_deauth} deauth and ${results.total_disassoc} disassoc frames`,
            details: results.suspicious_bursts?.length > 0 ? 
              `${results.suspicious_bursts.length} suspicious burst(s) detected` : null,
            icon: '🚨'
          });
        }
      } else if (analyzerName === 'EvilTwinHeuristic') {
        if (results.suspected_evil_twins?.length > 0) {
          findings.push({
            analyzer: analyzerName,
            type: 'evil_twin',
            severity: 'high',
            title: 'Potential Evil Twin APs',
            description: `${results.suspected_evil_twins.length} SSID(s) with suspicious configurations`,
            details: results.suspected_evil_twins.slice(0, 3).map(s => `${s.ssid}: ${s.reason}`).join('; '),
            icon: '👥'
          });
        }
      } else if (analyzerName === 'ProbePrivacy') {
        if (results.clients_with_large_pnl?.length > 0) {
          findings.push({
            analyzer: analyzerName,
            type: 'privacy_leak',
            severity: 'medium',
            title: 'Privacy Leakage',
            description: `${results.clients_with_large_pnl.length} client(s) with large preferred network lists`,
            details: `May reveal location history and network preferences`,
            icon: '🕵️'
          });
        }
      } else if (analyzerName === 'WeakSecurity') {
        if (results.weak_aps?.length > 0) {
          findings.push({
            analyzer: analyzerName,
            type: 'weak_security',
            severity: 'medium',
            title: 'Weak Security',
            description: `${results.weak_aps.length} access point(s) with weak/no security`,
            details: results.weak_aps.slice(0, 3).map(ap => ap.ssid || ap.bssid).join(', '),
            icon: '🔓'
          });
        }
      }
    });
  }

  const getSeverityColor = (severity) => {
    const colors = {
      'high': 'bg-red-50 border-red-200 text-red-700',
      'medium': 'bg-yellow-50 border-yellow-200 text-yellow-700',
      'low': 'bg-blue-50 border-blue-200 text-blue-700'
    };
    return colors[severity] || 'bg-gray-50 border-gray-200 text-gray-700';
  };

  if (findings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Security Issues Found</h3>
        <p className="text-gray-600">The analysis didn't detect any obvious security concerns in this capture.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Security Findings</h3>
      
      <div className="space-y-4">
        {findings.map((finding, index) => (
          <div key={index} className={`rounded-lg border p-4 ${getSeverityColor(finding.severity)}`}>
            <div className="flex items-start gap-4">
              <span className="text-2xl">{finding.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold">{finding.title}</h4>
                  <span className="text-xs px-2 py-1 bg-black bg-opacity-10 rounded uppercase font-semibold">
                    {finding.severity}
                  </span>
                  <span className="text-xs px-2 py-1 bg-black bg-opacity-5 rounded">
                    {finding.analyzer}
                  </span>
                </div>
                <p className="font-medium mb-1">{finding.description}</p>
                {finding.details && (
                  <p className="text-sm opacity-80">{finding.details}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}