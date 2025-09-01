import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function PendingUsers({ onStatsUpdate }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingUser, setProcessingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setIsLoading(true);
      const data = await api.getPendingUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (user) => {
    setProcessingUser(user.id);
    try {
      await api.approveUser(user.id, notes);
      await fetchPendingUsers();
      onStatsUpdate();
      setSelectedUser(null);
      setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingUser(null);
    }
  };

  const handleReject = async (user) => {
    setProcessingUser(user.id);
    try {
      await api.rejectUser(user.id, notes);
      await fetchPendingUsers();
      onStatsUpdate();
      setSelectedUser(null);
      setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingUser(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysRemainingColor = (days) => {
    if (days <= 1) return 'text-red-600 bg-red-100';
    if (days <= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading pending users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Pending User Approvals</h2>
        <button
          onClick={fetchPendingUsers}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending users</h3>
          <p className="text-gray-600">All user access requests have been processed.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {users.map((user) => (
              <li key={user.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-lg font-medium text-gray-900">
                          {user.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          Requested on {formatDate(user.created_at)}
                        </p>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDaysRemainingColor(user.days_remaining)}`}>
                        {user.days_remaining > 0 
                          ? `${user.days_remaining} day${user.days_remaining !== 1 ? 's' : ''} left`
                          : 'Expires today'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUser(user)}
                      disabled={processingUser === user.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {processingUser === user.id ? 'Processing...' : 'Review'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Review User: {selectedUser.email}
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Requested on:</p>
                <p className="font-medium">{formatDate(selectedUser.created_at)}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Time remaining:</p>
                <p className={`font-medium ${selectedUser.days_remaining <= 1 ? 'text-red-600' : ''}`}>
                  {selectedUser.days_remaining > 0 
                    ? `${selectedUser.days_remaining} day${selectedUser.days_remaining !== 1 ? 's' : ''}`
                    : 'Expires today'
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  placeholder="Add any notes about this decision..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleApprove(selectedUser)}
                disabled={processingUser === selectedUser.id}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {processingUser === selectedUser.id ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(selectedUser)}
                disabled={processingUser === selectedUser.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {processingUser === selectedUser.id ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setNotes('');
                }}
                disabled={processingUser === selectedUser.id}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}