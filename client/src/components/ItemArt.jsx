export default function ItemArt({ kind, className = "" }) {
  const common = {
    viewBox: "0 0 260 180",
    role: "img",
    className: `item-art ${className}`,
  };
  if (kind === "bottle")
    return (
      <svg {...common} aria-label="Ilustración de un termo">
        <ellipse
          cx="130"
          cy="160"
          rx="55"
          ry="8"
          fill="#1e4750"
          opacity=".12"
        />
        <rect x="110" y="28" width="40" height="16" rx="5" fill="#638a82" />
        <path
          d="M108 45h44l-4 13v84c0 12-8 20-18 20s-18-8-18-20V58l-4-13Z"
          fill="#edf3e6"
          stroke="#476e68"
          strokeWidth="3"
        />
        <path d="M112 77h36v45h-36z" fill="#9ec4ae" />
        <path
          d="M122 98c5-9 14-9 18 0"
          stroke="#4a8372"
          strokeWidth="3"
          fill="none"
        />
        <path d="M112 58h36" stroke="#476e68" strokeWidth="3" />
      </svg>
    );
  if (kind === "keys")
    return (
      <svg {...common} aria-label="Ilustración de unas llaves">
        <ellipse
          cx="130"
          cy="160"
          rx="60"
          ry="8"
          fill="#1e4750"
          opacity=".12"
        />
        <circle
          cx="100"
          cy="75"
          r="29"
          fill="none"
          stroke="#d8a858"
          strokeWidth="13"
        />
        <circle cx="100" cy="75" r="9" fill="#faf1e5" />
        <path
          d="m122 95 64 45-11 15-13-9-8 10-14-10 8-10-37-26"
          fill="#e7ba6c"
          stroke="#bc8b43"
          strokeWidth="2"
        />
        <circle cx="135" cy="81" r="9" fill="#d6a85a" />
      </svg>
    );
  if (kind === "wallet")
    return (
      <svg {...common} aria-label="Ilustración de una billetera">
        <ellipse
          cx="130"
          cy="159"
          rx="75"
          ry="8"
          fill="#1e4750"
          opacity=".12"
        />
        <rect x="52" y="55" width="156" height="93" rx="14" fill="#567b8a" />
        <path d="M65 55V43c0-8 6-13 14-13h107v27" fill="#7897a1" />
        <rect x="52" y="72" width="156" height="76" rx="14" fill="#315b68" />
        <rect x="140" y="93" width="69" height="39" rx="8" fill="#9bb8bb" />
        <circle cx="169" cy="112" r="5" fill="#315b68" />
      </svg>
    );
  return (
    <svg {...common} aria-label="Ilustración de unos audífonos">
      <ellipse cx="130" cy="162" rx="73" ry="8" fill="#1e4750" opacity=".12" />
      <path
        d="M65 91V76c0-37 28-60 65-60s65 23 65 60v15"
        fill="none"
        stroke="#6b7c8f"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <rect
        x="50"
        y="86"
        width="35"
        height="58"
        rx="15"
        fill="#e9e0d0"
        stroke="#687987"
        strokeWidth="4"
      />
      <rect
        x="175"
        y="86"
        width="35"
        height="58"
        rx="15"
        fill="#e9e0d0"
        stroke="#687987"
        strokeWidth="4"
      />
      <path
        d="M64 82V70c0-37 26-55 66-55s66 18 66 55v12"
        fill="none"
        stroke="#e9e0d0"
        strokeWidth="10"
      />
    </svg>
  );
}
