import React, { useState } from 'react';

export default function FrameMixChart({ frameMix, totalPackets }) {
  const [expandedGroups, setExpandedGroups] = useState({
    management: true,
    control: false,
    data: false,
    other: false
  });

  if (!frameMix || !totalPackets || totalPackets === 0) {
    return <div className="text-gray-500 text-sm">No frame data available</div>;
  }

  // Define all frame types with their categories, colors, and descriptions
  const frameTypeDefinitions = {
    // Management Frames - Discovery & Network Info
    beacon: { label: 'Beacon', color: 'bg-blue-500', description: 'AP advertisements', group: 'management' },
    probe_req: { label: 'Probe Request', color: 'bg-blue-400', description: 'Client network scanning', group: 'management' },
    probe_resp: { label: 'Probe Response', color: 'bg-blue-300', description: 'AP scan responses', group: 'management' },
    
    // Management Frames - Authentication & Association
    auth: { label: 'Authentication', color: 'bg-green-500', description: 'Authentication frames', group: 'management' },
    assoc_req: { label: 'Association Request', color: 'bg-green-400', description: 'Client association requests', group: 'management' },
    assoc_resp: { label: 'Association Response', color: 'bg-green-300', description: 'AP association responses', group: 'management' },
    reassoc_req: { label: 'Reassociation Request', color: 'bg-green-200', description: 'Client reassociation', group: 'management' },
    reassoc_resp: { label: 'Reassociation Response', color: 'bg-green-100', description: 'AP reassociation responses', group: 'management' },
    
    // Management Frames - Disconnection
    deauth: { label: 'Deauthentication', color: 'bg-red-500', description: 'Disconnection frames', group: 'management' },
    disassoc: { label: 'Disassociation', color: 'bg-red-400', description: 'Disassociation frames', group: 'management' },
    
    // Management Frames - Other
    atim: { label: 'ATIM', color: 'bg-purple-300', description: 'Announcement frames', group: 'management' },
    mgmt_other: { label: 'Other Management', color: 'bg-gray-400', description: 'Unspecified management frames', group: 'management' },
    
    // Control Frames
    ack: { label: 'ACK', color: 'bg-orange-500', description: 'Acknowledgment frames', group: 'control' },
    rts: { label: 'RTS', color: 'bg-orange-400', description: 'Request to Send', group: 'control' },
    cts: { label: 'CTS', color: 'bg-orange-300', description: 'Clear to Send', group: 'control' },
    ps_poll: { label: 'PS-Poll', color: 'bg-orange-200', description: 'Power Save Poll', group: 'control' },
    cf_end: { label: 'CF-End', color: 'bg-orange-100', description: 'Contention Free End', group: 'control' },
    cf_end_ack: { label: 'CF-End+ACK', color: 'bg-yellow-200', description: 'CF-End with ACK', group: 'control' },
    control_other: { label: 'Other Control', color: 'bg-gray-400', description: 'Unspecified control frames', group: 'control' },
    
    // Data Frames
    data: { label: 'Data', color: 'bg-indigo-500', description: 'Regular data frames', group: 'data' },
    qos_data: { label: 'QoS Data', color: 'bg-indigo-400', description: 'Quality of Service data', group: 'data' },
    null_data: { label: 'Null Data', color: 'bg-indigo-300', description: 'No-data frames', group: 'data' },
    data_cf_ack: { label: 'Data+CF-ACK', color: 'bg-indigo-200', description: 'Data with CF acknowledgment', group: 'data' },
    data_cf_poll: { label: 'Data+CF-Poll', color: 'bg-indigo-100', description: 'Data with CF poll', group: 'data' },
    data_cf_ack_poll: { label: 'Data+CF-ACK+Poll', color: 'bg-cyan-200', description: 'Data with CF ACK and poll', group: 'data' },
    cf_ack: { label: 'CF-ACK', color: 'bg-cyan-300', description: 'Contention Free ACK', group: 'data' },
    cf_poll: { label: 'CF-Poll', color: 'bg-cyan-400', description: 'Contention Free Poll', group: 'data' },
    cf_ack_poll: { label: 'CF-ACK+Poll', color: 'bg-cyan-500', description: 'CF ACK with Poll', group: 'data' },
    data_other: { label: 'Other Data', color: 'bg-gray-400', description: 'Unspecified data frames', group: 'data' },
    
    // Other/Unknown
    non_802_11: { label: 'Non-802.11', color: 'bg-gray-500', description: 'Non-WiFi frames', group: 'other' },
    radiotap_no_dot11: { label: 'RadioTap Only', color: 'bg-gray-400', description: 'RadioTap without 802.11', group: 'other' },
    reserved: { label: 'Reserved', color: 'bg-gray-400', description: 'Reserved frame types', group: 'other' },
    unknown: { label: 'Unknown', color: 'bg-gray-300', description: 'Unidentified frames', group: 'other' }
  };

  // Group frames by category and calculate totals
  const groupedFrames = {
    management: [],
    control: [],
    data: [],
    other: []
  };

  let totalCategorizedFrames = 0;
  Object.entries(frameMix).forEach(([frameType, count]) => {
    const definition = frameTypeDefinitions[frameType];
    if (definition && count > 0) {
      const percentage = (count / totalPackets) * 100;
      groupedFrames[definition.group].push({
        key: frameType,
        ...definition,
        count,
        percentage
      });
      totalCategorizedFrames += count;
    }
  });

  // Calculate group totals
  const groupTotals = {};
  Object.keys(groupedFrames).forEach(group => {
    groupTotals[group] = {
      count: groupedFrames[group].reduce((sum, frame) => sum + frame.count, 0),
      percentage: groupedFrames[group].reduce((sum, frame) => sum + frame.percentage, 0)
    };
  });

  // Sort frames within each group by count (descending)
  Object.keys(groupedFrames).forEach(group => {
    groupedFrames[group].sort((a, b) => b.count - a.count);
  });

  const maxPercentage = Math.max(...Object.values(groupTotals).map(g => g.percentage));

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const getGroupIcon = (group) => {
    const icons = {
      management: '📋',
      control: '🎮', 
      data: '📦',
      other: '❓'
    };
    return icons[group] || '📄';
  };

  const getGroupColor = (group) => {
    const colors = {
      management: 'border-blue-300 bg-blue-50',
      control: 'border-orange-300 bg-orange-50',
      data: 'border-indigo-300 bg-indigo-50',
      other: 'border-gray-300 bg-gray-50'
    };
    return colors[group] || 'border-gray-300 bg-gray-50';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-gray-900">Frame Composition</h4>
        <span className="text-sm text-gray-600">{totalPackets.toLocaleString()} total packets</span>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedFrames).map(([groupName, frames]) => {
          if (frames.length === 0) return null;
          
          const total = groupTotals[groupName];
          const isExpanded = expandedGroups[groupName];
          
          return (
            <div key={groupName} className={`border rounded-lg p-4 ${getGroupColor(groupName)}`}>
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between text-left hover:opacity-80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getGroupIcon(groupName)}</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {groupName} Frames
                  </span>
                  <span className="text-sm text-gray-600">
                    ({frames.length} type{frames.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold">{total.count.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">{total.percentage.toFixed(1)}%</div>
                  </div>
                  <div className="transform transition-transform duration-200">
                    {isExpanded ? '🔽' : '▶️'}
                  </div>
                </div>
              </button>

              {/* Group Progress Bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full bg-gradient-to-r from-gray-600 to-gray-400"
                  style={{ width: `${maxPercentage > 0 ? (total.percentage / maxPercentage) * 100 : 0}%` }}
                ></div>
              </div>

              {/* Expanded Frame Details */}
              {isExpanded && (
                <div className="mt-4 space-y-2 pl-4 border-l-2 border-gray-300">
                  {frames.map(frame => (
                    <div key={frame.key} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${frame.color}`}></div>
                          <span className="font-medium">{frame.label}</span>
                          <span className="text-gray-500">({frame.description})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600">{frame.count.toLocaleString()}</span>
                          <span className="font-medium min-w-[50px] text-right">
                            {frame.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${frame.color}`}
                          style={{ width: `${total.percentage > 0 ? (frame.percentage / total.percentage) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-100 rounded-lg p-4 mt-6">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium">Total Categorized:</span>
          <span>{totalCategorizedFrames.toLocaleString()} / {totalPackets.toLocaleString()} packets</span>
        </div>
        {totalCategorizedFrames < totalPackets && (
          <div className="flex justify-between items-center text-sm text-orange-600 mt-1">
            <span>Uncategorized:</span>
            <span>{(totalPackets - totalCategorizedFrames).toLocaleString()} packets</span>
          </div>
        )}
      </div>
    </div>
  );
}