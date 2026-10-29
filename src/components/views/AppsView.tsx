import React, { useState, useEffect } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Title,
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
  Switch,
  NumberInput,
  Box,
  Tooltip,
  Paper,
  SimpleGrid,
  Table,
  Tabs,
  Code,
  ScrollArea,
  Divider,
  Avatar,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconRocket,
  IconPlus,
  IconDownload,
  IconTrash,
  IconEdit,
  IconCopy,
  IconCheck,
  IconSearch,
  IconPlayerPlay,
  IconCode,
  IconCloudUpload,
  IconRefresh,
  IconVersions,
  IconTerminal2,
  IconPhoto,
  IconArrowLeft,
} from "@tabler/icons-react";
import {
  api,
  AppItem,
  AppVersionItem,
  AppUpdateCheckResult,
} from "../../api/client";
import { openHoldToConfirmModal } from "../HoldToConfirmModal";

export const AppsView: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileShowList, setMobileShowList] = useState(false);

  // Data states
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [versions, setVersions] = useState<AppVersionItem[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Search & filter
  const [appSearch, setAppSearch] = useState("");
  const [versionSearch, setVersionSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string | null>("all");
  const [channelFilter, setChannelFilter] = useState<string | null>("all");

  // Create/Edit App Modal
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [appName, setAppName] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appIconUrl, setAppIconUrl] = useState("");
  const [appIconFile, setAppIconFile] = useState<File | null>(null);
  const [appIconBase64, setAppIconBase64] = useState<string>("");
  const [appIconMode, setAppIconMode] = useState<"upload" | "url">("upload");
  const [savingApp, setSavingApp] = useState(false);

  // Upload/Edit Version Modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<AppVersionItem | null>(null);
  const [verString, setVerString] = useState("");
  const [verBuild, setVerBuild] = useState<number>(1);
  const [verImportance, setVerImportance] = useState<"automatic" | "optional">("optional");
  const [verChannel, setVerChannel] = useState("stable");
  const [verPlatform, setVerPlatform] = useState("all");
  const [verNotes, setVerNotes] = useState("");
  const [verMinOs, setVerMinOs] = useState("");
  const [verActive, setVerActive] = useState(true);

  // File binary state for upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Simulator / SDK Modal
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simCurrentVersion, setSimCurrentVersion] = useState("1.0.0");
  const [simPlatform, setSimPlatform] = useState("windows");
  const [simChannel, setSimChannel] = useState("");
  const [simResult, setSimResult] = useState<AppUpdateCheckResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load Apps
  const loadApps = async (preserveSelectedId?: string) => {
    setLoadingApps(true);
    try {
      const res = await api.getApps();
      const list = res.items || [];
      setApps(list);

      if (list.length > 0) {
        if (preserveSelectedId) {
          const found = list.find((a) => a.id === preserveSelectedId);
          setSelectedApp(found || list[0]);
        } else if (!selectedApp) {
          setSelectedApp(list[0]);
        } else {
          const updated = list.find((a) => a.id === selectedApp.id);
          setSelectedApp(updated || list[0]);
        }
      } else {
        setSelectedApp(null);
      }
    } catch (err: any) {
      notifications.show({
        title: "Error loading apps",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  // Load Versions when selectedApp changes
  const loadVersions = async () => {
    if (!selectedApp) {
      setVersions([]);
      return;
    }
    setLoadingVersions(true);
    try {
      const res = await api.getAppVersions(selectedApp.id);
      setVersions(res.items || []);
    } catch (err: any) {
      notifications.show({
        title: "Error loading versions",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [selectedApp?.id]);

  // Handle App Slug generation
  const handleAppNameChange = (val: string) => {
    setAppName(val);
    if (!editingApp) {
      const generated = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      setAppSlug(generated);
    }
  };

  // Open App Modal (create or edit)
  const openAppModal = (appToEdit?: AppItem) => {
    if (appToEdit) {
      setEditingApp(appToEdit);
      setAppName(appToEdit.name);
      setAppSlug(appToEdit.slug);
      setAppDescription(appToEdit.description || "");
      setAppIconUrl(appToEdit.iconUrl || "");
      setAppIconFile(null);
      setAppIconBase64("");
      setAppIconMode(appToEdit.iconUrl?.startsWith("http") ? "url" : "upload");
    } else {
      setEditingApp(null);
      setAppName("");
      setAppSlug("");
      setAppDescription("");
      setAppIconUrl("");
      setAppIconFile(null);
      setAppIconBase64("");
      setAppIconMode("upload");
    }
    setIsAppModalOpen(true);
  };

  const handleAppIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppIconFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setAppIconBase64(res);
    };
    reader.readAsDataURL(file);
  };

  // Save App (create or edit)
  const handleSaveApp = async () => {
    if (!appName.trim()) {
      notifications.show({
        title: "Validation error",
        message: "App name is required",
        color: "red",
      });
      return;
    }

    setSavingApp(true);
    try {
      let iconPayload: { name: string; data: string; size?: number; type?: string } | undefined;
      if (appIconFile && appIconBase64) {
        iconPayload = {
          name: appIconFile.name,
          data: appIconBase64,
          size: appIconFile.size,
          type: appIconFile.type,
        };
      }

      // Determine final iconUrl string
      const resolvedIconUrl =
        appIconMode === "url"
          ? appIconUrl.trim()
          : iconPayload
          ? undefined
          : appIconUrl.trim();

      if (editingApp) {
        const updated = await api.updateApp(editingApp.id, {
          name: appName.trim(),
          slug: appSlug.trim(),
          description: appDescription.trim(),
          iconUrl: resolvedIconUrl,
          iconFile: iconPayload,
        });
        notifications.show({
          title: "App updated",
          message: `App "${updated.name}" has been updated`,
          color: "teal",
        });
        setIsAppModalOpen(false);
        setMobileShowList(false);
        loadApps(updated.id);
      } else {
        const created = await api.createApp({
          name: appName.trim(),
          slug: appSlug.trim() || undefined,
          description: appDescription.trim(),
          iconUrl: resolvedIconUrl,
          iconFile: iconPayload,
        });
        notifications.show({
          title: "App created",
          message: `App "${created.name}" created successfully`,
          color: "teal",
        });
        setIsAppModalOpen(false);
        setMobileShowList(false);
        loadApps(created.id);
      }
    } catch (err: any) {
      notifications.show({
        title: "Error saving app",
        message: err.message,
        color: "red",
      });
    } finally {
      setSavingApp(false);
    }
  };

  // Delete App
  const handleDeleteApp = (appToDelete: AppItem) => {
    openHoldToConfirmModal({
      title: `Delete App: ${appToDelete.name}`,
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete app <b>{appToDelete.name}</b> ({appToDelete.slug})? All {appToDelete.totalReleases} release versions and uploaded binary files will be permanently deleted.
        </Text>
      ),
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteApp(appToDelete.id);
          notifications.show({
            title: "App deleted",
            message: `App "${appToDelete.name}" was deleted`,
            color: "teal",
          });
          setMobileShowList(true);
          loadApps();
        } catch (err: any) {
          notifications.show({
            title: "Delete error",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  // Open Version Modal
  const openVersionModal = (v?: AppVersionItem) => {
    if (v) {
      setEditingVersion(v);
      setVerString(v.version);
      setVerBuild(v.buildNumber);
      setVerImportance(v.importance);
      setVerChannel(v.channel || "stable");
      setVerPlatform(v.platform || "all");
      setVerNotes(v.releaseNotes || "");
      setVerMinOs(v.minOsVersion || "");
      setVerActive(v.isActive);

      setSelectedFile(null);
      setFileBase64("");
    } else {
      setEditingVersion(null);
      // Auto-compute next build number
      const maxBuild = versions.reduce((max, cur) => Math.max(max, cur.buildNumber || 0), 0);
      setVerString("");
      setVerBuild(maxBuild + 1);
      setVerImportance("optional");
      setVerChannel("stable");
      setVerPlatform("all");
      setVerNotes("");
      setVerMinOs("");
      setVerActive(true);
      setSelectedFile(null);
      setFileBase64("");
    }
    setIsVersionModalOpen(true);
  };

  // Handle Binary File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Save/Upload Version
  const handleSaveVersion = async () => {
    if (!selectedApp) return;

    if (!verString.trim()) {
      notifications.show({
        title: "Validation error",
        message: "Version string (e.g. 1.0.0) is required",
        color: "red",
      });
      return;
    }

    setUploadingVersion(true);
    try {
      if (editingVersion) {
        // Edit existing release metadata
        const updated = await api.updateAppVersion(editingVersion.id, {
          importance: verImportance,
          channel: verChannel.trim().toLowerCase(),
          platform: verPlatform.trim().toLowerCase(),
          releaseNotes: verNotes.trim() || null,
          minOsVersion: verMinOs.trim() || null,
          isActive: verActive,
          buildNumber: verBuild,
        });

        notifications.show({
          title: "Version updated",
          message: `Version ${updated.version} metadata has been updated`,
          color: "teal",
        });
      } else {
        // Upload new release
        let filePayload: { name: string; data: string; size?: number; type?: string } | undefined;
        if (selectedFile && fileBase64) {
          filePayload = {
            name: selectedFile.name,
            data: fileBase64,
            size: selectedFile.size,
            type: selectedFile.type,
          };
        }

        const created = await api.uploadAppVersion({
          appId: selectedApp.id,
          version: verString.trim(),
          buildNumber: verBuild,
          importance: verImportance,
          channel: verChannel.trim().toLowerCase(),
          platform: verPlatform.trim().toLowerCase(),
          releaseNotes: verNotes.trim() || undefined,
          minOsVersion: verMinOs.trim() || undefined,
          isActive: verActive,
          file: filePayload,
        });

        notifications.show({
          title: "Release published",
          message: `Version ${created.version} successfully uploaded and published`,
          color: "teal",
        });
      }

      setIsVersionModalOpen(false);
      loadVersions();
      loadApps(selectedApp.id);
    } catch (err: any) {
      notifications.show({
        title: "Upload error",
        message: err.message,
        color: "red",
      });
    } finally {
      setUploadingVersion(false);
    }
  };

  // Delete Version
  const handleDeleteVersion = (v: AppVersionItem) => {
    openHoldToConfirmModal({
      title: `Delete Version: ${v.version}`,
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete version <b>v{v.version}</b> (Build #{v.buildNumber})? The uploaded binary file will also be removed from storage.
        </Text>
      ),
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteAppVersion(v.id);
          notifications.show({
            title: "Version deleted",
            message: `Version ${v.version} was removed`,
            color: "teal",
          });
          loadVersions();
          if (selectedApp) loadApps(selectedApp.id);
        } catch (err: any) {
          notifications.show({
            title: "Delete error",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  // Toggle Active/Inactive directly
  const handleToggleActive = async (v: AppVersionItem) => {
    try {
      await api.updateAppVersion(v.id, { isActive: !v.isActive });
      setVersions((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, isActive: !item.isActive } : item))
      );
      notifications.show({
        title: v.isActive ? "Version deactivated" : "Version activated",
        message: `Version ${v.version} is now ${v.isActive ? "hidden from updates" : "available"}`,
        color: v.isActive ? "orange" : "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message,
        color: "red",
      });
    }
  };

  // Run Simulator Check
  const handleRunSimulation = async () => {
    if (!selectedApp) return;
    setSimulating(true);
    try {
      const res = await api.checkAppUpdate(selectedApp.slug, {
        currentVersion: simCurrentVersion.trim(),
        platform: simPlatform === "all" ? undefined : simPlatform,
        channel: simChannel.trim() ? simChannel.trim() : undefined,
      });
      setSimResult(res);
    } catch (err: any) {
      notifications.show({
        title: "Simulation error",
        message: err.message,
        color: "red",
      });
    } finally {
      setSimulating(false);
    }
  };

  // Filtered versions
  const filteredVersions = versions.filter((v) => {
    if (versionSearch.trim()) {
      const q = versionSearch.trim().toLowerCase();
      const matchVer = v.version.toLowerCase().includes(q);
      const matchChannel = v.channel.toLowerCase().includes(q);
      const matchFile = (v.fileName || "").toLowerCase().includes(q);
      if (!matchVer && !matchChannel && !matchFile) return false;
    }
    if (platformFilter && platformFilter !== "all" && v.platform !== "all" && v.platform !== platformFilter) {
      return false;
    }
    if (channelFilter && channelFilter !== "all" && v.channel !== channelFilter) {
      return false;
    }
    return true;
  });

  // Filtered apps list
  const filteredApps = apps.filter((a) => {
    if (!appSearch.trim()) return true;
    const q = appSearch.trim().toLowerCase();
    return a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notifications.show({
      title: "Copied!",
      message: `${label} copied to clipboard`,
      color: "teal",
    });
  };

  return (
    <Box
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--color-bg-base)",
      }}
    >
      {/* ==================================================================== */}
      {/* LEFT SIDEBAR: Applications List & Switcher */}
      {/* ==================================================================== */}
      <Box
        style={{
          width: isMobile ? "100%" : 290,
          minWidth: isMobile ? "100%" : 290,
          borderRight: isMobile ? "none" : "1px solid var(--color-border)",
          display: isMobile && !mobileShowList && selectedApp ? "none" : "flex",
          flexDirection: "column",
          backgroundColor: "var(--color-bg-surface)",
          height: "100%",
        }}
      >
        {/* Sidebar Header */}
        <Box p="md" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Group justify="space-between" align="center" mb="xs">
            <Group gap={8}>
              <IconRocket size={20} color="var(--color-neon-primary, #10e57a)" />
              <Title order={5} style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
                App Releases
              </Title>
            </Group>
            <Tooltip label="Register New App" withArrow>
              <ActionIcon
                variant="filled"
                color="teal"
                size="md"
                radius="md"
                onClick={() => openAppModal()}
                style={{
                  backgroundColor: "var(--color-neon-primary, #10e57a)",
                  color: "#ffffff",
                }}
              >
                <IconPlus size={16} color="#ffffff" />
              </ActionIcon>
            </Tooltip>
          </Group>

          <TextInput
            placeholder="Search applications..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            styles={{
              input: {
                backgroundColor: "var(--color-bg-card)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              },
            }}
          />

          {isMobile && selectedApp && (
            <Button
              size="xs"
              variant="light"
              color="teal"
              fullWidth
              mt="xs"
              onClick={() => setMobileShowList(false)}
            >
              View {selectedApp.name} &rarr;
            </Button>
          )}
        </Box>

        {/* Apps List */}
        <ScrollArea style={{ flex: 1 }} p="xs">
          <Stack gap={6}>
            {loadingApps && apps.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="xl">
                Loading applications...
              </Text>
            ) : filteredApps.length === 0 ? (
              <Box ta="center" py="xl" px="sm">
                <Text size="xs" c="dimmed" mb="sm">
                  {appSearch ? "No matching apps found" : "No applications registered yet."}
                </Text>
                <Button
                  size="xs"
                  variant="filled"
                  color="teal"
                  leftSection={<IconPlus size={14} color="#ffffff" />}
                  onClick={() => openAppModal()}
                  style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
                  styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
                >
                  Create First App
                </Button>
              </Box>
            ) : (
              filteredApps.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <Paper
                    key={app.id}
                    p="sm"
                    radius="md"
                    onClick={() => {
                      setSelectedApp(app);
                      setMobileShowList(false);
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor: isSelected
                        ? "var(--color-neon-dim, rgba(16, 229, 122, 0.1))"
                        : "transparent",
                      border: isSelected
                        ? "1px solid var(--color-border-glow, rgba(16, 229, 122, 0.35))"
                        : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--color-bg-card-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" align="center">
                      <Group gap="xs" wrap="nowrap" align="center" style={{ overflow: "hidden" }}>
                        <Avatar
                          src={app.iconUrl}
                          size={34}
                          radius="md"
                          style={{
                            backgroundColor: isSelected
                              ? "var(--color-neon-dim, rgba(16, 229, 122, 0.15))"
                              : "var(--color-bg-card)",
                            border: isSelected
                              ? "1px solid var(--color-border-glow)"
                              : "1px solid var(--color-border)",
                            flexShrink: 0,
                          }}
                        >
                          <IconRocket size={17} color="var(--color-neon-primary, #10e57a)" />
                        </Avatar>
                        <Box style={{ overflow: "hidden" }}>
                          <Text
                            size="sm"
                            fw={isSelected ? 700 : 600}
                            style={{
                              color: isSelected
                                ? "var(--color-neon-primary, #10e57a)"
                                : "var(--color-text-primary)",
                            }}
                            truncate
                          >
                            {app.name}
                          </Text>
                          <Text size="xs" c="dimmed" truncate style={{ fontFamily: "var(--font-mono)" }}>
                            {app.slug}
                          </Text>
                        </Box>
                      </Group>
                      {app.latestVersion && (
                        <Badge
                          size="xs"
                          variant="outline"
                          color={isSelected ? "teal" : "gray"}
                          style={{ fontFamily: "var(--font-mono)", flexShrink: 0 }}
                        >
                          v{app.latestVersion}
                        </Badge>
                      )}
                    </Group>

                    <Group justify="space-between" mt={8}>
                      <Text size="11px" c="dimmed">
                        {app.totalReleases} {app.totalReleases === 1 ? "release" : "releases"}
                      </Text>
                      <Text size="11px" c="dimmed">
                        {app.totalDownloads} {app.totalDownloads === 1 ? "download" : "downloads"}
                      </Text>
                    </Group>
                  </Paper>
                );
              })
            )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA: Selected App Dashboard & Releases */}
      {/* ==================================================================== */}
      <Box
        style={{
          flex: 1,
          width: isMobile ? "100%" : "auto",
          minWidth: 0,
          display: isMobile && (mobileShowList || !selectedApp) ? "none" : "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {!selectedApp ? (
          <Box
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <IconRocket size={52} color="var(--color-text-dimmed)" stroke={1.3} />
            <Title order={4} mt="md" c="dimmed">
              No Application Selected
            </Title>
            <Text size="sm" c="dimmed" mt={4} mb="lg" ta="center">
              Select an app from the list or register a new one to manage version releases.
            </Text>
            <Button
              color="teal"
              leftSection={<IconPlus size={16} color="#ffffff" />}
              onClick={() => openAppModal()}
              style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
              styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
            >
              Register New App
            </Button>
          </Box>
        ) : (
          <>
            {/* Top Bar for Selected App */}
            <Box
              p="md"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <Group justify="space-between" align="center" wrap={isMobile ? "wrap" : "nowrap"} gap={isMobile ? "xs" : "md"}>
                <Group gap="sm" align="center" style={{ flex: isMobile ? "1 1 100%" : "auto" }}>
                  {isMobile && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      leftSection={<IconArrowLeft size={16} />}
                      onClick={() => setMobileShowList(true)}
                      styles={{ root: { paddingLeft: 6, paddingRight: 8 } }}
                    >
                      Apps
                    </Button>
                  )}
                  <Avatar
                    src={selectedApp.iconUrl}
                    size={isMobile ? 38 : 46}
                    radius="md"
                    style={{
                      backgroundColor: "var(--color-neon-dim, rgba(16, 229, 122, 0.15))",
                      border: "1px solid var(--color-border-glow)",
                      flexShrink: 0,
                    }}
                  >
                    <IconRocket size={isMobile ? 20 : 24} color="var(--color-neon-primary, #10e57a)" />
                  </Avatar>
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" align="center" wrap="wrap">
                      <Title order={isMobile ? 4 : 3} style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
                        {selectedApp.name}
                      </Title>
                      <Badge
                        size="xs"
                        variant="filled"
                        style={{
                          backgroundColor: "var(--color-neon-dim)",
                          color: "var(--color-neon-primary)",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                        }}
                      >
                        slug: {selectedApp.slug}
                      </Badge>
                    </Group>
                    {selectedApp.description && (
                      <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                        {selectedApp.description}
                      </Text>
                    )}
                  </Box>
                </Group>

                <Group
                  gap="xs"
                  wrap="wrap"
                  style={{
                    width: isMobile ? "100%" : "auto",
                    justifyContent: isMobile ? "flex-start" : "flex-end",
                  }}
                >
                  <Button
                    size={isMobile ? "xs" : "sm"}
                    variant="filled"
                    color="blue"
                    leftSection={<IconPlayerPlay size={isMobile ? 14 : 16} color="#ffffff" />}
                    onClick={() => {
                      setSimCurrentVersion(selectedApp.latestVersion || "1.0.0");
                      setSimResult(null);
                      setIsSimulatorOpen(true);
                    }}
                    style={{ color: "#ffffff", flex: isMobile ? "1 1 auto" : "initial" }}
                    styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
                  >
                    Test Update Check
                  </Button>

                  <Button
                    size={isMobile ? "xs" : "sm"}
                    variant="filled"
                    color="teal"
                    leftSection={<IconCloudUpload size={isMobile ? 14 : 16} color="#ffffff" />}
                    onClick={() => openVersionModal()}
                    style={{
                      backgroundColor: "var(--color-neon-primary, #10e57a)",
                      color: "#ffffff",
                      fontWeight: 600,
                      flex: isMobile ? "1 1 auto" : "initial",
                    }}
                    styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
                  >
                    Upload New Version
                  </Button>

                  <Group gap={4}>
                    <Tooltip label="Edit App Information" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size={isMobile ? "md" : "lg"}
                        radius="md"
                        onClick={() => openAppModal(selectedApp)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label="Delete App" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size={isMobile ? "md" : "lg"}
                        radius="md"
                        onClick={() => handleDeleteApp(selectedApp)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Group>

              {/* Stats overview */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} mt="md">
                <Paper
                  p="xs"
                  radius="md"
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <Text size="11px" c="dimmed" fw={600} tt="uppercase">
                    Total Versions
                  </Text>
                  <Text size="lg" fw={700} style={{ color: "var(--color-text-primary)" }}>
                    {selectedApp.totalReleases}
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
                    Total Downloads
                  </Text>
                  <Text size="lg" fw={700} style={{ color: "var(--color-neon-primary, #10e57a)" }}>
                    {selectedApp.totalDownloads}
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
                    Latest Version
                  </Text>
                  <Group gap={6} align="center">
                    <Text size="lg" fw={700} style={{ fontFamily: "var(--font-mono)" }}>
                      {selectedApp.latestVersion ? `v${selectedApp.latestVersion}` : "None"}
                    </Text>
                    {selectedApp.latestImportance && (
                      <Badge
                        size="xs"
                        color={selectedApp.latestImportance === "automatic" ? "orange" : "blue"}
                      >
                        {selectedApp.latestImportance}
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
                    Total Storage
                  </Text>
                  <Text size="lg" fw={700} style={{ color: "var(--color-text-secondary)" }}>
                    {formatBytes(selectedApp.totalStorageBytes || 0)}
                  </Text>
                </Paper>
              </SimpleGrid>
            </Box>

            {/* Releases Table & Filter Controls */}
            <Box p={isMobile ? "xs" : "md"} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <Group justify="space-between" mb="sm" wrap="wrap" gap="xs">
                <Group gap="xs" wrap="wrap" style={{ flex: isMobile ? "1 1 100%" : 1, minWidth: 0 }}>
                  <TextInput
                    placeholder="Search versions, files..."
                    size="xs"
                    style={{ flex: isMobile ? "1 1 100%" : "0 0 200px" }}
                    leftSection={<IconSearch size={14} />}
                    value={versionSearch}
                    onChange={(e) => setVersionSearch(e.target.value)}
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border)",
                      },
                    }}
                  />

                  <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"} style={{ flex: isMobile ? "1 1 100%" : "auto" }}>
                    <Select
                      size="xs"
                      style={{ flex: isMobile ? "1 1 45%" : "0 0 130px" }}
                      placeholder="Platform"
                      data={[
                        { value: "all", label: "All Platforms" },
                        { value: "windows", label: "Windows" },
                        { value: "macos", label: "macOS" },
                        { value: "linux", label: "Linux" },
                        { value: "android", label: "Android" },
                        { value: "ios", label: "iOS" },
                        { value: "web", label: "Web" },
                      ]}
                      value={platformFilter}
                      onChange={setPlatformFilter}
                    />

                    <Select
                      size="xs"
                      style={{ flex: isMobile ? "1 1 45%" : "0 0 120px" }}
                      placeholder="Channel"
                      data={[
                        { value: "all", label: "All Channels" },
                        { value: "stable", label: "Stable" },
                        { value: "beta", label: "Beta" },
                        { value: "alpha", label: "Alpha" },
                        { value: "latest", label: "Latest" },
                      ]}
                      value={channelFilter}
                      onChange={setChannelFilter}
                    />
                  </Group>
                </Group>

                <Group gap="xs" justify={isMobile ? "flex-end" : "flex-start"} style={{ width: isMobile ? "100%" : "auto" }}>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconRefresh size={14} />}
                    onClick={loadVersions}
                    loading={loadingVersions}
                  >
                    Refresh
                  </Button>
                </Group>
              </Group>

              {/* Versions List Table */}
              <ScrollArea style={{ flex: 1, width: "100%" }} type="auto">
                {loadingVersions && versions.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    Loading releases...
                  </Text>
                ) : filteredVersions.length === 0 ? (
                  <Box
                    ta="center"
                    py="xl"
                    style={{
                      border: "1px dashed var(--color-border)",
                      borderRadius: 12,
                    }}
                  >
                    <IconCloudUpload size={40} color="var(--color-text-dimmed)" stroke={1.4} />
                    <Title order={5} mt="sm" c="dimmed">
                      No versions released yet
                    </Title>
                    <Text size="xs" c="dimmed" mt={4} mb="md">
                      Upload an installer, archive, or binary package for this app.
                    </Text>
                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconCloudUpload size={14} color="#ffffff" />}
                      onClick={() => openVersionModal()}
                      style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
                      styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
                    >
                      Upload First Version
                    </Button>
                  </Box>
                ) : (
                  <Table
                    striped
                    highlightOnHover
                    verticalSpacing="sm"
                    style={{ minWidth: 620 }}
                    styles={{
                      th: {
                        color: "var(--color-text-dimmed)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      },
                      td: {
                        color: "var(--color-text-primary)",
                        fontSize: "13px",
                      },
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Version & Build</Table.Th>
                        <Table.Th>Importance</Table.Th>
                        <Table.Th>Channel</Table.Th>
                        <Table.Th>Platform</Table.Th>
                        <Table.Th>Binary File</Table.Th>
                        <Table.Th>Downloads</Table.Th>
                        <Table.Th>Active</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredVersions.map((v) => (
                        <Table.Tr key={v.id}>
                          {/* Version & Build */}
                          <Table.Td>
                            <Group gap={6} align="center">
                              <Text fw={700} style={{ fontFamily: "var(--font-mono)" }}>
                                v{v.version}
                              </Text>
                              <Badge size="xs" variant="outline" color="gray">
                                #{v.buildNumber}
                              </Badge>
                            </Group>
                            <Text size="11px" c="dimmed">
                              {new Date(v.createdAt).toLocaleDateString()}
                            </Text>
                          </Table.Td>

                          {/* Importance */}
                          <Table.Td>
                            {v.isAutomatic ? (
                              <Tooltip
                                label="Automatic update: applies immediately without asking user"
                                withArrow
                              >
                                <Badge color="orange" variant="light" size="sm">
                                  Automatic
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Tooltip label="Optional update: user can choose to update" withArrow>
                                <Badge color="blue" variant="light" size="sm">
                                  Optional
                                </Badge>
                              </Tooltip>
                            )}
                          </Table.Td>

                          {/* Channel */}
                          <Table.Td>
                            <Badge
                              size="sm"
                              variant="dot"
                              color={
                                v.channel === "alpha"
                                  ? "purple"
                                  : v.channel === "beta"
                                  ? "indigo"
                                  : v.channel === "stable"
                                  ? "teal"
                                  : "cyan"
                              }
                            >
                              {v.channel}
                            </Badge>
                          </Table.Td>

                          {/* Platform */}
                          <Table.Td>
                            <Badge size="xs" variant="outline" color="gray">
                              {v.platform}
                            </Badge>
                          </Table.Td>

                          {/* Binary File */}
                          <Table.Td>
                            {v.fileName ? (
                              <Box>
                                <Text size="xs" fw={500} truncate style={{ maxWidth: 160 }}>
                                  {v.fileName}
                                </Text>
                                <Text size="11px" c="dimmed">
                                  {formatBytes(v.fileSize)}
                                </Text>
                              </Box>
                            ) : (
                              <Text size="xs" c="dimmed">
                                No binary attached
                              </Text>
                            )}
                          </Table.Td>

                          {/* Downloads */}
                          <Table.Td>
                            <Text size="xs" fw={600}>
                              {v.downloadCount}
                            </Text>
                          </Table.Td>

                          {/* Active Switch */}
                          <Table.Td>
                            <Switch
                              size="xs"
                              color="teal"
                              checked={v.isActive}
                              onChange={() => handleToggleActive(v)}
                            />
                          </Table.Td>

                          {/* Actions */}
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              {v.downloadUrl && (
                                <Tooltip label="Download Binary File" withArrow>
                                  <ActionIcon
                                    component="a"
                                    href={v.downloadUrl}
                                    download
                                    variant="subtle"
                                    color="teal"
                                    size="sm"
                                  >
                                    <IconDownload size={15} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              <Tooltip label="Copy Direct Download Link" withArrow>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  onClick={() =>
                                    copyToClipboard(
                                      `${window.location.origin}${v.downloadUrl}`,
                                      "Download link"
                                    )
                                  }
                                >
                                  <IconCopy size={15} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Edit Metadata" withArrow>
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  size="sm"
                                  onClick={() => openVersionModal(v)}
                                >
                                  <IconEdit size={15} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Delete Version" withArrow>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleDeleteVersion(v)}
                                >
                                  <IconTrash size={15} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </ScrollArea>
            </Box>
          </>
        )}
      </Box>

      {/* ==================================================================== */}
      {/* MODAL: Create / Edit Application */}
      {/* ==================================================================== */}
      <Modal
        opened={isAppModalOpen}
        onClose={() => setIsAppModalOpen(false)}
        title={
          <Group gap="xs">
            <IconRocket size={20} color="var(--color-neon-primary, #10e57a)" />
            <Text fw={700}>{editingApp ? "Edit Application" : "Register New Application"}</Text>
          </Group>
        }
        radius="md"
        size={isMobile ? "100%" : "md"}
        fullScreen={isMobile}
      >
        <Stack gap="md">
          <TextInput
            label="App Name"
            placeholder="e.g. AlsaBase Desktop Client"
            required
            value={appName}
            onChange={(e) => handleAppNameChange(e.target.value)}
          />

          <TextInput
            label="Slug Identifier"
            placeholder="e.g. desktop-client"
            description="Unique string used in API calls and SDK methods"
            required
            value={appSlug}
            onChange={(e) => setAppSlug(e.target.value)}
          />

          <Textarea
            label="Description"
            placeholder="Brief description of this application..."
            rows={3}
            value={appDescription}
            onChange={(e) => setAppDescription(e.target.value)}
          />

          {/* App Icon Upload / URL */}
          <Box>
            <Group justify="space-between" align="center" mb={6}>
              <Text size="sm" fw={500}>
                Application Icon (Optional)
              </Text>
              <SegmentedControl
                size="xs"
                value={appIconMode}
                onChange={(val: any) => setAppIconMode(val)}
                data={[
                  { value: "upload", label: "Upload Image" },
                  { value: "url", label: "Remote URL" },
                ]}
              />
            </Group>

            {appIconMode === "upload" ? (
              <Box>
                {appIconBase64 || appIconUrl ? (
                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Group gap="sm">
                      <Avatar
                        src={appIconBase64 || appIconUrl}
                        size={46}
                        radius="md"
                        style={{
                          border: "1px solid var(--color-border-glow)",
                          backgroundColor: "rgba(0, 0, 0, 0.2)",
                        }}
                      >
                        <IconPhoto size={20} color="var(--color-neon-primary, #10e57a)" />
                      </Avatar>
                      <Box style={{ overflow: "hidden" }}>
                        <Text size="xs" fw={600} truncate style={{ maxWidth: 220 }}>
                          {appIconFile?.name || "Application Icon"}
                        </Text>
                        <Text size="11px" c="dimmed">
                          {appIconFile ? `${(appIconFile.size / 1024).toFixed(1)} KB` : "Current Icon"}
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={6}>
                      <Button
                        size="xs"
                        variant="light"
                        color="teal"
                        onClick={() => document.getElementById("app-icon-file-input")?.click()}
                      >
                        Change
                      </Button>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        onClick={() => {
                          setAppIconFile(null);
                          setAppIconBase64("");
                          setAppIconUrl("");
                        }}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ) : (
                  <Paper
                    p="md"
                    radius="md"
                    style={{
                      border: "1px dashed var(--color-border)",
                      backgroundColor: "var(--color-bg-card)",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease",
                    }}
                    onClick={() => document.getElementById("app-icon-file-input")?.click()}
                  >
                    <IconPhoto size={32} color="var(--color-neon-primary, #10e57a)" stroke={1.5} />
                    <Text size="sm" fw={600} mt={4}>
                      Click to upload application icon
                    </Text>
                    <Text size="11px" c="dimmed" mt={2}>
                      PNG, SVG, JPG, WebP, or ICO (recommended square image)
                    </Text>
                  </Paper>
                )}
                <input
                  id="app-icon-file-input"
                  type="file"
                  accept="image/*,.ico"
                  style={{ display: "none" }}
                  onChange={handleAppIconFileChange}
                />
              </Box>
            ) : (
              <TextInput
                placeholder="https://example.com/icon.png"
                value={appIconUrl}
                onChange={(e) => {
                  setAppIconUrl(e.target.value);
                  setAppIconBase64("");
                  setAppIconFile(null);
                }}
                leftSection={
                  appIconUrl ? (
                    <Avatar src={appIconUrl} size={18} radius="xs" />
                  ) : (
                    <IconPhoto size={14} />
                  )
                }
              />
            )}
          </Box>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsAppModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              loading={savingApp}
              onClick={handleSaveApp}
              style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
              styles={{ label: { color: "#ffffff" } }}
            >
              {editingApp ? "Save Changes" : "Create App"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Upload / Edit Version */}
      {/* ==================================================================== */}
      <Modal
        opened={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        title={
          <Group gap="xs">
            <IconVersions size={20} color="var(--color-neon-primary, #10e57a)" />
            <Text fw={700}>
              {editingVersion
                ? `Edit Version: v${editingVersion.version}`
                : `Publish New Version for ${selectedApp?.name}`}
            </Text>
          </Group>
        }
        radius="md"
        size={isMobile ? "100%" : "lg"}
        fullScreen={isMobile}
      >
        <Stack gap="md">
          {/* Version and Build */}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Version String"
              placeholder="e.g. 1.2.0"
              required
              disabled={!!editingVersion}
              value={verString}
              onChange={(e) => setVerString(e.target.value)}
            />
            <NumberInput
              label="Build Number"
              placeholder="e.g. 102"
              min={1}
              value={verBuild}
              onChange={(val) => setVerBuild(typeof val === "number" ? val : 1)}
            />
          </SimpleGrid>

          {/* Importance Setting */}
          <Select
            label="Update Importance"
            description={
              verImportance === "automatic"
                ? "Automatic / Mandatory updates are downloaded and applied immediately without prompting or allowing the user to skip."
                : "Optional updates prompt the user with release notes; user can choose to postpone or proceed."
            }
            value={verImportance}
            onChange={(val) => setVerImportance((val as "automatic" | "optional") || "optional")}
            data={[
              {
                value: "automatic",
                label: "Automatic (Mandatory: doesn't ask user)",
              },
              {
                value: "optional",
                label: "Optional (Asks user to update)",
              },
            ]}
          />

          {/* Platform and Channel */}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Channel"
              data={[
                { value: "stable", label: "Stable" },
                { value: "beta", label: "Beta" },
                { value: "alpha", label: "Alpha" },
                { value: "latest", label: "Latest" },
              ]}
              value={verChannel}
              onChange={(val) => setVerChannel(val || "stable")}
            />

            <Select
              label="Platform"
              data={[
                { value: "all", label: "All Platforms" },
                { value: "windows", label: "Windows" },
                { value: "macos", label: "macOS" },
                { value: "linux", label: "Linux" },
                { value: "android", label: "Android" },
                { value: "ios", label: "iOS" },
                { value: "web", label: "Web" },
              ]}
              value={verPlatform}
              onChange={(val) => setVerPlatform(val || "all")}
            />
          </SimpleGrid>

          {/* File Upload (for new releases) */}
          {!editingVersion && (
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Release Binary File (Installer / Archive)
              </Text>
              <Paper
                p="md"
                radius="md"
                style={{
                  border: "1px dashed var(--color-border)",
                  textAlign: "center",
                  backgroundColor: "var(--color-bg-card)",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("release-file-input")?.click()}
              >
                <input
                  id="release-file-input"
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <IconCloudUpload size={32} color="var(--color-neon-primary, #10e57a)" />
                <Text size="sm" fw={600} mt="xs">
                  {selectedFile ? selectedFile.name : "Click to select or drag and drop release binary"}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {selectedFile
                    ? `Size: ${formatBytes(selectedFile.size)}`
                    : "Supports .exe, .dmg, .apk, .zip, .tar.gz, .msi, .deb, etc."}
                </Text>
              </Paper>
            </Box>
          )}

          {/* Release Notes */}
          <Textarea
            label="Release Notes (Markdown Changelog)"
            placeholder="### What's New&#10;- Added dark mode support&#10;- Fixed sync bug"
            rows={4}
            value={verNotes}
            onChange={(e) => setVerNotes(e.target.value)}
          />

          {/* Active Switch */}
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={500}>
                Active Release
              </Text>
              <Text size="xs" c="dimmed">
                Inactive releases are hidden from app update checks
              </Text>
            </Box>
            <Switch
              color="teal"
              checked={verActive}
              onChange={(e) => setVerActive(e.currentTarget.checked)}
            />
          </Group>

          {/* Buttons */}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsVersionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              loading={uploadingVersion}
              onClick={handleSaveVersion}
              style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
              styles={{ label: { color: "#ffffff" } }}
            >
              {editingVersion ? "Save Changes" : "Publish Release"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Simulator & SDK Code Generator */}
      {/* ==================================================================== */}
      <Modal
        opened={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title={
          <Group gap="xs">
            <IconPlayerPlay size={20} color="var(--color-neon-primary, #10e57a)" />
            <Text fw={700}>App Update Simulator & SDK Code Generator</Text>
          </Group>
        }
        radius="md"
        size={isMobile ? "100%" : "xl"}
        fullScreen={isMobile}
      >
        <Tabs defaultValue="simulator">
          <Tabs.List mb="md">
            <Tabs.Tab value="simulator" leftSection={<IconPlayerPlay size={15} />}>
              Live Update Simulator
            </Tabs.Tab>
            <Tabs.Tab value="sdk" leftSection={<IconCode size={15} />}>
              SDK Code Example
            </Tabs.Tab>
            <Tabs.Tab value="api" leftSection={<IconTerminal2 size={15} />}>
              REST API Endpoints
            </Tabs.Tab>
          </Tabs.List>

          {/* Live Simulator Tab */}
          <Tabs.Panel value="simulator">
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                Simulate how your client application calls AlsaBase to check for updates.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput
                  label="Current App Version"
                  placeholder="e.g. 1.0.0"
                  value={simCurrentVersion}
                  onChange={(e) => setSimCurrentVersion(e.target.value)}
                />

                <Select
                  label="Platform"
                  data={[
                    { value: "all", label: "All Platforms" },
                    { value: "windows", label: "Windows" },
                    { value: "macos", label: "macOS" },
                    { value: "linux", label: "Linux" },
                    { value: "android", label: "Android" },
                    { value: "ios", label: "iOS" },
                  ]}
                  value={simPlatform}
                  onChange={(val) => setSimPlatform(val || "windows")}
                />

                <TextInput
                  label="Channel (Optional)"
                  placeholder="e.g. beta or alpha"
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value)}
                />
              </SimpleGrid>

              <Button
                color="teal"
                loading={simulating}
                onClick={handleRunSimulation}
                leftSection={<IconPlayerPlay size={16} color="#ffffff" />}
                style={{ backgroundColor: "var(--color-neon-primary, #10e57a)", color: "#ffffff" }}
                styles={{ label: { color: "#ffffff" }, section: { color: "#ffffff" } }}
              >
                Run Update Check
              </Button>

              {simResult && (
                <Paper
                  p="md"
                  radius="md"
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    border: simResult.updateAvailable
                      ? "1px solid var(--color-neon-primary)"
                      : "1px solid var(--color-border)",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge
                        size="md"
                        color={simResult.updateAvailable ? "teal" : "gray"}
                        variant="filled"
                      >
                        {simResult.updateAvailable ? "Update Available" : "App is Up to Date"}
                      </Badge>
                      {simResult.updateAvailable && (
                        <Badge
                          size="md"
                          color={simResult.isAutomatic ? "orange" : "blue"}
                          variant="light"
                        >
                          {simResult.isAutomatic ? "Automatic (Mandatory)" : "Optional Update"}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontFamily: "var(--font-mono)" }}>
                      Current: v{simResult.currentVersion} &rarr; Latest:{" "}
                      {simResult.latestVersion ? `v${simResult.latestVersion}` : "None"}
                    </Text>
                  </Group>

                  {simResult.updateAvailable && simResult.version && (
                    <Box mt="xs">
                      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                        Release Details
                      </Text>
                      <SimpleGrid cols={2} mt={4}>
                        <Text size="xs">
                          <strong>File:</strong> {simResult.version.fileName || "N/A"}
                        </Text>
                        <Text size="xs">
                          <strong>Size:</strong> {formatBytes(simResult.version.fileSize)}
                        </Text>
                        <Text size="xs">
                          <strong>Channel:</strong> {simResult.version.channel}
                        </Text>
                        <Text size="xs">
                          <strong>Download:</strong>{" "}
                          <a href={simResult.downloadUrl || "#"} target="_blank" rel="noreferrer">
                            {simResult.downloadUrl}
                          </a>
                        </Text>
                      </SimpleGrid>

                      {simResult.releaseNotes && (
                        <Box mt="xs">
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                            Release Notes
                          </Text>
                          <Paper p="xs" radius="sm" mt={4} style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                            <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                              {simResult.releaseNotes}
                            </Text>
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  )}

                  <Divider my="xs" />
                  <Text size="xs" fw={600} c="dimmed" mb={4}>
                    RAW JSON RESPONSE:
                  </Text>
                  <Code block style={{ fontSize: "11px" }}>
                    {JSON.stringify(simResult, null, 2)}
                  </Code>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* SDK Code Tab */}
          <Tabs.Panel value="sdk">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Use the official <Code>alsabase</Code> npm package to integrate auto-updates:
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={copiedCode ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  onClick={() => {
                    const code = `import AlsaBase from "alsabase";

const client = new AlsaBase("${window.location.origin}");

// 1. Check for application update
const update = await client.checkAppUpdate("${selectedApp?.slug}", {
  currentVersion: "1.0.0",
  platform: "windows"
});

if (update.hasUpdate) {
  console.log("New version available:", update.latestVersion);
  
  if (update.isAutomatic) {
    // Automatic update: install immediately without prompting user
    console.log("Automatic / mandatory update - applying now...");
  } else {
    // Optional update: prompt user with update.releaseNotes
    console.log("Optional update:", update.releaseNotes);
  }

  // Direct download binary URL
  console.log("Download binary:", update.version?.downloadUrl);
}`;
                    copyToClipboard(code, "SDK code");
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? "Copied" : "Copy Code"}
                </Button>
              </Group>

              <Code block style={{ fontSize: "12px", padding: 14 }}>
                {`import AlsaBase from "alsabase";

const client = new AlsaBase("${window.location.origin}");

// 1. Check for application update
const update = await client.checkAppUpdate("${selectedApp?.slug}", {
  currentVersion: "1.0.0",
  platform: "windows" // windows, macos, linux, android, ios
});

if (update.hasUpdate) {
  console.log("New version available:", update.latestVersion);
  
  if (update.isAutomatic) {
    // Automatic update: install immediately without asking user
    console.log("Automatic update - downloading immediately...");
  } else {
    // Optional update: prompt user
    console.log("Optional update:", update.releaseNotes);
  }

  console.log("Download URL:", update.version?.downloadUrl);
}

// 2. Or list all eligible versions for the authenticated user
const versions = await client.apps.getVersions("${selectedApp?.slug}");`}
              </Code>
            </Stack>
          </Tabs.Panel>

          {/* REST API Endpoints Tab */}
          <Tabs.Panel value="api">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                Direct HTTP API endpoints for version checks and downloads:
              </Text>

              <Paper p="xs" radius="md" style={{ backgroundColor: "var(--color-bg-card)" }}>
                <Text size="xs" fw={700} c="teal">
                  GET /api/apps/{selectedApp?.slug}/check-update
                </Text>
                <Text size="11px" c="dimmed" mt={2}>
                  Query params: <Code>?currentVersion=1.0.0&platform=windows&channel=beta</Code>
                </Text>
              </Paper>

              <Paper p="xs" radius="md" style={{ backgroundColor: "var(--color-bg-card)" }}>
                <Text size="xs" fw={700} c="teal">
                  GET /api/apps/{selectedApp?.slug}/versions
                </Text>
                <Text size="11px" c="dimmed" mt={2}>
                  List all eligible versions matching requesting user&apos;s column access rules.
                </Text>
              </Paper>

              <Paper p="xs" radius="md" style={{ backgroundColor: "var(--color-bg-card)" }}>
                <Text size="xs" fw={700} c="teal">
                  GET /api/apps/{selectedApp?.slug}/versions/:version/download
                </Text>
                <Text size="11px" c="dimmed" mt={2}>
                  Direct binary installer / archive download stream.
                </Text>
              </Paper>

              <Paper p="xs" radius="md" style={{ backgroundColor: "var(--color-bg-card)" }}>
                <Text size="xs" fw={700} c="orange">
                  POST /api/apps/manage/versions (Superuser Only)
                </Text>
                <Text size="11px" c="dimmed" mt={2}>
                  Upload and publish new app version with binary payload in base64.
                </Text>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Box>
  );
};
