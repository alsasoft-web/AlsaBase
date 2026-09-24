import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  Badge,
  Button,
  Group,
  Stack,
  ActionIcon,
  Modal,
  TextInput,
  PasswordInput,
  Avatar,
  NumberInput,
  Switch,
  Select,
  Textarea,
  Paper,
  Card,
  Table,
  Tooltip,
  useComputedColorScheme,
  Divider,
  SegmentedControl,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconSettings,
  IconNetwork,
  IconShieldLock,
  IconUserShield,
  IconEdit,
  IconGauge,
  IconMail,
  IconDatabase,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconRefresh,
  IconDownload,
  IconUpload,
  IconRotateClockwise,
  IconSend,
  IconServer,
  IconLayoutSidebar,
  IconLayoutNavbar,
} from "@tabler/icons-react";
import { api, AppSettings, BackupItem } from "../../api/client";

export const SettingsView: React.FC = () => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("alsabase_settings_tab") || "general";
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem("alsabase_settings_tab", tab);
  };

  const [navType, setNavType] = useState<"sidebar" | "header">(() => {
    return (
      (localStorage.getItem("alsabase_nav_type") as "sidebar" | "header") ||
      "sidebar"
    );
  });
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("alsabase_nav_collapsed") === "true";
  });

  const handleNavTypeChange = (type: string) => {
    const newType = type as "sidebar" | "header";
    setNavType(newType);
    localStorage.setItem("alsabase_nav_type", newType);
    window.dispatchEvent(
      new CustomEvent("alsabase_nav_change", {
        detail: { navType: newType, navCollapsed },
      }),
    );
    notifications.show({
      title: "Navigation Layout Updated",
      message: `Switched to ${newType === "header" ? "Header Navigation" : "Sidebar Navigation"}.`,
      color: "teal",
    });
  };

  const handleNavCollapsedChange = (collapsed: boolean) => {
    setNavCollapsed(collapsed);
    localStorage.setItem("alsabase_nav_collapsed", String(collapsed));
    window.dispatchEvent(
      new CustomEvent("alsabase_nav_change", {
        detail: { navType, navCollapsed: collapsed },
      }),
    );
  };

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Client IP and headers info
  const [clientIpInfo, setClientIpInfo] = useState<{
    resolvedIp: string;
    rawIp: string;
    detectedHeaders: Record<string, string>;
    detectedProxyHeader: string;
  } | null>(null);

  // Backups state
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [createBackupModalOpen, setCreateBackupModalOpen] = useState(false);
  const [backupCustomName, setBackupCustomName] = useState("");
  const [backupIncludePublic, setBackupIncludePublic] = useState(true);
  const [backupIncludeHooks, setBackupIncludeHooks] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const sqliteInputRef = useRef<HTMLInputElement>(null);

  // Email Test Modal State
  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Superusers state
  const [superusers, setSuperusers] = useState<any[]>([]);
  const [loadingSuperusers, setLoadingSuperusers] = useState(false);
  const [createSuperuserModalOpen, setCreateSuperuserModalOpen] = useState(false);
  const [newSuperuserEmail, setNewSuperuserEmail] = useState("");
  const [newSuperuserPassword, setNewSuperuserPassword] = useState("");
  const [newSuperuserPasswordConfirm, setNewSuperuserPasswordConfirm] = useState("");
  const [creatingSuperuser, setCreatingSuperuser] = useState(false);
  const [editingSuperuser, setEditingSuperuser] = useState<any | null>(null);
  const [editSuperuserEmail, setEditSuperuserEmail] = useState("");
  const [editSuperuserPassword, setEditSuperuserPassword] = useState("");
  const [updatingSuperuser, setUpdatingSuperuser] = useState(false);

  // Active email template selection
  const [activeEmailTemplate, setActiveEmailTemplate] = useState<
    "passwordReset" | "verification" | "confirmEmailChange" | "otp"
  >("passwordReset");

  // Load Superusers list
  const loadSuperusersList = async () => {
    setLoadingSuperusers(true);
    try {
      const res = await api.getSuperusers();
      setSuperusers(res.items || []);
    } catch {
      setSuperusers([]);
    } finally {
      setLoadingSuperusers(false);
    }
  };

  const handleCreateSuperuser = async () => {
    if (!newSuperuserEmail.trim()) {
      notifications.show({ title: "Email required", message: "Please enter a valid email address.", color: "red" });
      return;
    }
    if (!newSuperuserPassword || newSuperuserPassword.length < 8) {
      notifications.show({ title: "Invalid password", message: "Password must be at least 8 characters long.", color: "red" });
      return;
    }
    if (newSuperuserPassword !== newSuperuserPasswordConfirm) {
      notifications.show({ title: "Passwords mismatch", message: "Passwords do not match.", color: "red" });
      return;
    }

    setCreatingSuperuser(true);
    try {
      await api.createSuperuser({ email: newSuperuserEmail.trim(), password: newSuperuserPassword });
      setCreateSuperuserModalOpen(false);
      setNewSuperuserEmail("");
      setNewSuperuserPassword("");
      setNewSuperuserPasswordConfirm("");
      loadSuperusersList();
      notifications.show({
        title: "Superuser Created",
        message: "New administrator account created successfully.",
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({ title: "Creation Failed", message: err.message, color: "red" });
    } finally {
      setCreatingSuperuser(false);
    }
  };

  const handleUpdateSuperuser = async () => {
    if (!editingSuperuser) return;
    if (!editSuperuserEmail.trim()) {
      notifications.show({ title: "Email required", message: "Please enter an email address.", color: "red" });
      return;
    }
    if (editSuperuserPassword && editSuperuserPassword.length < 8) {
      notifications.show({ title: "Invalid password", message: "Password must be at least 8 characters long.", color: "red" });
      return;
    }

    setUpdatingSuperuser(true);
    try {
      await api.updateSuperuser(editingSuperuser.id, {
        email: editSuperuserEmail.trim(),
        password: editSuperuserPassword.trim() || undefined,
      });
      setEditingSuperuser(null);
      setEditSuperuserEmail("");
      setEditSuperuserPassword("");
      loadSuperusersList();
      notifications.show({
        title: "Superuser Updated",
        message: "Administrator account details updated successfully.",
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({ title: "Update Failed", message: err.message, color: "red" });
    } finally {
      setUpdatingSuperuser(false);
    }
  };

  const handleDeleteSuperuser = (id: string, email: string) => {
    if (superusers.length <= 1) {
      notifications.show({
        title: "Cannot Delete",
        message: "Cannot delete the only remaining superuser account.",
        color: "red",
      });
      return;
    }

    modals.openConfirmModal({
      title: "Delete Administrator",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete superuser <strong>{email}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteSuperuser(id);
          loadSuperusersList();
          notifications.show({
            title: "Superuser Deleted",
            message: `Administrator ${email} deleted successfully.`,
            color: "teal",
          });
        } catch (err: any) {
          notifications.show({ title: "Delete Failed", message: err.message, color: "red" });
        }
      },
    });
  };

  // Load Settings and IP Info
  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      notifications.show({
        title: "Failed to Load Settings",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientIpInfo = async () => {
    try {
      const info = await api.getClientIpInfo();
      setClientIpInfo(info);
    } catch {
      // ignore
    }
  };

  const loadBackupsList = async () => {
    setLoadingBackups(true);
    try {
      const data = await api.listBackups();
      setBackups(
        Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? (data as any)
            : [],
      );
    } catch (err: any) {
      setBackups([]);
      notifications.show({
        title: "Failed to Load Backups",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadClientIpInfo();
    loadBackupsList();
    loadSuperusersList();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      notifications.show({
        title: "Settings Saved",
        message: "All configurations have been successfully updated.",
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  // Create Backup
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.createBackup({
        name: backupCustomName.trim() || undefined,
        includePublic: backupIncludePublic,
        includeHooks: backupIncludeHooks,
      });
      setCreateBackupModalOpen(false);
      setBackupCustomName("");
      notifications.show({
        title: "Backup Created",
        message: "Database and selected folders safely archived.",
        color: "teal",
      });
      loadBackupsList();
    } catch (err: any) {
      notifications.show({
        title: "Backup Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  // Restore Backup
  const handleRestoreBackup = (filename: string) => {
    modals.openConfirmModal({
      title: "Restore Database from Backup",
      centered: true,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Are you sure you want to restore <b>{filename}</b>?
          </Text>
          <Text size="xs" c="dimmed">
            This will replace the current database with the backup snapshot. A
            safety copy of your current database will be preserved in .trash.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Restore Now", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const res = await api.restoreBackup(filename);
          notifications.show({
            title: "Backup Restored",
            message: res.message,
            color: "teal",
          });
          loadSettings();
        } catch (err: any) {
          notifications.show({
            title: "Restore Failed",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  // Delete Backup
  const handleDeleteBackup = (filename: string) => {
    modals.openConfirmModal({
      title: "Delete Backup",
      centered: true,
      children: (
        <Text size="sm">
          Move backup archive <b>{filename}</b> to .trash?
        </Text>
      ),
      labels: { confirm: "Move to Trash", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteBackup(filename);
          notifications.show({
            title: "Backup Deleted",
            message: `Moved ${filename} to .trash.`,
            color: "teal",
          });
          loadBackupsList();
        } catch (err: any) {
          notifications.show({
            title: "Delete Failed",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  // Upload Backup
  const handleBackupFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      try {
        await api.uploadBackup(file.name, base64, true);
        notifications.show({
          title: "Backup Uploaded",
          message: `Uploaded ${file.name} to backups repository.`,
          color: "teal",
        });
        loadBackupsList();
      } catch (err: any) {
        notifications.show({
          title: "Upload Failed",
          message: err.message,
          color: "red",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    if (backupFileInputRef.current) backupFileInputRef.current.value = "";
  };

  // Import raw SQLite file
  const handleSqliteImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    modals.openConfirmModal({
      title: "Import SQLite Database",
      centered: true,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Replace the live database with <b>{file.name}</b>?
          </Text>
          <Text size="xs" c="dimmed">
            The server will restart after the import. All current data will be
            overwritten. Make sure you have a backup first.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Import & Restart", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        const reader = new FileReader();
        reader.onload = async () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          try {
            await api.importSqlite(base64);
            notifications.show({
              title: "Import Successful",
              message: "Database imported. Server is restarting — refresh in a few seconds.",
              color: "teal",
              autoClose: 8000,
            });
          } catch (err: any) {
            notifications.show({
              title: "Import Failed",
              message: err.message,
              color: "red",
            });
          }
        };
        reader.readAsArrayBuffer(file);
        if (sqliteInputRef.current) sqliteInputRef.current.value = "";
      },
      onCancel: () => {
        if (sqliteInputRef.current) sqliteInputRef.current.value = "";
      },
    });
  };

  // Send Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailRecipient.trim()) return;
    setSendingTestEmail(true);
    try {
      const res = await api.sendTestEmail(testEmailRecipient.trim());
      notifications.show({
        title: "Test Email Sent",
        message: res.message,
        color: "teal",
      });
      setTestEmailModalOpen(false);
      setTestEmailRecipient("");
    } catch (err: any) {
      notifications.show({
        title: "Test Email Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg-base)",
        overflow: "hidden",
      }}
    >
      {/* 1. TOP SETTINGS HEADER BAR */}
      <div
        style={{
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-card)",
          userSelect: "none",
          minHeight: 46,
        }}
      >
        {/* Left: Top Navigation Tabs */}
        <Group gap={6}>
          <Button
            variant={activeTab === "general" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconSettings size={14} />}
            onClick={() => handleTabChange("general")}
            style={{
              backgroundColor:
                activeTab === "general"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "general"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "general"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            General &amp; Batch API
          </Button>

          <Button
            variant={activeTab === "proxy" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconNetwork size={14} />}
            onClick={() => handleTabChange("proxy")}
            style={{
              backgroundColor:
                activeTab === "proxy" ? "var(--color-neon-dim)" : "transparent",
              color:
                activeTab === "proxy"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "proxy"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            IP Proxy Headers
          </Button>

          <Button
            variant={activeTab === "ratelimit" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconGauge size={14} />}
            onClick={() => handleTabChange("ratelimit")}
            style={{
              backgroundColor:
                activeTab === "ratelimit"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "ratelimit"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "ratelimit"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Rate Limiting
          </Button>

          <Button
            variant={activeTab === "email" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconMail size={14} />}
            onClick={() => handleTabChange("email")}
            style={{
              backgroundColor:
                activeTab === "email" ? "var(--color-neon-dim)" : "transparent",
              color:
                activeTab === "email"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "email"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Email &amp; Templates
          </Button>

          <Button
            variant={activeTab === "admins" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconUserShield size={14} />}
            onClick={() => handleTabChange("admins")}
            style={{
              backgroundColor:
                activeTab === "admins"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "admins"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "admins"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Administrators ({superusers.length})
          </Button>

          <Button
            variant={activeTab === "backups" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconDatabase size={14} />}
            onClick={() => handleTabChange("backups")}
            style={{
              backgroundColor:
                activeTab === "backups"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "backups"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "backups"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Backups ({(backups || []).length})
          </Button>
        </Group>

        {/* Right: Actions */}
        <Group gap="xs">
          <Button
            size="xs"
            leftSection={<IconDeviceFloppy size={13} />}
            loading={saving}
            onClick={handleSaveSettings}
            style={{
              backgroundColor: "var(--color-neon-primary)",
              color: isDark ? "#052e16" : "#ffffff",
              fontWeight: 700,
              height: 28,
              fontSize: "11px",
              boxShadow: "var(--color-accent-glow)",
            }}
          >
            Save Changes
          </Button>

          <Tooltip label="Refresh Settings" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="default"
              loading={loading || loadingSuperusers}
              onClick={() => {
                loadSettings();
                loadClientIpInfo();
                loadBackupsList();
                loadSuperusersList();
              }}
              style={{ height: 28, width: 28 }}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* 2. MAIN SCROLLABLE CONTENT BODY */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 32px",
          maxWidth: 1080,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {settings && (
          <Stack gap="xl">
            {/* TAB 1: GENERAL & BATCH WEB API */}
            {activeTab === "general" && (
              <>
                {/* Navigation & Layout Appearance Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <IconLayoutSidebar
                        size={18}
                        color="var(--color-neon-primary)"
                      />
                      <Text fw={700} size="md">
                        Navigation &amp; Layout
                      </Text>
                    </Group>
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        color: "var(--color-neon-primary)",
                      }}
                    >
                      {navType === "header"
                        ? "Header Mode"
                        : navCollapsed
                          ? "Collapsed Sidebar"
                          : "Expanded Sidebar"}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed" mb="md">
                    Customize how you navigate through AlsaBase. Choose between
                    a vertical sidebar with collapse support or a top horizontal
                    header bar.
                  </Text>

                  <Stack gap="md">
                    <div>
                      <Text size="xs" fw={600} mb={6}>
                        Navigation Position
                      </Text>
                      <SegmentedControl
                        value={navType}
                        w={400}
                        onChange={handleNavTypeChange}
                        data={[
                          {
                            value: "sidebar",
                            label: (
                              <Group gap="xs" justify="center" px="xs" py={2}>
                                <IconLayoutSidebar size={15} />
                                <span>Sidebar Navigation</span>
                              </Group>
                            ),
                          },
                          {
                            value: "header",
                            label: (
                              <Group gap="xs" justify="center" px="xs" py={2}>
                                <IconLayoutNavbar size={15} />
                                <span>Header Navigation</span>
                              </Group>
                            ),
                          },
                        ]}
                      />
                    </div>

                    {navType === "sidebar" && (
                      <Paper
                        p="sm"
                        withBorder
                        style={{
                          backgroundColor: "var(--color-bg-well)",
                          borderColor: "var(--color-border)",
                          borderRadius: 8,
                        }}
                      >
                        <Group justify="space-between" align="center">
                          <div>
                            <Text size="xs" fw={600}>
                              Collapse Sidebar
                            </Text>
                            <Text size="11px" c="dimmed">
                              Shrink the sidebar into a slim 68px icon-only rail
                              to maximize workspace table view.
                            </Text>
                          </div>
                          <Switch
                            checked={navCollapsed}
                            onChange={(e) =>
                              handleNavCollapsedChange(e.currentTarget.checked)
                            }
                            color="neonGreen"
                            size="sm"
                          />
                        </Group>
                      </Paper>
                    )}
                  </Stack>
                </Card>

                {/* Batch Web API Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="sm">
                    <Group gap="xs">
                      <IconServer size={18} color="var(--color-neon-primary)" />
                      <Text fw={700} size="md">
                        Batch Web API
                      </Text>
                    </Group>
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: settings.batch.enabled
                          ? "var(--color-neon-dim)"
                          : "rgba(255,255,255,0.06)",
                        color: settings.batch.enabled
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-dimmed)",
                      }}
                    >
                      {settings.batch.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed" mb="md">
                    Allow clients to bundle multiple HTTP requests into a single
                    transactional batch payload at <code>POST /api/batch</code>.
                  </Text>

                  <Stack gap="md">
                    <Switch
                      label="Enable Batch Web API"
                      checked={settings.batch.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          batch: {
                            ...settings.batch,
                            enabled: e.currentTarget.checked,
                          },
                        })
                      }
                    />

                    <Group grow>
                      <NumberInput
                        label="Max requests in a batch"
                        description="Maximum number of sub-requests allowed per batch call"
                        value={settings.batch.maxRequests}
                        min={1}
                        max={500}
                        onChange={(val) =>
                          setSettings({
                            ...settings,
                            batch: {
                              ...settings.batch,
                              maxRequests: Number(val) || 50,
                            },
                          })
                        }
                      />
                      <NumberInput
                        label="Max processing timeout (seconds)"
                        description="Timeout limit before canceling long batch requests"
                        value={settings.batch.timeout}
                        min={5}
                        max={300}
                        onChange={(val) =>
                          setSettings({
                            ...settings,
                            batch: {
                              ...settings.batch,
                              timeout: Number(val) || 30,
                            },
                          })
                        }
                      />
                      <NumberInput
                        label="Max body size (MB)"
                        description="Payload body limit for batch JSON requests"
                        value={settings.batch.maxBodySize}
                        min={1}
                        max={100}
                        onChange={(val) =>
                          setSettings({
                            ...settings,
                            batch: {
                              ...settings.batch,
                              maxBodySize: Number(val) || 15,
                            },
                          })
                        }
                      />
                    </Group>
                  </Stack>
                </Card>

                {/* Superuser IPs Card (Matching Image 3) */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <IconShieldLock
                        size={18}
                        color="var(--color-neon-primary)"
                      />
                      <Text fw={700} size="md">
                        Superuser IPs
                      </Text>
                    </Group>
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: settings.superuserIps.enabled
                          ? "var(--color-neon-dim)"
                          : "rgba(255,255,255,0.06)",
                        color: settings.superuserIps.enabled
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-dimmed)",
                      }}
                    >
                      {settings.superuserIps.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </Group>

                  <Text
                    size="xs"
                    c="dimmed"
                    mb="md"
                    style={{ lineHeight: 1.6 }}
                  >
                    A comma separated list of superusers allowed IPs and
                    subnets.
                    <br />
                    Enabling this option greatly helps hardening the security of
                    your application because even if someone manages to get
                    their hands on a superuser auth token they will not be able
                    to use it.
                  </Text>

                  <Stack gap="md">
                    <Switch
                      label="Enable Superuser IP Whitelisting"
                      checked={settings.superuserIps.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          superuserIps: {
                            ...settings.superuserIps,
                            enabled: e.currentTarget.checked,
                          },
                        })
                      }
                    />

                    <TextInput
                      label="Superuser IPs and subnets"
                      placeholder="Leave empty for no restriction"
                      value={settings.superuserIps.allowedIps.join(", ")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const list = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setSettings({
                          ...settings,
                          superuserIps: {
                            ...settings.superuserIps,
                            allowedIps: list,
                          },
                        });
                      }}
                    />

                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        Comma separated list of IPs and subnets such as:
                      </Text>
                      {clientIpInfo && (
                        <Badge
                          size="xs"
                          variant="outline"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (
                              !settings.superuserIps.allowedIps.includes(
                                clientIpInfo.resolvedIp,
                              )
                            ) {
                              setSettings({
                                ...settings,
                                superuserIps: {
                                  ...settings.superuserIps,
                                  allowedIps: [
                                    ...settings.superuserIps.allowedIps,
                                    clientIpInfo.resolvedIp,
                                  ],
                                },
                              });
                            }
                          }}
                        >
                          {clientIpInfo.resolvedIp} (you)
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Card>
              </>
            )}

            {/* TAB 2: IP PROXY HEADERS (Matching Image 1) */}
            {activeTab === "proxy" && (
              <Card
                withBorder
                padding="lg"
                radius="md"
                style={{ backgroundColor: "var(--color-bg-card)" }}
              >
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <IconNetwork size={18} color="var(--color-neon-primary)" />
                    <Text fw={700} size="md">
                      IP proxy headers
                    </Text>
                  </Group>
                  <Badge
                    size="sm"
                    variant="filled"
                    style={{
                      backgroundColor: settings.ipProxy.enabled
                        ? "var(--color-neon-dim)"
                        : "rgba(255,255,255,0.06)",
                      color: settings.ipProxy.enabled
                        ? "var(--color-neon-primary)"
                        : "var(--color-text-dimmed)",
                    }}
                  >
                    {settings.ipProxy.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>

                <Text size="xs" c="dimmed" mb="md">
                  Below you should see your real IP. If not - configure the
                  correct proxy header for your environment.
                </Text>

                {/* Resolved IP Box (Matching screenshot blue box) */}
                <Paper
                  p="md"
                  radius="md"
                  mb="md"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(30, 58, 138, 0.25)"
                      : "#eff6ff",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                  }}
                >
                  <Text size="sm" fw={600} style={{ color: "#38bdf8" }}>
                    Resolved user IP:{" "}
                    <b>{clientIpInfo?.resolvedIp || "127.0.0.1"}</b>
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Detected proxy header:{" "}
                    <b>{clientIpInfo?.detectedProxyHeader || "N/A"}</b>
                  </Text>
                </Paper>

                <Text size="xs" c="dimmed" mb="md" style={{ lineHeight: 1.6 }}>
                  When AlsaBase is deployed on platforms or accessible through
                  proxies such as NGINX, Cloudflare, or Caddy, requests from
                  different users will originate from the same IP address (the
                  IP of the proxy connecting to your app).
                  <br />
                  In this case to retrieve the actual user IP (used for rate
                  limiting, logging, etc.) you need to properly configure your
                  proxy and list below the trusted headers that AlsaBase could
                  use to extract the user IP.
                  <br />
                  <br />
                  <b>
                    When using such proxy, to avoid spoofing it is recommended
                    to:
                  </b>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li>
                      use headers that are controlled only by the proxy and
                      cannot be manually set by the users
                    </li>
                    <li>
                      make sure that the AlsaBase server can be accessed ONLY
                      through the proxy
                    </li>
                  </ul>
                  You can clear the headers field if AlsaBase is not deployed
                  behind a proxy.
                </Text>

                <Stack gap="md">
                  <Switch
                    label="Enable IP Proxy Resolution"
                    checked={settings.ipProxy.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ipProxy: {
                          ...settings.ipProxy,
                          enabled: e.currentTarget.checked,
                        },
                      })
                    }
                  />

                  <Group grow align="flex-start">
                    <TextInput
                      label="Trusted IP proxy headers"
                      placeholder="Leave empty to disable"
                      value={settings.ipProxy.headers.join(", ")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const list = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setSettings({
                          ...settings,
                          ipProxy: { ...settings.ipProxy, headers: list },
                        });
                      }}
                      description="Comma separated list of headers such as: X-Forwarded-For, Fly-Client-IP, CF-Connecting-IP"
                    />

                    <Select
                      label="IP priority"
                      data={[
                        { value: "rightmost", label: "Use rightmost IP" },
                        { value: "leftmost", label: "Use leftmost IP" },
                      ]}
                      value={settings.ipProxy.priority}
                      onChange={(val) =>
                        setSettings({
                          ...settings,
                          ipProxy: {
                            ...settings.ipProxy,
                            priority:
                              (val as "rightmost" | "leftmost") || "rightmost",
                          },
                        })
                      }
                    />
                  </Group>

                  {/* Suggestion Chips */}
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      Quick Add Header:
                    </Text>
                    {[
                      "X-Forwarded-For",
                      "Fly-Client-IP",
                      "CF-Connecting-IP",
                      "X-Real-IP",
                    ].map((h) => (
                      <Badge
                        key={h}
                        size="xs"
                        variant="outline"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          if (!settings.ipProxy.headers.includes(h)) {
                            setSettings({
                              ...settings,
                              ipProxy: {
                                ...settings.ipProxy,
                                headers: [...settings.ipProxy.headers, h],
                              },
                            });
                          }
                        }}
                      >
                        + {h}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Card>
            )}

            {/* TAB 3: RATE LIMITING (Matching Image 2) */}
            {activeTab === "ratelimit" && (
              <Card
                withBorder
                padding="lg"
                radius="md"
                style={{ backgroundColor: "var(--color-bg-card)" }}
              >
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <IconGauge size={18} color="var(--color-neon-primary)" />
                    <Text fw={700} size="md">
                      Rate limiting
                    </Text>
                  </Group>
                  <Badge
                    size="sm"
                    variant="filled"
                    style={{
                      backgroundColor: settings.rateLimit.enabled
                        ? "var(--color-neon-dim)"
                        : "rgba(255,255,255,0.06)",
                      color: settings.rateLimit.enabled
                        ? "var(--color-neon-primary)"
                        : "var(--color-text-dimmed)",
                    }}
                  >
                    {settings.rateLimit.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>

                <Group justify="space-between" mb="md">
                  <Switch
                    label="Enable Rate Limiting"
                    checked={settings.rateLimit.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        rateLimit: {
                          ...settings.rateLimit,
                          enabled: e.currentTarget.checked,
                        },
                      })
                    }
                  />
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    Enforces sliding request rate limit counters per client IP
                  </Text>
                </Group>

                {/* Rate limit rules table (Matching screenshot 2) */}
                <Table highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rate limit label</Table.Th>
                      <Table.Th style={{ width: 140 }}>
                        Max requests (per IP)
                      </Table.Th>
                      <Table.Th style={{ width: 140 }}>
                        Interval (in seconds)
                      </Table.Th>
                      <Table.Th style={{ width: 140 }}>Targeted users</Table.Th>
                      <Table.Th style={{ width: 50 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {settings.rateLimit.rules.map((rule, idx) => (
                      <Table.Tr key={rule.id || idx}>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            value={rule.label}
                            onChange={(e) => {
                              const next = [...settings.rateLimit.rules];
                              next[idx].label = e.target.value;
                              setSettings({
                                ...settings,
                                rateLimit: {
                                  ...settings.rateLimit,
                                  rules: next,
                                },
                              });
                            }}
                            styles={{
                              input: { fontFamily: "var(--font-mono)" },
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            value={rule.maxRequests}
                            min={1}
                            onChange={(val) => {
                              const next = [...settings.rateLimit.rules];
                              next[idx].maxRequests = Number(val) || 1;
                              setSettings({
                                ...settings,
                                rateLimit: {
                                  ...settings.rateLimit,
                                  rules: next,
                                },
                              });
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            value={rule.interval}
                            min={1}
                            onChange={(val) => {
                              const next = [...settings.rateLimit.rules];
                              next[idx].interval = Number(val) || 1;
                              setSettings({
                                ...settings,
                                rateLimit: {
                                  ...settings.rateLimit,
                                  rules: next,
                                },
                              });
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            data={[
                              { value: "all", label: "All" },
                              { value: "guests", label: "Guests only" },
                              { value: "auth", label: "Auth only" },
                            ]}
                            value={rule.target}
                            onChange={(val) => {
                              const next = [...settings.rateLimit.rules];
                              next[idx].target =
                                (val as "all" | "guests" | "auth") || "all";
                              setSettings({
                                ...settings,
                                rateLimit: {
                                  ...settings.rateLimit,
                                  rules: next,
                                },
                              });
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={() => {
                              const next = settings.rateLimit.rules.filter(
                                (_, i) => i !== idx,
                              );
                              setSettings({
                                ...settings,
                                rateLimit: {
                                  ...settings.rateLimit,
                                  rules: next,
                                },
                              });
                            }}
                          >
                            <IconTrash size={13} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {/* Add Rule Button */}
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  mt="sm"
                  onClick={() => {
                    const newRule = {
                      id: String(Date.now()),
                      label: "/api/",
                      maxRequests: 100,
                      interval: 60,
                      target: "all" as const,
                    };
                    setSettings({
                      ...settings,
                      rateLimit: {
                        ...settings.rateLimit,
                        rules: [...settings.rateLimit.rules, newRule],
                      },
                    });
                  }}
                >
                  Add rate limit rule
                </Button>
              </Card>
            )}

            {/* TAB 4: EMAIL SETTINGS & TEMPLATES */}
            {activeTab === "email" && (
              <Stack gap="lg">
                {/* SMTP Configuration Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <IconMail size={18} color="var(--color-neon-primary)" />
                      <Text fw={700} size="md">
                        SMTP Mail Server
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<IconSend size={13} />}
                        onClick={() => setTestEmailModalOpen(true)}
                      >
                        Send Test Email
                      </Button>
                      <Badge
                        size="sm"
                        variant="filled"
                        style={{
                          backgroundColor: settings.email.enabled
                            ? "var(--color-neon-dim)"
                            : "rgba(255,255,255,0.06)",
                          color: settings.email.enabled
                            ? "var(--color-neon-primary)"
                            : "var(--color-text-dimmed)",
                        }}
                      >
                        {settings.email.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </Group>
                  </Group>

                  <Text size="xs" c="dimmed" mb="md">
                    Configure your outgoing mail server for transactional user
                    emails (password resets, verifications, OTPs).
                  </Text>

                  <Stack gap="md">
                    <Switch
                      label="Enable Custom SMTP Server"
                      checked={settings.email.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: {
                            ...settings.email,
                            enabled: e.currentTarget.checked,
                          },
                        })
                      }
                    />

                    <Group grow>
                      <TextInput
                        label="SMTP Host"
                        placeholder="smtp.example.com"
                        value={settings.email.smtp.host}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                host: e.target.value,
                              },
                            },
                          })
                        }
                      />
                      <NumberInput
                        label="SMTP Port"
                        placeholder="587"
                        value={settings.email.smtp.port}
                        onChange={(val) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                port: Number(val) || 587,
                              },
                            },
                          })
                        }
                      />
                    </Group>

                    <Group grow>
                      <TextInput
                        label="SMTP Username"
                        placeholder="user@example.com"
                        value={settings.email.smtp.username}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                username: e.target.value,
                              },
                            },
                          })
                        }
                      />
                      <TextInput
                        label="SMTP Password"
                        type="password"
                        placeholder="••••••••"
                        value={settings.email.smtp.password}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                password: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Group>

                    <Group grow>
                      <TextInput
                        label="Sender Name"
                        placeholder="AlsaBase Support"
                        value={settings.email.smtp.fromName}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                fromName: e.target.value,
                              },
                            },
                          })
                        }
                      />
                      <TextInput
                        label="Sender Address"
                        placeholder="noreply@example.com"
                        value={settings.email.smtp.fromAddress}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              smtp: {
                                ...settings.email.smtp,
                                fromAddress: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Group>

                    <Switch
                      label="Use TLS / SSL Encryption"
                      checked={settings.email.smtp.tls}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: {
                            ...settings.email,
                            smtp: {
                              ...settings.email.smtp,
                              tls: e.currentTarget.checked,
                            },
                          },
                        })
                      }
                    />
                  </Stack>
                </Card>

                {/* Email Templates Editor Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Text fw={700} size="md" mb="xs">
                    Email Templates
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Customize the subject and HTML body for automatic system
                    emails. Use <code>{`{ACTION_URL}`}</code>,{" "}
                    <code>{`{OTP}`}</code>, and <code>{`{APP_NAME}`}</code> as
                    placeholders.
                  </Text>

                  {/* Template selector pills */}
                  <Group gap="xs" mb="md">
                    {[
                      { key: "passwordReset", label: "Password Reset" },
                      { key: "verification", label: "Email Verification" },
                      {
                        key: "confirmEmailChange",
                        label: "Confirm Email Change",
                      },
                      { key: "otp", label: "Login OTP Code" },
                    ].map((tpl) => (
                      <Button
                        key={tpl.key}
                        size="xs"
                        variant={
                          activeEmailTemplate === tpl.key ? "filled" : "default"
                        }
                        onClick={() => setActiveEmailTemplate(tpl.key as any)}
                        style={{
                          backgroundColor:
                            activeEmailTemplate === tpl.key
                              ? "var(--color-neon-dim)"
                              : undefined,
                          color:
                            activeEmailTemplate === tpl.key
                              ? "var(--color-neon-primary)"
                              : undefined,
                          borderColor:
                            activeEmailTemplate === tpl.key
                              ? "var(--color-border-glow)"
                              : undefined,
                        }}
                      >
                        {tpl.label}
                      </Button>
                    ))}
                  </Group>

                  <Stack gap="md">
                    <TextInput
                      label="Email Subject"
                      value={
                        settings.email.templates[activeEmailTemplate]
                          ?.subject || ""
                      }
                      onChange={(e) => {
                        const next = { ...settings.email.templates };
                        next[activeEmailTemplate].subject = e.target.value;
                        setSettings({
                          ...settings,
                          email: { ...settings.email, templates: next },
                        });
                      }}
                    />

                    <Textarea
                      label="Email HTML Body"
                      rows={8}
                      value={
                        settings.email.templates[activeEmailTemplate]?.body ||
                        ""
                      }
                      onChange={(e) => {
                        const next = { ...settings.email.templates };
                        next[activeEmailTemplate].body = e.target.value;
                        setSettings({
                          ...settings,
                          email: { ...settings.email, templates: next },
                        });
                      }}
                      styles={{
                        input: {
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          lineHeight: 1.5,
                        },
                      }}
                    />
                  </Stack>
                </Card>
              </Stack>
            )}

            {/* TAB 5: BACKUPS ENGINE */}
            {activeTab === "backups" && (
              <Stack gap="lg">
                {/* Auto-Backup Settings Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <IconRotateClockwise
                        size={18}
                        color="var(--color-neon-primary)"
                      />
                      <Text fw={700} size="md">
                        Automated Backups Scheduler
                      </Text>
                    </Group>
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: settings.backups.autoBackupEnabled
                          ? "var(--color-neon-dim)"
                          : "rgba(255,255,255,0.06)",
                        color: settings.backups.autoBackupEnabled
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-dimmed)",
                      }}
                    >
                      {settings.backups.autoBackupEnabled
                        ? "Active"
                        : "Disabled"}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed" mb="md">
                    Schedule periodic background backups of your database,
                    uploads, and directories with automated retention pruning.
                  </Text>

                  <Stack gap="md">
                    <Switch
                      label="Enable Automated Scheduled Backups"
                      checked={settings.backups.autoBackupEnabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          backups: {
                            ...settings.backups,
                            autoBackupEnabled: e.currentTarget.checked,
                          },
                        })
                      }
                    />

                    <Group grow>
                      <TextInput
                        label="Cron Expression Schedule"
                        description="Default: 0 0 * * * (daily at midnight)"
                        value={settings.backups.cronSchedule}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            backups: {
                              ...settings.backups,
                              cronSchedule: e.target.value,
                            },
                          })
                        }
                        styles={{ input: { fontFamily: "var(--font-mono)" } }}
                      />
                      <NumberInput
                        label="Max Retention Count"
                        description="Automatically delete oldest backups exceeding this limit"
                        value={settings.backups.maxRetention}
                        min={1}
                        max={100}
                        onChange={(val) =>
                          setSettings({
                            ...settings,
                            backups: {
                              ...settings.backups,
                              maxRetention: Number(val) || 5,
                            },
                          })
                        }
                      />
                    </Group>

                    <Group gap="lg">
                      <Switch
                        label="Include _public files in automated backups"
                        checked={settings.backups.includePublic}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            backups: {
                              ...settings.backups,
                              includePublic: e.currentTarget.checked,
                            },
                          })
                        }
                      />
                      <Switch
                        label="Include _hooks scripts in automated backups"
                        checked={settings.backups.includeHooks}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            backups: {
                              ...settings.backups,
                              includeHooks: e.currentTarget.checked,
                            },
                          })
                        }
                      />
                    </Group>
                  </Stack>
                </Card>

                {/* Backups List & Management Card */}
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text fw={700} size="md">
                        Backup Snapshots ({(backups || []).length})
                      </Text>
                      <Text size="xs" c="dimmed">
                        Archives contain full SQLite database snapshots,
                        uploads, and selected modules.
                      </Text>
                    </div>

                    <Group gap="xs">
                      <Button
                        size="xs"
                        leftSection={<IconPlus size={13} />}
                        onClick={() => setCreateBackupModalOpen(true)}
                        style={{
                          backgroundColor: "var(--color-neon-primary)",
                          color: isDark ? "#052e16" : "#ffffff",
                          fontWeight: 700,
                        }}
                      >
                        Create Backup Now
                      </Button>

                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<IconUpload size={13} />}
                        onClick={() => backupFileInputRef.current?.click()}
                      >
                        Upload Backup (.zip)
                      </Button>

                      <Button
                        size="xs"
                        variant="default"
                        color="orange"
                        leftSection={<IconDatabase size={13} />}
                        onClick={() => sqliteInputRef.current?.click()}
                      >
                        Import SQLite
                      </Button>

                      <ActionIcon
                        size="sm"
                        variant="default"
                        loading={loadingBackups}
                        onClick={loadBackupsList}
                        title="Refresh Backups List"
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>

                      <input
                        type="file"
                        ref={backupFileInputRef}
                        style={{ display: "none" }}
                        accept=".zip"
                        onChange={handleBackupFileUpload}
                      />
                      <input
                        type="file"
                        ref={sqliteInputRef}
                        style={{ display: "none" }}
                        accept=".sqlite,.sqlite3,.db"
                        onChange={handleSqliteImport}
                      />
                    </Group>
                  </Group>

                  <Table highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Backup File</Table.Th>
                        <Table.Th style={{ width: 110 }}>Size</Table.Th>
                        <Table.Th style={{ width: 170 }}>Created At</Table.Th>
                        <Table.Th style={{ width: 160 }}>
                          Included Modules
                        </Table.Th>
                        <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(backups || []).map((item) => (
                        <Table.Tr key={item.key}>
                          <Table.Td>
                            <Group gap={6}>
                              <IconDatabase size={15} color="#38bdf8" />
                              <Text
                                size="xs"
                                fw={600}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                {item.name}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {(item.sizeBytes / 1024).toFixed(1)} KB
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <Badge size="xs" variant="outline">
                                DB
                              </Badge>
                              {item.includePublic && (
                                <Badge size="xs" variant="outline" color="cyan">
                                  _public
                                </Badge>
                              )}
                              {item.includeHooks && (
                                <Badge size="xs" variant="outline" color="teal">
                                  _hooks
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <Tooltip
                                label="Download Backup"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => {
                                    const token =
                                      localStorage.getItem("alsabase_token") ||
                                      localStorage.getItem("AlsaBase_token") ||
                                      "";
                                    const url = `/api/backups/${encodeURIComponent(item.name)}/download?token=${encodeURIComponent(token)}`;
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = item.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                  }}
                                >
                                  <IconDownload size={13} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip
                                label="Restore Snapshot"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="orange"
                                  onClick={() => handleRestoreBackup(item.name)}
                                >
                                  <IconRotateClockwise size={13} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip
                                label="Delete Backup"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="red"
                                  onClick={() => handleDeleteBackup(item.name)}
                                >
                                  <IconTrash size={13} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}

                      {backups.length === 0 && (
                        <Table.Tr>
                          <Table.Td
                            colSpan={5}
                            style={{ textAlign: "center", padding: "24px" }}
                          >
                            <Text size="xs" c="dimmed">
                              No backups created yet. Click "Create Backup Now"
                              to make a snapshot.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Card>
              </Stack>
            )}
            {/* TAB: ADMINISTRATORS (SUPERUSERS) */}
            {activeTab === "admins" && (
              <Stack gap="lg">
                <Card
                  withBorder
                  padding="lg"
                  radius="md"
                  style={{ backgroundColor: "var(--color-bg-card)" }}
                >
                  <Group justify="space-between" mb="lg">
                    <div>
                      <Group gap="xs">
                        <IconUserShield
                          size={18}
                          color="var(--color-neon-primary)"
                        />
                        <Text fw={700} size="md">
                          Superuser Administrators
                        </Text>
                        <Badge size="sm" variant="filled" color="green">
                          {superusers.length} Active
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt={3}>
                        Manage superusers with full access to the database, system settings, and API routes.
                      </Text>
                    </div>

                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => {
                        setNewSuperuserEmail("");
                        setNewSuperuserPassword("");
                        setNewSuperuserPasswordConfirm("");
                        setCreateSuperuserModalOpen(true);
                      }}
                      style={{
                        backgroundColor: "var(--color-neon-primary)",
                        color: isDark ? "#052e16" : "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      New Administrator
                    </Button>
                  </Group>

                  <Table
                    verticalSpacing="sm"
                    horizontalSpacing="md"
                    highlightOnHover
                    style={{ fontSize: "13px" }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ color: "var(--color-text-dimmed)" }}>
                          Administrator
                        </Table.Th>
                        <Table.Th style={{ color: "var(--color-text-dimmed)" }}>
                          Account ID
                        </Table.Th>
                        <Table.Th style={{ color: "var(--color-text-dimmed)" }}>
                          Created
                        </Table.Th>
                        <Table.Th
                          style={{
                            color: "var(--color-text-dimmed)",
                            textAlign: "right",
                          }}
                        >
                          Actions
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {superusers.map((su) => (
                        <Table.Tr key={su.id}>
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <Avatar
                                size={32}
                                radius="xl"
                                style={{
                                  backgroundColor: "var(--color-neon-dim)",
                                  color: "var(--color-neon-primary)",
                                  fontWeight: 700,
                                  border: "1px solid var(--color-border-glow)",
                                }}
                              >
                                {(su.email?.[0] || "A").toUpperCase()}
                              </Avatar>
                              <div>
                                <Text size="sm" fw={600}>
                                  {su.email}
                                </Text>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color="teal"
                                  style={{ marginTop: 2 }}
                                >
                                  Superuser
                                </Badge>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-dimmed)",
                              }}
                            >
                              {su.id}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {su.created
                                ? new Date(su.created).toLocaleString()
                                : "N/A"}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap={6} justify="flex-end">
                              <Tooltip
                                label="Edit Superuser"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => {
                                    setEditingSuperuser(su);
                                    setEditSuperuserEmail(su.email);
                                    setEditSuperuserPassword("");
                                  }}
                                >
                                  <IconEdit size={14} color="#38bdf8" />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip
                                label="Delete Superuser"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="red"
                                  disabled={superusers.length <= 1}
                                  onClick={() =>
                                    handleDeleteSuperuser(su.id, su.email)
                                  }
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}

                      {superusers.length === 0 && (
                        <Table.Tr>
                          <Table.Td
                            colSpan={4}
                            style={{ textAlign: "center", padding: "24px" }}
                          >
                            <Text size="xs" c="dimmed">
                              No administrator accounts found.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Card>
              </Stack>
            )}
          </Stack>
        )}
      </div>

      {/* MODAL: CREATE SUPERUSER */}
      <Modal
        opened={createSuperuserModalOpen}
        onClose={() => setCreateSuperuserModalOpen(false)}
        title="Create New Administrator"
        centered
        styles={{
          header: {
            backgroundColor: "var(--color-bg-card)",
            borderBottom: "1px solid var(--color-border)",
          },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Administrator Email"
            placeholder="admin@yourdomain.com"
            value={newSuperuserEmail}
            onChange={(e) => setNewSuperuserEmail(e.target.value)}
            required
            data-autofocus
          />
          <PasswordInput
            label="Password"
            description="Minimum 8 characters"
            placeholder="Choose a strong password"
            value={newSuperuserPassword}
            onChange={(e) => setNewSuperuserPassword(e.target.value)}
            required
          />
          <PasswordInput
            label="Confirm Password"
            placeholder="Repeat password"
            value={newSuperuserPasswordConfirm}
            onChange={(e) => setNewSuperuserPasswordConfirm(e.target.value)}
            required
          />
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button
              variant="default"
              size="xs"
              onClick={() => setCreateSuperuserModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              loading={creatingSuperuser}
              onClick={handleCreateSuperuser}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Create Account
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: EDIT SUPERUSER */}
      <Modal
        opened={Boolean(editingSuperuser)}
        onClose={() => setEditingSuperuser(null)}
        title="Edit Administrator"
        centered
        styles={{
          header: {
            backgroundColor: "var(--color-bg-card)",
            borderBottom: "1px solid var(--color-border)",
          },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Administrator Email"
            placeholder="admin@yourdomain.com"
            value={editSuperuserEmail}
            onChange={(e) => setEditSuperuserEmail(e.target.value)}
            required
          />
          <PasswordInput
            label="New Password (Optional)"
            description="Leave blank to keep current password"
            placeholder="Enter new password"
            value={editSuperuserPassword}
            onChange={(e) => setEditSuperuserPassword(e.target.value)}
          />
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button
              variant="default"
              size="xs"
              onClick={() => setEditingSuperuser(null)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              loading={updatingSuperuser}
              onClick={handleUpdateSuperuser}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: CREATE MANUAL BACKUP */}
      <Modal
        opened={createBackupModalOpen}
        onClose={() => setCreateBackupModalOpen(false)}
        title="Create Manual Backup Snapshot"
        centered
        styles={{
          header: {
            backgroundColor: "var(--color-bg-card)",
            borderBottom: "1px solid var(--color-border)",
          },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Backup Name (Optional)"
            placeholder="e.g. pre_migration_backup"
            value={backupCustomName}
            onChange={(e) => setBackupCustomName(e.target.value)}
          />

          <Divider label="Select folders to include" labelPosition="center" />

          <Switch
            label="Include _public static hosting directory"
            checked={backupIncludePublic}
            onChange={(e) => setBackupIncludePublic(e.currentTarget.checked)}
          />

          <Switch
            label="Include _hooks custom scripts directory"
            checked={backupIncludeHooks}
            onChange={(e) => setBackupIncludeHooks(e.currentTarget.checked)}
          />

          <Group justify="flex-end" gap="xs" mt="sm">
            <Button
              variant="default"
              size="xs"
              onClick={() => setCreateBackupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              loading={creatingBackup}
              onClick={handleCreateBackup}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Generate Backup
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: SEND TEST EMAIL */}
      <Modal
        opened={testEmailModalOpen}
        onClose={() => setTestEmailModalOpen(false)}
        title="Send Test Email"
        centered
        styles={{
          header: {
            backgroundColor: "var(--color-bg-card)",
            borderBottom: "1px solid var(--color-border)",
          },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Recipient Email Address"
            placeholder="your-email@example.com"
            value={testEmailRecipient}
            onChange={(e) => setTestEmailRecipient(e.target.value)}
            data-autofocus
          />

          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              size="xs"
              onClick={() => setTestEmailModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              loading={sendingTestEmail}
              onClick={handleSendTestEmail}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Send Test
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};
