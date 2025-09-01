import React from 'react';

export default function AdminStats({ stats, onRefresh }) {
  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      color: 'blue',
      icon: '👥'
    },
    {
      title: 'Pending Approval',
      value: stats?.pending_users || 0,
      color: 'yellow',
      icon: '⏳'
    },
    {
      title: 'Approved Users',
      value: stats?.approved_users || 0,
      color: 'green',
      icon: '✅'
    },
    {
      title: 'Rejected Users',
      value: stats?.rejected_users || 0,
      color: 'red',
      icon: '❌'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">System Overview</h2>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`rounded-lg border p-6 ${getColorClasses(card.color)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">
                  {card.title}
                </p>
                <p className="text-3xl font-bold">
                  {card.value}
                </p>
              </div>
              <div className="text-3xl opacity-75">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">User Management</h4>
              <p className="text-sm text-gray-600">Review and manage user accounts</p>
            </div>
            <div className="text-2xl">🔧</div>
          </div>
          
          {stats?.pending_users > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div>
                <h4 className="font-medium text-yellow-800">Pending Approvals</h4>
                <p className="text-sm text-yellow-600">
                  {stats.pending_users} user{stats.pending_users !== 1 ? 's' : ''} waiting for approval
                </p>
              </div>
              <div className="text-2xl">⚠️</div>
            </div>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-sm">Authentication Service</span>
            <span className="text-sm text-green-600 font-medium">Online</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-sm">Database Connection</span>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-sm">Admin Dashboard</span>
            <span className="text-sm text-green-600 font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}