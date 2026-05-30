export default function TunisianMeshBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-navy-50"
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.35]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="tunisian-mesh"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path
              d="M0 24h48M24 0v48"
              stroke="#0F2744"
              strokeWidth="0.5"
              strokeOpacity="0.08"
            />
            <circle cx="24" cy="24" r="2" fill="#C9A84C" fillOpacity="0.12" />
            <path
              d="M12 12l12 12M36 12L24 24M12 36l12-12M36 36L24 24"
              stroke="#0F2744"
              strokeWidth="0.35"
              strokeOpacity="0.06"
            />
          </pattern>
          <linearGradient id="mesh-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#f4f6f9" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#tunisian-mesh)" />
        <rect width="100%" height="100%" fill="url(#mesh-fade)" />
      </svg>
    </div>
  );
}
