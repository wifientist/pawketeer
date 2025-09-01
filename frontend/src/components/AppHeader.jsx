import React from "react";
import config from "../config/config";
import LabLogo from "../assets/pawketeer-256.png";
import { useAuth } from "../contexts/AuthContext";

export default function AppHeader({ showAdminButton, onAdminClick }) {
  const { user, logout, isAdmin } = useAuth();

  return (
    <header className="relative bg-[--header-bg] text-gray p-5 rounded-[--radius] mb-8 text-center">
      <div className={"absolute top-0 left-0 px-3 py-2 rounded-full text-sm font-bold"}>
        <img src={LabLogo} width={128} height={128} alt="Logo" />
      </div>
      
      {/* User info and logout */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user.email}</div>
              {user.is_admin && (
                <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Admin
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {isAdmin && showAdminButton && (
                <button
                  onClick={onAdminClick}
                  className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Admin
                </button>
              )}
              <button
                onClick={logout}
                className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      
      <h1 className="m-0 mb-2 text-4xl font-semibold">{config.appName}</h1>
      <p className="opacity-90">Upload and analyze WiFi packet captures</p>
    </header>
  );
}
