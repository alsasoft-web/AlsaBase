import React, { useState, useEffect } from "react";
import {
  Text,
  Badge,
  Button,
  Group,
  Stack,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Box,
  Tooltip,
  Paper,
  SimpleGrid,
  Table,
  Code,
  ScrollArea,
  Checkbox,
  Pagination,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconCloudUpload,
  IconDownload,
  IconTrash,
  IconRefresh,
  IconTerminal2,
  IconCopy,
  IconEye,
  IconFileText,
} from "@tabler/icons-react";
import {
  api,
  AppItem,
  AppDeviceItem,
  AppLogItem,
  AppLogStats,
} from "../../../api/client";
import { openHoldToConfirmModal } from "../../HoldToConfirmModal";

interface AppLogsPanelProps {
  selectedApp: AppItem;
  isMobile: boolean;
  devices?: AppDeviceItem[];
  isUploadModalOpen?: boolean;
  onCloseUploadModal?: () => void;
  onOpenUploadModal?: () => void;
}

export const AppLogsPanel: React.FC<AppLogsPanelProps> = ({
  selectedApp,
  isMobile,
  devices = [],
  isUploadModalOpen: externalUploadOpen,
  onCloseUploadModal,
  onOpenUploadModal,
}) => {
  // Data states
  const [appLogs, setAppLogs] = useState<AppLogItem[]>([]);
  const [appLogStats, setAppLogStats] = useState<AppLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter states
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [deviceFilter, setDeviceFilter] = useState("ALL");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AppLogItem | null>(null);

  // Export / Download Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  // Upload Modal State (support both internal & external trigger)
  const [internalUploadOpen, setInternalUploadOpen] = useState(false);
  const isUploadModalOpen = externalUploadOpen ?? internalUploadOpen;
  const setUploadModalOpen = (open: boolean) => {
    if (open) {
      if (onOpenUploadModal) onOpenUploadModal();
      else setInternalUploadOpen(true);
    } else {
      if (onCloseUploadModal) onCloseUploadModal();
      setInternalUploadOpen(false);
    }
  };

  const [uploadMode, setUploadMode] = useState<"file" | "manual">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFileContent, setUploadFileContent] = useState("");
  const [uploadPreviewCount, setUploadPreviewCount] = useState<number | null>(null);
  const [uploadDefaultLevel, setUploadDefaultLevel] = useState("INFO");
  const [uploadDefaultDeviceId, setUploadDefaultDeviceId] = useState("");
  const [uploadDefaultVersion, setUploadDefaultVersion] = useState("");

  // Manual entry form
  const [manualLevel, setManualLevel] = useState("INFO");
  const [manualMessage, setManualMessage] = useState("");
  const [manualStackTrace, setManualStackTrace] = useState("");
  const [manualDeviceId, setManualDeviceId] = useState("");
  const [manualDeviceName, setManualDeviceName] = useState("");
  const [manualVersion, setManualVersion] = useState("");
  const [manualMetadata, setManualMetadata] = useState("");

  const loadLogs = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const res = await api.getAppLogs(selectedApp.id, {
        page,
        limit: 50,
        level: levelFilter !== "ALL" ? levelFilter : undefined,
        search: search.trim() || undefined,
        deviceId: deviceFilter !== "ALL" ? deviceFilter : undefined,
      });
      setAppLogs(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      notifications.show({
        title: "Error loading logs",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedApp) return;
    try {
      const stats = await api.getAppLogStats(selectedApp.id);
      setAppLogStats(stats);
    } catch {
      // Ignore stats error
    }
  };

  useEffect(() => {
    setPage(1);
    setSelectedLogIds([]);
    loadLogs();
    loadStats();
  }, [selectedApp.id]);

  useEffect(() => {
    loadLogs();
  }, [page, levelFilter, search, deviceFilter]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setUploadFileName("");
      setUploadFileContent("");
      setUploadPreviewCount(null);
      return;
    }
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setUploadFileContent(text);
      if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(text);
          setUploadPreviewCount(Array.isArray(parsed) ? parsed.length : 1);
        } catch {
          setUploadPreviewCount(text.split(/\r?\n/).filter(Boolean).length);
        }
      } else {
        setUploadPreviewCount(text.split(/\r?\n/).filter(Boolean).length);
      }
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async () => {
    if (uploadMode === "file") {
      if (!uploadFileContent.trim()) {
        notifications.show({
          title: "File empty",
          message: "Please choose or drop a valid log file (.log, .txt, .json).",
          color: "red",
        });
        return;
      }

      setUploading(true);
      try {
        const res = await api.uploadAppLogs({
          appId: selectedApp.id,
          rawContent: uploadFileContent,
          fileName: uploadFileName || "uploaded.log",
          deviceId: uploadDefaultDeviceId.trim() || undefined,
          appVersion: uploadDefaultVersion.trim() || undefined,
          level: uploadDefaultLevel,
        });

        notifications.show({
          title: "Logs uploaded successfully",
          message: res.message || `Uploaded ${res.count} log records.`,
          color: "teal",
        });

        setUploadModalOpen(false);
        setUploadFileContent("");
        setUploadFileName("");
        setUploadPreviewCount(null);
        loadLogs();
        loadStats();
      } catch (err: any) {
        notifications.show({
          title: "Upload failed",
          message: err.message,
          color: "red",
        });
      } finally {
        setUploading(false);
      }
    } else {
      if (!manualMessage.trim()) {
        notifications.show({
          title: "Message required",
          message: "Please enter a log message.",
          color: "red",
        });
        return;
      }

      let parsedMeta: any = undefined;
      if (manualMetadata.trim()) {
        try {
          parsedMeta = JSON.parse(manualMetadata);
        } catch {
          notifications.show({
            title: "Invalid JSON metadata",
            message: "Metadata must be valid JSON or empty.",
            color: "red",
          });
          return;
        }
      }

      setUploading(true);
      try {
        const res = await api.uploadAppLogs({
          appId: selectedApp.id,
          log: {
            level: manualLevel,
            message: manualMessage.trim(),
            stackTrace: manualStackTrace.trim() || undefined,
            deviceId: manualDeviceId.trim() || undefined,
            deviceName: manualDeviceName.trim() || undefined,
            appVersion: manualVersion.trim() || undefined,
            metadata: parsedMeta,
          },
        });

        notifications.show({
          title: "Log entry created",
          message: res.message || "Log recorded successfully.",
          color: "teal",
        });

        setUploadModalOpen(false);
        setManualMessage("");
        setManualStackTrace("");
        setManualMetadata("");
        loadLogs();
        loadStats();
      } catch (err: any) {
        notifications.show({
          title: "Failed to record log",
          message: err.message,
          color: "red",
        });
      } finally {
        setUploading(false);
      }
    }
  };

  const downloadJSONFile = (items: AppLogItem[], filename: string) => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCurrentPage = () => {
    if (!appLogs.length) {
      notifications.show({
        title: "No Logs to Export",
        message: "The current page has no logs to download.",
        color: "yellow",
      });
      return;
    }
    downloadJSONFile(
      appLogs,
      `${selectedApp.slug}_logs_page_${page}_${Date.now()}.json`
    );
    setExportModalOpen(false);
    notifications.show({
      title: "Logs Exported",
      message: `Exported ${appLogs.length} logs (Current Page ${page}) to JSON file.`,
      color: "teal",
    });
  };

  const handleExportAll = async () => {
    if (!selectedApp) return;
    setExportingAll(true);
    try {
      const res = await api.getAppLogs(selectedApp.id, {
        page: 1,
        limit: 50000,
        all: true,
        level: levelFilter !== "ALL" ? levelFilter : undefined,
        search: search.trim() || undefined,
        deviceId: deviceFilter !== "ALL" ? deviceFilter : undefined,
      });
      const items = res.items || [];
      if (!items.length) {
        notifications.show({
          title: "No Logs to Export",
          message: "No logs found matching the selected criteria.",
          color: "yellow",
        });
        setExportModalOpen(false);
        return;
      }
      downloadJSONFile(
        items,
        `${selectedApp.slug}_logs_all_${Date.now()}.json`
      );
      setExportModalOpen(false);
      notifications.show({
        title: "All Logs Exported",
        message: `Successfully exported all ${items.length} logs to JSON file.`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Export Failed",
        message: err.message || "Could not fetch all logs.",
        color: "red",
      });
    } finally {
      setExportingAll(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogIds.length === 0) return;
    try {
      await api.deleteAppLogsBatch({
        ids: selectedLogIds,
        appId: selectedApp.id,
      });
      notifications.show({
        title: "Logs deleted",
        message: `Deleted ${selectedLogIds.length} log records.`,
        color: "teal",
      });
      setSelectedLogIds([]);
      loadLogs();
      loadStats();
    } catch (err: any) {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleDeleteSingle = async (logItem: AppLogItem) => {
    try {
      await api.deleteAppLog(logItem.id);
      notifications.show({
        title: "Log deleted",
        message: "Log entry removed",
        color: "teal",
      });
      setAppLogs((prev) => prev.filter((l) => l.id !== logItem.id));
      loadStats();
    } catch (err: any) {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleClearAll = () => {
    openHoldToConfirmModal({
      title: "Clear All App Logs",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to clear all logs for <b>{selectedApp.name}</b>?
          This action cannot be undone.
        </Text>
      ),
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.clearAppLogs(selectedApp.id);
          notifications.show({
            title: "Logs cleared",
            message: "All logs for this application have been cleared.",
            color: "teal",
          });
          loadLogs();
          loadStats();
        } catch (err: any) {
          notifications.show({
            title: "Clear error",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  return (
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: isMobile ? 8 : 16,
        gap: 12,
      }}
    >
      {/* Metrics bar */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        <Paper
          p="xs"
          radius="md"
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Text size="11px" c="dimmed" fw={600} tt="uppercase">
            Total Logs
          </Text>
          <Text size="lg" fw={700} style={{ color: "var(--color-text-primary)" }}>
            {appLogStats?.total ?? total}
          </Text>
        </Paper>

        <Paper
          p="xs"
          radius="md"
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Text size="11px" c="dimmed" fw={600} tt="uppercase">
            Fatal & Errors
          </Text>
          <Group gap={6} align="center">
            <Text
              size="lg"
              fw={700}
              style={{
                color:
                  (appLogStats?.error || 0) + (appLogStats?.fatal || 0) > 0
                    ? "#ef4444"
                    : "var(--color-text-primary)",
              }}
            >
              {(appLogStats?.error || 0) + (appLogStats?.fatal || 0)}
            </Text>
            {(appLogStats?.error || 0) + (appLogStats?.fatal || 0) > 0 && (
              <Badge size="xs" color="red" variant="filled">
                Issues
              </Badge>
            )}
          </Group>
        </Paper>

        <Paper
          p="xs"
          radius="md"
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Text size="11px" c="dimmed" fw={600} tt="uppercase">
            Warnings
          </Text>
          <Text
            size="lg"
            fw={700}
            style={{
              color: (appLogStats?.warn || 0) > 0 ? "#f59e0b" : "var(--color-text-primary)",
            }}
          >
            {appLogStats?.warn ?? 0}
          </Text>
        </Paper>

        <Paper
          p="xs"
          radius="md"
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Text size="11px" c="dimmed" fw={600} tt="uppercase">
            Reporting Devices
          </Text>
          <Text size="lg" fw={700} style={{ color: "var(--color-text-primary)" }}>
            {appLogStats?.uniqueDevices ?? 0}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Filter and actions bar */}
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Group gap="xs" wrap="wrap" style={{ flex: 1, minWidth: isMobile ? "100%" : 320 }}>
          <TextInput
            placeholder="Search messages, stack traces, HWID..."
            leftSection={<IconSearch size={15} />}
            size="xs"
            style={{ flex: 1, minWidth: 180 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select
            size="xs"
            style={{ width: 120 }}
            value={levelFilter}
            onChange={(val) => setLevelFilter(val || "ALL")}
            data={[
              { value: "ALL", label: "All Levels" },
              { value: "FATAL", label: "FATAL" },
              { value: "ERROR", label: "ERROR" },
              { value: "WARN", label: "WARN" },
              { value: "INFO", label: "INFO" },
              { value: "DEBUG", label: "DEBUG" },
            ]}
          />

          {devices.length > 0 && (
            <Select
              size="xs"
              style={{ width: 150 }}
              value={deviceFilter}
              onChange={(val) => setDeviceFilter(val || "ALL")}
              data={[
                { value: "ALL", label: "All Devices" },
                ...devices.map((d) => ({
                  value: d.deviceId,
                  label: d.deviceName
                    ? `${d.deviceName} (${d.deviceId.slice(0, 6)})`
                    : d.deviceId.slice(0, 14),
                })),
              ]}
            />
          )}
        </Group>

        <Group gap="xs">
          {selectedLogIds.length > 0 && (
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              onClick={handleDeleteSelected}
            >
              Delete ({selectedLogIds.length})
            </Button>
          )}

          <Button
            size="xs"
            variant="filled"
            leftSection={
              <IconCloudUpload
                size={14}
                color="var(--color-btn-primary-text, var(--color-neon-text))"
              />
            }
            onClick={() => setUploadModalOpen(true)}
            style={{
              backgroundColor:
                "var(--color-btn-primary-bg, var(--color-neon-primary))",
              color: "var(--color-btn-primary-text, var(--color-neon-text))",
              fontWeight: 600,
            }}
            styles={{
              label: {
                color: "var(--color-btn-primary-text, var(--color-neon-text))",
              },
              section: {
                color: "var(--color-btn-primary-text, var(--color-neon-text))",
              },
            }}
          >
            Upload Logs
          </Button>

          <Tooltip label="Download Logs" withArrow>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => setExportModalOpen(true)}
              disabled={total === 0 && appLogs.length === 0}
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Clear All App Logs" withArrow>
            <ActionIcon
              variant="default"
              color="red"
              size="sm"
              onClick={handleClearAll}
              disabled={total === 0}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Refresh Logs" withArrow>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => {
                loadLogs();
                loadStats();
              }}
              loading={loading}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Table of logs */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--mantine-radius-md)",
          backgroundColor: "var(--color-bg-card)",
        }}
      >
        <ScrollArea style={{ flex: 1 }}>
          {loading ? (
            <Box p="xl" style={{ textAlign: "center" }}>
              <Text size="sm" c="dimmed">
                Loading logs...
              </Text>
            </Box>
          ) : appLogs.length === 0 ? (
            <Box p="xl" style={{ textAlign: "center" }}>
              <IconTerminal2
                size={40}
                color="var(--color-text-dimmed)"
                style={{ margin: "0 auto 12px" }}
              />
              <Text size="sm" fw={600} style={{ color: "var(--color-text-primary)" }}>
                No logs found for {selectedApp.name}
              </Text>
              <Text size="xs" c="dimmed" mt={4} mb="md">
                Upload logs from a customer machine (.log, .txt, .json), report crash events via the AlsaBase SDK, or submit a test entry.
              </Text>
              <Button
                size="xs"
                variant="filled"
                leftSection={<IconCloudUpload size={14} />}
                onClick={() => setUploadModalOpen(true)}
                style={{
                  backgroundColor:
                    "var(--color-btn-primary-bg, var(--color-neon-primary))",
                  color: "var(--color-btn-primary-text, var(--color-neon-text))",
                }}
              >
                Upload Logs Now
              </Button>
            </Box>
          ) : (
            <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="sm">
              <Table.Thead style={{ backgroundColor: "var(--color-bg-surface)" }}>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>
                    <Checkbox
                      size="xs"
                      checked={
                        selectedLogIds.length === appLogs.length && appLogs.length > 0
                      }
                      indeterminate={
                        selectedLogIds.length > 0 &&
                        selectedLogIds.length < appLogs.length
                      }
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setSelectedLogIds(appLogs.map((l) => l.id));
                        } else {
                          setSelectedLogIds([]);
                        }
                      }}
                    />
                  </Table.Th>
                  <Table.Th style={{ width: 90 }}>Level</Table.Th>
                  <Table.Th style={{ width: 140 }}>Timestamp</Table.Th>
                  <Table.Th>Message / Error</Table.Th>
                  <Table.Th style={{ width: 90 }}>Version</Table.Th>
                  <Table.Th style={{ width: 140 }}>Device / HWID</Table.Th>
                  <Table.Th style={{ width: 90, textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {appLogs.map((log) => {
                  const isFatal = log.level === "FATAL";
                  const isError = log.level === "ERROR" || isFatal;
                  const isWarn = log.level === "WARN";
                  const isInfo = log.level === "INFO";
                  const badgeColor = isFatal
                    ? "red"
                    : isError
                    ? "red"
                    : isWarn
                    ? "orange"
                    : isInfo
                    ? "blue"
                    : "gray";

                  return (
                    <Table.Tr
                      key={log.id}
                      style={{
                        cursor: "pointer",
                        backgroundColor: selectedLogIds.includes(log.id)
                          ? "var(--color-neon-dim)"
                          : undefined,
                      }}
                      onClick={() => setSelectedLogForDetails(log)}
                    >
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          size="xs"
                          checked={selectedLogIds.includes(log.id)}
                          onChange={(e) => {
                            if (e.currentTarget.checked) {
                              setSelectedLogIds((prev) => [...prev, log.id]);
                            } else {
                              setSelectedLogIds((prev) =>
                                prev.filter((id) => id !== log.id)
                              );
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant={isFatal ? "filled" : "light"}
                          color={badgeColor}
                          style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
                        >
                          {log.level}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" style={{ fontFamily: "var(--font-mono)" }}>
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="xs"
                          fw={isError ? 600 : 400}
                          lineClamp={2}
                          style={{
                            color: isError ? "#ef4444" : "var(--color-text-primary)",
                          }}
                        >
                          {log.message}
                        </Text>
                        {log.stackTrace && (
                          <Text
                            size="10px"
                            c="dimmed"
                            style={{ fontFamily: "var(--font-mono)" }}
                            lineClamp={1}
                          >
                            {log.stackTrace.split("\n")[0]}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {log.appVersion ? (
                          <Badge size="xs" variant="outline" color="teal">
                            v{log.appVersion}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        {log.deviceId ? (
                          <Group gap={4} wrap="nowrap">
                            <Code style={{ fontSize: 11 }}>
                              {log.deviceId.length > 12
                                ? `${log.deviceId.slice(0, 10)}...`
                                : log.deviceId}
                            </Code>
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              onClick={() => {
                                navigator.clipboard.writeText(log.deviceId || "");
                                notifications.show({
                                  title: "Copied HWID",
                                  message: log.deviceId,
                                  color: "teal",
                                });
                              }}
                            >
                              <IconCopy size={11} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td
                        style={{ textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="View Details" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => setSelectedLogForDetails(log)}
                            >
                              <IconEye size={15} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleDeleteSingle(log)}
                            >
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <Box
            p="xs"
            style={{
              borderTop: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-surface)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text size="xs" c="dimmed">
              Showing {(page - 1) * 50 + 1} - {Math.min(page * 50, total)} of {total} logs
            </Text>
            <Pagination
              size="xs"
              value={page}
              onChange={setPage}
              total={totalPages}
            />
          </Box>
        )}
      </Box>

      {/* ==================================================================== */}
      {/* MODAL: Upload Logs & Crash Reports */}
      {/* ==================================================================== */}
      <Modal
        opened={isUploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title={
          <Group gap="xs">
            <IconCloudUpload size={20} color="var(--color-neon-primary, #10e57a)" />
            <Text fw={700}>Upload Logs - {selectedApp.name}</Text>
          </Group>
        }
        radius="md"
        size={isMobile ? "100%" : "lg"}
        fullScreen={isMobile}
      >
        <Stack gap="md">
          <SegmentedControl
            value={uploadMode}
            onChange={(val) => setUploadMode(val as "file" | "manual")}
            data={[
              { label: "File Upload (.log, .txt, .json)", value: "file" },
              { label: "Manual Log Entry / Direct Test", value: "manual" },
            ]}
          />

          {uploadMode === "file" ? (
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                Upload log files from client installations, server crashes, or telemetry dumps. Supports standard timestamped logs with multi-line stack traces, JSON lines, or JSON arrays.
              </Text>

              <Box
                p="lg"
                style={{
                  border: "2px dashed var(--color-border)",
                  borderRadius: "var(--mantine-radius-md)",
                  textAlign: "center",
                  backgroundColor: "var(--color-bg-card)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  const input = document.getElementById(
                    "app-log-file-input"
                  ) as HTMLInputElement;
                  if (input) input.click();
                }}
              >
                <input
                  id="app-log-file-input"
                  type="file"
                  accept=".log,.txt,.json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleFileChange(file);
                  }}
                />
                <IconFileText
                  size={36}
                  color="var(--color-neon-primary, #10e57a)"
                  style={{ margin: "0 auto 8px" }}
                />
                {uploadFileName ? (
                  <Box>
                    <Text
                      size="sm"
                      fw={600}
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {uploadFileName}
                    </Text>
                    {uploadPreviewCount !== null && (
                      <Badge size="sm" color="teal" variant="light" mt={4}>
                        ~{uploadPreviewCount} log entries detected
                      </Badge>
                    )}
                    <Text size="11px" c="dimmed" mt={4}>
                      Click to choose a different file
                    </Text>
                  </Box>
                ) : (
                  <Box>
                    <Text
                      size="sm"
                      fw={600}
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Click or drag and drop a log file here
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      Supports .log, .txt, .json files
                    </Text>
                  </Box>
                )}
              </Box>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                <Select
                  label="Default Level"
                  size="xs"
                  value={uploadDefaultLevel}
                  onChange={(val) => setUploadDefaultLevel(val || "INFO")}
                  data={[
                    { value: "INFO", label: "INFO" },
                    { value: "WARN", label: "WARN" },
                    { value: "ERROR", label: "ERROR" },
                    { value: "FATAL", label: "FATAL" },
                    { value: "DEBUG", label: "DEBUG" },
                  ]}
                />

                <TextInput
                  label="App Version (Optional)"
                  placeholder="e.g. 1.2.0"
                  size="xs"
                  value={uploadDefaultVersion}
                  onChange={(e) => setUploadDefaultVersion(e.target.value)}
                />

                <TextInput
                  label="Device HWID (Optional)"
                  placeholder="e.g. PC-HWID-..."
                  size="xs"
                  value={uploadDefaultDeviceId}
                  onChange={(e) => setUploadDefaultDeviceId(e.target.value)}
                />
              </SimpleGrid>

              {uploadFileContent && (
                <Box>
                  <Text size="11px" c="dimmed" fw={600} mb={4} tt="uppercase">
                    File Content Preview (First 500 characters)
                  </Text>
                  <Code
                    block
                    style={{ maxHeight: 120, fontSize: 11, overflow: "hidden" }}
                  >
                    {uploadFileContent.slice(0, 500)}
                    {uploadFileContent.length > 500 ? "\n... [truncated]" : ""}
                  </Code>
                </Box>
              )}
            </Stack>
          ) : (
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
                <Select
                  label="Log Level"
                  size="xs"
                  required
                  value={manualLevel}
                  onChange={(val) => setManualLevel(val || "INFO")}
                  data={[
                    { value: "INFO", label: "INFO" },
                    { value: "WARN", label: "WARN" },
                    { value: "ERROR", label: "ERROR" },
                    { value: "FATAL", label: "FATAL" },
                    { value: "DEBUG", label: "DEBUG" },
                  ]}
                />

                <TextInput
                  label="App Version"
                  placeholder="e.g. 1.2.0"
                  size="xs"
                  value={manualVersion}
                  onChange={(e) => setManualVersion(e.target.value)}
                />

                <TextInput
                  label="Device HWID"
                  placeholder="e.g. PC-HWID-..."
                  size="xs"
                  value={manualDeviceId}
                  onChange={(e) => setManualDeviceId(e.target.value)}
                />

                <TextInput
                  label="Device Name (Optional)"
                  placeholder="e.g. Workstation-1"
                  size="xs"
                  value={manualDeviceName}
                  onChange={(e) => setManualDeviceName(e.target.value)}
                />
              </SimpleGrid>

              <TextInput
                label="Log Message / Error Summary"
                placeholder="e.g. Unhandled NullReferenceException in PaymentProcessor"
                required
                size="xs"
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
              />

              <Textarea
                label="Stack Trace (Optional)"
                placeholder="at Program.cs:line 45&#10;at System.Threading.Tasks.Task..."
                size="xs"
                rows={4}
                style={{ fontFamily: "var(--font-mono)" }}
                value={manualStackTrace}
                onChange={(e) => setManualStackTrace(e.target.value)}
              />

              <Textarea
                label="JSON Metadata (Optional)"
                placeholder='{ "userId": "usr_123", "feature": "billing" }'
                size="xs"
                rows={3}
                style={{ fontFamily: "var(--font-mono)" }}
                value={manualMetadata}
                onChange={(e) => setManualMetadata(e.target.value)}
              />
            </Stack>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="filled"
              loading={uploading}
              onClick={handleUploadSubmit}
              style={{
                backgroundColor:
                  "var(--color-btn-primary-bg, var(--color-neon-primary))",
                color: "var(--color-btn-primary-text, var(--color-neon-text))",
                fontWeight: 600,
              }}
              styles={{
                label: {
                  color: "var(--color-btn-primary-text, var(--color-neon-text))",
                },
                section: {
                  color: "var(--color-btn-primary-text, var(--color-neon-text))",
                },
              }}
            >
              {uploadMode === "file" ? "Ingest & Upload Logs" : "Submit Log Record"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: View Log Details */}
      {/* ==================================================================== */}
      <Modal
        opened={!!selectedLogForDetails}
        onClose={() => setSelectedLogForDetails(null)}
        title={
          <Group gap="xs">
            <Badge
              size="sm"
              variant={
                selectedLogForDetails?.level === "FATAL" ||
                selectedLogForDetails?.level === "ERROR"
                  ? "filled"
                  : "light"
              }
              color={
                selectedLogForDetails?.level === "FATAL" ||
                selectedLogForDetails?.level === "ERROR"
                  ? "red"
                  : selectedLogForDetails?.level === "WARN"
                  ? "orange"
                  : "blue"
              }
              style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
            >
              {selectedLogForDetails?.level}
            </Badge>
            <Text fw={700}>Log Details</Text>
          </Group>
        }
        radius="md"
        size={isMobile ? "100%" : "lg"}
        fullScreen={isMobile}
      >
        {selectedLogForDetails && (
          <Stack gap="md">
            <Paper
              p="sm"
              radius="md"
              style={{
                backgroundColor: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                <Box>
                  <Text size="10px" c="dimmed" fw={600} tt="uppercase">
                    Timestamp
                  </Text>
                  <Text size="xs" fw={600} style={{ fontFamily: "var(--font-mono)" }}>
                    {new Date(selectedLogForDetails.createdAt).toLocaleString()}
                  </Text>
                </Box>
                <Box>
                  <Text size="10px" c="dimmed" fw={600} tt="uppercase">
                    App Version
                  </Text>
                  <Text size="xs" fw={600}>
                    {selectedLogForDetails.appVersion
                      ? `v${selectedLogForDetails.appVersion}`
                      : "N/A"}
                  </Text>
                </Box>
                <Box>
                  <Text size="10px" c="dimmed" fw={600} tt="uppercase">
                    Device HWID
                  </Text>
                  <Text size="xs" fw={600} style={{ fontFamily: "var(--font-mono)" }}>
                    {selectedLogForDetails.deviceId || "N/A"}
                  </Text>
                </Box>
                <Box>
                  <Text size="10px" c="dimmed" fw={600} tt="uppercase">
                    Source File
                  </Text>
                  <Text size="xs" fw={600}>
                    {selectedLogForDetails.fileName || "Direct API / Manual"}
                  </Text>
                </Box>
              </SimpleGrid>
            </Paper>

            <Box>
              <Group justify="space-between" mb={4}>
                <Text
                  size="xs"
                  fw={700}
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Message
                </Text>
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedLogForDetails.message);
                    notifications.show({
                      title: "Copied",
                      message: "Message copied",
                      color: "teal",
                    });
                  }}
                >
                  <IconCopy size={13} />
                </ActionIcon>
              </Group>
              <Paper
                p="xs"
                radius="sm"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Text
                  size="xs"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {selectedLogForDetails.message}
                </Text>
              </Paper>
            </Box>

            {selectedLogForDetails.stackTrace && (
              <Box>
                <Group justify="space-between" mb={4}>
                  <Text
                    size="xs"
                    fw={700}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Stack Trace
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedLogForDetails.stackTrace || ""
                      );
                      notifications.show({
                        title: "Copied",
                        message: "Stack trace copied",
                        color: "teal",
                      });
                    }}
                  >
                    <IconCopy size={13} />
                  </ActionIcon>
                </Group>
                <Code
                  block
                  style={{ fontSize: 11, maxHeight: 220, overflowY: "auto" }}
                >
                  {selectedLogForDetails.stackTrace}
                </Code>
              </Box>
            )}

            {selectedLogForDetails.metadata && (
              <Box>
                <Group justify="space-between" mb={4}>
                  <Text
                    size="xs"
                    fw={700}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Metadata JSON
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(selectedLogForDetails.metadata, null, 2)
                      );
                      notifications.show({
                        title: "Copied",
                        message: "Metadata copied",
                        color: "teal",
                      });
                    }}
                  >
                    <IconCopy size={13} />
                  </ActionIcon>
                </Group>
                <Code
                  block
                  style={{ fontSize: 11, maxHeight: 180, overflowY: "auto" }}
                >
                  {typeof selectedLogForDetails.metadata === "string"
                    ? selectedLogForDetails.metadata
                    : JSON.stringify(selectedLogForDetails.metadata, null, 2)}
                </Code>
              </Box>
            )}

            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setSelectedLogForDetails(null)}
              >
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Download / Export Options Modal */}
      <Modal
        opened={exportModalOpen}
        onClose={() => !exportingAll && setExportModalOpen(false)}
        title={
          <Group gap="xs">
            <IconDownload size={18} color="var(--color-neon-primary, #10e57a)" />
            <Text fw={700} size="md">
              Download Application Logs
            </Text>
          </Group>
        }
        centered
        radius="md"
        styles={{
          header: { backgroundColor: "var(--color-bg-card)" },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Choose whether to download only the logs currently displayed on this page, or all logs matching your active filters.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Paper
              p="md"
              withBorder
              style={{
                backgroundColor: "var(--color-bg-well)",
                borderColor: "var(--color-border)",
                cursor: "pointer",
                borderRadius: 8,
                transition: "all 0.15s ease",
              }}
              onClick={handleExportCurrentPage}
            >
              <Stack gap={6} justify="space-between" h="100%">
                <div>
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="11px" fw={700} c="dimmed">
                      CURRENT PAGE
                    </Text>
                    <Badge size="xs" variant="light" color="blue">
                      Page {page}
                    </Badge>
                  </Group>
                  <Text size="xl" fw={800}>
                    {appLogs.length}
                  </Text>
                  <Text size="11px" c="dimmed">
                    Logs on page {page} of {totalPages}
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconDownload size={13} />}
                  mt="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportCurrentPage();
                  }}
                >
                  Download Page ({appLogs.length})
                </Button>
              </Stack>
            </Paper>

            <Paper
              p="md"
              withBorder
              style={{
                backgroundColor: "var(--color-bg-well)",
                borderColor: "var(--color-border)",
                cursor: "pointer",
                borderRadius: 8,
                transition: "all 0.15s ease",
              }}
              onClick={handleExportAll}
            >
              <Stack gap={6} justify="space-between" h="100%">
                <div>
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="11px" fw={700} c="dimmed">
                      ALL LOGS
                    </Text>
                    <Badge size="xs" variant="filled" color="teal">
                      All {totalPages} Pages
                    </Badge>
                  </Group>
                  <Text
                    size="xl"
                    fw={800}
                    style={{ color: "var(--color-neon-primary, #10e57a)" }}
                  >
                    {total}
                  </Text>
                  <Text size="11px" c="dimmed">
                    Total records matching filters
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="filled"
                  style={{
                    backgroundColor: "var(--color-neon-primary, #10e57a)",
                    color: "var(--color-neon-text, #052e16)",
                    fontWeight: 700,
                  }}
                  leftSection={<IconDownload size={13} />}
                  mt="xs"
                  loading={exportingAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportAll();
                  }}
                >
                  Download All ({total})
                </Button>
              </Stack>
            </Paper>
          </SimpleGrid>

          {(levelFilter !== "ALL" || deviceFilter !== "ALL" || search.trim()) && (
            <Paper
              p="xs"
              withBorder
              style={{
                backgroundColor: "rgba(255,255,255,0.02)",
                borderColor: "var(--color-border)",
                borderRadius: 6,
              }}
            >
              <Text size="11px" c="dimmed">
                Active filters applied:
                {levelFilter !== "ALL" && (
                  <Badge size="xs" ml={6} variant="outline" color="gray">
                    Level: {levelFilter}
                  </Badge>
                )}
                {deviceFilter !== "ALL" && (
                  <Badge size="xs" ml={6} variant="outline" color="gray">
                    Device: {deviceFilter.slice(0, 10)}...
                  </Badge>
                )}
                {search.trim() && (
                  <Badge size="xs" ml={6} variant="outline" color="gray">
                    Search: "{search.trim()}"
                  </Badge>
                )}
              </Text>
            </Paper>
          )}
        </Stack>
      </Modal>
    </Box>
  );
};
