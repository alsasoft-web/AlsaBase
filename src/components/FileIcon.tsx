import React from "react";

interface FileIconProps {
  name: string;
  isFolder?: boolean;
  isOpen?: boolean;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  isFolder = false,
  isOpen = false,
  size = 16,
}) => {
  const lower = name.toLowerCase();

  // 1. FOLDER ICONS
  if (isFolder) {
    if (lower === "_hooks" || lower.includes("hook")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#a855f7"
          />
          <path
            d="M14 11a2 2 0 10-4 0v4a2 2 0 004 0"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (lower === "_public" || lower === "public" || lower === "www") {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#0284c7"
          />
          <circle cx="12" cy="13" r="4" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M12 9c1.5 1.5 1.5 6.5 0 8M12 9c-1.5 1.5-1.5 6.5 0 8" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M8 13h8" stroke="#ffffff" strokeWidth="1.2" />
        </svg>
      );
    }

    if (lower === ".agent" || lower.includes("agent") || lower.includes("ai")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#ef4444"
          />
          <rect x="9" y="10" width="6" height="5" rx="1" fill="#ffffff" />
          <circle cx="10.5" cy="12.5" r="0.75" fill="#ef4444" />
          <circle cx="13.5" cy="12.5" r="0.75" fill="#ef4444" />
        </svg>
      );
    }

    if (lower === ".trash" || lower === "trash") {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#dc2626"
          />
          <path
            d="M9.5 11.5v4M14.5 11.5v4M8.5 10.5h7"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (lower === ".yarn" || lower.includes("yarn")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#0ea5e9"
          />
          <circle cx="12" cy="13" r="3.5" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );
    }

    if (lower === "data" || lower === "db" || lower.includes("database")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#eab308"
          />
          <ellipse cx="12" cy="11.5" rx="3.5" ry="1.5" fill="#ffffff" />
          <path d="M8.5 11.5v3c0 .8 1.6 1.5 3.5 1.5s3.5-.7 3.5-1.5v-3" stroke="#ffffff" strokeWidth="1.2" />
        </svg>
      );
    }

    if (lower === "dist" || lower === "build" || lower === "out") {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#f472b6"
          />
          <rect x="9" y="11" width="6" height="5" rx="1" fill="#ffffff" />
          <path d="M10.5 11V9.5a1.5 1.5 0 013 0V11" stroke="#ffffff" strokeWidth="1.2" />
        </svg>
      );
    }

    if (lower === "node_modules") {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#84cc16"
          />
          <path
            d="M9 13.5l3-2 3 2-3 2-3-2z"
            fill="#ffffff"
          />
        </svg>
      );
    }

    if (lower === "server" || lower.includes("backend") || lower.includes("api")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#f59e0b"
          />
          <rect x="8.5" y="10.5" width="7" height="2" rx="0.5" fill="#ffffff" />
          <rect x="8.5" y="13.5" width="7" height="2" rx="0.5" fill="#ffffff" />
          <circle cx="10" cy="11.5" r="0.5" fill="#f59e0b" />
          <circle cx="10" cy="14.5" r="0.5" fill="#f59e0b" />
        </svg>
      );
    }

    if (lower === "src" || lower === "source" || lower === "app" || lower.includes("component")) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            fill="#22c55e"
          />
          <path
            d="M10 11l-2 2 2 2M14 11l2 2-2 2"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // Default Folder
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          fill="#eab308"
        />
        {isOpen && (
          <path
            d="M3 10h18l-2 9H1l2-9z"
            fill="#facc15"
          />
        )}
      </svg>
    );
  }

  // 2. SPECIFIC FILE ICONS
  if (lower === "package.json" || lower === "package-lock.json") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l9 5.2v10.4l-9 5.2-9-5.2V7.2L12 2z"
          fill="#22c55e"
        />
        <path
          d="M12 4.5l6.5 3.7v7.6L12 19.5 5.5 15.8V8.2L12 4.5z"
          fill="#15803d"
        />
        <text
          x="12"
          y="14.5"
          fill="#ffffff"
          fontSize="8"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          JS
        </text>
      </svg>
    );
  }

  if (lower.startsWith("tsconfig") && lower.endsWith(".json")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#3178c6" />
        <text
          x="12"
          y="15.5"
          fill="#ffffff"
          fontSize="8.5"
          fontWeight="900"
          fontFamily="monospace"
          textAnchor="middle"
        >
          TS
        </text>
      </svg>
    );
  }

  if (lower.includes("vite.config")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M12.5 2L4 13h6.5L9.5 22 19 9.5h-6.5L14 2h-1.5z"
          fill="#a855f7"
        />
        <path
          d="M13 4l-6 8h5l-1 6 7-8.5h-5L14 4h-1z"
          fill="#ffd700"
        />
      </svg>
    );
  }

  if (lower.includes("postcss.config")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#dc2626" />
        <circle cx="12" cy="12" r="3.5" fill="#ffffff" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (lower.startsWith(".git") || lower === ".gitignore") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#f05032" />
        <circle cx="9" cy="9" r="2" fill="#ffffff" />
        <circle cx="15" cy="9" r="2" fill="#ffffff" />
        <circle cx="9" cy="15" r="2" fill="#ffffff" />
        <path d="M9 9v6M9 9l6 0" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  }

  if (lower.startsWith(".env")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" fill="#eab308" />
        <path d="M8 7h8M8 12h8M8 17h8" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="7" r="1.5" fill="#ffffff" />
        <circle cx="14" cy="12" r="1.5" fill="#ffffff" />
        <circle cx="11" cy="17" r="1.5" fill="#ffffff" />
      </svg>
    );
  }

  if (lower === "readme.md" || lower.endsWith(".md")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#0284c7" />
        <path
          d="M6 15V9h2l2 2.5L12 9h2v6h-2v-3.5L10 14l-2-2.5V15H6zM17 11.5l-2-2.5h1.5V9h1v2.5H19l-2 2.5z"
          fill="#ffffff"
        />
      </svg>
    );
  }

  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 3l1.5 16.5L12 21.5l6.5-2L20 3H4z"
          fill="#e34f26"
        />
        <path
          d="M12 4.5v15.2l5.2-1.6L18.4 4.5H12z"
          fill="#ef652a"
        />
        <text
          x="12"
          y="15"
          fill="#ffffff"
          fontSize="10"
          fontWeight="900"
          fontFamily="sans-serif"
          textAnchor="middle"
        >
          5
        </text>
      </svg>
    );
  }

  if (lower.endsWith(".css")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 3l1.5 16.5L12 21.5l6.5-2L20 3H4z"
          fill="#1572b6"
        />
        <path
          d="M12 4.5v15.2l5.2-1.6L18.4 4.5H12z"
          fill="#33a9dc"
        />
        <text
          x="12"
          y="15"
          fill="#ffffff"
          fontSize="10"
          fontWeight="900"
          fontFamily="sans-serif"
          textAnchor="middle"
        >
          3
        </text>
      </svg>
    );
  }

  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#3178c6" />
        <text
          x="12"
          y="16"
          fill="#ffffff"
          fontSize="9"
          fontWeight="900"
          fontFamily="monospace"
          textAnchor="middle"
        >
          TS
        </text>
      </svg>
    );
  }

  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#eab308" />
        <text
          x="12"
          y="16"
          fill="#000000"
          fontSize="9"
          fontWeight="900"
          fontFamily="monospace"
          textAnchor="middle"
        >
          JS
        </text>
      </svg>
    );
  }

  if (lower.endsWith(".json")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" fill="#22c55e" />
        <text
          x="12"
          y="15"
          fill="#ffffff"
          fontSize="10"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {"{}"}
        </text>
      </svg>
    );
  }

  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".ico") ||
    lower.endsWith(".svg")
  ) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#10b981" />
        <circle cx="8.5" cy="8.5" r="1.75" fill="#ffffff" />
        <path d="M4.5 17.5l5.5-6 4 4.5 2.5-3 3 4.5H4.5z" fill="#ffffff" />
      </svg>
    );
  }

  // Generic File
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3h8l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"
        fill="#64748b"
      />
      <path d="M14 3v5h5" fill="#94a3b8" />
    </svg>
  );
};
