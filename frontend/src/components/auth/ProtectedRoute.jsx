import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthForm from './AuthForm';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔄</div>
          <div className="text-xl font-semibold text-gray-700">Loading...</div>
          <div className="text-gray-500">Checking authentication status</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You need administrator privileges to access this area.
          </p>
          <p className="text-sm text-gray-500">
            Contact your system administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return children;
}