import React, { useState, useEffect } from "react";
import {
  Group,
  Text,
  ActionIcon,
  ScrollArea,
  Stack,
  Button,
  Box,
  Title,
  Badge,
  TextInput,
  Table,
  Code,
  Paper,
  Drawer,
  Modal,
  MultiSelect,
  Select,
  Checkbox,
  NumberInput,
  Tooltip,
  Tabs,
  Grid,
  Menu,
  SegmentedControl,
  Pagination,
  TagsInput,
  Switch,
  PasswordInput,
  Collapse,
  SimpleGrid,
  CopyButton,
} from "@mantine/core";
import { ApiPreviewDrawer } from "../ApiPreviewDrawer";
import { CollectionsOverviewModal } from "../CollectionsOverviewModal";
import { RecordDrawer } from "../RecordDrawer";
import { ErrorBoundary } from "../ErrorBoundary";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDatabase,
  IconTrash,
  IconSearch,
  IconTable,
  IconSettings,
  IconEdit,
  IconLetterT,
  IconHash,
  IconToggleLeft,
  IconCode,
  IconFile,
  IconCalendar,
  IconClock,
  IconMail,
  IconLink,
  IconListCheck,
  IconKey,
  IconDots,
  IconLock,
  IconId,
  IconShield,
  IconShieldCheck,
  IconCheck,
  IconRefresh,
  IconUser,
  IconDotsVertical,
  IconSitemap,
  IconCopy,
  IconDownload,
  IconLayoutList,
  IconBracketsContain,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconArrowsSort,
  IconFilter,
  IconX,
  IconAdjustmentsHorizontal,
  IconBrandGoogle,
  IconBrandGithub,
  IconBrandDiscord,
  IconBrandWindows,
  IconWorld,
} from "@tabler/icons-react";
import {
  api,
  CollectionDef,
  CollectionRule,
  FieldDef,
  FieldType,
  TableIndexInfo,
} from "../../api/client";
import { copyToClipboard } from "../../utils/clipboard";
import { openHoldToConfirmModal } from "../HoldToConfirmModal";

export interface OAuth2ProviderConfig {
  name: string;
  displayName: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  tenantId?: string;
  authUrl?: string;
  tokenUrl?: string;
  userApiUrl?: string;
}

export const DEFAULT_OAUTH2_PROVIDERS: OAuth2ProviderConfig[] = [
  { name: "google", displayName: "Google", enabled: true, clientId: "", clientSecret: "" },
  { name: "github", displayName: "GitHub", enabled: true, clientId: "", clientSecret: "" },
  { name: "discord", displayName: "Discord", enabled: false, clientId: "", clientSecret: "" },
  { name: "microsoft", displayName: "Microsoft", enabled: false, clientId: "", clientSecret: "", tenantId: "common" },
  { name: "oidc", displayName: "OpenID Connect", enabled: false, clientId: "", clientSecret: "", authUrl: "", tokenUrl: "", userApiUrl: "" },
];

function getMergedOAuth2Providers(existing?: OAuth2ProviderConfig[]): OAuth2ProviderConfig[] {
  const current = existing || [];
  return DEFAULT_OAUTH2_PROVIDERS.map((def) => {
    const match = current.find((p) => p.name === def.name);
    return match ? { ...def, ...match } : { ...def };
  });
}

function getFieldIcon(type: FieldType, name?: string) {
  if (name === "avatar") return <IconUser size={15} color="#10e57a" />;
  if (name === "verified") return <IconShieldCheck size={15} color="#10e57a" />;
  if (name === "email" || type === "email") return <IconMail size={15} color="#06b6d4" />;
  if (name === "emailVisibility") return <IconToggleLeft size={15} color="#38bdf8" />;
  switch (type) {
    case "text":
      return <IconLetterT size={15} color="#38bdf8" />;
    case "number":
      return <IconHash size={15} color="#fbbf24" />;
    case "bool":
      return <IconToggleLeft size={15} color="#4ade80" />;
    case "json":
      return <IconCode size={15} color="#f472b6" />;
    case "file":
      return <IconFile size={15} color="#fb923c" />;
    case "date":
      return <IconCalendar size={15} color="#a855f7" />;
    case "autodate":
      return <IconClock size={15} color="#ec4899" />;
    case "url":
      return <IconLink size={15} color="#3b82f6" />;
    case "select":
      return <IconListCheck size={15} color="#14b8a6" />;
    default:
      return <IconLetterT size={15} color="#94a3b8" />;
  }
}

export const CollectionsView: React.FC = () => {
  const [collections, setCollections] = useState<CollectionDef[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionDef | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordPage, setRecordPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState<string>("20");
  const [recordSearch, setRecordSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<string>("table");

  // Schema Editor Drawer
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false);
  const [editingCollectionName, setEditingCollectionName] = useState<
    string | null
  >(null);
  const [collectionFormName, setCollectionFormName] = useState("");
  const [collectionType, setCollectionType] = useState<
    "base" | "auth" | "view"
  >("base");
  const [activeTab, setActiveTab] = useState<string | null>("fields");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(
    null,
  );
  const [collectionRules, setCollectionRules] = useState<CollectionRule>({
    list: "id = @request.auth.id",
    view: "id = @request.auth.id",
    create: "",
    update: "id = @request.auth.id",
    delete: "id = @request.auth.id",
  });
  const [collectionIndexes, setCollectionIndexes] = useState<string[]>([]);
  const [collectionOptions, setCollectionOptions] = useState<
    Record<string, any>
  >({
    sendEmailAlert: true,
    allowEmailAuth: true,
    allowOAuth2Auth: false,
    allowOtpAuth: false,
    allowMfa: false,
  });

  const [collectionSearch, setCollectionSearch] = useState("");
  const [apiPreviewOpen, setApiPreviewOpen] = useState(false);
  const [collectionsOverviewOpen, setCollectionsOverviewOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Table Indexes Inspector Modal
  const [indexesModalOpen, setIndexesModalOpen] = useState(false);
  const [tableIndexes, setTableIndexes] = useState<TableIndexInfo[]>([]);
  const [loadingIndexes, setLoadingIndexes] = useState(false);
  const [showAddIndexForm, setShowAddIndexForm] = useState(false);
  const [newIndexName, setNewIndexName] = useState("");
  const [newIndexCols, setNewIndexCols] = useState<string[]>([]);
  const [newIndexUnique, setNewIndexUnique] = useState(false);
  const [newIndexRawSql, setNewIndexRawSql] = useState("");
  const [useRawSql, setUseRawSql] = useState(false);

  // JSON expand modal
  const [jsonExpandModalOpen, setJsonExpandModalOpen] = useState(false);
  const [jsonExpandContent, setJsonExpandContent] = useState("");
  const [jsonExpandTitle, setJsonExpandTitle] = useState("");

  // Schema Drawer Index Form State
  const [schemaIndexCols, setSchemaIndexCols] = useState<string[]>([]);
  const [schemaIndexUnique, setSchemaIndexUnique] = useState(false);
  const [schemaIndexName, setSchemaIndexName] = useState("");
  const [schemaIndexRawSql, setSchemaIndexRawSql] = useState("");
  const [schemaUseRawSql, setSchemaUseRawSql] = useState(false);

  // Record Create/Edit Drawer
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Special Filter State
  const [recordFilter, setRecordFilter] = useState<string>("");
  const [appliedFilter, setAppliedFilter] = useState<string>("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);
  const [builderCol, setBuilderCol] = useState<string>("id");
  const [builderOp, setBuilderOp] = useState<string>("=");
  const [builderVal, setBuilderVal] = useState<string>("");

  const handleSelectCollection = (col: CollectionDef) => {
    setSelectedCollection(col);
    setSelectedRecordIds([]);
    setSortField("created_at");
    setSortDirection("desc");
    setRecordPage(1);
    setRecordFilter("");
    setAppliedFilter("");
    setBuilderVal("");
    setBuilderCol("id");
    localStorage.setItem("alsabase_selected_col", col.name);
  };

  const handleSort = (field: string) => {
    const isCurrent =
      sortField === field ||
      (field === "created_at" && (sortField === "created" || sortField === "created_at")) ||
      (field === "updated_at" && (sortField === "updated" || sortField === "updated_at"));

    let nextDir: "asc" | "desc" = "asc";
    if (isCurrent) {
      nextDir = sortDirection === "asc" ? "desc" : "asc";
    }
    setSortField(field);
    setSortDirection(nextDir);
    setRecordPage(1);
  };

  const handleApplyFilter = (customFilter?: string) => {
    const filterToApply =
      typeof customFilter === "string" ? customFilter.trim() : recordFilter.trim();
    setRecordFilter(filterToApply);
    setAppliedFilter(filterToApply);
    setRecordPage(1);
  };

  const handleClearFilter = () => {
    setRecordFilter("");
    setAppliedFilter("");
    setBuilderVal("");
    setRecordPage(1);
  };

  const handleInsertBuilderCondition = () => {
    if (!builderVal.trim()) return;
    const valTrim = builderVal.trim();
    const isNum = !isNaN(Number(valTrim)) && valTrim !== "";
    const isBool = valTrim.toLowerCase() === "true" || valTrim.toLowerCase() === "false";
    const formattedVal =
      isNum || isBool || builderOp === "~" || builderOp === "!~"
        ? valTrim
        : `"${valTrim}"`;
    const clause = `${builderCol} ${builderOp} ${formattedVal}`;
    const newFilter = recordFilter.trim() ? `${recordFilter.trim()} && ${clause}` : clause;
    setRecordFilter(newFilter);
    setAppliedFilter(newFilter);
    setRecordPage(1);
    setBuilderVal("");
  };

  const renderSortIcon = (field: string) => {
    const isSorted =
      sortField === field ||
      (field === "created_at" && (sortField === "created" || sortField === "created_at")) ||
      (field === "updated_at" && (sortField === "updated" || sortField === "updated_at"));

    if (!isSorted) {
      return (
        <IconArrowsSort
          size={12}
          style={{
            opacity: 0.35,
            flexShrink: 0,
            transition: "opacity 0.15s ease",
          }}
        />
      );
    }

    return sortDirection === "asc" ? (
      <IconChevronUp
        size={12}
        color="var(--color-neon-primary)"
        style={{
          flexShrink: 0,
          strokeWidth: 2.5,
        }}
      />
    ) : (
      <IconChevronDown
        size={12}
        color="var(--color-neon-primary)"
        style={{
          flexShrink: 0,
          strokeWidth: 2.5,
        }}
      />
    );
  };

  const loadCollections = async () => {
    try {
      const res = await api.listCollections();
      const list = res.items || [];
      setCollections(list);
      if (list.length > 0) {
        const savedColName = localStorage.getItem("alsabase_selected_col");
        const match = list.find((c) => c.name === savedColName);
        const colToSelect = match || list[0];
        setSelectedCollection((prev) => prev || colToSelect);
        loadRecords(
          colToSelect,
          1,
          parseInt(pageSize, 10) || 20,
          sortField,
          sortDirection,
          appliedFilter,
        );
      }
    } catch (err: any) {
      notifications.show({
        title: "Failed to load collections",
        message: err.message,
        color: "red",
      });
    }
  };

  const loadRecords = async (
    col: CollectionDef,
    page = 1,
    limitVal = parseInt(pageSize, 10) || 20,
    currentSortField = sortField,
    currentSortDir = sortDirection,
    currentFilter = appliedFilter,
  ) => {
    setLoading(true);
    try {
      const sortParam = currentSortField
        ? `${currentSortDir === "desc" ? "-" : "+"}${currentSortField}`
        : "-created_at";
      const res = await api.listRecords(col.name, {
        page,
        limit: limitVal,
        search: recordSearch,
        sort: sortParam,
        filter: currentFilter || undefined,
      });
      setRecords(res.items || []);
      setTotalRecords(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setRecordPage(page);
    } catch (err: any) {
      notifications.show({
        title: "Failed to load records",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadRecords(
        selectedCollection,
        recordPage,
        parseInt(pageSize, 10) || 20,
        sortField,
        sortDirection,
        appliedFilter,
      );
    }
  }, [selectedCollection, recordSearch, pageSize, sortField, sortDirection, appliedFilter]);

  const handleOpenCreateCollection = () => {
    setEditingCollectionName(null);
    setCollectionFormName("");
    setCollectionType("base");
    setFields([
      { name: "title", type: "text", required: true, max: 5000 },
      { name: "description", type: "text" },
    ]);
    setCollectionRules({
      list: "",
      view: "",
      create: '@request.auth.id != ""',
      update: '@request.auth.id != ""',
      delete: '@request.auth.id != ""',
    });
    setCollectionIndexes([]);
    setCollectionOptions({
      sendEmailAlert: true,
      allowEmailAuth: true,
      allowOAuth2Auth: false,
      allowOtpAuth: false,
      allowMfa: false,
      allowUsernameAuth: true,
      oauth2: {
        providers: DEFAULT_OAUTH2_PROVIDERS,
      },
      mfa: {
        duration: 600,
        enforce: false,
      },
    });
    setActiveTab("fields");
    setExpandedFieldIndex(null);
    setSchemaDrawerOpen(true);
  };

  const handleOpenEditSchema = (col: CollectionDef) => {
    setEditingCollectionName(col.name);
    setCollectionFormName(col.name);
    setCollectionType(col.type || (col.name === "users" ? "auth" : "base"));
    setFields(col.fields.filter((f) => f.name !== "tokenKey"));
    setCollectionRules({
      list:
        col.rules?.list !== undefined
          ? col.rules.list
          : col.name === "users"
            ? "id = @request.auth.id"
            : "",
      view:
        col.rules?.view !== undefined
          ? col.rules.view
          : col.name === "users"
            ? "id = @request.auth.id"
            : "",
      create: col.rules?.create !== undefined ? col.rules.create : "",
      update:
        col.rules?.update !== undefined
          ? col.rules.update
          : col.name === "users"
            ? "id = @request.auth.id"
            : '@request.auth.id != ""',
      delete:
        col.rules?.delete !== undefined
          ? col.rules.delete
          : col.name === "users"
            ? "id = @request.auth.id"
            : '@request.auth.id != ""',
      authWithPassword: col.rules?.authWithPassword || "",
      authRule: col.rules?.authRule || "",
      manageRule: col.rules?.manageRule || "",
    });
    setCollectionIndexes(
      col.indexes && col.indexes.length > 0
        ? col.indexes.filter((idx) => !idx.includes("tokenKey"))
        : col.name === "users"
          ? ["Unique: email"]
          : [],
    );
    const existingOptions = col.options || {};
    setCollectionOptions({
      sendEmailAlert: true,
      allowEmailAuth: true,
      allowOAuth2Auth: false,
      allowOtpAuth: false,
      allowMfa: false,
      allowUsernameAuth: true,
      ...existingOptions,
      oauth2: {
        providers: getMergedOAuth2Providers(existingOptions.oauth2?.providers),
      },
      mfa: {
        duration: existingOptions.mfa?.duration || 600,
        enforce: Boolean(existingOptions.mfa?.enforce),
      },
    });
    setActiveTab("fields");
    setExpandedFieldIndex(null);
    setSchemaDrawerOpen(true);
  };

  const handleSaveSchema = async () => {
    if (!collectionFormName.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Collection name is required",
        color: "yellow",
      });
      return;
    }

    const cleanFields = fields.filter((f) => f.name !== "tokenKey");

    // Check for duplicate field names before submitting
    const fieldNamesSeen = new Set<string>();
    for (const f of cleanFields) {
      const normalized = f.name.trim().toLowerCase();
      if (!normalized) continue;
      if (fieldNamesSeen.has(normalized)) {
        notifications.show({
          title: "Duplicate Field Name",
          message: `Field name "${f.name}" is used more than once. Each field must have a unique name.`,
          color: "red",
        });
        return;
      }
      fieldNamesSeen.add(normalized);
    }

    try {
      if (editingCollectionName) {
        const updated = await api.updateCollection(editingCollectionName, {
          name: collectionFormName,
          type: collectionType,
          fields: cleanFields,
          rules: collectionRules,
          indexes: collectionIndexes.filter((idx) => !idx.includes("tokenKey")),
          options: collectionOptions,
        });
        setSelectedCollection(updated);
        notifications.show({
          title: "Schema Updated",
          message: `Collection "${collectionFormName}" schema was updated.`,
          color: "teal",
        });
      } else {
        const created = await api.createCollection({
          name: collectionFormName,
          type: collectionType,
          fields: cleanFields,
          rules: collectionRules,
          indexes: collectionIndexes.filter((idx) => !idx.includes("tokenKey")),
          options: collectionOptions,
        });
        setSelectedCollection(created);
        notifications.show({
          title: "Collection Created",
          message: `Collection "${collectionFormName}" created successfully.`,
          color: "teal",
        });
      }
      setSchemaDrawerOpen(false);
      loadCollections();
    } catch (err: any) {
      notifications.show({
        title: "Save Schema Error",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleOpenCreateRecord = () => {
    setEditingRecord(null);
    setRecordDrawerOpen(true);
  };

  const handleOpenEditRecord = (rec: any) => {
    setEditingRecord(rec);
    setRecordDrawerOpen(true);
  };

  const handleSaveRecord = async (data: Record<string, any>) => {
    if (!selectedCollection) return;
    try {
      if (editingRecord?.id) {
        await api.updateRecord(selectedCollection.name, editingRecord.id, data);
        notifications.show({
          title: "Record Updated",
          message: "Record updated successfully.",
          color: "teal",
        });
      } else {
        await api.createRecord(selectedCollection.name, data);
        notifications.show({
          title: "Record Created",
          message: "New record added successfully.",
          color: "teal",
        });
      }
      setRecordDrawerOpen(false);
      loadRecords(selectedCollection, recordPage);
    } catch (err: any) {
      notifications.show({
        title: "Save Record Error",
        message: err.message,
        color: "red",
      });
      throw err;
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (!selectedCollection) return;
    openHoldToConfirmModal({
      title: "Delete Record",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete this record from{" "}
          <b>{selectedCollection.name}</b>?
        </Text>
      ),
      labels: { confirm: "Delete Record", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteRecord(selectedCollection.name, id);
          setSelectedRecordIds((prev) => prev.filter((item) => item !== id));
          loadRecords(selectedCollection, recordPage);
          notifications.show({
            title: "Record Deleted",
            message: "Record removed successfully.",
            color: "teal",
          });
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

  const handleBatchDelete = () => {
    if (!selectedCollection || selectedRecordIds.length === 0) return;
    openHoldToConfirmModal({
      title: `Delete ${selectedRecordIds.length} Selected Records`,
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete{" "}
          <b>{selectedRecordIds.length}</b> records from{" "}
          <b>{selectedCollection.name}</b>? This action cannot be undone.
        </Text>
      ),
      labels: {
        confirm: `Delete ${selectedRecordIds.length} Records`,
        cancel: "Cancel",
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          for (const id of selectedRecordIds) {
            await api.deleteRecord(selectedCollection.name, id);
          }
          setSelectedRecordIds([]);
          loadRecords(selectedCollection, 1);
          notifications.show({
            title: "Records Deleted",
            message: `Successfully deleted selected records from ${selectedCollection.name}.`,
            color: "teal",
          });
        } catch (err: any) {
          notifications.show({
            title: "Batch Delete Error",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  const handleTruncateCollection = (col: CollectionDef) => {
    openHoldToConfirmModal({
      title: "Truncate Collection Records",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete <b>ALL records</b> in collection{" "}
          <b>{col.name}</b>? The collection schema and rules will remain intact.
        </Text>
      ),
      labels: { confirm: "Truncate All Records", cancel: "Cancel" },
      confirmProps: { color: "orange" },
      onConfirm: async () => {
        try {
          const res = await api.truncateCollection(col.name);
          loadRecords(col, 1);
          setSelectedRecordIds([]);
          notifications.show({
            title: "Collection Truncated",
            message: `Successfully deleted ${res.changes || 0} record(s) from ${col.name}.`,
            color: "teal",
          });
        } catch (err: any) {
          notifications.show({
            title: "Truncate Failed",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  const handleDeleteCollection = (col: CollectionDef) => {
    if (col.name === "users") {
      notifications.show({
        title: "Action Not Allowed",
        message: "The core users collection cannot be deleted.",
        color: "red",
      });
      return;
    }

    openHoldToConfirmModal({
      title: "Delete Collection",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete collection{" "}
          <b>{col.name}</b>? All stored data and schema fields will be dropped.
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete Collection", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteCollection(col.name);
          notifications.show({
            title: "Collection Deleted",
            message: `Collection "${col.name}" has been deleted.`,
            color: "teal",
          });
          const remaining = collections.filter((c) => c.name !== col.name);
          setCollections(remaining);
          if (remaining.length > 0) {
            handleSelectCollection(remaining[0]);
            loadRecords(remaining[0], 1);
          } else {
            setSelectedCollection(null);
            setRecords([]);
            setTotalRecords(0);
          }
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

  const handleExportJson = () => {
    if (!selectedCollection || records.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(records, null, 2),
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `${selectedCollection.name}_records.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], ...patch };
    setFields(updated);
  };

  const loadTableIndexes = async (tableName: string) => {
    setLoadingIndexes(true);
    try {
      const res = await api.getTableIndexes(tableName);
      setTableIndexes(res.items || []);
    } catch (err: any) {
      notifications.show({
        title: "Failed to load indexes",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoadingIndexes(false);
    }
  };

  const handleOpenIndexesModal = (col: CollectionDef) => {
    loadTableIndexes(col.name);
    setShowAddIndexForm(false);
    setNewIndexName("");
    setNewIndexCols([]);
    setNewIndexUnique(false);
    setNewIndexRawSql("");
    setUseRawSql(false);
    setIndexesModalOpen(true);
  };

  const handleCreateLiveIndex = async () => {
    if (!selectedCollection) return;
    if (!useRawSql && newIndexCols.length === 0) {
      notifications.show({
        title: "Validation Error",
        message: "Please select at least one column for the index",
        color: "yellow",
      });
      return;
    }
    if (useRawSql && !newIndexRawSql.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Raw SQL query cannot be empty",
        color: "yellow",
      });
      return;
    }

    try {
      await api.createTableIndex(selectedCollection.name, {
        name: newIndexName.trim() || undefined,
        columns: newIndexCols,
        unique: newIndexUnique,
        rawSql: useRawSql ? newIndexRawSql.trim() : undefined,
      });
      notifications.show({
        title: "Index Created",
        message: "Database index created successfully.",
        color: "teal",
      });
      setShowAddIndexForm(false);
      setNewIndexName("");
      setNewIndexCols([]);
      setNewIndexUnique(false);
      setNewIndexRawSql("");
      setUseRawSql(false);
      loadTableIndexes(selectedCollection.name);
      loadCollections();
    } catch (err: any) {
      notifications.show({
        title: "Failed to create index",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleDropLiveIndex = (indexName: string) => {
    if (!selectedCollection) return;
    openHoldToConfirmModal({
      title: `Drop Index "${indexName}"`,
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to drop the index <b>{indexName}</b> from table{" "}
          <b>{selectedCollection.name}</b>?
        </Text>
      ),
      labels: { confirm: "Drop Index", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.dropTableIndex(selectedCollection.name, indexName);
          notifications.show({
            title: "Index Dropped",
            message: `Index "${indexName}" was dropped successfully.`,
            color: "teal",
          });
          loadTableIndexes(selectedCollection.name);
          loadCollections();
        } catch (err: any) {
          notifications.show({
            title: "Failed to drop index",
            message: err.message,
            color: "red",
          });
        }
      },
    });
  };

  const handleAddSchemaIndex = () => {
    let sqlToAdd = "";
    if (schemaUseRawSql) {
      if (!schemaIndexRawSql.trim()) {
        notifications.show({
          title: "Validation Error",
          message: "Raw SQL query cannot be empty",
          color: "yellow",
        });
        return;
      }
      sqlToAdd = schemaIndexRawSql.trim();
    } else {
      if (schemaIndexCols.length === 0) {
        notifications.show({
          title: "Validation Error",
          message: "Please select at least one column for the index",
          color: "yellow",
        });
        return;
      }
      const targetTable = collectionFormName.trim() || "collection";
      const cols = schemaIndexCols.map((c) => `"${c}"`).join(", ");
      const colsClean = schemaIndexCols.join("_");
      const idxName =
        schemaIndexName.trim() || `idx_${targetTable}_${colsClean}`;
      const uniquePart = schemaIndexUnique ? "UNIQUE " : "";
      sqlToAdd = `CREATE ${uniquePart}INDEX IF NOT EXISTS "${idxName}" ON "${targetTable}" (${cols});`;
    }

    setCollectionIndexes((prev) => [...prev, sqlToAdd]);
    setSchemaIndexCols([]);
    setSchemaIndexUnique(false);
    setSchemaIndexName("");
    setSchemaIndexRawSql("");
    setSchemaUseRawSql(false);
  };

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(collectionSearch.toLowerCase()),
  );

  const authCollections = filteredCollections.filter(
    (c) => (c.type === "auth" || c.name === "users") && c.name !== "_superusers",
  );
  const baseCollections = filteredCollections.filter(
    (c) => c.type !== "auth" && c.name !== "users",
  );

  return (
    <>
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "var(--color-bg-base)",
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar: Collections Navigator */}
        <div
          style={{
            width: 260,
            minWidth: 260,
            maxWidth: 260,
            height: "100%",
            backgroundColor: "var(--color-bg-surface)",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            userSelect: "none",
          }}
        >
          {/* Explorer Header */}
          <div
            style={{
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-card)",
              height: 52,
              minHeight: 52,
              boxSizing: "border-box",
            }}
          >
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Text
                fw={700}
                size="xs"
                style={{
                  color: "var(--color-text-dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                }}
              >
                Collections
              </Text>
              <Badge
                size="xs"
                variant="filled"
                style={{
                  backgroundColor: "var(--color-bg-well)",
                  color: "var(--color-text-dimmed)",
                  border: "1px solid var(--color-border)",
                  fontSize: "10px",
                  padding: "0 5px",
                }}
              >
                {collections.length}
              </Badge>
            </Group>

            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Tooltip
                label="Collections Schema Overview"
                withArrow
                position="top"
              >
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => setCollectionsOverviewOpen(true)}
                  style={{ color: "var(--color-text-dimmed)" }}
                >
                  <IconSitemap size={15} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="New Collection" withArrow position="top">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleOpenCreateCollection}
                  style={{ color: "var(--color-neon-primary)" }}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>

          {/* Search Box in Explorer */}
          <div
            style={{
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid var(--color-border)",
              height: 48,
              minHeight: 48,
              boxSizing: "border-box",
            }}
          >
            <TextInput
              placeholder="Search collections..."
              leftSection={
                <IconSearch size={13} color="var(--color-text-dimmed)" />
              }
              value={collectionSearch}
              onChange={(e) => setCollectionSearch(e.target.value)}
              size="xs"
              style={{ width: "100%" }}
              styles={{
                input: {
                  backgroundColor: "var(--color-bg-well)",
                  border: "1px solid var(--color-border)",
                  height: 30,
                  fontSize: "12px",
                },
              }}
            />
          </div>

          {/* Collections List */}
          <ScrollArea style={{ flex: 1 }} scrollbarSize={5} p="xs">
            <Stack gap={12}>
              {/* Auth Collections Section */}
              {authCollections.length > 0 && (
                <div>
                  <Text
                    size="10px"
                    fw={700}
                    c="dimmed"
                    px="xs"
                    mb={4}
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    System & Auth
                  </Text>
                  <Stack gap={2}>
                    {authCollections.map((col) => {
                      const isSelected = selectedCollection?.id === col.id;
                      return (
                        <div
                          key={col.id}
                          onClick={() => handleSelectCollection(col)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? "var(--color-neon-dim)"
                              : "transparent",
                            borderLeft: isSelected
                              ? "2px solid var(--color-neon-primary)"
                              : "2px solid transparent",
                            color: isSelected
                              ? "var(--color-neon-primary)"
                              : "var(--color-text-primary)",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <Group
                            gap={8}
                            wrap="nowrap"
                            style={{ overflow: "hidden" }}
                          >
                            <IconShieldCheck
                              size={15}
                              color={
                                isSelected
                                  ? "var(--color-neon-primary)"
                                  : "#38bdf8"
                              }
                            />
                            <Text
                              size="xs"
                              fw={isSelected ? 600 : 400}
                              truncate
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "12.5px",
                              }}
                            >
                              {col.name}
                            </Text>
                          </Group>

                          <Menu shadow="xl" width={200} position="right-start" radius="md">
                            <Menu.Target>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  opacity: isSelected ? 0.9 : 0.4,
                                  color: "var(--color-text-dimmed)",
                                }}
                              >
                                <IconDotsVertical size={13} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown
                              style={{
                                backgroundColor: "var(--color-bg-card)",
                                borderColor: "var(--color-border)",
                                boxShadow:
                                  "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border)",
                                padding: 5,
                              }}
                            >
                              <Menu.Label
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  color: "var(--color-text-dimmed)",
                                  padding: "5px 8px",
                                }}
                              >
                                Collection Actions
                              </Menu.Label>
                              <Menu.Item
                                leftSection={<IconEdit size={14} color="#38bdf8" />}
                                onClick={() => handleOpenEditSchema(col)}
                                style={{
                                  fontSize: "12.5px",
                                  borderRadius: 5,
                                  padding: "7px 10px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Edit Schema
                              </Menu.Item>
                              <Menu.Divider
                                style={{ borderColor: "var(--color-border-subtle)" }}
                              />
                              <Menu.Item
                                color="orange"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handleTruncateCollection(col)}
                                style={{
                                  fontSize: "12.5px",
                                  borderRadius: 5,
                                  padding: "7px 10px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Truncate Records
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </div>
                      );
                    })}
                  </Stack>
                </div>
              )}

              {/* Base Application Tables Section */}
              <div>
                <Text
                  size="10px"
                  fw={700}
                  c="dimmed"
                  px="xs"
                  mb={4}
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Application Tables ({baseCollections.length})
                </Text>
                <Stack gap={2}>
                  {baseCollections.map((col) => {
                    const isSelected = selectedCollection?.id === col.id;
                    return (
                      <div
                        key={col.id}
                        onClick={() => handleSelectCollection(col)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "7px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "var(--color-neon-dim)"
                            : "transparent",
                          borderLeft: isSelected
                            ? "2px solid var(--color-neon-primary)"
                            : "2px solid transparent",
                          color: isSelected
                            ? "var(--color-neon-primary)"
                            : "var(--color-text-primary)",
                          transition: "all 0.12s ease",
                        }}
                      >
                        <Group
                          gap={8}
                          wrap="nowrap"
                          style={{ overflow: "hidden" }}
                        >
                          <IconTable
                            size={15}
                            color={
                              isSelected
                                ? "var(--color-neon-primary)"
                                : "var(--color-text-dimmed)"
                            }
                          />
                          <Text
                            size="xs"
                            fw={isSelected ? 600 : 400}
                            truncate
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "12.5px",
                            }}
                          >
                            {col.name}
                          </Text>
                        </Group>

                        <Menu shadow="xl" width={200} position="right-start" radius="md">
                          <Menu.Target>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                opacity: isSelected ? 0.9 : 0.4,
                                color: "var(--color-text-dimmed)",
                              }}
                            >
                              <IconDotsVertical size={13} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown
                            style={{
                              backgroundColor: "var(--color-bg-card)",
                              borderColor: "var(--color-border)",
                              boxShadow:
                                "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border)",
                              padding: 5,
                            }}
                          >
                            <Menu.Label
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "var(--color-text-dimmed)",
                                padding: "5px 8px",
                              }}
                            >
                              Collection Actions
                            </Menu.Label>
                            <Menu.Item
                              leftSection={<IconEdit size={14} color="#38bdf8" />}
                              onClick={() => handleOpenEditSchema(col)}
                              style={{
                                fontSize: "12.5px",
                                borderRadius: 5,
                                padding: "7px 10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Edit Schema
                            </Menu.Item>
                            <Menu.Divider
                              style={{ borderColor: "var(--color-border-subtle)" }}
                            />
                            <Menu.Item
                              color="orange"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleTruncateCollection(col)}
                              style={{
                                fontSize: "12.5px",
                                borderRadius: 5,
                                padding: "7px 10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Truncate Records
                            </Menu.Item>
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleDeleteCollection(col)}
                              style={{
                                fontSize: "12.5px",
                                borderRadius: 5,
                                padding: "7px 10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Delete Collection
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </div>
                    );
                  })}

                  {baseCollections.length === 0 &&
                    authCollections.length === 0 && (
                      <div
                        style={{ padding: "24px 12px", textAlign: "center" }}
                      >
                        <Text size="xs" c="dimmed">
                          No collections match your search.
                        </Text>
                      </div>
                    )}
                </Stack>
              </div>
            </Stack>
          </ScrollArea>

          {/* Bottom Sidebar Action */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-card)",
            }}
          >
            <Button
              variant="outline"
              size="xs"
              fullWidth
              leftSection={<IconPlus size={14} />}
              onClick={handleOpenCreateCollection}
              style={{
                backgroundColor: "var(--color-bg-surface)",
                borderColor: "var(--color-border-glow)",
                color: "var(--color-neon-primary)",
                fontWeight: 600,
                fontSize: "12px",
                height: 32,
              }}
            >
              New Collection
            </Button>
          </div>
        </div>

        {/* Right Main Content Area: Data Explorer */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {selectedCollection ? (
            <>
              {/* Header Bar */}
              <div
                style={{
                  padding: "0 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-bg-surface)",
                  height: 52,
                  minHeight: 52,
                  boxSizing: "border-box",
                }}
              >
                {/* Left: Breadcrumbs & Metas */}
                <Group gap={8} align="center">
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    COLLECTIONS
                  </Text>
                  <Text size="xs" c="dimmed">
                    /
                  </Text>
                  <Group gap={6} align="center">
                    {selectedCollection.type === "auth" ||
                    selectedCollection.name === "users" ? (
                      <IconShieldCheck
                        size={16}
                        color="var(--color-neon-primary)"
                      />
                    ) : (
                      <IconTable size={16} color="var(--color-neon-primary)" />
                    )}
                    <Text
                      size="sm"
                      fw={700}
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {selectedCollection.name}
                    </Text>
                  </Group>

                  <Badge
                    size="xs"
                    variant="outline"
                    style={{
                      borderColor: "var(--color-border-subtle)",
                      color: "var(--color-text-dimmed)",
                      textTransform: "capitalize",
                    }}
                  >
                    {selectedCollection.type || "Base"}
                  </Badge>

                  <Badge
                    size="xs"
                    variant="filled"
                    style={{
                      backgroundColor: "var(--color-neon-dim)",
                      color: "var(--color-neon-primary)",
                      border: "1px solid var(--color-border-glow)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {totalRecords} records
                  </Badge>
                </Group>

                {/* Right Action Buttons */}
                <Group gap={8}>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconCode size={14} />}
                    onClick={() => setApiPreviewOpen(true)}
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      color: "var(--color-text-dimmed)",
                      border: "1px solid var(--color-border)",
                      fontSize: "12px",
                      height: 30,
                    }}
                  >
                    API Preview
                  </Button>

                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconDatabase size={14} />}
                    onClick={() => handleOpenIndexesModal(selectedCollection)}
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      color: "var(--color-text-dimmed)",
                      border: "1px solid var(--color-border)",
                      fontSize: "12px",
                      height: 30,
                    }}
                  >
                    Indexes
                  </Button>

                  {selectedCollection.name !== "_superusers" && (
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconSettings size={14} />}
                      onClick={() => handleOpenEditSchema(selectedCollection)}
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        color: "var(--color-text-dimmed)",
                        border: "1px solid var(--color-border)",
                        fontSize: "12px",
                        height: 30,
                      }}
                    >
                      Edit Schema
                    </Button>
                  )}

                  <Menu shadow="xl" width={210} position="bottom-end" radius="md">
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        size="md"
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-dimmed)",
                          height: 30,
                          width: 30,
                        }}
                      >
                        <IconDots size={15} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border)",
                        boxShadow:
                          "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border)",
                        padding: 5,
                      }}
                    >
                      <Menu.Label
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--color-text-dimmed)",
                          padding: "5px 8px",
                        }}
                      >
                        Collection Tools
                      </Menu.Label>
                      <Menu.Item
                        leftSection={<IconDownload size={14} color="#38bdf8" />}
                        onClick={handleExportJson}
                        style={{
                          fontSize: "12.5px",
                          borderRadius: 5,
                          padding: "7px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Export Page to JSON
                      </Menu.Item>
                      <Menu.Divider
                        style={{ borderColor: "var(--color-border-subtle)" }}
                      />
                      <Menu.Item
                        color="orange"
                        leftSection={<IconTrash size={14} />}
                        onClick={() =>
                          handleTruncateCollection(selectedCollection)
                        }
                        style={{
                          fontSize: "12.5px",
                          borderRadius: 5,
                          padding: "7px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Truncate All Records
                      </Menu.Item>
                      {selectedCollection.name !== "users" && (
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() =>
                            handleDeleteCollection(selectedCollection)
                          }
                          style={{
                            fontSize: "12.5px",
                            borderRadius: 5,
                            padding: "7px 10px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Delete Collection
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>

                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={handleOpenCreateRecord}
                    style={{
                      backgroundColor: "var(--color-neon-primary)",
                      color: "var(--color-neon-text)",
                      fontWeight: 700,
                      fontSize: "12px",
                      height: 30,
                      boxShadow: "0 0 14px var(--color-neon-glow)",
                    }}
                  >
                    New Record
                  </Button>
                </Group>
              </div>

              {/* Toolbar: Search, Filters, View Modes, Batch Actions */}
              <div
                style={{
                  padding: "0 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "var(--color-bg-base)",
                  borderBottom: "1px solid var(--color-border)",
                  gap: 12,
                  height: 48,
                  minHeight: 48,
                  boxSizing: "border-box",
                }}
              >
                {/* Search & Filter Toolbar */}
                <Group gap={8} style={{ flex: 1, maxWidth: 600 }}>
                  <TextInput
                    placeholder="Search text fields..."
                    leftSection={
                      <IconSearch size={14} color="var(--color-text-dimmed)" />
                    }
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    size="xs"
                    style={{ flex: 1, minWidth: 160 }}
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontSize: "12px",
                        height: 30,
                      },
                    }}
                  />
                  <Tooltip label="Special Column & Formula Filters" withArrow position="top">
                    <Button
                      size="xs"
                      variant={appliedFilter ? "filled" : filterDrawerOpen ? "light" : "default"}
                      color={appliedFilter ? "neonGreen" : "gray"}
                      leftSection={<IconFilter size={13} />}
                      rightSection={
                        appliedFilter ? (
                          <Badge
                            size="xs"
                            circle
                            color="dark"
                            style={{
                              height: 16,
                              width: 16,
                              minWidth: 16,
                              fontSize: "10px",
                              padding: 0,
                              color: "var(--color-neon-primary)",
                              backgroundColor: "rgba(0,0,0,0.4)",
                            }}
                          >
                            1
                          </Badge>
                        ) : null
                      }
                      onClick={() => setFilterDrawerOpen((prev) => !prev)}
                      style={{
                        height: 30,
                        fontSize: "12px",
                        fontWeight: appliedFilter ? 700 : 500,
                        borderColor: appliedFilter
                          ? "var(--color-neon-primary)"
                          : "var(--color-border)",
                        backgroundColor: appliedFilter
                          ? "var(--color-neon-primary)"
                          : filterDrawerOpen
                          ? "var(--color-neon-dim)"
                          : "var(--color-bg-card)",
                        color: appliedFilter
                          ? "var(--color-neon-text)"
                          : filterDrawerOpen
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      Filter
                    </Button>
                  </Tooltip>
                  <Tooltip label="Refresh Records" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      loading={loading}
                      onClick={() =>
                        loadRecords(
                          selectedCollection,
                          recordPage,
                          parseInt(pageSize, 10) || 20,
                        )
                      }
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-dimmed)",
                        height: 30,
                        width: 30,
                      }}
                    >
                      <IconRefresh size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                {/* Batch Action or View Toggle */}
                <Group gap={8}>
                  {selectedRecordIds.length > 0 ? (
                    <Group
                      gap={6}
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--color-border-glow)",
                      }}
                    >
                      <Badge size="sm" color="teal" variant="filled">
                        {selectedRecordIds.length} selected
                      </Badge>
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="subtle"
                        leftSection={<IconTrash size={12} />}
                        onClick={handleBatchDelete}
                      >
                        Delete Selected
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => setSelectedRecordIds([])}
                      >
                        Deselect
                      </Button>
                    </Group>
                  ) : (
                    <SegmentedControl
                      size="xs"
                      value={viewMode}
                      onChange={setViewMode}
                      data={[
                        {
                          label: (
                            <Group gap={4} wrap="nowrap">
                              <IconLayoutList size={13} />
                              <span>Table</span>
                            </Group>
                          ),
                          value: "table",
                        },
                        {
                          label: (
                            <Group gap={4} wrap="nowrap">
                              <IconBracketsContain size={13} />
                              <span>JSON</span>
                            </Group>
                          ),
                          value: "json",
                        },
                      ]}
                      styles={{
                        root: {
                          backgroundColor: "var(--color-bg-well)",
                          border: "1px solid var(--color-border)",
                          padding: 2,
                        },
                      }}
                    />
                  )}
                </Group>
              </div>

              {/* Expandable Special Filter Bar */}
              <Collapse expanded={filterDrawerOpen}>
                <Paper
                  p="sm"
                  style={{
                    backgroundColor: "var(--color-bg-surface)",
                    borderBottom: "1px solid var(--color-border)",
                    borderRadius: 0,
                  }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Group gap={6}>
                        <IconAdjustmentsHorizontal size={15} color="var(--color-neon-primary)" />
                        <Text size="xs" fw={700} c="var(--color-text-primary)">
                          Column Filter Builder
                        </Text>
                      </Group>
                      <Group gap={6}>
                        {appliedFilter && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconX size={12} />}
                            onClick={handleClearFilter}
                          >
                            Clear Filter
                          </Button>
                        )}
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => setFilterDrawerOpen(false)}
                        >
                          <IconX size={13} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    {/* Visual Filter Builder Row */}
                    <Group gap="xs" wrap="nowrap" align="flex-end">
                      <Box style={{ width: 150 }}>
                        <Text size="11px" c="dimmed" mb={2}>
                          Column
                        </Text>
                        <Select
                          size="xs"
                          value={builderCol}
                          onChange={(val) => setBuilderCol(val || "id")}
                          data={[
                            { label: "id", value: "id" },
                            ...selectedCollection.fields.map((f) => ({
                              label: f.name,
                              value: f.name,
                            })),
                            { label: "created", value: "created_at" },
                            { label: "updated", value: "updated_at" },
                          ]}
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                              fontSize: "12px",
                              height: 30,
                            },
                          }}
                        />
                      </Box>

                      <Box style={{ width: 135 }}>
                        <Text size="11px" c="dimmed" mb={2}>
                          Operator
                        </Text>
                        <Select
                          size="xs"
                          value={builderOp}
                          onChange={(val) => setBuilderOp(val || "=")}
                          data={[
                            { label: "= (Equals)", value: "=" },
                            { label: "!= (Not equals)", value: "!=" },
                            { label: "~ (Contains)", value: "~" },
                            { label: "!~ (Not contains)", value: "!~" },
                            { label: "> (Greater than)", value: ">" },
                            { label: "< (Less than)", value: "<" },
                            { label: ">= (Greater or eq)", value: ">=" },
                            { label: "<= (Less or eq)", value: "<=" },
                          ]}
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                              fontSize: "12px",
                              height: 30,
                            },
                          }}
                        />
                      </Box>

                      <Box style={{ flex: 1 }}>
                        <Text size="11px" c="dimmed" mb={2}>
                          Value
                        </Text>
                        <TextInput
                          placeholder='e.g. 123 or "game"'
                          size="xs"
                          value={builderVal}
                          onChange={(e) => setBuilderVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleInsertBuilderCondition();
                            }
                          }}
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                              fontSize: "12px",
                              height: 30,
                              fontFamily: "var(--font-mono)",
                            },
                          }}
                        />
                      </Box>

                      <Button
                        size="xs"
                        variant="filled"
                        color="neonGreen"
                        onClick={handleInsertBuilderCondition}
                        style={{
                          height: 30,
                          backgroundColor: "var(--color-neon-primary)",
                          color: "var(--color-neon-text)",
                          fontWeight: 700,
                        }}
                      >
                        Add Condition
                      </Button>
                    </Group>

                    {/* Raw Expression Input */}
                    <Box>
                      <Group justify="space-between" align="center" mb={2}>
                        <Text size="11px" c="dimmed">
                          Filter Expression (e.g. id = 123 or title = game or id = "123" && title = "game")
                        </Text>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
                          placeholder='e.g. id = 123 || title = "game"'
                          size="xs"
                          value={recordFilter}
                          onChange={(e) => setRecordFilter(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleApplyFilter();
                            }
                          }}
                          style={{ flex: 1 }}
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                              fontSize: "12px",
                              height: 30,
                              fontFamily: "var(--font-mono)",
                            },
                          }}
                        />
                        <Button
                          size="xs"
                          variant="filled"
                          color="neonGreen"
                          onClick={() => handleApplyFilter()}
                          style={{
                            height: 30,
                            backgroundColor: "var(--color-neon-primary)",
                            color: "var(--color-neon-text)",
                            fontWeight: 700,
                          }}
                        >
                          Apply
                        </Button>
                        {recordFilter && (
                          <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={handleClearFilter}
                            style={{ height: 30 }}
                          >
                            Reset
                          </Button>
                        )}
                      </Group>
                    </Box>

                    {/* Quick Example Pills */}
                    <Group gap={6} wrap="nowrap" style={{ overflowX: "auto" }}>
                      <Text size="11px" c="dimmed">
                        Examples:
                      </Text>
                      <Badge
                        size="xs"
                        variant="outline"
                        color="gray"
                        style={{ cursor: "pointer", textTransform: "none", fontFamily: "var(--font-mono)" }}
                        onClick={() => {
                          const expr = 'id = "123"';
                          setRecordFilter(expr);
                          handleApplyFilter(expr);
                        }}
                      >
                        id = 123
                      </Badge>
                      {selectedCollection.fields.slice(0, 3).map((f) => (
                        <Badge
                          key={f.name}
                          size="xs"
                          variant="outline"
                          color="gray"
                          style={{ cursor: "pointer", textTransform: "none", fontFamily: "var(--font-mono)" }}
                          onClick={() => {
                            const expr = `${f.name} = "game"`;
                            setRecordFilter(expr);
                            handleApplyFilter(expr);
                          }}
                        >
                          {f.name} = game
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Paper>
              </Collapse>

              {/* Active Filter Pill Bar */}
              {appliedFilter && (
                <Paper
                  px="md"
                  py={6}
                  style={{
                    backgroundColor: "var(--color-neon-dim)",
                    borderBottom: "1px solid var(--color-border-glow)",
                    borderRadius: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <IconFilter size={13} color="var(--color-neon-primary)" />
                    <Text size="xs" fw={700} c="var(--color-neon-primary)">
                      Active Filter:
                    </Text>
                    <Code
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        color: "var(--color-neon-primary)",
                        fontSize: "11.5px",
                        border: "1px solid var(--color-border-glow)",
                        padding: "2px 6px",
                      }}
                    >
                      {appliedFilter}
                    </Code>
                    <Text size="xs" c="dimmed">
                      ({totalRecords} {totalRecords === 1 ? "record" : "records"})
                    </Text>
                  </Group>
                  <Group gap={6}>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => setFilterDrawerOpen(true)}
                    >
                      Edit Filter
                    </Button>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={handleClearFilter}
                      title="Clear active filter"
                    >
                      <IconX size={13} />
                    </ActionIcon>
                  </Group>
                </Paper>
              )}

              {/* Data Workspace Table or JSON View */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {viewMode === "table" ? (
                  <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
                    <Table
                      highlightOnHover
                      verticalSpacing="sm"
                      horizontalSpacing="md"
                      style={{
                        fontSize: "13px",
                      }}
                    >
                      <Table.Thead
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "var(--color-bg-surface)",
                          zIndex: 2,
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <Table.Tr>
                          <Table.Th style={{ width: 44, paddingLeft: 12 }}>
                            <Checkbox
                              size="xs"
                              checked={
                                records.length > 0 &&
                                selectedRecordIds.length === records.length
                              }
                              onChange={(e) => {
                                if (e.currentTarget.checked) {
                                  setSelectedRecordIds(
                                    records.map((r) => r.id),
                                  );
                                } else {
                                  setSelectedRecordIds([]);
                                }
                              }}
                            />
                          </Table.Th>
                          <Table.Th
                            style={{
                              width: 155,
                              minWidth: 155,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                            onClick={() => handleSort("id")}
                            title="Sort by ID"
                          >
                            <Group gap={4} wrap="nowrap" justify="space-between">
                              <Group gap={4} wrap="nowrap">
                                <IconKey size={13} color="#fbbf24" />
                                <Text
                                  size="xs"
                                  c={
                                    sortField === "id"
                                      ? "var(--color-neon-primary)"
                                      : "dimmed"
                                  }
                                  fw={sortField === "id" ? 800 : 700}
                                  style={{
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    fontSize: "11px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  id
                                </Text>
                              </Group>
                              {renderSortIcon("id")}
                            </Group>
                          </Table.Th>
                          {selectedCollection.fields
                            .filter(
                              (f) =>
                                !f.hidden &&
                                !["password", "tokenKey"].includes(f.name)
                            )
                            .map((f) => (
                              <Table.Th
                                key={f.name}
                                style={{
                                  cursor: "pointer",
                                  userSelect: "none",
                                  whiteSpace: "nowrap",
                                }}
                                onClick={() => handleSort(f.name)}
                                title={`Sort by ${f.name}`}
                              >
                                <Group gap={5} wrap="nowrap" justify="space-between">
                                  <Group gap={5} wrap="nowrap">
                                    {getFieldIcon(f.type, f.name)}
                                    <Text
                                      size="xs"
                                      c={
                                        sortField === f.name
                                          ? "var(--color-neon-primary)"
                                          : "dimmed"
                                      }
                                      fw={sortField === f.name ? 800 : 700}
                                      style={{
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        fontSize: "11px",
                                      }}
                                    >
                                      {f.name}
                                    </Text>
                                    {f.unique && (
                                      <Badge
                                        size="xs"
                                        variant="outline"
                                        color="blue"
                                        style={{
                                          height: 16,
                                          fontSize: "9px",
                                          padding: "0 4px",
                                          borderWidth: 1,
                                          textTransform: "lowercase",
                                        }}
                                      >
                                        unique
                                      </Badge>
                                    )}
                                  </Group>
                                  {renderSortIcon(f.name)}
                                </Group>
                              </Table.Th>
                            ))}
                          <Table.Th
                            style={{
                              width: 130,
                              cursor: "pointer",
                              userSelect: "none",
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => handleSort("created_at")}
                            title="Sort by Created"
                          >
                            <Group gap={4} wrap="nowrap" justify="space-between">
                              <Group gap={4} wrap="nowrap">
                                <IconCalendar size={13} color="#a855f7" />
                                <Text
                                  size="xs"
                                  c={
                                    sortField === "created_at" ||
                                    sortField === "created"
                                      ? "var(--color-neon-primary)"
                                      : "dimmed"
                                  }
                                  fw={
                                    sortField === "created_at" ||
                                    sortField === "created"
                                      ? 800
                                      : 700
                                  }
                                  style={{
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    fontSize: "11px",
                                  }}
                                >
                                  created
                                </Text>
                              </Group>
                              {renderSortIcon("created_at")}
                            </Group>
                          </Table.Th>
                          <Table.Th
                            style={{
                              width: 130,
                              cursor: "pointer",
                              userSelect: "none",
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => handleSort("updated_at")}
                            title="Sort by Updated"
                          >
                            <Group gap={4} wrap="nowrap" justify="space-between">
                              <Group gap={4} wrap="nowrap">
                                <IconClock size={13} color="#ec4899" />
                                <Text
                                  size="xs"
                                  c={
                                    sortField === "updated_at" ||
                                    sortField === "updated"
                                      ? "var(--color-neon-primary)"
                                      : "dimmed"
                                  }
                                  fw={
                                    sortField === "updated_at" ||
                                    sortField === "updated"
                                      ? 800
                                      : 700
                                  }
                                  style={{
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    fontSize: "11px",
                                  }}
                                >
                                  updated
                                </Text>
                              </Group>
                              {renderSortIcon("updated_at")}
                            </Group>
                          </Table.Th>
                          <Table.Th style={{ width: 50, textAlign: "right" }}>
                            <Text size="xs" c="dimmed" fw={700}>
                              Action
                            </Text>
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {records.map((rec) => {
                          const isRowSelected = selectedRecordIds.includes(
                            rec.id,
                          );
                          return (
                            <Table.Tr
                              key={rec.id}
                              style={{
                                borderBottom:
                                  "1px solid var(--color-border-subtle)",
                                backgroundColor: isRowSelected
                                  ? "var(--color-neon-dim)"
                                  : "transparent",
                                cursor: "pointer",
                                transition: "background-color 0.1s ease",
                              }}
                              onClick={() => handleOpenEditRecord(rec)}
                            >
                              <Table.Td
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: 44, paddingLeft: 12 }}
                              >
                                <Checkbox
                                  size="xs"
                                  checked={isRowSelected}
                                  onChange={(e) => {
                                    if (e.currentTarget.checked) {
                                      setSelectedRecordIds([
                                        ...selectedRecordIds,
                                        rec.id,
                                      ]);
                                    } else {
                                      setSelectedRecordIds(
                                        selectedRecordIds.filter(
                                          (id) => id !== rec.id,
                                        ),
                                      );
                                    }
                                  }}
                                />
                              </Table.Td>
                              <Table.Td style={{ width: 155, minWidth: 155, whiteSpace: "nowrap" }}>
                                <Tooltip
                                  label="Click to copy ID"
                                  withArrow
                                  position="top"
                                >
                                   <Code
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await copyToClipboard(rec.id);
                                      notifications.show({
                                        message:
                                          "Copied record ID to clipboard",
                                        color: "teal",
                                      });
                                    }}
                                    style={{
                                      backgroundColor: "var(--color-bg-well)",
                                      color: "var(--color-text-primary)",
                                      border: "1px solid var(--color-border)",
                                      fontSize: "11.5px",
                                      padding: "3px 7px",
                                      borderRadius: 4,
                                      fontFamily: "var(--font-mono)",
                                      cursor: "copy",
                                      whiteSpace: "nowrap",
                                      display: "inline-block",
                                    }}
                                  >
                                    {rec.id?.substring(0, 15) || "-"}
                                  </Code>
                                </Tooltip>
                              </Table.Td>

                              {selectedCollection.fields
                                .filter(
                                  (f) =>
                                    !f.hidden &&
                                    !["password", "tokenKey"].includes(f.name)
                                )
                                .map((f) => {
                                  const isFileOrAvatar =
                                    f.type === "file" || f.name === "avatar";

                                  if (f.type === "bool") {
                                    return (
                                      <Table.Td key={f.name}>
                                        <Badge
                                          size="xs"
                                          variant="filled"
                                          style={{
                                            backgroundColor: rec[f.name]
                                              ? "rgba(16, 229, 122, 0.15)"
                                              : "rgba(239, 68, 68, 0.12)",
                                            color: rec[f.name]
                                              ? "var(--color-neon-primary)"
                                              : "#f87171",
                                            border: `1px solid ${
                                              rec[f.name]
                                                ? "var(--color-border-glow)"
                                                : "rgba(239, 68, 68, 0.25)"
                                            }`,
                                            textTransform: "capitalize",
                                            fontFamily: "var(--font-mono)",
                                            fontSize: "10.5px",
                                          }}
                                        >
                                          {rec[f.name] ? "True" : "False"}
                                        </Badge>
                                      </Table.Td>
                                    );
                                  }

                                  if (isFileOrAvatar) {
                                    let fileObj: {
                                      name?: string;
                                      data?: string;
                                      url?: string;
                                    } | null = null;
                                    const rawVal = rec[f.name];
                                    if (rawVal) {
                                      if (typeof rawVal === "object") {
                                        fileObj = rawVal;
                                      } else if (typeof rawVal === "string") {
                                        if (
                                          rawVal.startsWith("{") ||
                                          rawVal.startsWith("[")
                                        ) {
                                          try {
                                            fileObj = JSON.parse(rawVal);
                                          } catch {
                                            fileObj = { name: rawVal };
                                          }
                                        } else if (
                                          rawVal.startsWith("data:image/") ||
                                          rawVal.startsWith("http://") ||
                                          rawVal.startsWith("https://") ||
                                          rawVal.startsWith("/api/")
                                        ) {
                                          fileObj = {
                                            data: rawVal,
                                            name: f.name,
                                          };
                                        } else if (rawVal === "[object Object]") {
                                          fileObj = { name: "avatar.png" };
                                        } else {
                                          const isImg = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(rawVal);
                                          const fileUrl = `/api/files/${encodeURIComponent(selectedCollection.name)}/${encodeURIComponent(rec.id)}/${encodeURIComponent(rawVal)}`;
                                          fileObj = {
                                            name: rawVal,
                                            url: fileUrl,
                                            data: isImg ? fileUrl : undefined,
                                          };
                                        }
                                      }
                                    }

                                    const imgSrc =
                                      fileObj?.data || fileObj?.url;

                                    return (
                                      <Table.Td key={f.name}>
                                        {fileObj ? (
                                          <Group gap={8} wrap="nowrap">
                                            {imgSrc ? (
                                              <img
                                                src={imgSrc}
                                                alt={
                                                  fileObj.name || f.name || "avatar"
                                                }
                                                style={{
                                                  width: 28,
                                                  height: 28,
                                                  borderRadius:
                                                    f.name === "avatar"
                                                      ? "50%"
                                                      : 6,
                                                  objectFit: "cover",
                                                  border:
                                                    "1px solid var(--color-border-glow)",
                                                  backgroundColor:
                                                    "var(--color-bg-well)",
                                                }}
                                              />
                                            ) : (
                                              <Box
                                                style={{
                                                  width: 28,
                                                  height: 28,
                                                  borderRadius:
                                                    f.name === "avatar"
                                                      ? "50%"
                                                      : 6,
                                                  backgroundColor:
                                                    "var(--color-neon-dim)",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  color:
                                                    "var(--color-neon-primary)",
                                                  border:
                                                    "1px solid var(--color-border-glow)",
                                                }}
                                              >
                                                {f.name === "avatar" ? (
                                                  <IconUser size={15} />
                                                ) : (
                                                  <IconFile size={15} />
                                                )}
                                              </Box>
                                            )}
                                            <Text
                                              size="xs"
                                              truncate
                                              style={{
                                                maxWidth: 120,
                                                fontFamily:
                                                  "var(--font-mono)",
                                                fontSize: "11.5px",
                                                color:
                                                  "var(--color-text-primary)",
                                              }}
                                            >
                                              {fileObj.name &&
                                              fileObj.name !== "[object Object]"
                                                ? fileObj.name
                                                : f.name}
                                            </Text>
                                          </Group>
                                        ) : (
                                          <Text size="xs" c="dimmed">
                                            -
                                          </Text>
                                        )}
                                      </Table.Td>
                                    );
                                  }

                                  if (f.type === "json") {
                                    const rawJson = typeof rec[f.name] === "object"
                                      ? JSON.stringify(rec[f.name], null, 2)
                                      : String(rec[f.name] ?? "");
                                    const preview = rawJson.length > 60
                                      ? rawJson.slice(0, 60) + "..."
                                      : rawJson;
                                    return (
                                      <Table.Td key={f.name}>
                                        <Code
                                          onClick={() => {
                                            setJsonExpandTitle(f.name);
                                            setJsonExpandContent(rawJson);
                                            setJsonExpandModalOpen(true);
                                          }}
                                          style={{
                                            backgroundColor: "var(--color-bg-well)",
                                            color: "#38bdf8",
                                            fontSize: "11px",
                                            border: "1px solid var(--color-border)",
                                            maxWidth: 200,
                                            display: "inline-block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            cursor: "pointer",
                                          }}
                                          title="Click to expand"
                                        >
                                          {preview || "-"}
                                        </Code>
                                      </Table.Td>
                                    );
                                  }

                                  if (f.type === "url") {
                                    const urlVal = rec[f.name] != null ? String(rec[f.name]) : "";
                                    return (
                                      <Table.Td key={f.name}>
                                        {urlVal ? (
                                          <a
                                            href={urlVal}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              color: "#38bdf8",
                                              fontSize: "12.5px",
                                              fontFamily: "var(--font-mono)",
                                              display: "inline-block",
                                              maxWidth: 220,
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                              textDecoration: "none",
                                              verticalAlign: "middle",
                                            }}
                                            title={urlVal}
                                          >
                                            {urlVal}
                                          </a>
                                        ) : (
                                          <Text size="xs" c="dimmed">-</Text>
                                        )}
                                      </Table.Td>
                                    );
                                  }

                                  return (
                                    <Table.Td key={f.name}>
                                      <Text
                                        size="xs"
                                        truncate
                                        style={{
                                          maxWidth: 220,
                                          color: "var(--color-text-primary)",
                                          fontSize: "12.5px",
                                        }}
                                      >
                                        {rec[f.name] !== undefined &&
                                        rec[f.name] !== null
                                          ? String(rec[f.name])
                                          : "-"}
                                      </Text>
                                    </Table.Td>
                                  );
                                })}

                              <Table.Td>
                                <Stack gap={1}>
                                  <Text
                                    size="xs"
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "11px",
                                      color: "var(--color-text-secondary)",
                                    }}
                                  >
                                    {rec.created_at
                                      ? rec.created_at.substring(0, 10)
                                      : "-"}
                                  </Text>
                                  <Text
                                    size="10px"
                                    c="dimmed"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {rec.created_at
                                      ? rec.created_at.substring(11, 19) + "Z"
                                      : ""}
                                  </Text>
                                </Stack>
                              </Table.Td>

                              <Table.Td>
                                <Stack gap={1}>
                                  <Text
                                    size="xs"
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "11px",
                                      color: "var(--color-text-secondary)",
                                    }}
                                  >
                                    {rec.updated_at
                                      ? rec.updated_at.substring(0, 10)
                                      : "-"}
                                  </Text>
                                  <Text
                                    size="10px"
                                    c="dimmed"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {rec.updated_at
                                      ? rec.updated_at.substring(11, 19) + "Z"
                                      : ""}
                                  </Text>
                                </Stack>
                              </Table.Td>

                              <Table.Td
                                style={{ textAlign: "right" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Menu
                                  shadow="md"
                                  width={160}
                                  position="left-start"
                                >
                                  <Menu.Target>
                                    <ActionIcon
                                      variant="subtle"
                                      size="sm"
                                      color="gray"
                                    >
                                      <IconDotsVertical size={14} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown
                                    style={{
                                      backgroundColor: "var(--color-bg-card)",
                                      borderColor: "var(--color-border)",
                                    }}
                                  >
                                    <Menu.Item
                                      leftSection={<IconEdit size={13} />}
                                      onClick={() => handleOpenEditRecord(rec)}
                                    >
                                      Edit Record
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconCopy size={13} />}
                                      onClick={async () => {
                                        await copyToClipboard(
                                          JSON.stringify(rec, null, 2),
                                        );
                                        notifications.show({
                                          message:
                                            "Copied record JSON to clipboard",
                                          color: "teal",
                                        });
                                      }}
                                    >
                                      Copy JSON
                                    </Menu.Item>
                                    <Menu.Item
                                      color="red"
                                      leftSection={<IconTrash size={13} />}
                                      onClick={() => handleDeleteRecord(rec.id)}
                                    >
                                      Delete Record
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}

                        {records.length === 0 && (
                          <Table.Tr>
                            <Table.Td
                              colSpan={selectedCollection.fields.length + 4}
                              style={{ textAlign: "center", padding: "80px 0" }}
                            >
                              <Stack align="center" gap="xs">
                                <Box
                                  style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: "50%",
                                    backgroundColor: "var(--color-neon-dim)",
                                    border:
                                      "1px solid var(--color-border-glow)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--color-neon-primary)",
                                    marginBottom: 6,
                                  }}
                                >
                                  <IconTable size={26} />
                                </Box>
                                <Title
                                  order={4}
                                  style={{ color: "var(--color-text-primary)" }}
                                >
                                  No records found in {selectedCollection.name}
                                </Title>
                                <Text
                                  c="dimmed"
                                  size="xs"
                                  style={{ maxWidth: 360 }}
                                >
                                  Start building your database by adding records
                                  or importing sample dataset.
                                </Text>
                                <Button
                                  size="xs"
                                  leftSection={<IconPlus size={14} />}
                                  onClick={handleOpenCreateRecord}
                                  mt="xs"
                                  style={{
                                    backgroundColor:
                                      "var(--color-neon-primary)",
                                    color: "var(--color-neon-text)",
                                    fontWeight: 700,
                                  }}
                                >
                                  Add First Record
                                </Button>
                              </Stack>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <ScrollArea style={{ flex: 1 }} p="md" scrollbarSize={6}>
                    <Paper
                      p="md"
                      withBorder
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {JSON.stringify(records, null, 2)}
                      </pre>
                    </Paper>
                  </ScrollArea>
                )}
              </div>

              {/* Modern Pagination & Stats Footer */}
              <div
                style={{
                  height: 42,
                  minHeight: 42,
                  backgroundColor: "var(--color-bg-surface)",
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 18px",
                  fontSize: "12px",
                  userSelect: "none",
                }}
              >
                <Group gap={8}>
                  <Text size="xs" c="dimmed">
                    Showing{" "}
                    <Text span fw={600} c="var(--color-text-primary)">
                      {records.length > 0
                        ? (recordPage - 1) * parseInt(pageSize, 10) + 1
                        : 0}
                      -
                      {Math.min(
                        recordPage * parseInt(pageSize, 10),
                        totalRecords,
                      )}
                    </Text>{" "}
                    of{" "}
                    <Text span fw={600} c="var(--color-text-primary)">
                      {totalRecords}
                    </Text>{" "}
                    records
                  </Text>
                </Group>

                <Group gap="md">
                  <Pagination
                    size="xs"
                    total={totalPages}
                    value={recordPage}
                    onChange={(p) =>
                      loadRecords(
                        selectedCollection,
                        p,
                        parseInt(pageSize, 10) || 20,
                      )
                    }
                    color="neonGreen"
                  />

                  <Group gap={6}>
                    <Text size="xs" c="dimmed">
                      Rows per page:
                    </Text>
                    <Select
                      size="xs"
                      w={68}
                      value={pageSize}
                      onChange={(val) => setPageSize(val || "20")}
                      data={["10", "20", "50", "100"]}
                      styles={{
                        input: {
                          backgroundColor: "var(--color-bg-well)",
                          borderColor: "var(--color-border)",
                          height: 26,
                          fontSize: "11.5px",
                        },
                      }}
                    />
                  </Group>
                </Group>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
              }}
            >
              <Paper
                p="xl"
                withBorder
                style={{
                  background: "var(--color-bg-card)",
                  borderColor: "var(--color-border)",
                  textAlign: "center",
                  maxWidth: 420,
                  borderRadius: 12,
                }}
              >
                <Stack align="center" gap="xs" py="md">
                  <Box
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: "var(--color-neon-dim)",
                      border: "1px solid var(--color-border-glow)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-neon-primary)",
                      marginBottom: 10,
                    }}
                  >
                    <IconDatabase size={30} />
                  </Box>
                  <Title
                    order={3}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    No Collection Selected
                  </Title>
                  <Text size="xs" c="dimmed">
                    Select a collection from the left explorer or create a new
                    one to manage schema fields and stored data.
                  </Text>
                  <Button
                    leftSection={<IconPlus size={15} />}
                    onClick={handleOpenCreateCollection}
                    style={{
                      backgroundColor: "var(--color-neon-primary)",
                      color: "var(--color-neon-text)",
                      fontWeight: 700,
                    }}
                    mt="sm"
                  >
                    Create Collection
                  </Button>
                </Stack>
              </Paper>
            </div>
          )}
        </div>
      </div>

      {/* API Preview Drawer */}
      <ApiPreviewDrawer
        opened={apiPreviewOpen}
        onClose={() => setApiPreviewOpen(false)}
        collection={selectedCollection}
      />

      {/* Table Indexes Inspector Modal */}
      <Modal
        opened={indexesModalOpen}
        onClose={() => setIndexesModalOpen(false)}
        size="lg"
        title={
          <Group gap={8}>
            <IconDatabase size={18} color="var(--color-neon-primary)" />
            <Text fw={700} size="md">
              Table Indexes: {selectedCollection?.name}
            </Text>
            <Badge size="xs" variant="outline" color="gray">
              SQLite
            </Badge>
          </Group>
        }
        styles={{
          header: {
            backgroundColor: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            padding: "16px 20px",
          },
          body: {
            backgroundColor: "var(--color-bg-base)",
            padding: 20,
          },
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              View and manage active SQLite indexes on the{" "}
              <b>{selectedCollection?.name}</b> table.
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                loading={loadingIndexes}
                onClick={() =>
                  selectedCollection &&
                  loadTableIndexes(selectedCollection.name)
                }
                style={{
                  color: "var(--color-text-dimmed)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Refresh
              </Button>
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setShowAddIndexForm(!showAddIndexForm)}
                style={{
                  backgroundColor: "var(--color-neon-primary)",
                  color: "var(--color-neon-text)",
                  fontWeight: 600,
                }}
              >
                {showAddIndexForm ? "Hide Form" : "Create Index"}
              </Button>
            </Group>
          </Group>

          {/* Add Index Collapsible Form */}
          <Collapse expanded={showAddIndexForm}>
            <Paper
              p="md"
              withBorder
              mb="sm"
              style={{
                backgroundColor: "var(--color-bg-card)",
                borderColor: "var(--color-border-glow)",
                borderRadius: 8,
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="xs" fw={700} c="var(--color-neon-primary)">
                    Create New Index on {selectedCollection?.name}
                  </Text>
                  <Switch
                    size="xs"
                    label="Raw SQL"
                    checked={useRawSql}
                    onChange={(e) => setUseRawSql(e.currentTarget.checked)}
                  />
                </Group>

                {useRawSql ? (
                  <TextInput
                    label="Raw SQL Index Statement"
                    placeholder={`CREATE INDEX idx_${selectedCollection?.name}_custom ON ${selectedCollection?.name} (col1);`}
                    size="xs"
                    value={newIndexRawSql}
                    onChange={(e) => setNewIndexRawSql(e.target.value)}
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                ) : (
                  <>
                    <MultiSelect
                      label="Select Column(s)"
                      placeholder="Select columns to index..."
                      size="xs"
                      data={
                        selectedCollection
                          ? selectedCollection.fields.map((f) => f.name)
                          : []
                      }
                      value={newIndexCols}
                      onChange={setNewIndexCols}
                      searchable
                      clearable
                      styles={{
                        input: {
                          backgroundColor: "var(--color-bg-well)",
                          borderColor: "var(--color-border)",
                        },
                      }}
                    />
                    <Grid>
                      <Grid.Col span={8}>
                        <TextInput
                          label="Index Name (optional)"
                          placeholder={`idx_${selectedCollection?.name}_${newIndexCols.join("_") || "cols"}`}
                          size="xs"
                          value={newIndexName}
                          onChange={(e) => setNewIndexName(e.target.value)}
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                              fontFamily: "var(--font-mono)",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col
                        span={4}
                        style={{ display: "flex", alignItems: "flex-end" }}
                      >
                        <Checkbox
                          size="xs"
                          label="Unique Index"
                          checked={newIndexUnique}
                          onChange={(e) =>
                            setNewIndexUnique(e.currentTarget.checked)
                          }
                          mb={8}
                        />
                      </Grid.Col>
                    </Grid>
                  </>
                )}

                <Button
                  size="xs"
                  leftSection={<IconCheck size={14} />}
                  onClick={handleCreateLiveIndex}
                  style={{
                    backgroundColor: "var(--color-neon-primary)",
                    color: "var(--color-neon-text)",
                    fontWeight: 700,
                  }}
                >
                  Create Index
                </Button>
              </Stack>
            </Paper>
          </Collapse>

          {/* Active Indexes List */}
          {tableIndexes.length > 0 ? (
            <Stack gap="xs">
              {tableIndexes.map((idxInfo, i) => (
                <Paper
                  key={idxInfo.name || i}
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={8} wrap="nowrap">
                        <IconDatabase
                          size={15}
                          color="var(--color-neon-primary)"
                        />
                        <Text
                          size="xs"
                          fw={700}
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {idxInfo.name}
                        </Text>
                        {idxInfo.primaryKey && (
                          <Badge size="xs" color="yellow" variant="light">
                            PRIMARY KEY
                          </Badge>
                        )}
                        {idxInfo.unique && !idxInfo.primaryKey && (
                          <Badge size="xs" color="blue" variant="light">
                            UNIQUE
                          </Badge>
                        )}
                        {!idxInfo.unique && !idxInfo.primaryKey && (
                          <Badge size="xs" color="gray" variant="light">
                            INDEX
                          </Badge>
                        )}
                      </Group>

                      {idxInfo.columns && idxInfo.columns.length > 0 && (
                        <Group gap={4}>
                          <Text size="xs" c="dimmed">
                            Columns:
                          </Text>
                          {idxInfo.columns.map((colName) => (
                            <Badge
                              key={colName}
                              size="xs"
                              variant="outline"
                              style={{
                                borderColor: "var(--color-border-glow)",
                                color: "var(--color-neon-primary)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {colName}
                            </Badge>
                          ))}
                        </Group>
                      )}

                      {idxInfo.sql && (
                        <Code
                          block
                          style={{
                            fontSize: "11px",
                            backgroundColor: "var(--color-bg-well)",
                            color: "var(--color-text-primary)",
                            fontFamily: "var(--font-mono)",
                            wordBreak: "break-all",
                          }}
                        >
                          {idxInfo.sql}
                        </Code>
                      )}
                    </Stack>

                    {!idxInfo.primaryKey && (
                      <Tooltip label="Drop Index" withArrow>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => handleDropLiveIndex(idxInfo.name)}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper
              p="xl"
              withBorder
              style={{
                backgroundColor: "var(--color-bg-card)",
                borderColor: "var(--color-border)",
                textAlign: "center",
              }}
            >
              <Text size="xs" c="dimmed">
                No active indexes found on this table.
              </Text>
            </Paper>
          )}
        </Stack>
      </Modal>

      {/* DRAWER 1: Schema Editor (AlsaBase Modern Schema Drawer) */}
      <Drawer
        opened={schemaDrawerOpen}
        onClose={() => setSchemaDrawerOpen(false)}
        position="right"
        size="680px"
        title={
          <Group justify="space-between" w="100%" pr="xs">
            <Group gap={8}>
              <IconSettings size={18} color="var(--color-neon-primary)" />
              <Text fw={700} size="md">
                {editingCollectionName
                  ? `Edit ${collectionFormName} Collection`
                  : "New Collection"}
              </Text>
            </Group>
          </Group>
        }
        styles={{
          header: {
            backgroundColor: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            padding: "16px 20px",
          },
          body: {
            backgroundColor: "var(--color-bg-base)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 65px)",
            overflowY: "auto",
          },
        }}
      >
        <Stack gap="md" style={{ flex: 1 }}>
          {/* Top Collection Info Box */}
          <Paper
            p="md"
            withBorder
            style={{
              backgroundColor: "var(--color-bg-card)",
              borderColor: "var(--color-border)",
              borderRadius: 8,
            }}
          >
            <Group justify="space-between" align="center">
              <TextInput
                label="Collection Name"
                description="Database table identifier"
                placeholder="e.g. posts, products, analytics"
                value={collectionFormName}
                onChange={(e) => setCollectionFormName(e.target.value)}
                disabled={Boolean(editingCollectionName)}
                required
                style={{ flex: 1, maxWidth: 320 }}
                styles={{
                  input: {
                    backgroundColor: "var(--color-bg-well)",
                    borderColor: "var(--color-border)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  },
                }}
              />
              <Box style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed" mb={2}>
                  Collection Type
                </Text>
                <Badge
                  size="sm"
                  variant="filled"
                  style={{
                    backgroundColor:
                      collectionType === "auth"
                        ? "var(--color-neon-dim)"
                        : "var(--color-bg-well)",
                    color:
                      collectionType === "auth"
                        ? "var(--color-neon-primary)"
                        : "var(--color-text-dimmed)",
                    border: "1px solid var(--color-border)",
                    textTransform: "capitalize",
                  }}
                >
                  Type: {collectionType === "auth" ? "Auth" : "Base"}
                </Badge>
              </Box>
            </Group>
          </Paper>

          {/* Schema Drawer Tabs */}
          <Tabs value={activeTab} onChange={setActiveTab} color="neonGreen">
            <Tabs.List style={{ borderColor: "var(--color-border)" }} mb="md">
              <Tabs.Tab value="fields" leftSection={<IconTable size={15} />}>
                Fields & Schema
              </Tabs.Tab>
              <Tabs.Tab
                value="indexes"
                leftSection={<IconDatabase size={15} />}
              >
                Indexes ({collectionIndexes.length})
              </Tabs.Tab>
              <Tabs.Tab value="rules" leftSection={<IconShield size={15} />}>
                API Access Rules
              </Tabs.Tab>
              {(collectionType === "auth" ||
                collectionFormName === "users") && (
                <Tabs.Tab
                  value="options"
                  leftSection={<IconSettings size={15} />}
                >
                  Auth Options
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* TAB 1: FIELDS */}
            <Tabs.Panel value="fields">
              <Stack gap="sm">
                {/* For Auth collection: Default System Fields */}
                {(collectionType === "auth" ||
                  collectionFormName === "users") && (
                  <Paper
                    withBorder
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      borderColor: "var(--color-border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <Stack gap={0}>
                      <Group
                        justify="space-between"
                        px="md"
                        py={9}
                        style={{
                          borderBottom: "1px solid var(--color-border-subtle)",
                        }}
                      >
                        <Group gap="xs">
                          <IconLetterT size={16} color="#38bdf8" />
                          <Text
                            size="xs"
                            fw={600}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            id
                          </Text>
                        </Group>
                        <Badge size="xs" color="teal" variant="light">
                          System Primary Key
                        </Badge>
                      </Group>

                      <Group
                        justify="space-between"
                        px="md"
                        py={9}
                        style={{
                          borderBottom: "1px solid var(--color-border-subtle)",
                        }}
                      >
                        <Group gap="xs">
                          <IconLock size={16} color="#fbbf24" />
                          <Text
                            size="xs"
                            fw={600}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            password
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <Badge size="xs" color="teal" variant="light">
                            Required
                          </Badge>
                          <Badge size="xs" color="red" variant="light">
                            Hidden
                          </Badge>
                        </Group>
                      </Group>

                      <Group
                        justify="space-between"
                        px="md"
                        py={9}
                        style={{
                          borderBottom: "1px solid var(--color-border-subtle)",
                        }}
                      >
                        <Group gap="xs">
                          <IconMail size={16} color="#06b6d4" />
                          <Text
                            size="xs"
                            fw={600}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            email
                          </Text>
                        </Group>
                        <Badge size="xs" color="teal" variant="light">
                          Required / Unique
                        </Badge>
                      </Group>
                    </Stack>
                  </Paper>
                )}

                {/* Base Collection System Fields Overview */}
                {collectionType !== "auth" &&
                  collectionFormName !== "users" && (
                    <div>
                      <Text
                        size="xs"
                        fw={700}
                        c="dimmed"
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                        mb={6}
                      >
                        System Fields
                      </Text>
                      <Paper
                        p="xs"
                        withBorder
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Stack gap={6}>
                          <Group
                            justify="space-between"
                            px="xs"
                            py={4}
                            style={{
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <Group gap="xs">
                              <IconKey size={15} color="#fbbf24" />
                              <Text
                                size="xs"
                                fw={600}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                id
                              </Text>
                            </Group>
                            <Badge size="xs" variant="outline" color="gray">
                              System ID (Primary Key)
                            </Badge>
                          </Group>
                          <Group
                            justify="space-between"
                            px="xs"
                            py={4}
                            style={{
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <Group gap="xs">
                              <IconCalendar size={15} color="#a855f7" />
                              <Text
                                size="xs"
                                fw={600}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                created_at
                              </Text>
                            </Group>
                            <Badge size="xs" variant="outline" color="violet">
                              Autodate: Create
                            </Badge>
                          </Group>
                          <Group justify="space-between" px="xs" py={4}>
                            <Group gap="xs">
                              <IconClock size={15} color="#ec4899" />
                              <Text
                                size="xs"
                                fw={600}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                updated_at
                              </Text>
                            </Group>
                            <Badge size="xs" variant="outline" color="pink">
                              Autodate: Update
                            </Badge>
                          </Group>
                        </Stack>
                      </Paper>
                    </div>
                  )}

                {/* Custom Fields List */}
                {fields.length > 0 && (
                  <Stack gap="xs" mt="xs">
                    <Text
                      size="xs"
                      fw={700}
                      c="dimmed"
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Custom Fields ({fields.length})
                    </Text>

                    {fields.map((field, idx) => {
                      const isExpanded = expandedFieldIndex === idx;
                      return (
                        <Paper
                          key={idx}
                          withBorder
                          style={{
                            backgroundColor: "var(--color-bg-card)",
                            borderColor: isExpanded
                              ? "var(--color-border-glow)"
                              : "var(--color-border)",
                            borderRadius: 8,
                            overflow: "hidden",
                            transition: "border-color 0.15s ease",
                          }}
                        >
                          <Group justify="space-between" p="sm" wrap="nowrap">
                            <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                              <Box
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                {getFieldIcon(field.type)}
                              </Box>
                              <TextInput
                                placeholder="field_name"
                                value={field.name}
                                onChange={(e) =>
                                  updateField(idx, { name: e.target.value })
                                }
                                size="xs"
                                style={{ flex: 1 }}
                                styles={{
                                  input: {
                                    backgroundColor: "var(--color-bg-well)",
                                    borderColor: "var(--color-border)",
                                    fontFamily: "var(--font-mono)",
                                  },
                                }}
                              />
                              <Select
                                size="xs"
                                value={field.type}
                                onChange={(val: any) =>
                                  updateField(idx, { type: val })
                                }
                                data={[
                                  { label: "text", value: "text" },
                                  { label: "number", value: "number" },
                                  { label: "bool", value: "bool" },
                                  { label: "json", value: "json" },
                                  { label: "file", value: "file" },
                                  { label: "date", value: "date" },
                                  { label: "email", value: "email" },
                                  { label: "url", value: "url" },
                                  { label: "select", value: "select" },
                                ]}
                                w={105}
                                styles={{
                                  input: {
                                    backgroundColor: "var(--color-bg-well)",
                                    borderColor: "var(--color-border)",
                                  },
                                }}
                              />
                              {field.type === "file" && (
                                <Select
                                  size="xs"
                                  w={95}
                                  value={
                                    field.maxSelect === 1 || !field.maxSelect
                                      ? "single"
                                      : "multiple"
                                  }
                                  onChange={(val) =>
                                    updateField(idx, {
                                      maxSelect: val === "multiple" ? 10 : 1,
                                    })
                                  }
                                  data={[
                                    { label: "Single", value: "single" },
                                    { label: "Multiple", value: "multiple" },
                                  ]}
                                  styles={{
                                    input: {
                                      backgroundColor: "var(--color-bg-well)",
                                      borderColor: "var(--color-border)",
                                    },
                                  }}
                                />
                              )}
                            </Group>

                            <Group gap={6} wrap="nowrap">
                              <Tooltip
                                label="Field Options & Constraints"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="md"
                                  variant="subtle"
                                  onClick={() =>
                                    setExpandedFieldIndex(
                                      isExpanded ? null : idx,
                                    )
                                  }
                                  style={{
                                    color: isExpanded
                                      ? "var(--color-neon-primary)"
                                      : "var(--color-text-dimmed)",
                                    backgroundColor: isExpanded
                                      ? "var(--color-neon-dim)"
                                      : "transparent",
                                  }}
                                >
                                  <IconSettings size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip
                                label="Remove Field"
                                withArrow
                                position="top"
                              >
                                <ActionIcon
                                  size="md"
                                  color="red"
                                  variant="subtle"
                                  onClick={() =>
                                    setFields(
                                      fields.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <IconTrash size={15} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Group>

                          {/* Expandable Field Options */}
                          {isExpanded && (
                            <Box
                              p="md"
                              style={{
                                backgroundColor: "var(--color-bg-well)",
                                borderTop: "1px solid var(--color-border)",
                              }}
                            >
                              {field.type === "file" ? (
                                <Stack gap="sm">
                                  <div>
                                    <Group
                                      justify="space-between"
                                      align="center"
                                      mb={4}
                                    >
                                      <Group gap={4}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="var(--color-text-primary)"
                                        >
                                          Allowed mime types
                                        </Text>
                                        <Tooltip
                                          label="Supported MIME types or extensions. Leave empty to allow any file type."
                                          withArrow
                                        >
                                          <ActionIcon
                                            variant="transparent"
                                            size="xs"
                                            color="gray"
                                          >
                                            <IconInfoCircle size={13} />
                                          </ActionIcon>
                                        </Tooltip>
                                      </Group>

                                      {/* Presets dropdown */}
                                      <Menu
                                        shadow="md"
                                        width={240}
                                        position="bottom-end"
                                      >
                                        <Menu.Target>
                                          <Button
                                            variant="subtle"
                                            size="compact-xs"
                                            rightSection={
                                              <IconChevronDown size={12} />
                                            }
                                            style={{
                                              color:
                                                "var(--color-neon-primary)",
                                              fontSize: "11px",
                                            }}
                                          >
                                            Choose presets
                                          </Button>
                                        </Menu.Target>
                                        <Menu.Dropdown
                                          style={{
                                            backgroundColor:
                                              "var(--color-bg-card)",
                                            borderColor:
                                              "var(--color-border)",
                                          }}
                                        >
                                          <Menu.Item
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [
                                                  "image/jpeg",
                                                  "image/png",
                                                  "image/svg+xml",
                                                  "image/gif",
                                                  "image/webp",
                                                ],
                                              })
                                            }
                                          >
                                            Images (jpg, png, svg, gif, webp)
                                          </Menu.Item>
                                          <Menu.Item
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [
                                                  "application/pdf",
                                                  "application/msword",
                                                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                  "text/plain",
                                                ],
                                              })
                                            }
                                          >
                                            Documents (pdf, doc, docx, txt)
                                          </Menu.Item>
                                          <Menu.Item
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [
                                                  "audio/mpeg",
                                                  "audio/ogg",
                                                  "audio/wav",
                                                ],
                                              })
                                            }
                                          >
                                            Audio (mp3, ogg, wav)
                                          </Menu.Item>
                                          <Menu.Item
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [
                                                  "video/mp4",
                                                  "video/webm",
                                                  "video/quicktime",
                                                ],
                                              })
                                            }
                                          >
                                            Video (mp4, webm, mov)
                                          </Menu.Item>
                                          <Menu.Item
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [
                                                  "application/zip",
                                                  "application/x-tar",
                                                  "application/gzip",
                                                ],
                                              })
                                            }
                                          >
                                            Archives (zip, tar, gz)
                                          </Menu.Item>
                                          <Menu.Divider />
                                          <Menu.Item
                                            color="red"
                                            onClick={() =>
                                              updateField(idx, {
                                                mimeTypes: [],
                                              })
                                            }
                                          >
                                            Clear all (Allow any)
                                          </Menu.Item>
                                        </Menu.Dropdown>
                                      </Menu>
                                    </Group>

                                    <TagsInput
                                      placeholder="e.g. image/png, image/jpeg, application/pdf (press Enter)"
                                      value={field.mimeTypes || []}
                                      onChange={(val) =>
                                        updateField(idx, { mimeTypes: val })
                                      }
                                      data={[
                                        "image/jpeg",
                                        "image/png",
                                        "image/svg+xml",
                                        "image/gif",
                                        "image/webp",
                                        "application/pdf",
                                        "text/plain",
                                        "video/mp4",
                                        "audio/mpeg",
                                        "application/zip",
                                      ]}
                                      size="xs"
                                      styles={{
                                        input: {
                                          backgroundColor:
                                            "var(--color-bg-well)",
                                          borderColor:
                                            "var(--color-border)",
                                          fontFamily: "var(--font-mono)",
                                          fontSize: "12px",
                                        },
                                        pill: {
                                          backgroundColor:
                                            "rgba(255, 255, 255, 0.08)",
                                          color:
                                            "var(--color-text-primary)",
                                          borderColor:
                                            "var(--color-border)",
                                        },
                                      }}
                                    />
                                  </div>

                                  <Grid>
                                    <Grid.Col span={7}>
                                      <TextInput
                                        label={
                                          <Group gap={4}>
                                            <Text size="xs" fw={600}>
                                              Thumb sizes
                                            </Text>
                                            <Tooltip
                                              label="Auto-generated thumbnail dimensions e.g. 50x50, 480x720"
                                              withArrow
                                            >
                                              <ActionIcon
                                                variant="transparent"
                                                size="xs"
                                                color="gray"
                                              >
                                                <IconInfoCircle size={13} />
                                              </ActionIcon>
                                            </Tooltip>
                                          </Group>
                                        }
                                        description="Use comma as separator. Supported formats"
                                        placeholder="e.g. 50x50, 480x720"
                                        size="xs"
                                        value={
                                          Array.isArray(field.thumbs)
                                            ? field.thumbs.join(", ")
                                            : field.thumbs || ""
                                        }
                                        onChange={(e) =>
                                          updateField(idx, {
                                            thumbs: e.target.value
                                              ? e.target.value
                                                  .split(",")
                                                  .map((s) => s.trim())
                                              : [],
                                          })
                                        }
                                        styles={{
                                          input: {
                                            backgroundColor:
                                              "var(--color-bg-well)",
                                            borderColor:
                                              "var(--color-border)",
                                            fontFamily: "var(--font-mono)",
                                          },
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={5}>
                                      <NumberInput
                                        label="Max size"
                                        description="In bytes (~5MB default)"
                                        placeholder="5242880"
                                        size="xs"
                                        value={field.maxSize ?? 5242880}
                                        onChange={(val) =>
                                          updateField(idx, {
                                            maxSize:
                                              typeof val === "number"
                                                ? val
                                                : undefined,
                                          })
                                        }
                                        styles={{
                                          input: {
                                            backgroundColor:
                                              "var(--color-bg-well)",
                                            borderColor:
                                              "var(--color-border)",
                                            fontFamily: "var(--font-mono)",
                                          },
                                        }}
                                      />
                                    </Grid.Col>
                                  </Grid>

                                  {/* Protected Switch */}
                                  <Paper
                                    p="xs"
                                    withBorder
                                    style={{
                                      backgroundColor:
                                        "var(--color-bg-card)",
                                      borderColor: "var(--color-border)",
                                      borderRadius: 6,
                                    }}
                                  >
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
                                      <div>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="var(--color-text-primary)"
                                        >
                                          Protected
                                        </Text>
                                        <Text size="11px" c="dimmed">
                                          File download requests will need to
                                          satisfy the View API rule.
                                        </Text>
                                      </div>
                                      <Switch
                                        checked={Boolean(field.protected)}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            protected:
                                              e.currentTarget.checked,
                                          })
                                        }
                                        size="sm"
                                        color="neonGreen"
                                      />
                                    </Group>
                                  </Paper>

                                  <TextInput
                                    label="Help text"
                                    placeholder="Optional instruction shown to users in the editor"
                                    size="xs"
                                    value={field.helpText || ""}
                                    onChange={(e) =>
                                      updateField(idx, {
                                        helpText: e.target.value,
                                      })
                                    }
                                    styles={{
                                      input: {
                                        backgroundColor:
                                          "var(--color-bg-well)",
                                        borderColor:
                                          "var(--color-border)",
                                      },
                                    }}
                                  />

                                  <Group
                                    justify="space-between"
                                    mt="xs"
                                    pt="xs"
                                  >
                                    <Group gap="lg">
                                      <Checkbox
                                        size="xs"
                                        label="Required (!='')"
                                        checked={field.required || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            required:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Unique"
                                        checked={field.unique || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            unique:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Indexed"
                                        checked={field.indexed || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            indexed:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Presentable"
                                        checked={field.presentable || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            presentable:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Hidden"
                                        checked={field.hidden || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            hidden:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                    </Group>
                                  </Group>
                                </Stack>
                              ) : (
                                <>
                                  {/* Min/Max: hidden for bool; labeled correctly for number vs text */}
                                  {field.type !== "bool" && (
                                    <Grid mb="sm">
                                      <Grid.Col span={6}>
                                        <NumberInput
                                          label={field.type === "number" ? "Min Value" : "Min Length"}
                                          placeholder="e.g. 0"
                                          size="xs"
                                          value={field.min ?? ""}
                                          onChange={(val) =>
                                            updateField(idx, {
                                              min:
                                                typeof val === "number"
                                                  ? val
                                                  : undefined,
                                            })
                                          }
                                          styles={{
                                            input: {
                                              backgroundColor: "var(--color-bg-well)",
                                              borderColor: "var(--color-border)",
                                            },
                                          }}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={6}>
                                        <NumberInput
                                          label={field.type === "number" ? "Max Value" : "Max Length"}
                                          placeholder={field.type === "number" ? "e.g. 1000" : "e.g. 5000"}
                                          size="xs"
                                          value={field.max ?? ""}
                                          onChange={(val) =>
                                            updateField(idx, {
                                              max:
                                                typeof val === "number"
                                                  ? val
                                                  : undefined,
                                            })
                                          }
                                          styles={{
                                            input: {
                                              backgroundColor: "var(--color-bg-well)",
                                              borderColor: "var(--color-border)",
                                            },
                                          }}
                                        />
                                      </Grid.Col>
                                    </Grid>
                                  )}

                                  {/* Number-specific: noDecimal toggle */}
                                  {field.type === "number" && (
                                    <Checkbox
                                      size="xs"
                                      label="No decimal (integer only)"
                                      checked={field.noDecimal || false}
                                      onChange={(e) =>
                                        updateField(idx, { noDecimal: e.currentTarget.checked })
                                      }
                                      mb="sm"
                                    />
                                  )}

                                  {/* URL-specific: pattern validation */}
                                  {field.type === "url" && (
                                    <Paper
                                      p="xs"
                                      withBorder
                                      mb="sm"
                                      style={{
                                        backgroundColor: "var(--color-bg-card)",
                                        borderColor: "var(--color-border)",
                                        borderRadius: 6,
                                      }}
                                    >
                                      <Group justify="space-between" align="center">
                                        <div>
                                          <Text size="xs" fw={600} c="var(--color-text-primary)">
                                            Validate URL format
                                          </Text>
                                          <Text size="11px" c="dimmed">
                                            Enforce https?:// or http:// prefix on save
                                          </Text>
                                        </div>
                                        <Switch
                                          checked={Boolean(field.pattern)}
                                          onChange={(e) =>
                                            updateField(idx, {
                                              pattern: e.currentTarget.checked
                                                ? "^https?:\\/\\/.+"
                                                : undefined,
                                            })
                                          }
                                          size="sm"
                                          color="neonGreen"
                                        />
                                      </Group>
                                    </Paper>
                                  )}

                                  <TextInput
                                    label="Help text"
                                    placeholder="Optional instruction shown to users in the editor"
                                    size="xs"
                                    value={field.helpText || ""}
                                    onChange={(e) =>
                                      updateField(idx, {
                                        helpText: e.target.value,
                                      })
                                    }
                                    mb="sm"
                                    styles={{
                                      input: {
                                        backgroundColor:
                                          "var(--color-bg-well)",
                                        borderColor:
                                          "var(--color-border)",
                                      },
                                    }}
                                  />

                                  <Group
                                    justify="space-between"
                                    mt="md"
                                    pt="xs"
                                  >
                                    <Group gap="lg">
                                      <Checkbox
                                        size="xs"
                                        label="Required field"
                                        checked={field.required || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            required:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Unique"
                                        checked={field.unique || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            unique:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Indexed"
                                        checked={field.indexed || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            indexed:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Presentable"
                                        checked={field.presentable || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            presentable:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                      <Checkbox
                                        size="xs"
                                        label="Hidden from public API"
                                        checked={field.hidden || false}
                                        onChange={(e) =>
                                          updateField(idx, {
                                            hidden:
                                              e.currentTarget.checked,
                                          })
                                        }
                                      />
                                    </Group>
                                  </Group>
                                </>
                              )}
                            </Box>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                )}

                {/* Add New Field Button */}
                <Button
                  variant="subtle"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    const newIdx = fields.length;
                    setFields([
                      ...fields,
                      { name: "", type: "text", required: false, max: 5000 },
                    ]);
                    setExpandedFieldIndex(newIdx);
                  }}
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    color: "var(--color-neon-primary)",
                    border: "1px dashed var(--color-border-glow)",
                    height: 38,
                  }}
                >
                  New Field
                </Button>
              </Stack>
            </Tabs.Panel>

            {/* TAB: INDEXES */}
            <Tabs.Panel value="indexes">
              <Stack gap="md">
                <Text size="xs" c="dimmed">
                  Configure database indexes to optimize query performance and enforce unique constraints on table columns.
                </Text>

                {/* List of configured indexes */}
                {collectionIndexes.length > 0 ? (
                  <Stack gap="xs">
                    {collectionIndexes.map((idxSql, i) => (
                      <Paper
                        key={i}
                        p="sm"
                        withBorder
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: 8,
                        }}
                      >
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={6}>
                              <IconDatabase size={14} color="var(--color-neon-primary)" />
                              <Text size="xs" fw={700} style={{ fontFamily: "var(--font-mono)" }}>
                                Index #{i + 1}
                              </Text>
                              {idxSql.toUpperCase().includes("UNIQUE") && (
                                <Badge size="xs" variant="filled" color="blue">
                                  UNIQUE
                                </Badge>
                              )}
                            </Group>
                            <Code
                              block
                              style={{
                                fontSize: "11px",
                                backgroundColor: "var(--color-bg-well)",
                                color: "var(--color-text-primary)",
                                fontFamily: "var(--font-mono)",
                                wordBreak: "break-all",
                              }}
                            >
                              {idxSql}
                            </Code>
                          </Stack>
                          <ActionIcon
                            size="sm"
                            color="red"
                            variant="subtle"
                            onClick={() =>
                              setCollectionIndexes(
                                collectionIndexes.filter((_, idxIdx) => idxIdx !== i)
                              )
                            }
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Paper
                    p="md"
                    withBorder
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      borderColor: "var(--color-border)",
                      textAlign: "center",
                    }}
                  >
                    <Text size="xs" c="dimmed">
                      No custom composite indexes configured yet. You can also mark individual fields as &quot;Indexed&quot; or &quot;Unique&quot; in the Fields tab.
                    </Text>
                  </Paper>
                )}

                {/* Add Index Builder Form */}
                <Paper
                  p="md"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border-glow)",
                    borderRadius: 8,
                  }}
                >
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="xs" fw={700} c="var(--color-neon-primary)">
                        + Add Index to Table
                      </Text>
                      <Switch
                        size="xs"
                        label="Raw SQL"
                        checked={schemaUseRawSql}
                        onChange={(e) => setSchemaUseRawSql(e.currentTarget.checked)}
                      />
                    </Group>

                    {schemaUseRawSql ? (
                      <TextInput
                        label="Raw SQL Index Statement"
                        placeholder="e.g. CREATE UNIQUE INDEX idx_col ON tbl (col1, col2);"
                        size="xs"
                        value={schemaIndexRawSql}
                        onChange={(e) => setSchemaIndexRawSql(e.target.value)}
                        styles={{
                          input: {
                            backgroundColor: "var(--color-bg-well)",
                            borderColor: "var(--color-border)",
                            fontFamily: "var(--font-mono)",
                          },
                        }}
                      />
                    ) : (
                      <>
                        <MultiSelect
                          label="Columns to Index"
                          placeholder="Select columns..."
                          size="xs"
                          data={fields.map((f) => f.name).filter(Boolean)}
                          value={schemaIndexCols}
                          onChange={setSchemaIndexCols}
                          searchable
                          clearable
                          styles={{
                            input: {
                              backgroundColor: "var(--color-bg-well)",
                              borderColor: "var(--color-border)",
                            },
                          }}
                        />
                        <Grid>
                          <Grid.Col span={8}>
                            <TextInput
                              label="Index Name (optional)"
                              placeholder={`e.g. idx_${collectionFormName || "table"}_${schemaIndexCols.join("_") || "cols"}`}
                              size="xs"
                              value={schemaIndexName}
                              onChange={(e) => setSchemaIndexName(e.target.value)}
                              styles={{
                                input: {
                                  backgroundColor: "var(--color-bg-well)",
                                  borderColor: "var(--color-border)",
                                  fontFamily: "var(--font-mono)",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4} style={{ display: "flex", alignItems: "flex-end" }}>
                            <Checkbox
                              size="xs"
                              label="Unique Index"
                              checked={schemaIndexUnique}
                              onChange={(e) => setSchemaIndexUnique(e.currentTarget.checked)}
                              mb={8}
                            />
                          </Grid.Col>
                        </Grid>
                      </>
                    )}

                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={handleAddSchemaIndex}
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        color: "var(--color-neon-primary)",
                        border: "1px solid var(--color-border-glow)",
                        fontWeight: 600,
                      }}
                    >
                      Add Index
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>

            {/* TAB 2: API RULES */}
            <Tabs.Panel value="rules">
              <Stack gap="md">
                <Text size="xs" c="dimmed">
                  Control who can list, view, create, update, or delete records.
                  Leave empty for public access, or use filter expressions (e.g.{" "}
                  <code>@request.auth.id != ""</code>).
                </Text>

                {/* List Rule */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Text size="xs" fw={600}>
                        List / Search Rule
                      </Text>
                      {collectionRules.list === "" && (
                        <Badge size="xs" color="gray" variant="outline">
                          Public
                        </Badge>
                      )}
                      {collectionRules.list === "admin" && (
                        <Badge size="xs" color="red" variant="light">
                          Locked
                        </Badge>
                      )}
                    </Group>
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<IconLock size={12} />}
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {collectionRules.list
                            ? "Change Rule"
                            : "Set Auth Users Only"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              list: "",
                            })
                          }
                        >
                          Public (Anyone)
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              list: '@request.auth.id != ""',
                            })
                          }
                        >
                          Auth Users Only
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              list: "id = @request.auth.id",
                            })
                          }
                        >
                          Owner Only (id = @request.auth.id)
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              list: "admin",
                            })
                          }
                        >
                          Locked (Admins Only)
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput
                    placeholder="Leave empty for public access..."
                    value={collectionRules.list || ""}
                    onChange={(e) =>
                      setCollectionRules({
                        ...collectionRules,
                        list: e.target.value,
                      })
                    }
                    size="xs"
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                </Paper>

                {/* View Rule */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Text size="xs" fw={600}>
                        View Rule
                      </Text>
                      {collectionRules.view === "" && (
                        <Badge size="xs" color="gray" variant="outline">
                          Public
                        </Badge>
                      )}
                      {collectionRules.view === "admin" && (
                        <Badge size="xs" color="red" variant="light">
                          Locked
                        </Badge>
                      )}
                    </Group>
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<IconLock size={12} />}
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {collectionRules.view
                            ? "Change Rule"
                            : "Set Auth Users Only"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              view: "",
                            })
                          }
                        >
                          Public (Anyone)
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              view: '@request.auth.id != ""',
                            })
                          }
                        >
                          Auth Users Only
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              view: "id = @request.auth.id",
                            })
                          }
                        >
                          Owner Only (id = @request.auth.id)
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              view: "admin",
                            })
                          }
                        >
                          Locked (Admins Only)
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput
                    placeholder="Leave empty for public access..."
                    value={collectionRules.view || ""}
                    onChange={(e) =>
                      setCollectionRules({
                        ...collectionRules,
                        view: e.target.value,
                      })
                    }
                    size="xs"
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                </Paper>

                {/* Create Rule */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Text size="xs" fw={600}>
                        Create Rule
                      </Text>
                      {collectionRules.create === "" && (
                        <Badge size="xs" color="gray" variant="outline">
                          Public
                        </Badge>
                      )}
                      {collectionRules.create === "admin" && (
                        <Badge size="xs" color="red" variant="light">
                          Locked
                        </Badge>
                      )}
                    </Group>
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<IconLock size={12} />}
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {collectionRules.create
                            ? "Change Rule"
                            : "Set Auth Users Only"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              create: "",
                            })
                          }
                        >
                          Public (Anyone)
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              create: '@request.auth.id != ""',
                            })
                          }
                        >
                          Auth Users Only
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              create: "admin",
                            })
                          }
                        >
                          Locked (Admins Only)
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput
                    placeholder="Leave empty for public access..."
                    value={collectionRules.create || ""}
                    onChange={(e) =>
                      setCollectionRules({
                        ...collectionRules,
                        create: e.target.value,
                      })
                    }
                    size="xs"
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                </Paper>

                {/* Update Rule */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Text size="xs" fw={600}>
                        Update Rule
                      </Text>
                      {collectionRules.update === "" && (
                        <Badge size="xs" color="gray" variant="outline">
                          Public
                        </Badge>
                      )}
                      {collectionRules.update === "admin" && (
                        <Badge size="xs" color="red" variant="light">
                          Locked
                        </Badge>
                      )}
                    </Group>
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<IconLock size={12} />}
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {collectionRules.update
                            ? "Change Rule"
                            : "Set Auth Users Only"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              update: "",
                            })
                          }
                        >
                          Public (Anyone)
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              update: '@request.auth.id != ""',
                            })
                          }
                        >
                          Auth Users Only
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              update: "id = @request.auth.id",
                            })
                          }
                        >
                          Owner Only (id = @request.auth.id)
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              update: "admin",
                            })
                          }
                        >
                          Locked (Admins Only)
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput
                    placeholder="Leave empty for public access..."
                    value={collectionRules.update || ""}
                    onChange={(e) =>
                      setCollectionRules({
                        ...collectionRules,
                        update: e.target.value,
                      })
                    }
                    size="xs"
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                </Paper>

                {/* Delete Rule */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Text size="xs" fw={600}>
                        Delete Rule
                      </Text>
                      {collectionRules.delete === "" && (
                        <Badge size="xs" color="gray" variant="outline">
                          Public
                        </Badge>
                      )}
                      {collectionRules.delete === "admin" && (
                        <Badge size="xs" color="red" variant="light">
                          Locked
                        </Badge>
                      )}
                    </Group>
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<IconLock size={12} />}
                          style={{
                            color: "var(--color-text-dimmed)",
                            fontSize: "11px",
                          }}
                        >
                          {collectionRules.delete
                            ? "Change Rule"
                            : "Set Auth Users Only"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: "var(--color-bg-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              delete: "",
                            })
                          }
                        >
                          Public (Anyone)
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              delete: '@request.auth.id != ""',
                            })
                          }
                        >
                          Auth Users Only
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              delete: "id = @request.auth.id",
                            })
                          }
                        >
                          Owner Only (id = @request.auth.id)
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          onClick={() =>
                            setCollectionRules({
                              ...collectionRules,
                              delete: "admin",
                            })
                          }
                        >
                          Locked (Admins Only)
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput
                    placeholder="Leave empty for public access..."
                    value={collectionRules.delete || ""}
                    onChange={(e) =>
                      setCollectionRules({
                        ...collectionRules,
                        delete: e.target.value,
                      })
                    }
                    size="xs"
                    styles={{
                      input: {
                        backgroundColor: "var(--color-bg-well)",
                        borderColor: "var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      },
                    }}
                  />
                </Paper>
              </Stack>
            </Tabs.Panel>

            {/* TAB 3: OPTIONS (For Auth Collection) */}
            {(collectionType === "auth" || collectionFormName === "users") && (
              <Tabs.Panel value="options">
                <Stack gap="lg">
                  <Box>
                    <Text fw={700} size="sm" mb="xs">
                      Authentication Methods
                    </Text>
                    <Paper
                      withBorder
                      style={{
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <Stack gap={0}>
                        {/* Password Auth */}
                        <Group
                          justify="space-between"
                          px="md"
                          py="sm"
                          style={{
                            borderBottom:
                              "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <Group gap="xs">
                            <IconLock size={16} color="#fbbf24" />
                            <div>
                              <Text size="xs" fw={600}>
                                Password Authentication
                              </Text>
                              <Text size="11px" c="dimmed">
                                Allow users to authenticate with email / username and password.
                              </Text>
                            </div>
                          </Group>
                          <Switch
                            checked={collectionOptions.allowEmailAuth !== false}
                            onChange={(e) =>
                              setCollectionOptions({
                                ...collectionOptions,
                                allowEmailAuth: e.currentTarget.checked,
                              })
                            }
                            color="neonGreen"
                            size="sm"
                          />
                        </Group>

                        {/* Username Auth */}
                        <Group
                          justify="space-between"
                          px="md"
                          py="sm"
                          style={{
                            borderBottom:
                              "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <Group gap="xs">
                            <IconUser size={16} color="#a855f7" />
                            <div>
                              <Text size="xs" fw={600}>
                                Username Authentication
                              </Text>
                              <Text size="11px" c="dimmed">
                                Allow username as an alternative login identifier.
                              </Text>
                            </div>
                          </Group>
                          <Switch
                            checked={collectionOptions.allowUsernameAuth !== false}
                            onChange={(e) =>
                              setCollectionOptions({
                                ...collectionOptions,
                                allowUsernameAuth: e.currentTarget.checked,
                              })
                            }
                            color="neonGreen"
                            size="sm"
                          />
                        </Group>

                        {/* OAuth2 Providers Toggle */}
                        <Box
                          style={{
                            borderBottom:
                              "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <Group
                            justify="space-between"
                            px="md"
                            py="sm"
                          >
                            <Group gap="xs">
                              <IconId size={16} color="#38bdf8" />
                              <div>
                                <Group gap="xs">
                                  <Text size="xs" fw={600}>
                                    OAuth2 Providers
                                  </Text>
                                  {collectionOptions.allowOAuth2Auth && (
                                    <Badge size="xs" variant="light" color="cyan">
                                      {(collectionOptions.oauth2?.providers || []).filter((p: any) => p.enabled).length} enabled
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="11px" c="dimmed">
                                  Allow users to sign in via Google, GitHub, Discord, Microsoft, or OpenID.
                                </Text>
                              </div>
                            </Group>
                            <Switch
                              checked={Boolean(collectionOptions.allowOAuth2Auth)}
                              onChange={(e) =>
                                setCollectionOptions({
                                  ...collectionOptions,
                                  allowOAuth2Auth: e.currentTarget.checked,
                                })
                              }
                              color="neonGreen"
                              size="sm"
                            />
                          </Group>

                          {/* OAuth2 Config Panel */}
                          <Collapse expanded={Boolean(collectionOptions.allowOAuth2Auth)}>
                            <Box px="md" pb="md" pt="xs">
                              <Stack gap="sm">
                                {/* Global Redirect Info */}
                                <Paper
                                  p="xs"
                                  style={{
                                    backgroundColor: "rgba(56, 189, 248, 0.05)",
                                    border: "1px dashed rgba(56, 189, 248, 0.3)",
                                    borderRadius: 6,
                                  }}
                                >
                                  <Group justify="space-between" wrap="nowrap">
                                    <div>
                                      <Text size="11px" fw={600} c="#38bdf8">
                                        OAuth2 Redirect / Callback URL
                                      </Text>
                                      <Code style={{ fontSize: "10px", marginTop: 2 }}>
                                        {`${window.location.origin}/api/collections/${collectionFormName || editingCollectionName || "users"}/auth-with-oauth2`}
                                      </Code>
                                    </div>
                                    <CopyButton
                                      value={`${window.location.origin}/api/collections/${collectionFormName || editingCollectionName || "users"}/auth-with-oauth2`}
                                    >
                                      {({ copied, copy }) => (
                                        <Button
                                          size="compact-xs"
                                          variant="light"
                                          color={copied ? "teal" : "blue"}
                                          onClick={copy}
                                          leftSection={
                                            copied ? <IconCheck size={12} /> : <IconCopy size={12} />
                                          }
                                        >
                                          {copied ? "Copied" : "Copy URL"}
                                        </Button>
                                      )}
                                    </CopyButton>
                                  </Group>
                                </Paper>

                                {/* Providers Config List */}
                                <Stack gap="xs">
                                  {(collectionOptions.oauth2?.providers || DEFAULT_OAUTH2_PROVIDERS).map(
                                    (prov: OAuth2ProviderConfig, pIdx: number) => {
                                      const updateProvider = (patch: Partial<OAuth2ProviderConfig>) => {
                                        const currentProviders = [
                                          ...(collectionOptions.oauth2?.providers || DEFAULT_OAUTH2_PROVIDERS),
                                        ];
                                        currentProviders[pIdx] = {
                                          ...currentProviders[pIdx],
                                          ...patch,
                                        };
                                        setCollectionOptions({
                                          ...collectionOptions,
                                          oauth2: {
                                            ...collectionOptions.oauth2,
                                            providers: currentProviders,
                                          },
                                        });
                                      };

                                      const getProviderIcon = () => {
                                        switch (prov.name) {
                                          case "google":
                                            return <IconBrandGoogle size={15} color="#ea4335" />;
                                          case "github":
                                            return <IconBrandGithub size={15} color="#e2e8f0" />;
                                          case "discord":
                                            return <IconBrandDiscord size={15} color="#5865f2" />;
                                          case "microsoft":
                                            return <IconBrandWindows size={15} color="#00a4ef" />;
                                          default:
                                            return <IconWorld size={15} color="#10e57a" />;
                                        }
                                      };

                                      return (
                                        <Paper
                                          key={prov.name}
                                          withBorder
                                          p="xs"
                                          style={{
                                            backgroundColor: "var(--color-bg-well)",
                                            borderColor: prov.enabled
                                              ? "rgba(56, 189, 248, 0.4)"
                                              : "var(--color-border)",
                                            borderRadius: 6,
                                          }}
                                        >
                                          <Group justify="space-between" mb={prov.enabled ? "xs" : 0}>
                                            <Group gap="xs">
                                              {getProviderIcon()}
                                              <Text size="xs" fw={600}>
                                                {prov.displayName || prov.name}
                                              </Text>
                                            </Group>
                                            <Switch
                                              checked={Boolean(prov.enabled)}
                                              onChange={(e) =>
                                                updateProvider({
                                                  enabled: e.currentTarget.checked,
                                                })
                                              }
                                              size="xs"
                                              color="cyan"
                                            />
                                          </Group>

                                          <Collapse expanded={Boolean(prov.enabled)}>
                                            <Stack gap="xs" mt="xs">
                                              <TextInput
                                                label="Client ID"
                                                placeholder={`Enter ${prov.displayName} Client ID`}
                                                size="xs"
                                                value={prov.clientId || ""}
                                                onChange={(e) =>
                                                  updateProvider({
                                                    clientId: e.currentTarget.value,
                                                  })
                                                }
                                                styles={{
                                                  input: {
                                                    backgroundColor: "var(--color-bg-card)",
                                                    borderColor: "var(--color-border)",
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: "11px",
                                                  },
                                                }}
                                              />
                                              <PasswordInput
                                                label="Client Secret"
                                                placeholder={`Enter ${prov.displayName} Client Secret`}
                                                size="xs"
                                                value={prov.clientSecret || ""}
                                                onChange={(e) =>
                                                  updateProvider({
                                                    clientSecret: e.currentTarget.value,
                                                  })
                                                }
                                                styles={{
                                                  input: {
                                                    backgroundColor: "var(--color-bg-card)",
                                                    borderColor: "var(--color-border)",
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: "11px",
                                                  },
                                                }}
                                              />
                                              {prov.name === "microsoft" && (
                                                <TextInput
                                                  label="Tenant ID"
                                                  placeholder="common, organizations, or tenant GUID"
                                                  size="xs"
                                                  value={prov.tenantId || "common"}
                                                  onChange={(e) =>
                                                    updateProvider({
                                                      tenantId: e.currentTarget.value,
                                                    })
                                                  }
                                                  styles={{
                                                    input: {
                                                      backgroundColor: "var(--color-bg-card)",
                                                      borderColor: "var(--color-border)",
                                                      fontFamily: "var(--font-mono)",
                                                      fontSize: "11px",
                                                    },
                                                  }}
                                                />
                                              )}
                                              {prov.name === "oidc" && (
                                                <>
                                                  <TextInput
                                                    label="Auth URL"
                                                    placeholder="https://auth.example.com/oauth/authorize"
                                                    size="xs"
                                                    value={prov.authUrl || ""}
                                                    onChange={(e) =>
                                                      updateProvider({
                                                        authUrl: e.currentTarget.value,
                                                      })
                                                    }
                                                    styles={{
                                                      input: {
                                                        backgroundColor: "var(--color-bg-card)",
                                                        borderColor: "var(--color-border)",
                                                        fontSize: "11px",
                                                      },
                                                    }}
                                                  />
                                                  <TextInput
                                                    label="Token URL"
                                                    placeholder="https://auth.example.com/oauth/token"
                                                    size="xs"
                                                    value={prov.tokenUrl || ""}
                                                    onChange={(e) =>
                                                      updateProvider({
                                                        tokenUrl: e.currentTarget.value,
                                                      })
                                                    }
                                                    styles={{
                                                      input: {
                                                        backgroundColor: "var(--color-bg-card)",
                                                        borderColor: "var(--color-border)",
                                                        fontSize: "11px",
                                                      },
                                                    }}
                                                  />
                                                  <TextInput
                                                    label="User Info URL"
                                                    placeholder="https://auth.example.com/oauth/userinfo"
                                                    size="xs"
                                                    value={prov.userApiUrl || ""}
                                                    onChange={(e) =>
                                                      updateProvider({
                                                        userApiUrl: e.currentTarget.value,
                                                      })
                                                    }
                                                    styles={{
                                                      input: {
                                                        backgroundColor: "var(--color-bg-card)",
                                                        borderColor: "var(--color-border)",
                                                        fontSize: "11px",
                                                      },
                                                    }}
                                                  />
                                                </>
                                              )}
                                            </Stack>
                                          </Collapse>
                                        </Paper>
                                      );
                                    },
                                  )}
                                </Stack>
                              </Stack>
                            </Box>
                          </Collapse>
                        </Box>

                        {/* Multi-factor Authentication (MFA) Toggle */}
                        <Box>
                          <Group
                            justify="space-between"
                            px="md"
                            py="sm"
                          >
                            <Group gap="xs">
                              <IconShieldCheck size={16} color="#10e57a" />
                              <div>
                                <Group gap="xs">
                                  <Text size="xs" fw={600}>
                                    Multi-factor Authentication (MFA)
                                  </Text>
                                  {collectionOptions.allowMfa && (
                                    <Badge size="xs" variant="light" color="teal">
                                      Active ({collectionOptions.mfa?.duration || 600}s)
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="11px" c="dimmed">
                                  Require two-step verification code for auth requests.
                                </Text>
                              </div>
                            </Group>
                            <Switch
                              checked={Boolean(collectionOptions.allowMfa)}
                              onChange={(e) =>
                                setCollectionOptions({
                                  ...collectionOptions,
                                  allowMfa: e.currentTarget.checked,
                                  mfa: {
                                    duration: collectionOptions.mfa?.duration || 600,
                                    enforce: Boolean(collectionOptions.mfa?.enforce),
                                  },
                                })
                              }
                              color="neonGreen"
                              size="sm"
                            />
                          </Group>

                          {/* MFA Config Panel */}
                          <Collapse expanded={Boolean(collectionOptions.allowMfa)}>
                            <Box px="md" pb="md" pt="xs">
                              <Stack gap="xs">
                                <Paper
                                  p="xs"
                                  style={{
                                    backgroundColor: "rgba(16, 229, 122, 0.05)",
                                    border: "1px dashed rgba(16, 229, 122, 0.3)",
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text size="11px" c="#10e57a">
                                    When MFA is active, password and OAuth2 logins return a 2-step verification challenge (<code>mfaId</code>). A 6-digit code is dispatched to the user's email to verify with <code>/api/collections/:collection/auth-with-mfa</code>.
                                  </Text>
                                </Paper>

                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                                  <NumberInput
                                    label="OTP Expiration (Seconds)"
                                    description="Validity window for the 6-digit code"
                                    size="xs"
                                    min={60}
                                    max={86400}
                                    step={60}
                                    value={collectionOptions.mfa?.duration || 600}
                                    onChange={(val) =>
                                      setCollectionOptions({
                                        ...collectionOptions,
                                        mfa: {
                                          ...collectionOptions.mfa,
                                          duration: Number(val) || 600,
                                        },
                                      })
                                    }
                                    styles={{
                                      input: {
                                        backgroundColor: "var(--color-bg-card)",
                                        borderColor: "var(--color-border)",
                                        fontSize: "11px",
                                      },
                                    }}
                                  />
                                  <Paper
                                    withBorder
                                    p="xs"
                                    mt={18}
                                    style={{
                                      backgroundColor: "var(--color-bg-well)",
                                      borderColor: "var(--color-border)",
                                      borderRadius: 6,
                                    }}
                                  >
                                    <Group justify="space-between">
                                      <div>
                                        <Text size="xs" fw={600}>
                                          Enforce on All Logins
                                        </Text>
                                        <Text size="10px" c="dimmed">
                                          Strict 2FA challenge on every sign in
                                        </Text>
                                      </div>
                                      <Switch
                                        checked={Boolean(collectionOptions.mfa?.enforce)}
                                        onChange={(e) =>
                                          setCollectionOptions({
                                            ...collectionOptions,
                                            mfa: {
                                              ...collectionOptions.mfa,
                                              enforce: e.currentTarget.checked,
                                            },
                                          })
                                        }
                                        size="xs"
                                        color="neonGreen"
                                      />
                                    </Group>
                                  </Paper>
                                </SimpleGrid>
                              </Stack>
                            </Box>
                          </Collapse>
                        </Box>
                      </Stack>
                    </Paper>
                  </Box>
                </Stack>
              </Tabs.Panel>
            )}
          </Tabs>

          {/* Drawer Actions Footer */}
          <Group
            justify="space-between"
            mt="auto"
            pt="md"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <Button
              variant="default"
              onClick={() => setSchemaDrawerOpen(false)}
            >
              Close
            </Button>
            <Group gap="xs">
              {editingCollectionName && (
                <Button
                  color="red"
                  variant="subtle"
                  leftSection={<IconTrash size={15} />}
                  onClick={() => {
                    const targetCol = collections.find(
                      (c) => c.name === editingCollectionName,
                    );
                    if (targetCol) {
                      setSchemaDrawerOpen(false);
                      handleDeleteCollection(targetCol);
                    }
                  }}
                >
                  Delete Collection
                </Button>
              )}
              <Button
                onClick={handleSaveSchema}
                rightSection={<IconCheck size={14} />}
                style={{
                  backgroundColor: "var(--color-neon-primary)",
                  color: "var(--color-neon-text)",
                  fontWeight: 700,
                  boxShadow: "0 0 12px var(--color-neon-glow)",
                }}
              >
                Save Changes
              </Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>

      {/* Record Create/Edit Drawer */}
      <ErrorBoundary fallbackTitle="Record Editor Error">
        <RecordDrawer
          opened={recordDrawerOpen}
          onClose={() => setRecordDrawerOpen(false)}
          collection={selectedCollection}
          record={editingRecord}
          onSave={handleSaveRecord}
          onDelete={handleDeleteRecord}
        />
      </ErrorBoundary>

      {/* Collections Overview Modal */}
      <CollectionsOverviewModal
        opened={collectionsOverviewOpen}
        onClose={() => setCollectionsOverviewOpen(false)}
        collections={collections}
        onSelectCollection={handleSelectCollection}
      />

      {/* JSON Expand Modal */}
      <Modal
        opened={jsonExpandModalOpen}
        onClose={() => setJsonExpandModalOpen(false)}
        size="lg"
        title={
          <Group gap={8}>
            <IconCode size={18} color="var(--color-neon-primary)" />
            <Text fw={700} size="md" style={{ fontFamily: "var(--font-mono)" }}>
              {jsonExpandTitle}
            </Text>
          </Group>
        }
        styles={{
          header: {
            backgroundColor: "var(--color-bg-card)",
            borderBottom: "1px solid var(--color-border)",
          },
          body: { backgroundColor: "var(--color-bg-card)", padding: 0 },
          content: {
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
          },
        }}
      >
        <ScrollArea h={480} p="md">
          <Code
            block
            style={{
              backgroundColor: "var(--color-bg-well)",
              color: "#38bdf8",
              fontSize: "12.5px",
              fontFamily: "var(--font-mono)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {jsonExpandContent}
          </Code>
        </ScrollArea>
      </Modal>
    </>
  );
};
