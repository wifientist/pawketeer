import React from 'react';

export default function TrafficProfile({ profile, securityIndicators }) {
  if (!profile) {
    return <div className="text-gray-500 text-sm">No traffic profile available</div>;
  }

  const getProfileIcon = (profileType) => {
    const icons = {
      'deauth_attack': '🚨',
      'active_scanning': '📡',
      'passive_monitoring': '👁️',
      'client_activity': '📱',
      'normal_mixed': '📊'
    };
    return icons[profileType] || '❓';
  };

  const getProfileColor = (profileType) => {
    const colors = {
      'deauth_attack': 'bg-red-100 text-red-800 border-red-200',
      'active_scanning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'passive_monitoring': 'bg-blue-100 text-blue-800 border-blue-200',
      'client_activity': 'bg-purple-100 text-purple-800 border-purple-200',
      'normal_mixed': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[profileType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'high': 'bg-red-50 text-red-700 border-red-200',
      'medium': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'low': 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return colors[severity] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      'high': '🔴',
      'medium': '🟡', 
      'low': '🔵'
    };
    return icons[severity] || '⚪';
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-900">Traffic Profile</h4>
      
      {/* Main Profile */}
      <div className={`rounded-lg border p-4 ${getProfileColor(profile.profile)}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{getProfileIcon(profile.profile)}</span>
          <div>
            <h5 className="font-semibold text-lg capitalize">
              {profile.profile.replace('_', ' ')}
            </h5>
            <p className="text-sm opacity-80">
              {profile.interpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Security Indicators */}
      {securityIndicators && securityIndicators.length > 0 && (
        <div className="space-y-3">
          <h5 className="font-medium text-gray-900 flex items-center gap-2">
            ⚠️ Security Indicators
          </h5>
          <div className="space-y-2">
            {securityIndicators.map((indicator, index) => (
              <div 
                key={index}
                className={`rounded-lg border p-3 ${getSeverityColor(indicator.severity)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{getSeverityIcon(indicator.severity)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">
                        {indicator.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs px-2 py-1 bg-black bg-opacity-10 rounded uppercase font-semibold">
                        {indicator.severity}
                      </span>
                    </div>
                    <p className="text-sm">{indicator.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frame Percentages Summary */}
      {profile.frame_percentages && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Frame Distribution</h5>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(profile.frame_percentages).map(([type, percentage]) => (
              <div key={type} className="flex justify-between">
                <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                <span className="font-medium">{percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}