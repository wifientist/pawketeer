import React from "react";
import config from "../config/config";
import StatusPill from "./StatusPill";
import LabLogo from "../assets/pawketeer-256.png";

export default function AppHeader({ statusText, statusClass }) {
  return (
    <header className="relative bg-[--header-bg] text-gray p-5 rounded-[--radius] mb-8 text-center">
      <div className={"absolute top-4 left-4 px-3 py-2 rounded-full text-sm font-bold"}>
        <img src={LabLogo} width={128} height={128} alt="Logo" />
      </div>
      <h1 className="m-0 mb-2 text-4xl font-semibold">{config.appName}</h1>
      <p className="opacity-90">Upload and analyze WiFi packet captures</p>
      <StatusPill className={statusClass}>
        Server: {statusText}
      </StatusPill>
    </header>
  );
}
