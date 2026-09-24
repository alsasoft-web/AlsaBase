import React, { useState, useRef, useEffect } from "react";
import {
  Group,
  Button,
  ActionIcon,
  Tooltip,
  Text,
  Badge,
  Box,
} from "@mantine/core";
import {
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconArrowsMaximize,
  IconExternalLink,
  IconDownload,
  IconCopy,
  IconMusic,
  IconCode,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { copyToClipboard } from "../utils/clipboard";

export interface MediaViewerProps {
  filename: string;
  src: string;
  sizeBytes?: number;
  updatedAt?: string;
  isDark?: boolean;
  onSwitchToCode?: () => void;
  showCodeToggle?: boolean;
}

export function isMediaFilename(filename: string | null): {
  isMedia: boolean;
  mediaType: "image" | "audio" | "video" | "pdf" | "none";
} {
  if (!filename) return { isMedia: false, mediaType: "none" };
  const lower = filename.toLowerCase();

  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".ico") ||
    lower.endsWith(".bmp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".tiff") ||
    lower.endsWith(".svg")
  ) {
    return { isMedia: true, mediaType: "image" };
  }

  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".aac") ||
    lower.endsWith(".flac") ||
    lower.endsWith(".m4a")
  ) {
    return { isMedia: true, mediaType: "audio" };
  }

  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".ogv")
  ) {
    return { isMedia: true, mediaType: "video" };
  }

  if (lower.endsWith(".pdf")) {
    return { isMedia: true, mediaType: "pdf" };
  }

  return { isMedia: false, mediaType: "none" };
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  filename,
  src,
  sizeBytes,
  isDark = true,
  onSwitchToCode,
  showCodeToggle = false,
}) => {
  const { mediaType } = isMediaFilename(filename);
  const isSvg = filename.toLowerCase().endsWith(".svg");

  const [zoom, setZoom] = useState<number>(1);
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom & pan when switching files
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalDimensions(null);
  }, [src, filename]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.25, 10));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.25, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (!containerRef.current || !naturalDimensions) return;
    const containerWidth = containerRef.current.clientWidth - 64;
    const containerHeight = containerRef.current.clientHeight - 64;
    const widthRatio = containerWidth / naturalDimensions.width;
    const heightRatio = containerHeight / naturalDimensions.height;
    const fitRatio = Math.min(widthRatio, heightRatio, 1);
    setZoom(Math.max(fitRatio, 0.1));
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.05), 15));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCopyPath = async () => {
    await copyToClipboard(filename);
    notifications.show({
      title: "Path Copied",
      message: filename,
      color: "teal",
    });
  };

  // Checkerboard pattern for transparency contrast
  const checkerboardStyle: React.CSSProperties = {
    backgroundImage: isDark
      ? `linear-gradient(45deg, #181f2a 25%, transparent 25%),
         linear-gradient(-45deg, #181f2a 25%, transparent 25%),
         linear-gradient(45deg, transparent 75%, #181f2a 75%),
         linear-gradient(-45deg, transparent 75%, #181f2a 75%)`
      : `linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
         linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
         linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
         linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    backgroundColor: isDark ? "#0b101b" : "#f8fafc",
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "var(--color-bg-base)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Top Preview Toolbar */}
      <div
        style={{
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-card)",
          minHeight: 36,
          userSelect: "none",
        }}
      >
        {/* Left: File Metadata Info */}
        <Group gap="xs">
          <Badge
            size="sm"
            variant="filled"
            style={{
              backgroundColor: "var(--color-neon-dim)",
              color: "var(--color-neon-primary)",
              border: "1px solid var(--color-border-glow)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {filename.split(".").pop()?.toUpperCase() || "MEDIA"}
          </Badge>

          {naturalDimensions && (
            <Text
              size="xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-dimmed)",
                fontSize: "12px",
              }}
            >
              {naturalDimensions.width} × {naturalDimensions.height} px
            </Text>
          )}

          {sizeBytes && sizeBytes > 0 && (
            <Text
              size="xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-dimmed)",
                fontSize: "12px",
              }}
            >
              • {formatBytes(sizeBytes)}
            </Text>
          )}
        </Group>

        {/* Right: Controls & Actions */}
        <Group gap={6}>
          {isSvg && showCodeToggle && onSwitchToCode && (
            <Tooltip label="Edit SVG Source Code" withArrow position="bottom">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconCode size={13} />}
                onClick={onSwitchToCode}
                style={{
                  height: 24,
                  fontSize: "11px",
                  color: "var(--color-text-dimmed)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Edit Source
              </Button>
            </Tooltip>
          )}

          {mediaType === "image" && (
            <>
              <Tooltip label="Zoom In (Wheel Up)" withArrow position="bottom">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleZoomIn}
                  style={{ color: "var(--color-text-dimmed)" }}
                >
                  <IconZoomIn size={14} />
                </ActionIcon>
              </Tooltip>

              <Text
                size="xs"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11.5px",
                  color: "var(--color-text-primary)",
                  minWidth: 44,
                  textAlign: "center",
                }}
              >
                {Math.round(zoom * 100)}%
              </Text>

              <Tooltip label="Zoom Out (Wheel Down)" withArrow position="bottom">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleZoomOut}
                  style={{ color: "var(--color-text-dimmed)" }}
                >
                  <IconZoomOut size={14} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Reset 100%" withArrow position="bottom">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleResetZoom}
                  style={{ color: "var(--color-text-dimmed)" }}
                >
                  <IconZoomReset size={14} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Fit to Screen" withArrow position="bottom">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleFitToScreen}
                  style={{ color: "var(--color-text-dimmed)" }}
                >
                  <IconArrowsMaximize size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}

          <Tooltip label="Copy Relative Path" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={handleCopyPath}
              style={{ color: "var(--color-text-dimmed)" }}
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Open in New Tab" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="subtle"
              component="a"
              href={src}
              target="_blank"
              style={{ color: "var(--color-text-dimmed)" }}
            >
              <IconExternalLink size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Download Asset" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="subtle"
              component="a"
              href={src}
              download={filename.split("/").pop()}
              style={{ color: "var(--color-text-dimmed)" }}
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* Main Preview Container */}
      <div
        ref={containerRef}
        onWheel={mediaType === "image" ? handleWheel : undefined}
        onMouseDown={mediaType === "image" ? handleMouseDown : undefined}
        onMouseMove={mediaType === "image" ? handleMouseMove : undefined}
        onMouseUp={mediaType === "image" ? handleMouseUp : undefined}
        onMouseLeave={mediaType === "image" ? handleMouseUp : undefined}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          cursor:
            mediaType === "image"
              ? isDragging
                ? "grabbing"
                : "grab"
              : "default",
          ...checkerboardStyle,
        }}
      >
        {/* 1. IMAGE VIEWER */}
        {mediaType === "image" && (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.12s ease-out",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
              borderRadius: "4px",
              lineHeight: 0,
              maxWidth: "90%",
              maxHeight: "90%",
            }}
          >
            <img
              ref={imageRef}
              src={src}
              alt={filename}
              onLoad={handleImageLoad}
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
                userSelect: "none",
                borderRadius: "4px",
                imageRendering: zoom > 2 ? "pixelated" : "auto",
              }}
            />
          </div>
        )}

        {/* 2. AUDIO VIEWER */}
        {mediaType === "audio" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              padding: 32,
              backgroundColor: "var(--color-bg-card)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              maxWidth: 460,
              width: "90%",
            }}
          >
            <Box
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--color-neon-dim)",
                border: "1px solid var(--color-border-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconMusic size={32} color="var(--color-neon-primary)" />
            </Box>
            <div style={{ textAlign: "center" }}>
              <Text fw={700} size="sm">
                {filename.split("/").pop()}
              </Text>
              <Text size="xs" c="dimmed">
                {formatBytes(sizeBytes)} • Audio Stream
              </Text>
            </div>
            <audio
              controls
              src={src}
              style={{
                width: "100%",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* 3. VIDEO VIEWER */}
        {mediaType === "video" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: "85%",
              maxHeight: "85%",
              backgroundColor: "var(--color-bg-card)",
              borderRadius: 12,
              padding: 12,
              border: "1px solid var(--color-border)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            }}
          >
            <video
              controls
              src={src}
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                borderRadius: 8,
                outline: "none",
                display: "block",
              }}
            />
          </div>
        )}

        {/* 4. PDF VIEWER */}
        {mediaType === "pdf" && (
          <iframe
            src={src}
            title={filename}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        )}
      </div>
    </div>
  );
};
