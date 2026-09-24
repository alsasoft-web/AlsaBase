import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Stack,
  Group,
  Text,
  Button,
  Paper,
  Box,
  Badge,
  useComputedColorScheme,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconAlertTriangle,
  IconTrash,
  IconClock,
  IconCheck,
} from "@tabler/icons-react";

export interface HoldToConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  holdDurationMs?: number;
  label?: string;
  color?: string;
  disabled?: boolean;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onConfirm,
  holdDurationMs = 5000,
  label = "Hold to Confirm",
  color = "red",
  disabled = false,
}) => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const [progress, setProgress] = useState(0); // 0 to 100
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [remainingSec, setRemainingSec] = useState(
    (holdDurationMs / 1000).toFixed(1)
  );

  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (hasTriggeredRef.current) return;
    setIsHolding(false);
    startTimeRef.current = null;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setProgress(0);
    setRemainingSec((holdDurationMs / 1000).toFixed(1));
  }, [holdDurationMs]);

  const tick = useCallback(
    (currentTime: number) => {
      if (!startTimeRef.current || hasTriggeredRef.current) return;

      const elapsed = currentTime - startTimeRef.current;
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      const left = Math.max(0, (holdDurationMs - elapsed) / 1000);

      setProgress(pct);
      setRemainingSec(left.toFixed(1));

      if (elapsed >= holdDurationMs) {
        hasTriggeredRef.current = true;
        setIsCompleted(true);
        setIsHolding(false);
        setProgress(100);
        setRemainingSec("0.0");
        try {
          onConfirm();
        } catch (err) {
          console.error("Error during hold confirm callback:", err);
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    },
    [holdDurationMs, onConfirm]
  );

  const startHold = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
      if (disabled || isCompleted || hasTriggeredRef.current) return;
      if (e.type === "mousedown" && (e as React.MouseEvent).button !== 0) return;

      setIsHolding(true);
      hasTriggeredRef.current = false;
      startTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [disabled, isCompleted, tick]
  );

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const buttonBg =
    color === "red"
      ? isDark
        ? "#7f1d1d"
        : "#b91c1c"
      : color === "orange"
      ? isDark
        ? "#7c2d12"
        : "#c2410c"
      : isDark
      ? "#1e293b"
      : "#334155";

  const progressFillColor =
    color === "red" ? "#ef4444" : color === "orange" ? "#f97316" : "#3b82f6";

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Button
        color={color}
        variant="filled"
        disabled={disabled || isCompleted}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            startHold(e);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            cancelHold();
          }
        }}
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: buttonBg,
          minWidth: "200px",
          height: "40px",
          fontWeight: 700,
          letterSpacing: "0.2px",
          transition: "box-shadow 0.2s ease, transform 0.1s ease",
          boxShadow: isHolding
            ? `0 0 18px ${progressFillColor}99, inset 0 0 10px rgba(0,0,0,0.3)`
            : "0 2px 8px rgba(0,0,0,0.2)",
          transform: isHolding ? "scale(0.98)" : "scale(1)",
        }}
        leftSection={
          isCompleted ? (
            <IconCheck size={18} />
          ) : isHolding ? (
            <IconClock
              size={18}
              style={{
                animation: "spin 2s linear infinite",
              }}
            />
          ) : (
            <IconTrash size={18} />
          )
        }
      >
        {/* Dynamic Progress Fill overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${progress}%`,
            backgroundColor: progressFillColor,
            opacity: 0.9,
            transition: isHolding ? "none" : "width 0.25s ease-out",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Content Label */}
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#ffffff",
          }}
        >
          {isCompleted
            ? "Confirmed!"
            : isHolding
            ? `Hold... ${remainingSec}s`
            : `${label} (${Math.round(holdDurationMs / 1000)}s)`}
        </span>
      </Button>
    </div>
  );
};

export interface HoldToConfirmModalOptions {
  title?: React.ReactNode;
  children?: React.ReactNode;
  labels?: {
    confirm?: string;
    cancel?: string;
  };
  confirmProps?: {
    color?: string;
  };
  holdDurationMs?: number; // defaults to 5000 (5 seconds)
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  centered?: boolean;
  size?: string | number;
}

interface ModalContentProps extends HoldToConfirmModalOptions {
  modalId: string;
}

const HoldToConfirmModalContent: React.FC<ModalContentProps> = ({
  modalId,
  title,
  children,
  labels,
  confirmProps,
  holdDurationMs = 5000,
  onConfirm,
  onCancel,
}) => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const handleConfirmed = async () => {
    try {
      if (onConfirm) {
        await onConfirm();
      }
    } finally {
      modals.close(modalId);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    modals.close(modalId);
  };

  const confirmColor = confirmProps?.color || "red";

  return (
    <Stack gap="md">
      {/* Header with Warning Icon */}
      <Group gap="sm" align="center">
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor:
              confirmColor === "red"
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(249, 115, 22, 0.15)",
            border: `1px solid ${
              confirmColor === "red"
                ? "rgba(239, 68, 68, 0.35)"
                : "rgba(249, 115, 22, 0.35)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {confirmColor === "red" ? (
            <IconAlertTriangle size={20} color="#ef4444" />
          ) : (
            <IconAlertTriangle size={20} color="#f97316" />
          )}
        </Box>
        <Stack gap={1} style={{ flex: 1 }}>
          <Text fw={700} size="md" style={{ color: "var(--color-text-primary)" }}>
            {title || "Confirm Deletion"}
          </Text>
          <Badge
            size="xs"
            variant="light"
            color={confirmColor}
            style={{ width: "fit-content" }}
          >
            Hold for {Math.round(holdDurationMs / 1000)} seconds
          </Badge>
        </Stack>
      </Group>

      {/* Body Message */}
      <Box style={{ color: "var(--color-text-primary)", fontSize: "14px" }}>
        {children}
      </Box>

      {/* Safety Notice Banner */}
      <Paper
        p="xs"
        withBorder
        style={{
          backgroundColor: isDark
            ? "rgba(239, 68, 68, 0.08)"
            : "rgba(239, 68, 68, 0.05)",
          borderColor: isDark
            ? "rgba(239, 68, 68, 0.25)"
            : "rgba(239, 68, 68, 0.2)",
          borderRadius: 6,
        }}
      >
        <Group gap="xs" wrap="nowrap" align="center">
          <IconClock size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
            Safety Protection: <b>Press and hold</b> the confirm button for{" "}
            <b>{Math.round(holdDurationMs / 1000)} seconds</b>. Releasing early
            will immediately cancel the operation.
          </Text>
        </Group>
      </Paper>

      {/* Actions */}
      <Group justify="flex-end" gap="sm" mt="xs">
        <Button variant="default" onClick={handleCancel}>
          {labels?.cancel || "Cancel"}
        </Button>
        <HoldToConfirmButton
          label={labels?.confirm || "Delete"}
          color={confirmColor}
          holdDurationMs={holdDurationMs}
          onConfirm={handleConfirmed}
        />
      </Group>
    </Stack>
  );
};

/**
 * Global helper to open a Hold-to-Confirm modal that requires holding the confirm button for 5 seconds.
 */
export function openHoldToConfirmModal(options: HoldToConfirmModalOptions): string {
  const modalId = `hold-confirm-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  modals.open({
    modalId,
    withCloseButton: true,
    centered: options.centered !== false,
    size: options.size || "md",
    children: <HoldToConfirmModalContent modalId={modalId} {...options} />,
  });

  return modalId;
}
