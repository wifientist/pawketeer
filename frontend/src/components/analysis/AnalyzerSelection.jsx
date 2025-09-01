import React, { useState } from 'react';

export default function AnalyzerSelection({ analyzerSelection, trafficProfile }) {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!analyzerSelection) {
    return <div className="text-gray-500 text-sm">No analyzer selection data available</div>;
  }

  const getAnalyzerDescription = (analyzerName) => {
    const descriptions = {
      'DeauthDisassoc': 'Detects deauthentication and disassociation attacks',
      'EvilTwinHeuristic': 'Identifies potential evil twin access points',
      'ProbePrivacy': 'Analyzes client probe requests and privacy leakage',
      'WeakSecurity': 'Identifies open and weakly secured access points',
      'HandshakePMKID': 'Captures WPA handshakes and PMKIDs for analysis'
    };
    return descriptions[analyzerName] || 'Specialized WiFi security analyzer';
  };

  const getAnalyzerIcon = (analyzerName) => {
    const icons = {
      'DeauthDisassoc': '🚨',
      'EvilTwinHeuristic': '👥',
      'ProbePrivacy': '🕵️',
      'WeakSecurity': '🔓',
      'HandshakePMKID': '🔑'
    };
    return icons[analyzerName] || '🔍';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'high': 'bg-red-100 text-red-700 border-red-200',
      'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200', 
      'low': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-gray-900">Analyzer Selection</h4>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Selection Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h5 className="font-medium">
              {analyzerSelection.mode === 'automatic' ? 'Smart Selection' : 'Manual Selection'}
            </h5>
            <p className="text-sm text-gray-600">
              {analyzerSelection.selected.length} analyzer{analyzerSelection.selected.length !== 1 ? 's' : ''} selected
              {analyzerSelection.skipped.length > 0 && `, ${analyzerSelection.skipped.length} skipped`}
            </p>
          </div>
        </div>

        {analyzerSelection.mode === 'automatic' && analyzerSelection.profile && (
          <div className="text-sm text-gray-600 bg-white rounded p-2">
            Based on traffic profile: <span className="font-medium capitalize">{analyzerSelection.profile.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* Selected Analyzers */}
      <div className="space-y-3">
        <h5 className="font-medium text-gray-900 flex items-center gap-2">
          ✅ Selected Analyzers
        </h5>
        <div className="space-y-2">
          {analyzerSelection.selected.map(analyzerName => (
            <div key={analyzerName} className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">{getAnalyzerIcon(analyzerName)}</span>
                <div className="flex-1">
                  <h6 className="font-medium text-green-900">{analyzerName}</h6>
                  <p className="text-sm text-green-700 opacity-80">
                    {getAnalyzerDescription(analyzerName)}
                  </p>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-semibold">
                  ACTIVE
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selection Details */}
      {showDetails && analyzerSelection.selection_details && analyzerSelection.selection_details.length > 0 && (
        <div className="space-y-3">
          <h5 className="font-medium text-gray-900 flex items-center gap-2">
            📋 Selection Reasoning
          </h5>
          <div className="space-y-2">
            {analyzerSelection.selection_details.map((detail, index) => (
              <div 
                key={index}
                className={`rounded-lg border p-3 ${
                  detail.selected 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">
                    {detail.selected ? '✅' : '⏭️'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{detail.analyzer}</span>
                      <span className={`text-xs px-2 py-1 rounded uppercase font-semibold ${getPriorityColor(detail.priority)}`}>
                        {detail.priority}
                      </span>
                      {detail.selected && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{detail.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped Analyzers */}
      {analyzerSelection.skipped.length > 0 && showDetails && (
        <div className="space-y-3">
          <h5 className="font-medium text-gray-900 flex items-center gap-2">
            ⏭️ Skipped Analyzers
          </h5>
          <div className="space-y-2">
            {analyzerSelection.skipped.map(analyzerName => (
              <div key={analyzerName} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl opacity-50">{getAnalyzerIcon(analyzerName)}</span>
                  <div className="flex-1">
                    <h6 className="font-medium text-gray-600">{analyzerName}</h6>
                    <p className="text-sm text-gray-500">
                      {getAnalyzerDescription(analyzerName)}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                    NOT NEEDED
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}