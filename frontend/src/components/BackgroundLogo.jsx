// src/components/BackgroundLogo.jsx
export default function BackgroundLogo() {
    return (
      <div
        className="
          fixed inset-0
          bg-no-repeat bg-center bg-contain
          opacity-5
          pointer-events-none
          -z-10
        "
        style={{ backgroundImage: "url('/pawketeer.png')" }}
      />
    );
  }
  