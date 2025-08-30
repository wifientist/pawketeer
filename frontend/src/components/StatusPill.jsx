import React from "react";

export default function StatusPill({ className = "", children }) {
  return (
    <div
      className={[
        "absolute top-4 right-4 px-3 py-2 rounded-full text-sm font-bold",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
