import React, { useState, useEffect, useMemo } from "react";
import {
  Stack,
  Text,
  Title,
  Group,
  TextInput,
  Button,
  Table,
  Code,
  Pagination,
  Alert,
  Switch,
  ActionIcon,
  Tooltip,
  Box,
  useComputedColorScheme,
  Menu,
  Checkbox,
  Badge,
  Paper,
  Drawer,
  Tabs,
  Select,
  SegmentedControl,
} from "@mantine/core";
import {
  IconSearch,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
  IconActivity,
  IconSettings,
  IconInfoCircle,
  IconX,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconPlayerPause,
  IconDownload,
  IconTerminal2,
  IconClock,
  IconCode,
  IconChevronRight,
  IconArrowDownLeft,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  api,
  LogEntry,
  subscribeLogs,
  onRealtimeStatus,
} from "../../api/client";

export const LogsView: React.FC = () => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  // Data states
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [timelineData, setTimelineData] = useState<
    { time_bucket: string; total: number; errors: number }[]
  >([]);
  const [statsData, setStatsData] = useState<{
    total: number;
    error: number;
    warn: number;
    info: number;
    avgDurationMs: number;
  } | null>(null);

  // Filter states
  const [activeLevelTab, setActiveLevelTab] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [logSearch, setLogSearch] = useState<string>("");
  const [includeSuperusers, setIncludeSuperusers] = useState<boolean>(true);
  const [logPage, setLogPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>("50");

  // Live WebSocket streaming state
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Detail Drawer & Selection
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<string | null>(
    "overview",
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectAllAcrossPages, setSelectAllAcrossPages] =
    useState<boolean>(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let levelParam = activeLevelTab === "ALL" ? "" : activeLevelTab;
      if (activeLevelTab === "HOOKS") {
        levelParam = "";
      }

      const res = await api.listLogs({
        page: logPage,
        limit: parseInt(pageSize, 10) || 50,
        level: levelParam,
        search:
          activeLevelTab === "HOOKS"
            ? logSearch
              ? `${logSearch} HOOK`
              : "HOOK"
            : logSearch,
        includeSuperusers,
      });

      let items = res.items || [];
      if (selectedMethod !== "ALL") {
        items = items.filter(
          (lg) =>
            (lg.method || "").toUpperCase() === selectedMethod.toUpperCase(),
        );
      }

      setLogs(items);
      setLogTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error("Failed to load logs:", err);
      if (!silent) {
        notifications.show({
          title: "Error Loading Logs",
          message: err.message || "Could not fetch activity logs.",
          color: "red",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadStatsAndTimeline = async () => {
    try {
      const [timelineRes, statsRes] = await Promise.all([
        api.getLogTimeline().catch(() => ({ timeline: [] })),
        api.getLogStats().catch(() => ({
          total: 0,
          error: 0,
          warn: 0,
          info: 0,
          avgDurationMs: 0,
        })),
      ]);
      setTimelineData(timelineRes.timeline || []);
      setStatsData(statsRes);
    } catch (err) {
      console.error("Failed to load stats/timeline:", err);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [
    activeLevelTab,
    selectedMethod,
    logSearch,
    logPage,
    pageSize,
    includeSuperusers,
  ]);

  useEffect(() => {
    loadStatsAndTimeline();
  }, []);

  // Monitor WebSocket status
  useEffect(() => {
    const unsub = onRealtimeStatus((connected) => {
      setWsConnected(connected);
    });
    return () => unsub();
  }, []);

  // Live WebSocket log streaming (instant push without polling)
  useEffect(() => {
    if (!autoRefresh) return;

    const unsub = subscribeLogs((newLog) => {
      if (!newLog) return;

      // Check level filter
      if (activeLevelTab !== "ALL") {
        if (activeLevelTab === "HOOKS") {
          if (
            !newLog.path?.includes("hook") &&
            !newLog.method?.includes("HOOK")
          )
            return;
        } else if (newLog.level !== activeLevelTab) {
          return;
        }
      }

      // Check method filter
      if (
        selectedMethod !== "ALL" &&
        (newLog.method || "").toUpperCase() !== selectedMethod.toUpperCase()
      ) {
        return;
      }

      // Check search query
      if (logSearch && logSearch.trim()) {
        const term = logSearch.toLowerCase().trim();
        const matches =
          (newLog.path && newLog.path.toLowerCase().includes(term)) ||
          (newLog.error_message &&
            newLog.error_message.toLowerCase().includes(term)) ||
          (newLog.metadata_json &&
            newLog.metadata_json.toLowerCase().includes(term));
        if (!matches) return;
      }

      // Check superuser filter
      if (!includeSuperusers) {
        const isSuper =
          newLog.metadata_json?.includes('"isSuperuser":true') ||
          newLog.metadata_json?.includes('"role":"admin"') ||
          newLog.path?.startsWith("/api/hooks") ||
          newLog.path?.startsWith("/api/settings") ||
          newLog.path?.startsWith("/api/backups") ||
          newLog.path?.startsWith("/api/auth/superusers");
        if (isSuper) return;
      }

      // Prepend live log to list on first page
      if (logPage === 1) {
        const limitNum = parseInt(pageSize, 10) || 50;
        setLogs((prev) => [newLog, ...prev.slice(0, limitNum - 1)]);
        setLogTotal((prev) => prev + 1);
      }

      // Update summary counters in real time
      setStatsData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          total: prev.total + 1,
          error: newLog.level === "ERROR" ? prev.error + 1 : prev.error,
          warn: newLog.level === "WARN" ? prev.warn + 1 : prev.warn,
          info: newLog.level === "INFO" ? prev.info + 1 : prev.info,
        };
      });
    });

    return () => unsub();
  }, [
    autoRefresh,
    activeLevelTab,
    selectedMethod,
    logSearch,
    logPage,
    pageSize,
    includeSuperusers,
  ]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notifications.show({
      title: "Copied to Clipboard",
      message: "Content copied successfully.",
      color: "teal",
      autoClose: 2000,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleClearLogs = () => {
    modals.openConfirmModal({
      title: "Clear All Activity Logs",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to permanently clear all activity logs and stack
          traces from the database? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Clear All Logs", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.clearLogs();
          notifications.show({
            title: "Logs Cleared",
            message: "All activity logs were permanently cleared.",
            color: "teal",
          });
          setSelectedRowIds([]);
          setSelectAllAcrossPages(false);
          loadLogs();
          loadStatsAndTimeline();
        } catch (err: any) {
          notifications.show({
            title: "Failed to Clear Logs",
            message: err.message || "An error occurred while clearing logs.",
            color: "red",
          });
        }
      },
    });
  };

  const handleDeleteSelected = () => {
    const count = selectAllAcrossPages ? logTotal : selectedRowIds.length;
    if (count === 0) return;

    modals.openConfirmModal({
      title: "Delete Selected Logs",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete{" "}
          {selectAllAcrossPages
            ? `all ${logTotal.toLocaleString()} logs across all pages`
            : `${selectedRowIds.length} selected log(s)`}
          ?
        </Text>
      ),
      labels: {
        confirm: `Delete ${count.toLocaleString()} Log(s)`,
        cancel: "Cancel",
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          if (selectAllAcrossPages) {
            await api.deleteLogsBatch({
              all: true,
              level: activeLevelTab === "ALL" ? "" : activeLevelTab,
              search: logSearch,
              includeSuperusers,
            });
          } else {
            await api.deleteLogsBatch({ ids: selectedRowIds });
          }

          notifications.show({
            title: "Logs Deleted",
            message: `Successfully deleted ${count.toLocaleString()} log entries.`,
            color: "teal",
          });

          setSelectedRowIds([]);
          setSelectAllAcrossPages(false);
          loadLogs();
          loadStatsAndTimeline();
        } catch (err: any) {
          notifications.show({
            title: "Delete Failed",
            message: err.message || "Failed to delete selected logs.",
            color: "red",
          });
        }
      },
    });
  };

  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `alsabase_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notifications.show({
      title: "Logs Exported",
      message: `Exported ${logs.length} log records to JSON file.`,
      color: "teal",
    });
  };

  // Timeline buckets computation
  const chartBuckets = useMemo(() => {
    const buckets: {
      label: string;
      dateStr: string;
      count: number;
      errors: number;
    }[] = [];
    const now = new Date();
    const segmentCount = 32;

    const liveMap = new Map<string, { total: number; errors: number }>();
    timelineData.forEach((item) => {
      const d = new Date(item.time_bucket);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
      liveMap.set(key, { total: item.total, errors: item.errors });
    });

    for (let i = segmentCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3 * 3600 * 1000);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
      const live = liveMap.get(key);

      const hour = d.getHours();
      const hourLabel =
        hour === 0
          ? "12am"
          : hour === 12
            ? "12pm"
            : hour > 12
              ? `${hour - 12}pm`
              : `${hour}am`;
      const dateLabel = `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;

      const showDate = hour === 0 || hour === 6 || i === segmentCount - 1;
      const fullLabel = showDate ? `${hourLabel} ${dateLabel}` : hourLabel;

      buckets.push({
        label: fullLabel,
        dateStr: d.toLocaleString(),
        count: live?.total ?? 0,
        errors: live?.errors ?? 0,
      });
    }

    return buckets;
  }, [timelineData]);

  const maxVolume = useMemo(() => {
    const maxVal = Math.max(10, ...chartBuckets.map((b) => b.count));
    if (maxVal <= 10) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 500) return 500;
    return Math.ceil(maxVal / 500) * 500;
  }, [chartBuckets]);

  const formatTimestamps = (ts: string) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return { local: ts, utc: ts, relative: "" };

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const ms = String(date.getMilliseconds()).padStart(3, "0");

      const localStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
      const utcStr = date.toISOString().replace("T", " ");

      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      let relative = "";
      if (diffSec < 60) relative = `${diffSec}s ago`;
      else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
      else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
      else relative = `${Math.floor(diffSec / 86400)}d ago`;

      return { local: localStr, utc: utcStr, relative };
    } catch {
      return { local: ts, utc: ts, relative: "" };
    }
  };

  const getMethodBadge = (method?: string) => {
    const m = (method || "LOG").toUpperCase();
    let bg = "rgba(100, 116, 139, 0.15)";
    let color = "#94a3b8";
    let border = "rgba(100, 116, 139, 0.3)";

    if (m === "GET") {
      bg = isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.1)";
      color = isDark ? "#38bdf8" : "#0284c7";
      border = isDark ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.25)";
    } else if (m === "POST") {
      bg = isDark ? "rgba(16, 229, 122, 0.12)" : "rgba(5, 150, 105, 0.1)";
      color = isDark ? "#10e57a" : "#059669";
      border = isDark ? "rgba(16, 229, 122, 0.3)" : "rgba(5, 150, 105, 0.25)";
    } else if (m === "PATCH" || m === "PUT") {
      bg = isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(217, 119, 6, 0.1)";
      color = isDark ? "#fbbf24" : "#d97706";
      border = isDark ? "rgba(251, 191, 36, 0.3)" : "rgba(217, 119, 6, 0.25)";
    } else if (m === "DELETE") {
      bg = isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(220, 38, 38, 0.1)";
      color = isDark ? "#f87171" : "#dc2626";
      border = isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(220, 38, 38, 0.25)";
    } else if (m === "CRON" || m === "CRON_LOG") {
      bg = isDark ? "rgba(168, 85, 247, 0.12)" : "rgba(147, 51, 234, 0.1)";
      color = isDark ? "#c084fc" : "#7e22ce";
      border = isDark ? "rgba(168, 85, 247, 0.3)" : "rgba(147, 51, 234, 0.25)";
    } else if (m === "HOOK" || m === "HOOK_LOG" || m === "ROUTE_LOG") {
      bg = isDark ? "rgba(236, 72, 153, 0.12)" : "rgba(219, 39, 119, 0.1)";
      color = isDark ? "#f472b6" : "#db2777";
      border = isDark ? "rgba(236, 72, 153, 0.3)" : "rgba(219, 39, 119, 0.25)";
    }

    return (
      <span
        style={{
          display: "inline-block",
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: 4,
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
          letterSpacing: "0.02em",
          textAlign: "center",
          minWidth: 46,
        }}
      >
        {m}
      </span>
    );
  };

  const getStatusBadge = (lg: LogEntry) => {
    const status = lg.status;
    const isErr =
      lg.level === "ERROR" || (status !== undefined && status >= 500);
    const isWarn =
      lg.level === "WARN" ||
      (status !== undefined && status >= 400 && status < 500);

    let dotColor = "#10e57a";
    let textColor = isDark ? "#86efac" : "#15803d";
    let bgColor = isDark ? "rgba(16, 229, 122, 0.1)" : "rgba(22, 163, 74, 0.1)";
    let borderColor = isDark
      ? "rgba(16, 229, 122, 0.25)"
      : "rgba(22, 163, 74, 0.2)";

    if (isErr) {
      dotColor = "#ef4444";
      textColor = isDark ? "#fca5a5" : "#b91c1c";
      bgColor = isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(220, 38, 38, 0.1)";
      borderColor = isDark
        ? "rgba(239, 68, 68, 0.3)"
        : "rgba(220, 38, 38, 0.25)";
    } else if (isWarn) {
      dotColor = "#f59e0b";
      textColor = isDark ? "#fde68a" : "#b45309";
      bgColor = isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(217, 119, 6, 0.1)";
      borderColor = isDark
        ? "rgba(245, 158, 11, 0.3)"
        : "rgba(217, 119, 6, 0.25)";
    }

    const code = status
      ? String(status)
      : isErr
        ? "500"
        : isWarn
          ? "400"
          : "200";
    const label = lg.level || (isErr ? "ERROR" : isWarn ? "WARN" : "INFO");

    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          color: textColor,
          padding: "2px 8px",
          borderRadius: 12,
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
        <span>{status ? `${code}` : label}</span>
      </div>
    );
  };

  const getLatencyBadge = (durationMs?: number) => {
    if (durationMs === undefined || durationMs === null) return null;
    let color = isDark ? "#86efac" : "#16a34a";
    if (durationMs > 500) {
      color = isDark ? "#f87171" : "#dc2626";
    } else if (durationMs > 150) {
      color = isDark ? "#fbbf24" : "#d97706";
    }

    return (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          color: color,
        }}
      >
        {durationMs < 1 ? "<1ms" : `${durationMs}ms`}
      </span>
    );
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === logs.length || selectAllAcrossPages) {
      setSelectedRowIds([]);
      setSelectAllAcrossPages(false);
    } else {
      setSelectedRowIds(logs.map((l) => l.id));
      setSelectAllAcrossPages(false);
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRowIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      if (next.length !== logs.length) {
        setSelectAllAcrossPages(false);
      }
      return next;
    });
  };

  // Generate cURL command from log entry
  const generateCurlCommand = (lg: LogEntry) => {
    let host = window.location.origin;
    let path = lg.path || "/";
    let method = lg.method || "GET";
    let curl = `curl -X ${method} "${host}${path}"`;

    if (lg.metadata_json) {
      try {
        const meta = JSON.parse(lg.metadata_json);
        if (meta.body && Object.keys(meta.body).length > 0) {
          curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(meta.body)}'`;
        }
      } catch {
        // ignore
      }
    }
    return curl;
  };

  // Metrics summary calculations
  const errorRatePercent = useMemo(() => {
    if (!statsData || statsData.total === 0) return 0;
    return Number(((statsData.error / statsData.total) * 100).toFixed(1));
  }, [statsData]);

  const parsedMeta = useMemo(() => {
    if (!selectedLog?.metadata_json) return null;
    try {
      return JSON.parse(selectedLog.metadata_json);
    } catch {
      return null;
    }
  }, [selectedLog?.metadata_json]);

  const requestMeta = useMemo(() => {
    if (!parsedMeta) return null;
    const { response, ...reqData } = parsedMeta;
    return reqData;
  }, [parsedMeta]);

  const responseData = useMemo(() => {
    if (
      parsedMeta &&
      parsedMeta.response !== undefined &&
      parsedMeta.response !== null
    ) {
      return parsedMeta.response;
    }
    if (selectedLog?.error_message) {
      return {
        status: selectedLog.status || 500,
        error: selectedLog.error_message,
      };
    }
    if (selectedLog?.status) {
      return {
        status: selectedLog.status,
        message: selectedLog.status < 400 ? "OK" : "Error",
      };
    }
    return null;
  }, [parsedMeta, selectedLog]);

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "var(--color-bg-base)",
        padding: "16px 20px 24px 20px",
        gap: "16px",
      }}
    >
      {/* 1. TOP METRICS OBSERVABILITY OVERVIEW BAR */}
      <div>
        <Group grow align="stretch" gap="sm">
          {/* Stat 1: Total Activity */}
          <Paper
            p="sm"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text
                size="xs"
                fw={700}
                style={{
                  color: "var(--color-text-dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Total Activity
              </Text>
              <span className="pulsing-dot" style={{ width: 7, height: 7 }} />
            </Group>
            <Group align="baseline" gap="xs">
              <Title
                order={2}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  fontSize: "24px",
                }}
              >
                {statsData?.total !== undefined
                  ? statsData.total.toLocaleString()
                  : logTotal.toLocaleString()}
              </Title>
              <Text size="xs" c="dimmed">
                records
              </Text>
            </Group>
          </Paper>

          {/* Stat 2: Error Rate */}
          <Paper
            p="sm"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text
                size="xs"
                fw={700}
                style={{
                  color: "var(--color-text-dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Error Rate
              </Text>
              <IconAlertTriangle
                size={15}
                color={errorRatePercent > 0 ? "#ef4444" : "#10e57a"}
              />
            </Group>
            <Group align="baseline" gap="xs">
              <Title
                order={2}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  color:
                    errorRatePercent > 0
                      ? "#f87171"
                      : "var(--color-neon-primary)",
                  fontSize: "24px",
                }}
              >
                {errorRatePercent}%
              </Title>
              <Text size="xs" c="dimmed">
                ({statsData?.error || 0} errors)
              </Text>
            </Group>
          </Paper>

          {/* Stat 3: Avg Response Latency */}
          <Paper
            p="sm"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text
                size="xs"
                fw={700}
                style={{
                  color: "var(--color-text-dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Avg Latency
              </Text>
              <IconClock size={15} color="var(--color-neon-primary)" />
            </Group>
            <Group align="baseline" gap="xs">
              <Title
                order={2}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  fontSize: "24px",
                }}
              >
                {statsData?.avgDurationMs !== undefined
                  ? `${statsData.avgDurationMs}ms`
                  : "-"}
              </Title>
              <Badge
                size="xs"
                variant="filled"
                style={{
                  backgroundColor: "var(--color-neon-dim)",
                  color: "var(--color-neon-primary)",
                  fontWeight: 700,
                }}
              >
                {(statsData?.avgDurationMs || 0) < 50
                  ? "Fast"
                  : (statsData?.avgDurationMs || 0) < 200
                    ? "Normal"
                    : "High"}
              </Badge>
            </Group>
          </Paper>

          {/* Stat 4: Live Stream Status & Health */}
          <Paper
            p="sm"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text
                size="xs"
                fw={700}
                style={{
                  color: "var(--color-text-dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Stream Status
              </Text>
              <IconActivity
                size={15}
                color={
                  autoRefresh
                    ? wsConnected
                      ? "#10e57a"
                      : "#f59e0b"
                    : "var(--color-text-dimmed)"
                }
              />
            </Group>
            <Group justify="space-between" align="center">
              <Group gap={6}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: autoRefresh
                      ? wsConnected
                        ? "#10e57a"
                        : "#f59e0b"
                      : "var(--color-text-subtle)",
                    boxShadow:
                      autoRefresh && wsConnected
                        ? "0 0 8px #10e57a"
                        : autoRefresh
                          ? "0 0 8px #f59e0b"
                          : "none",
                  }}
                />
                <Text
                  size="sm"
                  fw={700}
                  style={{
                    color: autoRefresh
                      ? wsConnected
                        ? "var(--color-neon-primary)"
                        : "#f59e0b"
                      : "var(--color-text-secondary)",
                  }}
                >
                  {autoRefresh
                    ? wsConnected
                      ? "WebSocket Live"
                      : "Connecting WS..."
                    : "Stream Paused"}
                </Text>
              </Group>
              <Button
                variant={autoRefresh ? "light" : "subtle"}
                color={autoRefresh ? "neonGreen" : "gray"}
                size="compact-xs"
                leftSection={
                  autoRefresh ? (
                    <IconPlayerPause size={12} />
                  ) : (
                    <IconPlayerPlay size={12} />
                  )
                }
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{ fontWeight: 600 }}
              >
                {autoRefresh ? "Pause" : "Live"}
              </Button>
            </Group>
          </Paper>
        </Group>
      </div>

      {/* 2. OBSERVABILITY TIMELINE / HISTOGRAM CHART */}
      <div>
        <Paper
          p="md"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconTerminal2 size={16} color="var(--color-neon-primary)" />
              <Text
                size="xs"
                fw={700}
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-secondary)",
                }}
              >
                Activity & Telemetry Timeline
              </Text>
            </Group>
            <Group gap="md">
              <Group gap={6}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: "var(--color-neon-primary)",
                  }}
                />
                <Text size="xs" c="dimmed">
                  Successful (2xx/3xx)
                </Text>
              </Group>
              <Group gap={6}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: "#ef4444",
                  }}
                />
                <Text size="xs" c="dimmed">
                  Errors (5xx)
                </Text>
              </Group>
            </Group>
          </Group>

          <div style={{ position: "relative", height: 95, marginTop: 10 }}>
            {/* Y-Axis Labels */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--color-text-dimmed)",
                pointerEvents: "none",
                zIndex: 2,
                width: 36,
              }}
            >
              <span>{maxVolume.toLocaleString()}</span>
              <span>{(maxVolume / 2).toLocaleString()}</span>
              <span>0</span>
            </div>

            {/* Bars Container */}
            <div
              style={{
                marginLeft: 42,
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              {/* Horizontal Grid Guide Lines */}
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  top: 0,
                  borderBottom: "1px dashed var(--color-border)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  top: "50%",
                  borderBottom: "1px dashed var(--color-border)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  bottom: 0,
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              />

              {chartBuckets.map((bucket, index) => {
                const heightPercent =
                  bucket.count > 0
                    ? Math.min(
                        100,
                        Math.max(8, (bucket.count / maxVolume) * 100),
                      )
                    : 3;
                const isHovered = hoveredBarIndex === index;
                const hasErrors = bucket.errors > 0;

                return (
                  <div
                    key={index}
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    style={{
                      flex: 1,
                      height: `${heightPercent}%`,
                      backgroundColor: isHovered
                        ? "var(--color-neon-primary)"
                        : hasErrors
                          ? "rgba(239, 68, 68, 0.75)"
                          : isDark
                            ? "rgba(16, 229, 122, 0.35)"
                            : "rgba(5, 150, 105, 0.35)",
                      borderRadius: "3px 3px 0 0",
                      borderTop: isHovered
                        ? "2px solid #ffffff"
                        : hasErrors
                          ? "1px solid #ef4444"
                          : "1px solid var(--color-neon-primary)",
                      transition: "all 0.12s ease",
                      cursor: "pointer",
                      position: "relative",
                      minWidth: 4,
                      boxShadow: isHovered
                        ? "0 0 10px var(--color-neon-glow)"
                        : "none",
                    }}
                  >
                    {isHovered && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          marginBottom: 8,
                          backgroundColor: isDark ? "#18191c" : "#ffffff",
                          color: "var(--color-text-primary)",
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          whiteSpace: "nowrap",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                          border: "1px solid var(--color-border-subtle)",
                          zIndex: 20,
                          pointerEvents: "none",
                        }}
                      >
                        <div style={{ color: "var(--color-text-dimmed)" }}>
                          {bucket.dateStr}
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--color-neon-primary)",
                            marginTop: 2,
                          }}
                        >
                          {bucket.count.toLocaleString()} total requests{" "}
                          {bucket.errors > 0 ? `(${bucket.errors} errors)` : ""}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-Axis Timeline Labels */}
          <div
            style={{
              marginLeft: 42,
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--color-text-dimmed)",
            }}
          >
            {chartBuckets
              .filter((_, idx) => idx % 6 === 0)
              .map((b, idx) => (
                <span key={idx}>{b.label}</span>
              ))}
          </div>
        </Paper>
      </div>

      {/* 3. MAIN LOGS CONTAINER & CONTROLS */}
      <div>
        <Paper
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          {/* Controls Bar */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-surface)",
            }}
          >
            <Stack gap="sm">
              {/* Row 1: Filter Tabs & Actions */}
              <Group justify="space-between" wrap="wrap" gap="md">
                {/* Level Tabs */}
                <SegmentedControl
                  size="xs"
                  value={activeLevelTab}
                  onChange={(val) => {
                    setActiveLevelTab(val);
                    setLogPage(1);
                  }}
                  data={[
                    { label: "All Logs", value: "ALL" },
                    { label: "Errors (5xx)", value: "ERROR" },
                    { label: "Warnings (4xx)", value: "WARN" },
                    { label: "Info (2xx)", value: "INFO" },
                    { label: "Hooks & Crons", value: "HOOKS" },
                  ]}
                  styles={{
                    root: {
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                    },
                    indicator: {
                      backgroundColor: isDark ? "#282a30" : "#ffffff",
                      border: "1px solid var(--color-border-glow)",
                    },
                    label: {
                      fontWeight: 600,
                      fontSize: "12px",
                    },
                  }}
                />

                {/* Right Action Tools */}
                <Group gap="xs">
                  {selectedRowIds.length > 0 && (
                    <Group gap={6}>
                      <Badge
                        size="sm"
                        variant="filled"
                        style={{
                          backgroundColor: "var(--color-neon-dim)",
                          color: "var(--color-neon-primary)",
                          border: "1px solid var(--color-border-glow)",
                          fontWeight: 700,
                        }}
                      >
                        {selectAllAcrossPages
                          ? `${logTotal.toLocaleString()} of ${logTotal.toLocaleString()}`
                          : `${selectedRowIds.length} of ${logs.length}`}{" "}
                        selected
                      </Badge>
                      <Button
                        color="red"
                        variant="filled"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        onClick={handleDeleteSelected}
                        style={{ fontWeight: 700, height: 28 }}
                      >
                        Delete (
                        {selectAllAcrossPages
                          ? logTotal.toLocaleString()
                          : selectedRowIds.length}
                        )
                      </Button>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => {
                          setSelectedRowIds([]);
                          setSelectAllAcrossPages(false);
                        }}
                        style={{
                          color: "var(--color-text-dimmed)",
                          height: 28,
                        }}
                      >
                        Deselect
                      </Button>
                    </Group>
                  )}

                  <Tooltip label="Export to JSON" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={handleExportJSON}
                      style={{ color: "var(--color-text-dimmed)" }}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>

                  <Menu shadow="md" width={180}>
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        size="md"
                        style={{ color: "var(--color-text-dimmed)" }}
                      >
                        <IconSettings size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Log Maintenance</Menu.Label>
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={handleClearLogs}
                      >
                        Clear All Logs
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>

                  <Tooltip label="Refresh Logs" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      loading={loading}
                      onClick={() => {
                        loadLogs();
                        loadStatsAndTimeline();
                      }}
                      style={{ color: "var(--color-text-dimmed)" }}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              {/* Row 2: Search Input & Method Chips & Superuser Switch */}
              <Group justify="space-between" wrap="wrap" gap="md">
                {/* Method Chips */}
                <Group gap={4}>
                  <Text size="xs" fw={700} c="dimmed" mr={4}>
                    METHOD:
                  </Text>
                  {["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "CRON"].map(
                    (m) => (
                      <Button
                        key={m}
                        variant={selectedMethod === m ? "filled" : "subtle"}
                        size="compact-xs"
                        onClick={() => {
                          setSelectedMethod(m);
                          setLogPage(1);
                        }}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          fontWeight: 700,
                          backgroundColor:
                            selectedMethod === m
                              ? "var(--color-neon-dim)"
                              : "transparent",
                          color:
                            selectedMethod === m
                              ? "var(--color-neon-primary)"
                              : "var(--color-text-dimmed)",
                          border:
                            selectedMethod === m
                              ? "1px solid var(--color-border-glow)"
                              : "1px solid transparent",
                        }}
                      >
                        {m}
                      </Button>
                    ),
                  )}
                </Group>

                {/* Middle: Search Box */}
                <Group gap="xs" style={{ flex: 1, maxWidth: 420 }}>
                  <TextInput
                    placeholder="Search paths, messages, errors, metadata..."
                    leftSection={
                      <IconSearch size={14} color="var(--color-text-dimmed)" />
                    }
                    rightSection={
                      logSearch ? (
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => setLogSearch("")}
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      ) : null
                    }
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    size="xs"
                    style={{ width: "100%" }}
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                      },
                    }}
                  />
                </Group>

                {/* Right: Superuser toggle */}
                <Switch
                  label="Include superuser activity"
                  checked={includeSuperusers}
                  onChange={(event) => {
                    setIncludeSuperusers(event.currentTarget.checked);
                    setLogPage(1);
                  }}
                  size="xs"
                  color="neonGreen"
                  styles={{
                    label: {
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--color-text-dimmed)",
                      userSelect: "none",
                    },
                  }}
                />
              </Group>
            </Stack>
          </div>

          {/* Cross-page Selection Banner */}
          {selectedRowIds.length === logs.length &&
            logs.length > 0 &&
            logTotal > logs.length && (
              <div
                style={{
                  padding: "8px 18px",
                  backgroundColor: "var(--color-neon-dim)",
                  borderBottom: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: "13px",
                }}
              >
                {!selectAllAcrossPages ? (
                  <>
                    <Text
                      size="xs"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      All <b>{logs.length}</b> logs on this page are selected.
                    </Text>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      color="neonGreen"
                      onClick={() => setSelectAllAcrossPages(true)}
                      style={{ fontWeight: 700, textDecoration: "underline" }}
                    >
                      Select all {logTotal.toLocaleString()} logs across all
                      pages
                    </Button>
                  </>
                ) : (
                  <>
                    <Text
                      size="xs"
                      style={{
                        color: "var(--color-neon-primary)",
                        fontWeight: 600,
                      }}
                    >
                      All <b>{logTotal.toLocaleString()}</b> logs across all
                      pages are selected.
                    </Text>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      color="red"
                      onClick={() => {
                        setSelectedRowIds([]);
                        setSelectAllAcrossPages(false);
                      }}
                      style={{ fontWeight: 600 }}
                    >
                      Clear selection
                    </Button>
                  </>
                )}
              </div>
            )}

          {/* Table View */}
          <div style={{ overflowX: "auto" }}>
            <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover>
              <Table.Thead
                style={{
                  backgroundColor: "var(--color-table-thead)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <Table.Tr>
                  <Table.Th style={{ width: 38, paddingLeft: 18 }}>
                    <Checkbox
                      size="xs"
                      color="neonGreen"
                      checked={
                        logs.length > 0 && selectedRowIds.length === logs.length
                      }
                      indeterminate={
                        selectedRowIds.length > 0 &&
                        selectedRowIds.length < logs.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all logs"
                      styles={{
                        input: {
                          cursor: "pointer",
                          borderColor:
                            (logs.length > 0 &&
                              selectedRowIds.length === logs.length) ||
                            (selectedRowIds.length > 0 &&
                              selectedRowIds.length < logs.length)
                              ? "var(--color-neon-primary)"
                              : "var(--color-border-subtle)",
                        },
                      }}
                    />
                  </Table.Th>
                  <Table.Th style={{ width: 100 }}>Status</Table.Th>
                  <Table.Th style={{ width: 80 }}>Method</Table.Th>
                  <Table.Th>Request Path / Message</Table.Th>
                  <Table.Th style={{ width: 90 }}>Duration</Table.Th>
                  <Table.Th style={{ width: 200 }}>Created</Table.Th>
                  <Table.Th style={{ width: 36 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((lg) => {
                  const isSelected = selectedRowIds.includes(lg.id);
                  const timeStamps = formatTimestamps(lg.timestamp);
                  const isError =
                    lg.level === "ERROR" || (lg.status && lg.status >= 500);

                  return (
                    <Table.Tr
                      key={lg.id}
                      onClick={() => {
                        setSelectedLog(lg);
                        setDrawerOpen(true);
                      }}
                      style={{
                        cursor: "pointer",
                        backgroundColor: isSelected
                          ? "var(--color-neon-dim)"
                          : isError
                            ? isDark
                              ? "rgba(239, 68, 68, 0.05)"
                              : "rgba(254, 226, 226, 0.4)"
                            : "transparent",
                        borderBottom: "1px solid var(--color-table-border)",
                        transition: "background-color 0.1s ease",
                      }}
                    >
                      {/* Checkbox */}
                      <Table.Td style={{ width: 38, paddingLeft: 18 }}>
                        <Checkbox
                          size="xs"
                          color="neonGreen"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(lg.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select log ${lg.id}`}
                          styles={{
                            input: {
                              cursor: "pointer",
                              borderColor: isSelected
                                ? "var(--color-neon-primary)"
                                : "var(--color-border-subtle)",
                            },
                          }}
                        />
                      </Table.Td>

                      {/* Status */}
                      <Table.Td style={{ width: 100 }}>
                        {getStatusBadge(lg)}
                      </Table.Td>

                      {/* Method */}
                      <Table.Td style={{ width: 80 }}>
                        {getMethodBadge(lg.method)}
                      </Table.Td>

                      {/* Path / Message */}
                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap="xs" wrap="nowrap">
                            <Text
                              size="xs"
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: isError
                                  ? "#f87171"
                                  : "var(--color-text-primary)",
                                fontWeight: 600,
                                fontSize: "12.5px",
                                wordBreak: "break-all",
                              }}
                            >
                              {lg.path || "/"}
                            </Text>
                          </Group>
                          {lg.error_message && (
                            <Text
                              size="xs"
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: isError
                                  ? "var(--color-text-dimmed)"
                                  : "var(--color-text-secondary)",
                                fontSize: "11px",
                                wordBreak: "break-word",
                              }}
                            >
                              {lg.error_message}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>

                      {/* Duration Latency */}
                      <Table.Td style={{ width: 90 }}>
                        {getLatencyBadge(lg.duration_ms)}
                      </Table.Td>

                      {/* Created Timestamps */}
                      <Table.Td style={{ width: 200 }}>
                        <Stack gap={1}>
                          <Group gap={6}>
                            <Text
                              size="xs"
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-secondary)",
                                fontSize: "11.5px",
                                fontWeight: 600,
                              }}
                            >
                              {timeStamps.local}
                            </Text>
                          </Group>
                          <Text
                            size="xs"
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: "var(--color-text-dimmed)",
                              fontSize: "10.5px",
                            }}
                          >
                            {timeStamps.relative}
                          </Text>
                        </Stack>
                      </Table.Td>

                      {/* Action Chevron */}
                      <Table.Td
                        style={{
                          width: 36,
                          textAlign: "right",
                          paddingRight: 16,
                        }}
                      >
                        <IconChevronRight
                          size={15}
                          color="var(--color-text-subtle)"
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}

                {logs.length === 0 && (
                  <Table.Tr>
                    <Table.Td
                      colSpan={7}
                      style={{ textAlign: "center", padding: "56px 0" }}
                    >
                      <Stack align="center" gap="xs">
                        <IconActivity
                          size={40}
                          color="var(--color-text-subtle)"
                        />
                        <Text
                          fw={600}
                          size="sm"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          No activity logs found
                        </Text>
                        <Text c="dimmed" size="xs">
                          Try adjusting your search criteria, level filter, or
                          superuser visibility.
                        </Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </div>

          {/* Footer Status & Pagination Bar */}
          <div
            style={{
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: "11.5px",
              color: "var(--color-text-dimmed)",
            }}
          >
            <Group gap="sm">
              <span>
                Total:{" "}
                <b style={{ color: "var(--color-text-primary)" }}>
                  {logTotal.toLocaleString()}
                </b>
              </span>
              <Select
                size="xs"
                value={pageSize}
                onChange={(v) => {
                  setPageSize(v || "50");
                  setLogPage(1);
                }}
                data={[
                  { label: "25 / page", value: "25" },
                  { label: "50 / page", value: "50" },
                  { label: "100 / page", value: "100" },
                ]}
                style={{ width: 110 }}
                styles={{
                  input: {
                    height: 26,
                    fontSize: "11px",
                    backgroundColor: "var(--color-bg-well)",
                    borderColor: "var(--color-border)",
                  },
                }}
              />
            </Group>

            {totalPages > 1 && (
              <Pagination
                total={totalPages}
                value={logPage}
                onChange={setLogPage}
                size="xs"
                color="neonGreen"
              />
            )}

            <Group gap="xs">
              <span>AlsaBase Observability</span>
            </Group>
          </div>
        </Paper>
      </div>

      {/* 4. TELEMETRY INSPECTOR SLIDE-OVER DRAWER */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <Group gap="xs">
            <IconActivity size={18} color="var(--color-neon-primary)" />
            <Text
              fw={700}
              style={{ letterSpacing: "-0.02em", fontSize: "15px" }}
            >
              Telemetry & Event Inspector
            </Text>
          </Group>
        }
        position="right"
        size="lg"
        styles={{
          content: {
            backgroundColor: "var(--color-bg-card)",
            borderLeft: "1px solid var(--color-border)",
          },
          header: {
            backgroundColor: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
          },
        }}
      >
        {selectedLog && (
          <Stack gap="md" pt="sm">
            {/* Header Identity Box */}
            <Paper
              p="sm"
              style={{
                backgroundColor: "var(--color-bg-well)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            >
              <Group justify="space-between" align="center" mb={6}>
                <Group gap="xs">
                  {getStatusBadge(selectedLog)}
                  {getMethodBadge(selectedLog.method)}
                </Group>
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </Text>
              </Group>

              <Text
                size="xs"
                fw={700}
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-primary)",
                  wordBreak: "break-all",
                  fontSize: "13px",
                }}
              >
                {selectedLog.path || "/"}
              </Text>
            </Paper>

            {/* Error Message if present */}
            {selectedLog.error_message && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                color="red"
                title="Error / Message"
                radius="md"
              >
                <Text
                  size="xs"
                  style={{
                    fontFamily: "var(--font-mono)",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedLog.error_message}
                </Text>
              </Alert>
            )}

            {/* Inspector Navigation Tabs */}
            <Tabs value={activeDrawerTab} onChange={setActiveDrawerTab}>
              <Tabs.List>
                <Tabs.Tab
                  value="overview"
                  leftSection={<IconInfoCircle size={14} />}
                >
                  Overview
                </Tabs.Tab>
                <Tabs.Tab
                  value="response"
                  leftSection={
                    <IconArrowDownLeft
                      size={14}
                      color={
                        (selectedLog.status || 200) >= 400
                          ? "#f87171"
                          : "var(--color-neon-primary)"
                      }
                    />
                  }
                >
                  Response
                </Tabs.Tab>
                <Tabs.Tab value="metadata" leftSection={<IconCode size={14} />}>
                  Request & Context
                </Tabs.Tab>
                {selectedLog.stack_trace && (
                  <Tabs.Tab
                    value="stack"
                    leftSection={
                      <IconAlertTriangle size={14} color="#ef4444" />
                    }
                  >
                    Stack Trace
                  </Tabs.Tab>
                )}
                <Tabs.Tab
                  value="curl"
                  leftSection={<IconTerminal2 size={14} />}
                >
                  cURL Snippet
                </Tabs.Tab>
              </Tabs.List>

              {/* Tab 1: Overview Specs */}
              <Tabs.Panel value="overview" pt="sm">
                <Stack gap="sm">
                  <Table verticalSpacing="xs" horizontalSpacing="sm">
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td
                          style={{
                            width: 140,
                            color: "var(--color-text-dimmed)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Event ID
                        </Table.Td>
                        <Table.Td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11.5px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          <Group justify="space-between">
                            <span>{selectedLog.id}</span>
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              onClick={() => handleCopy(selectedLog.id, "id")}
                            >
                              {copiedKey === "id" ? (
                                <IconCheck size={12} color="#10e57a" />
                              ) : (
                                <IconCopy size={12} />
                              )}
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </Table.Td>
                        <Table.Td>{getStatusBadge(selectedLog)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Duration
                        </Table.Td>
                        <Table.Td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11.5px",
                          }}
                        >
                          {getLatencyBadge(selectedLog.duration_ms) || "0ms"}
                        </Table.Td>
                      </Table.Tr>
                      {parsedMeta?.ip && (
                        <Table.Tr>
                          <Table.Td
                            style={{
                              color: "var(--color-text-dimmed)",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Client IP
                          </Table.Td>
                          <Table.Td
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11.5px",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {parsedMeta.ip}
                          </Table.Td>
                        </Table.Tr>
                      )}
                      <Table.Tr>
                        <Table.Td
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Local Time
                        </Table.Td>
                        <Table.Td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11.5px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {formatTimestamps(selectedLog.timestamp).local}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          UTC Timestamp
                        </Table.Td>
                        <Table.Td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11.5px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {formatTimestamps(selectedLog.timestamp).utc}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>

                  {/* Quick Response Preview Box in Overview */}
                  {responseData && (
                    <Paper
                      p="xs"
                      style={{
                        backgroundColor: "var(--color-bg-well)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    >
                      <Group justify="space-between" mb={4}>
                        <Text
                          size="xs"
                          fw={700}
                          c="dimmed"
                          style={{
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Response Payload Preview:
                        </Text>
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          color="neonGreen"
                          onClick={() => setActiveDrawerTab("response")}
                        >
                          View Full Response
                        </Button>
                      </Group>
                      <Box
                        style={{
                          maxHeight: 120,
                          overflowY: "auto",
                        }}
                      >
                        <Code
                          block
                          style={{
                            background: "transparent",
                            color:
                              (selectedLog.status || 200) >= 400
                                ? "#f87171"
                                : "var(--color-text-secondary)",
                            fontSize: "11px",
                          }}
                        >
                          {typeof responseData === "object"
                            ? JSON.stringify(responseData, null, 2)
                            : String(responseData)}
                        </Code>
                      </Box>
                    </Paper>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Tab 2: Response Body */}
              <Tabs.Panel value="response" pt="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Text
                        size="xs"
                        fw={700}
                        c="dimmed"
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        HTTP Response Data:
                      </Text>
                      {getStatusBadge(selectedLog)}
                    </Group>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      leftSection={
                        copiedKey === "resp" ? (
                          <IconCheck size={12} />
                        ) : (
                          <IconCopy size={12} />
                        )
                      }
                      onClick={() =>
                        handleCopy(
                          typeof responseData === "object"
                            ? JSON.stringify(responseData, null, 2)
                            : String(responseData || ""),
                          "resp",
                        )
                      }
                    >
                      Copy Response
                    </Button>
                  </Group>
                  <Box
                    p="sm"
                    style={{
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      maxHeight: 400,
                      overflowY: "auto",
                    }}
                  >
                    {responseData !== null ? (
                      <Code
                        block
                        style={{
                          background: "transparent",
                          color:
                            (selectedLog.status || 200) >= 400
                              ? "#f87171"
                              : "var(--color-text-primary)",
                          fontSize: "12px",
                        }}
                      >
                        {typeof responseData === "object"
                          ? JSON.stringify(responseData, null, 2)
                          : String(responseData)}
                      </Code>
                    ) : (
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{ fontStyle: "italic" }}
                      >
                        No response payload captured for this request. Status
                        code: {selectedLog.status || 200}
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Tabs.Panel>

              {/* Tab 3: Request & Metadata JSON */}
              <Tabs.Panel value="metadata" pt="sm">
                <Stack gap="md">
                  {/* Response Section inside Metadata tab */}
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <Text
                          size="xs"
                          fw={700}
                          c="dimmed"
                          style={{
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Response Payload:
                        </Text>
                        {getStatusBadge(selectedLog)}
                      </Group>
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        leftSection={
                          copiedKey === "meta-resp" ? (
                            <IconCheck size={12} />
                          ) : (
                            <IconCopy size={12} />
                          )
                        }
                        onClick={() =>
                          handleCopy(
                            typeof responseData === "object"
                              ? JSON.stringify(responseData, null, 2)
                              : String(responseData || ""),
                            "meta-resp",
                          )
                        }
                      >
                        Copy Response
                      </Button>
                    </Group>
                    <Box
                      p="sm"
                      style={{
                        backgroundColor: "var(--color-bg-well)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        maxHeight: 220,
                        overflowY: "auto",
                      }}
                    >
                      <Code
                        block
                        style={{
                          background: "transparent",
                          color:
                            (selectedLog.status || 200) >= 400
                              ? "#f87171"
                              : "var(--color-text-primary)",
                          fontSize: "12px",
                        }}
                      >
                        {responseData !== null
                          ? typeof responseData === "object"
                            ? JSON.stringify(responseData, null, 2)
                            : String(responseData)
                          : JSON.stringify(
                              {
                                status: selectedLog.status || 200,
                                message: "No response body recorded",
                              },
                              null,
                              2,
                            )}
                      </Code>
                    </Box>
                  </div>

                  {/* Request Section inside Metadata tab */}
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text
                        size="xs"
                        fw={700}
                        c="dimmed"
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Request Payload & Context:
                      </Text>
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        leftSection={
                          copiedKey === "meta-req" ? (
                            <IconCheck size={12} />
                          ) : (
                            <IconCopy size={12} />
                          )
                        }
                        onClick={() =>
                          handleCopy(
                            JSON.stringify(requestMeta || {}, null, 2),
                            "meta-req",
                          )
                        }
                      >
                        Copy Request
                      </Button>
                    </Group>
                    <Box
                      p="sm"
                      style={{
                        backgroundColor: "var(--color-bg-well)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        maxHeight: 220,
                        overflowY: "auto",
                      }}
                    >
                      <Code
                        block
                        style={{
                          background: "transparent",
                          color: "var(--color-text-secondary)",
                          fontSize: "12px",
                        }}
                      >
                        {JSON.stringify(requestMeta || {}, null, 2)}
                      </Code>
                    </Box>
                  </div>

                  {/* Complete Raw Metadata JSON */}
                  {selectedLog.metadata_json && (
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text
                          size="xs"
                          fw={700}
                          c="dimmed"
                          style={{
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Complete Raw JSON:
                        </Text>
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          leftSection={
                            copiedKey === "meta-raw" ? (
                              <IconCheck size={12} />
                            ) : (
                              <IconCopy size={12} />
                            )
                          }
                          onClick={() =>
                            handleCopy(
                              selectedLog.metadata_json || "{}",
                              "meta-raw",
                            )
                          }
                        >
                          Copy Raw
                        </Button>
                      </Group>
                      <Box
                        p="sm"
                        style={{
                          backgroundColor: "var(--color-bg-well)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          maxHeight: 180,
                          overflowY: "auto",
                        }}
                      >
                        <Code
                          block
                          style={{
                            background: "transparent",
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {(() => {
                            try {
                              return JSON.stringify(
                                JSON.parse(selectedLog.metadata_json),
                                null,
                                2,
                              );
                            } catch {
                              return selectedLog.metadata_json;
                            }
                          })()}
                        </Code>
                      </Box>
                    </div>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Tab 4: Stack Trace */}
              {selectedLog.stack_trace && (
                <Tabs.Panel value="stack" pt="sm">
                  <Group justify="space-between" mb={4}>
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Exception Stack Trace:
                    </Text>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      leftSection={
                        copiedKey === "stack" ? (
                          <IconCheck size={12} />
                        ) : (
                          <IconCopy size={12} />
                        )
                      }
                      onClick={() =>
                        handleCopy(selectedLog.stack_trace || "", "stack")
                      }
                    >
                      Copy Stack
                    </Button>
                  </Group>
                  <Box
                    p="sm"
                    style={{
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    <Code
                      block
                      style={{
                        color: "#f87171",
                        background: "transparent",
                        fontSize: "11.5px",
                      }}
                    >
                      {selectedLog.stack_trace}
                    </Code>
                  </Box>
                </Tabs.Panel>
              )}

              {/* Tab 5: cURL Generator */}
              <Tabs.Panel value="curl" pt="sm">
                <Group justify="space-between" mb={4}>
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Reproduce Request via cURL:
                  </Text>
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    leftSection={
                      copiedKey === "curl" ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconCopy size={12} />
                      )
                    }
                    onClick={() =>
                      handleCopy(generateCurlCommand(selectedLog), "curl")
                    }
                  >
                    Copy cURL
                  </Button>
                </Group>
                <Box
                  p="sm"
                  style={{
                    backgroundColor: "var(--color-bg-well)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Code
                    block
                    style={{
                      background: "transparent",
                      color: "var(--color-neon-primary)",
                      fontSize: "12px",
                    }}
                  >
                    {generateCurlCommand(selectedLog)}
                  </Code>
                </Box>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}
      </Drawer>
    </div>
  );
};
