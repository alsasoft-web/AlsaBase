import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  Group,
  Title,
  Badge,
  Button,
  Table,
  Code,
  Text,
  ActionIcon,
  Modal,
  Stack,
  TextInput,
  Textarea,
  Paper,
  Select,
  Tooltip,
  Box,
  SegmentedControl,
  useComputedColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconFileCode,
  IconCode,
  IconClock,
  IconHelp,
  IconDeviceFloppy,
  IconCheck,
  IconPackage,
  IconAlertTriangle,
  IconTerminal2,
  IconCopy,
  IconSearch,
  IconTrash,
  IconBraces,
  IconList,
  IconSparkles,
} from "@tabler/icons-react";
import Editor, { OnMount } from "@monaco-editor/react";
import {
  api,
  HooksOverview,
  HookRouteDef,
  HookCommandDef,
} from "../../api/client";
import { NpmPackagesModal } from "../NpmPackagesModal";
import { VSCodeFileTree } from "../VSCodeFileTree";
import { FileIcon } from "../FileIcon";
import { MediaViewer, isMediaFilename } from "../MediaViewer";
import { copyToClipboard } from "../../utils/clipboard";
import { openHoldToConfirmModal } from "../HoldToConfirmModal";

interface BodyFieldRow {
  id: string;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
}

function parseJsonToFields(jsonStr: string): BodyFieldRow[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rows: BodyFieldRow[] = Object.entries(parsed).map(([k, v], idx) => {
        let type: "string" | "number" | "boolean" | "json" = "string";
        let strVal = String(v ?? "");
        if (typeof v === "number") {
          type = "number";
        } else if (typeof v === "boolean") {
          type = "boolean";
        } else if (typeof v === "object" && v !== null) {
          type = "json";
          strVal = JSON.stringify(v);
        }
        return {
          id: String(Date.now() + idx + Math.random()),
          key: k,
          value: strVal,
          type,
        };
      });
      if (rows.length > 0) return rows;
    }
  } catch {}
  return [{ id: String(Date.now()), key: "", value: "", type: "string" }];
}

function fieldsToJson(fields: BodyFieldRow[]): string {
  const obj: Record<string, any> = {};
  for (const f of fields) {
    const k = f.key.trim();
    if (!k) continue;
    if (f.type === "number") {
      const num = Number(f.value);
      obj[k] = isNaN(num) ? f.value : num;
    } else if (f.type === "boolean") {
      obj[k] = f.value === "true" || f.value === "1";
    } else if (f.type === "json") {
      try {
        obj[k] = JSON.parse(f.value);
      } catch {
        obj[k] = f.value;
      }
    } else {
      obj[k] = f.value;
    }
  }
  return JSON.stringify(obj, null, 2);
}

function getLanguage(filename: string | null): string {
  if (!filename) return "javascript";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  )
    return "javascript";
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".json5") ||
    lower.endsWith(".jsonc")
  )
    return "json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (
    lower.endsWith(".css") ||
    lower.endsWith(".scss") ||
    lower.endsWith(".less")
  )
    return "css";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".xml") || lower.endsWith(".svg")) return "xml";
  if (
    lower.endsWith(".sh") ||
    lower.endsWith(".bash") ||
    lower.endsWith(".zsh")
  )
    return "shell";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".env") || lower.includes(".env.")) return "ini";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "plaintext";
  return "javascript";
}

function getFileTypeLabel(filename: string | null): string {
  if (!filename) return "File";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
    return "Serverless ES6 Module";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx"))
    return "TypeScript Module";
  if (lower.endsWith(".json")) return "JSON Data";
  if (lower.endsWith(".sql")) return "SQL Script";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "HTML Document";
  if (lower.endsWith(".css")) return "Stylesheet";
  if (lower.endsWith(".md")) return "Markdown Document";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml"))
    return "YAML Configuration";
  if (lower.endsWith(".sh")) return "Shell Script";
  if (lower.endsWith(".py")) return "Python Script";
  if (lower.endsWith(".env") || lower.includes(".env."))
    return "Environment Config";
  return "Resource File";
}

const TEMPLATES: Record<string, string> = {
  route: `// Custom API Route Hook
// Registers an HTTP endpoint on AlsaBase

routerAdd("GET", "/api/custom-endpoint", (c) => {
  // Query parameters: c.query
  // JSON body: c.body
  // Auth user: c.user or c.auth
  
  return c.json({
    status: "success",
    message: "Hello from AlsaBase Serverless Hook!",
    timestamp: new Date().toISOString()
  });
});
`,
  cron: `// Scheduled Cron Job Hook
// Runs automatically according to cron expression

cronAdd("heartbeat_job", "*/5 * * * *", () => {
  log("Cron task executed at: " + new Date().toISOString());
  
  // Example: Query database
  // const total = collections.get("SELECT COUNT(*) as count FROM _logs");
  // log("Total log entries: " + total.count);
});
`,
  db: `// Database Query & Custom Handler Hook
// Use AlsaBase collections API

routerAdd("POST", "/api/records/summary", (c) => {
  try {
    const list = collections.list();
    const stats = list.map((col) => {
      const row = collections.get("SELECT COUNT(*) as count FROM " + col.name);
      return { collection: col.name, count: row?.count || 0 };
    });
    
    return c.json({ success: true, stats });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}, "auth");
`,
  events: `// Realtime Collection & Custom Web Events Hook
// Listen to database changes or publish custom web events

// 1. Listen to record changes on a collection (create, update, delete)
onRecordAfterCreate("posts", (e) => {
  log("New post created:", e.record.id, e.record.title || e.record.id);
  
  // Broadcast a custom web notification event to all connected SSE clients
  events.emit("notifications", {
    title: "New Post Published",
    postId: e.record.id,
    timestamp: new Date().toISOString()
  });
});

onRecordAfterUpdate("posts", (e) => {
  log("Post updated:", e.record.id);
});

onRecordAfterDelete("posts", (e) => {
  log("Post deleted:", e.record.id);
});

// 2. Custom Web Event Bus (Publish & Subscribe)
onEvent("user.login", (data) => {
  log("User login event received:", data);
});

// 3. Custom endpoint that broadcasts an event
routerAdd("POST", "/api/send-alert", (c) => {
  const { message } = c.body || {};
  events.emit("alerts", { message, sentAt: new Date().toISOString() });
  return c.json({ success: true, message: "Alert broadcasted to all SSE clients." });
});
`,
  helper: `// Reusable Helper Module (e.g. _hooks/utils.js)
// Export functions, constants, or classes to import across other hooks

export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function cleanExpiredLogs() {
  return collections.run("DELETE FROM _logs WHERE datetime(timestamp) < datetime('now', '-30 days')");
}
`,
  npm: `// Using Custom NPM Packages (e.g. axios, dayjs, lodash)
// Install packages via the "NPM Packages" button in the top bar!

import axios from 'axios';
import dayjs from 'dayjs';

routerAdd("GET", "/api/custom-time", (c) => {
  return c.json({
    status: "ok",
    formattedTime: dayjs().format("YYYY-MM-DD HH:mm:ss")
  });
});
`,
  empty: `// AlsaBase Hook File
// Supports modern ES Module syntax (import / export) and CommonJS (require / module.exports)
// Available globals: routerAdd, cronAdd, onRecordAfterCreate, onRecordAfterUpdate, onRecordAfterDelete, onEvent, events, realtime, collections, db, log

`,
};

export const HooksView: React.FC = () => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const [overview, setOverview] = useState<HooksOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    return localStorage.getItem("alsabase_hooks_tab") || "files";
  });
  const [packagesModalOpen, setPackagesModalOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem("alsabase_hooks_tab", tab);
  };

  // File Editor State
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("route");
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [editSvgAsCode, setEditSvgAsCode] = useState(false);

  // Refs for reliable closures in Monaco commands and global shortcuts
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const selectedFileNameRef = useRef<string | null>(selectedFileName);
  selectedFileNameRef.current = selectedFileName;
  const fileContentRef = useRef<string>(fileContent);
  fileContentRef.current = fileContent;

  // Route Test Modal State
  const [testRouteModalOpen, setTestRouteModalOpen] = useState(false);
  const [testingRoute, setTestingRoute] = useState<HookRouteDef | null>(null);
  const [testMethod, setTestMethod] = useState("GET");
  const [testRequestBody, setTestRequestBody] = useState(
    '{\n  "test": "test"\n}',
  );
  const [testBodyMode, setTestBodyMode] = useState<"fields" | "json">("fields");
  const [testBodyFields, setTestBodyFields] = useState<BodyFieldRow[]>([
    { id: "1", key: "test", value: "test", type: "string" },
  ]);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [routesSearchQuery, setRoutesSearchQuery] = useState("");

  const groupedRoutes = useMemo(() => {
    if (!overview?.routes) return [];
    const q = routesSearchQuery.trim().toLowerCase();
    const filtered = overview.routes.filter((r) => {
      if (!q) return true;
      return (
        r.path.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        (r.sourceFile || "").toLowerCase().includes(q) ||
        (r.authLevel || "").toLowerCase().includes(q)
      );
    });

    const fileMap: Record<string, HookRouteDef[]> = {};
    for (const route of filtered) {
      const file = route.sourceFile || "main.js";
      if (!fileMap[file]) {
        fileMap[file] = [];
      }
      fileMap[file].push(route);
    }

    return Object.entries(fileMap).map(([filename, routes]) => ({
      filename,
      routes,
    }));
  }, [overview?.routes, routesSearchQuery]);

  // Cron Trigger & Live Terminal State
  const [selectedCron, setSelectedCron] = useState<any>(null);
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronOutput, setCronOutput] = useState<string[]>([]);
  const [cronDuration, setCronDuration] = useState<number | null>(null);
  const [cronStatus, setCronStatus] = useState<"SUCCESS" | "ERROR" | null>(
    null,
  );
  const [cronError, setCronError] = useState<string | null>(null);
  const cronTerminalEndRef = useRef<HTMLDivElement>(null);
  const cronAbortControllerRef = useRef<AbortController | null>(null);
  const cronExecutionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (cronTerminalEndRef.current) {
      cronTerminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [cronOutput]);

  // Global Ctrl+C handler to cancel running cron when cron modal is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cronModalOpen && cronRunning) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          const selection = window.getSelection()?.toString();
          if (!selection) {
            e.preventDefault();
            handleCancelCron();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cronModalOpen, cronRunning]);

  // CLI Command Runner State
  const [selectedCommand, setSelectedCommand] = useState<HookCommandDef | null>(
    null,
  );
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandArgs, setCommandArgs] = useState("");
  const [commandRunning, setCommandRunning] = useState(false);
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const [commandDuration, setCommandDuration] = useState<number | null>(null);
  const [commandExitCode, setCommandExitCode] = useState<number | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const commandAbortControllerRef = useRef<AbortController | null>(null);
  const commandExecutionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [commandOutput]);

  // Global Ctrl+C handler to cancel running command when modal is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commandModalOpen && commandRunning) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          const selection = window.getSelection()?.toString();
          if (!selection) {
            e.preventDefault();
            handleCancelCommand();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandModalOpen, commandRunning]);

  // Open Tabs State (like VS Code)
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [editorCursorPos, setEditorCursorPos] = useState({ line: 1, col: 1 });

  const isDirty = fileContent !== savedContent && selectedFileName !== null;

  const activeFileStatus = overview?.files?.find(
    (f) => (f.filename || f.name) === selectedFileName,
  );

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await api.getHooksOverview();
      setOverview(data);

      if (data.files.length > 0) {
        if (!selectedFileName) {
          const savedFile = localStorage.getItem("alsabase_hooks_file");
          const matched = data.files.find(
            (f) => (f.filename || f.name) === savedFile,
          );
          const targetFile = matched
            ? matched.filename || matched.name
            : data.files[0].filename || data.files[0].name || "";
          if (targetFile) {
            loadFileContent(targetFile);
            setOpenFiles((prev) =>
              prev.includes(targetFile) ? prev : [...prev, targetFile],
            );
          }
        }
      }
    } catch (err: any) {
      notifications.show({
        title: "Hooks Overview Error",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (filename: string, forceCode = false) => {
    try {
      setSelectedFileName(filename);
      localStorage.setItem("alsabase_hooks_file", filename);
      setOpenFiles((prev) =>
        prev.includes(filename) ? prev : [...prev, filename],
      );

      const { isMedia } = isMediaFilename(filename);
      const isSvg = filename.toLowerCase().endsWith(".svg");

      if (isMedia && !forceCode && (!isSvg || !editSvgAsCode)) {
        setFileContent("");
        setSavedContent("");
        setSaveSuccessMsg(false);
        return;
      }

      const res = await api.getHookFile(filename);
      setFileContent(res.content);
      setSavedContent(res.content);
      setSaveSuccessMsg(false);
    } catch (err: any) {
      notifications.show({
        title: "Load File Failed",
        message: `Could not load file ${filename}: ${err.message}`,
        color: "red",
      });
    }
  };

  const handleCloseTab = (e: React.MouseEvent, filenameToClose: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter((f) => f !== filenameToClose);
    setOpenFiles(newOpenFiles);
    if (selectedFileName === filenameToClose) {
      if (newOpenFiles.length > 0) {
        loadFileContent(newOpenFiles[newOpenFiles.length - 1]);
      } else {
        setSelectedFileName(null);
        setFileContent("");
        setSavedContent("");
      }
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleReloadHooks = async () => {
    setLoading(true);
    try {
      const res = await api.reloadHooks();
      setOverview(res.overview);
      if (selectedFileName) {
        loadFileContent(selectedFileName);
      }
      notifications.show({
        title: "Hooks Reloaded",
        message:
          "All JavaScript hooks and cron tasks were hot-reloaded successfully.",
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Reload Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async (
    customContent?: string,
    targetFileName?: string,
  ) => {
    const filename = targetFileName || selectedFileNameRef.current;
    if (!filename) return;
    const contentToSave =
      customContent !== undefined ? customContent : fileContentRef.current;
    setSavingFile(true);
    try {
      await api.saveHookFile(filename, contentToSave);
      setSavedContent(contentToSave);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
      await loadOverview();
      notifications.show({
        title: "Hook Saved",
        message: `Saved and hot-reloaded "${filename}".`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setSavingFile(false);
    }
  };

  // Synchronize Monaco Error Markers (Underlines & Tooltips)
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    if (activeFileStatus?.error && activeFileStatus?.errorLine) {
      const line = activeFileStatus.errorLine;
      const col = activeFileStatus.errorCol || 1;
      monacoRef.current.editor.setModelMarkers(model, "hooks-error", [
        {
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 20,
          message: activeFileStatus.error,
          severity: monacoRef.current.MarkerSeverity.Error,
        },
      ]);
    } else {
      monacoRef.current.editor.setModelMarkers(model, "hooks-error", []);
    }
  }, [activeFileStatus, selectedFileName]);

  // Global Ctrl+S / Cmd+S shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        if (selectedFileNameRef.current) {
          e.preventDefault();
          const currentVal = editorRef.current
            ? editorRef.current.getValue()
            : fileContentRef.current;
          handleSaveFile(currentVal, selectedFileNameRef.current);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position for status bar
    editor.onDidChangeCursorPosition((e) => {
      setEditorCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Define authentic VS Code Dark+ theme
    monaco.editor.defineTheme("alsabase-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "d4d4d4" },
        { token: "comment", foreground: "6a9955", fontStyle: "italic" },
        { token: "comment.doc", foreground: "6a9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569cd6" },
        { token: "keyword.control", foreground: "c586c0" },
        { token: "keyword.flow", foreground: "c586c0" },
        { token: "keyword.async", foreground: "569cd6" },
        { token: "keyword.operator", foreground: "d4d4d4" },
        { token: "storage", foreground: "569cd6" },
        { token: "storage.type", foreground: "569cd6" },
        { token: "storage.modifier", foreground: "569cd6" },
        { token: "string", foreground: "ce9178" },
        { token: "string.escape", foreground: "d7ba7d" },
        { token: "string.template", foreground: "ce9178" },
        { token: "number", foreground: "b5cea8" },
        { token: "number.hex", foreground: "b5cea8" },
        { token: "regexp", foreground: "d16969" },
        { token: "type", foreground: "4ec9b0" },
        { token: "type.identifier", foreground: "4ec9b0" },
        { token: "class", foreground: "4ec9b0" },
        { token: "interface", foreground: "4ec9b0" },
        { token: "identifier", foreground: "9cdcfe" },
        { token: "variable", foreground: "9cdcfe" },
        { token: "variable.parameter", foreground: "9cdcfe" },
        { token: "variable.predefined", foreground: "4fc1ff" },
        { token: "variable.other.readwrite", foreground: "9cdcfe" },
        { token: "variable.other.property", foreground: "9cdcfe" },
        { token: "function", foreground: "dcdcaa" },
        { token: "member", foreground: "dcdcaa" },
        { token: "entity.name.function", foreground: "dcdcaa" },
        { token: "support.function", foreground: "dcdcaa" },
        { token: "support.variable", foreground: "9cdcfe" },
        { token: "support.type", foreground: "4ec9b0" },
        { token: "tag", foreground: "569cd6" },
        { token: "tag.id", foreground: "9cdcfe" },
        { token: "tag.class", foreground: "9cdcfe" },
        { token: "attribute.name", foreground: "9cdcfe" },
        { token: "attribute.value", foreground: "ce9178" },
        { token: "delimiter", foreground: "d4d4d4" },
        { token: "delimiter.bracket", foreground: "ffd700" },
        { token: "delimiter.parenthesis", foreground: "da70d6" },
        { token: "delimiter.square", foreground: "179fff" },
      ],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#c6c6c6",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#3a3d41",
        "editorCursor.foreground": "#aeafad",
        "editorIndentGuide.background1": "#404040",
        "editorIndentGuide.activeBackground1": "#707070",
        "editor.lineHighlightBackground": "#282828",
        "editorBracketMatch.background": "#0d3a58",
        "editorBracketMatch.border": "#888888",
      },
    });

    // Define custom light theme
    monaco.editor.defineTheme("alsabase-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "008000", fontStyle: "italic" },
        { token: "keyword", foreground: "0000ff" },
        { token: "keyword.control", foreground: "af00db" },
        { token: "string", foreground: "a31515" },
        { token: "number", foreground: "098658" },
        { token: "type", foreground: "267f99" },
        { token: "function", foreground: "795e26" },
        { token: "variable", foreground: "001080" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
        "editorLineNumber.foreground": "#237893",
        "editorLineNumber.activeForeground": "#0b216f",
        "editor.selectionBackground": "#add6ff",
        "editor.inactiveSelectionBackground": "#e5ebf1",
        "editorCursor.foreground": "#000000",
      },
    });

    monaco.editor.setTheme(isDark ? "alsabase-dark" : "alsabase-light");

    // Add Ctrl+S / Cmd+S save command using current active file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentVal = editor.getValue();
      handleSaveFile(currentVal, selectedFileNameRef.current || undefined);
    });
  };

  const handleCreateNewFile = async (
    customName?: string,
    templateKey?: string,
  ) => {
    let name = (customName || newFileName).trim();
    if (!name) return;
    if (!name.includes(".")) {
      name += ".js";
    }

    const tpl = templateKey || selectedTemplate;

    try {
      const templateContent = TEMPLATES[tpl] || TEMPLATES.empty;
      await api.saveHookFile(name, templateContent);
      setIsNewFileModalOpen(false);
      setNewFileName("");
      await loadOverview();
      loadFileContent(name);
      notifications.show({
        title: "Hook File Created",
        message: `Created and opened "${name}".`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Create Failed",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleDeleteFile = (filename: string) => {
    openHoldToConfirmModal({
      title: "Move File to Trash",
      centered: true,
      children: (
        <Text size="sm">
          Move hook file <b>{filename}</b> to the .trash directory?
        </Text>
      ),
      labels: { confirm: "Move to Trash", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteHookFile(filename);
          setOpenFiles((prev) => prev.filter((f) => f !== filename));
          if (selectedFileName === filename) {
            setSelectedFileName(null);
            setFileContent("");
            setSavedContent("");
          }
          await loadOverview();
          notifications.show({
            title: "File Moved to Trash",
            message: `Hook file "${filename}" moved to .trash.`,
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

  const handleOpenTestRoute = (route: HookRouteDef) => {
    setTestingRoute(route);
    setTestMethod(route.method === "ALL" ? "GET" : route.method);
    setTestResult(null);
    const initialJson = '{\n  "test": "test"\n}';
    setTestRequestBody(initialJson);
    setTestBodyFields(parseJsonToFields(initialJson));
    setTestBodyMode("fields");
    setTestRouteModalOpen(true);
  };

  const handleToggleBodyMode = (mode: "fields" | "json") => {
    if (mode === "json") {
      const json = fieldsToJson(testBodyFields);
      setTestRequestBody(json);
    } else {
      const fields = parseJsonToFields(testRequestBody);
      setTestBodyFields(fields);
    }
    setTestBodyMode(mode);
  };

  const handleUpdateField = (
    id: string,
    key: string,
    value: string,
    type: "string" | "number" | "boolean" | "json",
  ) => {
    setTestBodyFields((prev) => {
      const updated = prev.map((f) =>
        f.id === id ? { ...f, key, value, type } : f,
      );
      setTestRequestBody(fieldsToJson(updated));
      return updated;
    });
  };

  const handleAddField = () => {
    setTestBodyFields((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        key: "",
        value: "",
        type: "string" as const,
      },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setTestBodyFields((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      const nextFields: BodyFieldRow[] =
        updated.length > 0
          ? updated
          : [
              {
                id: String(Date.now()),
                key: "",
                value: "",
                type: "string" as const,
              },
            ];
      setTestRequestBody(fieldsToJson(nextFields));
      return nextFields;
    });
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(testRequestBody);
      const formatted = JSON.stringify(parsed, null, 2);
      setTestRequestBody(formatted);
      setTestBodyFields(parseJsonToFields(formatted));
    } catch {
      notifications.show({
        title: "Invalid JSON",
        message: "Cannot format invalid JSON string.",
        color: "red",
      });
    }
  };

  const handleExecuteTestRoute = async () => {
    if (!testingRoute) return;
    setTestLoading(true);
    setTestResult(null);

    const token =
      localStorage.getItem("alsabase_token") ||
      localStorage.getItem("AlsaBase_token") ||
      "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const options: RequestInit = {
        method: testMethod,
        headers,
      };

      if (["POST", "PUT", "PATCH"].includes(testMethod)) {
        let payload = testRequestBody;
        if (testBodyMode === "fields") {
          payload = fieldsToJson(testBodyFields);
        }
        if (payload && payload.trim() && payload.trim() !== "{}") {
          options.body = payload;
        }
      }

      const res = await fetch(testingRoute.path, options);
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      setTestResult({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        data: parsed,
      });
    } catch (err: any) {
      setTestResult({
        error: err.message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleCancelCron = async () => {
    if (!cronRunning) return;
    const execId = cronExecutionIdRef.current;
    const targetName = selectedCron?.name;

    if (cronAbortControllerRef.current) {
      cronAbortControllerRef.current.abort();
      cronAbortControllerRef.current = null;
    }

    setCronRunning(false);
    setCronOutput((prev) => [
      ...prev,
      "^C",
      "[Cron execution cancelled by user]",
    ]);

    try {
      await api.cancelCron(execId || undefined, targetName);
    } catch {}

    notifications.show({
      title: "Cron Cancelled",
      message: `Stopped execution of "${targetName || "cron job"}".`,
      color: "orange",
    });
  };

  const handleExecuteCron = async (cronDefOrName?: any) => {
    let targetCron: any;
    if (typeof cronDefOrName === "string") {
      targetCron = overview?.crons?.find((c) => c.name === cronDefOrName) || {
        name: cronDefOrName,
        schedule: "* * * * *",
        sourceFile: "hook",
        active: true,
      };
    } else if (cronDefOrName) {
      targetCron = cronDefOrName;
    } else {
      targetCron = selectedCron;
    }

    if (!targetCron) return;

    setSelectedCron(targetCron);
    setCronModalOpen(true);

    const abortController = new AbortController();
    cronAbortControllerRef.current = abortController;
    const execId = `cron_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cronExecutionIdRef.current = execId;

    setCronRunning(true);
    setCronError(null);
    setCronDuration(null);
    setCronStatus(null);

    const initialLine = `$ cron: ${targetCron.name} [${targetCron.schedule}] (source: _hooks/${targetCron.sourceFile || "main.js"})`;
    setCronOutput([initialLine]);

    const token =
      localStorage.getItem("alsabase_token") ||
      localStorage.getItem("AlsaBase_token") ||
      "";

    try {
      const response = await fetch("/api/hooks/cron/stream", {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: targetCron.name, executionId: execId }),
      });

      if (!response.ok) {
        // Fallback to standard trigger
        const res = await api.triggerCron(targetCron.name);
        setCronOutput([initialLine, ...(res.output || [])]);
        setCronDuration(res.durationMs);
        setCronStatus(res.success ? "SUCCESS" : "ERROR");
        if (!res.success) {
          setCronError(res.error || "Failed to execute cron job");
        } else {
          notifications.show({
            title: `Cron "${targetCron.name}" Completed`,
            message: `Finished successfully in ${res.durationMs}ms`,
            color: "teal",
          });
        }
        loadOverview();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const res = await api.triggerCron(targetCron.name);
        setCronOutput([initialLine, ...(res.output || [])]);
        setCronDuration(res.durationMs);
        setCronStatus(res.success ? "SUCCESS" : "ERROR");
        loadOverview();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let event = "message";
          let dataStr = "";

          for (const l of lines) {
            if (l.startsWith("event:")) {
              event = l.replace("event:", "").trim();
            } else if (l.startsWith("data:")) {
              dataStr += l.replace("data:", "").trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (event === "started" && data.executionId) {
              cronExecutionIdRef.current = data.executionId;
            } else if (event === "log" && data.line) {
              setCronOutput((prev) => [...prev, data.line]);
            } else if (event === "done") {
              setCronDuration(data.durationMs);
              setCronStatus(data.success ? "SUCCESS" : "ERROR");
              if (!data.success) {
                setCronError(data.error || "Cron execution failed");
              } else {
                notifications.show({
                  title: `Cron "${targetCron.name}" Completed`,
                  message: `Finished successfully in ${data.durationMs}ms`,
                  color: "teal",
                });
              }
              loadOverview();
            } else if (event === "error") {
              setCronError(data.error);
              setCronOutput((prev) => [...prev, `[Error] ${data.error}`]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      setCronError(err.message);
      setCronOutput((prev) => [...prev, `[Error] ${err.message}`]);
    } finally {
      cronAbortControllerRef.current = null;
      setCronRunning(false);
    }
  };

  const handleOpenCommandModal = (cmd: HookCommandDef, initialArgs = "") => {
    setSelectedCommand(cmd);
    setCommandArgs(initialArgs);
    setCommandOutput([]);
    setCommandDuration(null);
    setCommandExitCode(null);
    setCommandError(null);
    setCommandModalOpen(true);
  };

  const handleCancelCommand = async () => {
    if (!commandRunning) return;
    const execId = commandExecutionIdRef.current;
    const targetName = selectedCommand?.name;

    if (commandAbortControllerRef.current) {
      commandAbortControllerRef.current.abort();
      commandAbortControllerRef.current = null;
    }

    setCommandRunning(false);
    setCommandOutput((prev) => [
      ...prev,
      "^C",
      "[Process terminated by user (SIGINT)]",
    ]);

    try {
      await api.cancelHookCommand(execId || undefined, targetName);
    } catch {}

    notifications.show({
      title: "Command Cancelled",
      message: `Terminated execution of "${targetName || "command"}".`,
      color: "orange",
    });
  };

  const handleExecuteCommand = async (
    cmdName?: string,
    customArgs?: string,
  ) => {
    const targetName = cmdName || selectedCommand?.name;
    if (!targetName) return;
    const targetArgs = customArgs !== undefined ? customArgs : commandArgs;

    const abortController = new AbortController();
    commandAbortControllerRef.current = abortController;
    const execId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    commandExecutionIdRef.current = execId;

    setCommandRunning(true);
    setCommandError(null);
    setCommandDuration(null);
    setCommandExitCode(null);

    const initialLine = `$ node _hooks/${targetName} ${targetArgs}`.trim();
    setCommandOutput([initialLine]);

    const token =
      localStorage.getItem("alsabase_token") ||
      localStorage.getItem("AlsaBase_token") ||
      "";

    try {
      const response = await fetch("/api/hooks/commands/stream", {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: targetName,
          args: targetArgs,
          executionId: execId,
        }),
      });

      if (!response.ok) {
        // Fallback to standard runner
        const res = await api.runHookCommand(targetName, targetArgs);
        setCommandOutput([initialLine, ...(res.output || [])]);
        setCommandDuration(res.durationMs);
        setCommandExitCode(res.exitCode ?? 0);
        if (!res.success) {
          setCommandError(
            res.error || `Command exited with status code ${res.exitCode}`,
          );
        } else {
          notifications.show({
            title: `Command "${targetName}" Completed`,
            message: `Finished successfully in ${res.durationMs}ms`,
            color: "teal",
          });
        }
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const res = await api.runHookCommand(targetName, targetArgs);
        setCommandOutput([initialLine, ...(res.output || [])]);
        setCommandDuration(res.durationMs);
        setCommandExitCode(res.exitCode ?? 0);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let event = "message";
          let dataStr = "";

          for (const l of lines) {
            if (l.startsWith("event:")) {
              event = l.replace("event:", "").trim();
            } else if (l.startsWith("data:")) {
              dataStr += l.replace("data:", "").trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (event === "started" && data.executionId) {
              commandExecutionIdRef.current = data.executionId;
            } else if (event === "log" && data.line) {
              setCommandOutput((prev) => [...prev, data.line]);
            } else if (event === "done") {
              setCommandDuration(data.durationMs);
              setCommandExitCode(data.exitCode ?? 0);
              if (!data.success) {
                setCommandError(
                  data.error || `Exited with status code ${data.exitCode}`,
                );
              } else {
                notifications.show({
                  title: `Command "${targetName}" Completed`,
                  message: `Finished successfully in ${data.durationMs}ms`,
                  color: "teal",
                });
              }
            } else if (event === "error") {
              setCommandError(data.error);
              setCommandOutput((prev) => [...prev, `[Error] ${data.error}`]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Handled by user cancellation
        return;
      }
      setCommandError(err.message);
      setCommandOutput((prev) => [...prev, `[Error] ${err.message}`]);
    } finally {
      commandAbortControllerRef.current = null;
      setCommandRunning(false);
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
      {/* 1. TOP UNIFIED IDE HEADER BAR */}
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
            variant={activeTab === "files" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconFileCode size={14} />}
            onClick={() => handleTabChange("files")}
            style={{
              backgroundColor:
                activeTab === "files" ? "var(--color-neon-dim)" : "transparent",
              color:
                activeTab === "files"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "files"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Editor ({overview?.totalFiles || 0})
          </Button>

          <Button
            variant={activeTab === "routes" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconCode size={14} />}
            onClick={() => handleTabChange("routes")}
            style={{
              backgroundColor:
                activeTab === "routes"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "routes"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "routes"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Endpoints ({overview?.totalRoutes || 0})
          </Button>

          <Button
            variant={activeTab === "crons" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconClock size={14} />}
            onClick={() => handleTabChange("crons")}
            style={{
              backgroundColor:
                activeTab === "crons" ? "var(--color-neon-dim)" : "transparent",
              color:
                activeTab === "crons"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "crons"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Crons ({overview?.totalCrons || 0})
          </Button>

          <Button
            variant={activeTab === "commands" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconTerminal2 size={14} />}
            onClick={() => handleTabChange("commands")}
            style={{
              backgroundColor:
                activeTab === "commands"
                  ? "var(--color-neon-dim)"
                  : "transparent",
              color:
                activeTab === "commands"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "commands"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            Commands ({overview?.totalCommands || 0})
          </Button>

          <Button
            variant={activeTab === "guide" ? "filled" : "subtle"}
            size="xs"
            leftSection={<IconHelp size={14} />}
            onClick={() => handleTabChange("guide")}
            style={{
              backgroundColor:
                activeTab === "guide" ? "var(--color-neon-dim)" : "transparent",
              color:
                activeTab === "guide"
                  ? "var(--color-neon-primary)"
                  : "var(--color-text-dimmed)",
              border:
                activeTab === "guide"
                  ? "1px solid var(--color-border-glow)"
                  : "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            API Docs
          </Button>

          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPackage size={14} />}
            onClick={() => setPackagesModalOpen(true)}
            style={{
              backgroundColor: "transparent",
              color: "var(--color-text-dimmed)",
              border: "1px solid transparent",
              fontWeight: 600,
              fontSize: "12px",
              height: 28,
            }}
          >
            NPM Packages
          </Button>
        </Group>

        {/* Right: Actions & Reload */}
        <Group gap="xs">
          {saveSuccessMsg && (
            <Badge
              size="xs"
              variant="filled"
              leftSection={<IconCheck size={11} />}
              style={{
                backgroundColor: "var(--color-neon-dim)",
                color: "var(--color-neon-primary)",
                border: "1px solid var(--color-border-glow)",
              }}
            >
              Saved & Hot Reloaded
            </Badge>
          )}

          <Tooltip
            label="Reload and hot-swap all hook scripts"
            withArrow
            position="bottom"
          >
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconRefresh size={13} />}
              loading={loading}
              onClick={handleReloadHooks}
              style={{
                backgroundColor: "var(--color-bg-card-hover)",
                color: "var(--color-text-dimmed)",
                border: "1px solid var(--color-border)",
                height: 28,
                fontSize: "11.5px",
              }}
            >
              Reload Hooks
            </Button>
          </Tooltip>
        </Group>
      </div>

      {/* 2. MAIN FULL-SCREEN WORKSPACE PANELS */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* PANEL 1: FULL VS CODE EDITOR */}
        {activeTab === "files" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              minHeight: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* VS Code Explorer Sidebar */}
            <VSCodeFileTree
              title="AlsaBase"
              files={(overview?.files || []).map((file) => {
                const fname = file.filename || file.name || "";
                return {
                  name: fname,
                  sizeBytes: file.sizeBytes,
                  updatedAt: file.updatedAt,
                  isModified: selectedFileName === fname && isDirty,
                  error: file.error,
                };
              })}
              selectedFileName={selectedFileName}
              onSelectFile={loadFileContent}
              onNewFile={(targetFolder) => {
                if (targetFolder) {
                  setNewFileName(`${targetFolder}/`);
                } else {
                  setNewFileName("");
                }
                setIsNewFileModalOpen(true);
              }}
              onNewFolder={async (folderPath) => {
                if (!folderPath) return;
                try {
                  await api.createHookFolder(folderPath);
                  await loadOverview();
                  notifications.show({
                    title: "Folder Created",
                    message: `Created folder "${folderPath}".`,
                    color: "teal",
                  });
                } catch (err: any) {
                  notifications.show({
                    title: "Failed to Create Folder",
                    message: err.message,
                    color: "red",
                  });
                }
              }}
              onRename={async (oldPath, newPath) => {
                await api.renameHookFile(oldPath, newPath);
                if (selectedFileName === oldPath) {
                  setSelectedFileName(newPath);
                }
                setOpenFiles((prev) =>
                  prev.map((f) => (f === oldPath ? newPath : f)),
                );
                await loadOverview();
              }}
              onCopy={async (sourcePath, targetPath) => {
                await api.copyHookFile(sourcePath, targetPath);
                await loadOverview();
              }}
              onDeleteFolder={async (folderPath) => {
                await api.deleteHookFolder(folderPath);
                setOpenFiles((prev) =>
                  prev.filter((f) => !f.startsWith(folderPath + "/")),
                );
                if (
                  selectedFileName &&
                  selectedFileName.startsWith(folderPath + "/")
                ) {
                  setSelectedFileName(null);
                  setFileContent("");
                  setSavedContent("");
                }
                await loadOverview();
              }}
              onDeleteFile={(filePath) => handleDeleteFile(filePath)}
              onUploadBatch={async (files) => {
                await api.uploadHooksBatch(files);
                await loadOverview();
              }}
              onRefresh={loadOverview}
              loading={loading}
              searchPlaceholder="Search hook files..."
              onLoadDirectory={async (dirPath) => {
                const res = await api.getHooksTree(dirPath);
                return res.items;
              }}
              onSearch={async (query) => {
                const res = await api.searchHookFiles(query);
                return res.items;
              }}
            />

            {/* Main VS Code Editor Workspace */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {/* VS Code Tab Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "var(--color-bg-base)",
                  borderBottom: "1px solid var(--color-border)",
                  height: 38,
                  overflowX: "auto",
                }}
              >
                {/* Open Tabs */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    overflowX: "auto",
                  }}
                >
                  {openFiles.map((tabFileName) => {
                    const isActive = selectedFileName === tabFileName;
                    const isTabDirty = isActive && isDirty;

                    return (
                      <div
                        key={tabFileName}
                        onClick={() => loadFileContent(tabFileName)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "0 14px",
                          height: "100%",
                          cursor: "pointer",
                          backgroundColor: isActive
                            ? "var(--color-bg-card)"
                            : "transparent",
                          borderRight: "1px solid var(--color-border)",
                          borderTop: isActive
                            ? "2px solid var(--color-neon-primary)"
                            : "2px solid transparent",
                          color: isActive
                            ? "var(--color-text-primary)"
                            : "var(--color-text-dimmed)",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <FileIcon name={tabFileName} size={15} />
                        <span>{tabFileName}</span>

                        {isTabDirty ? (
                          <Box
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              backgroundColor: "#eab308",
                            }}
                            onClick={(e) => handleCloseTab(e, tabFileName)}
                          />
                        ) : (
                          <ActionIcon
                            size={16}
                            variant="subtle"
                            onClick={(e) => handleCloseTab(e, tabFileName)}
                            style={{
                              color: "var(--color-text-dimmed)",
                              opacity: 0.6,
                            }}
                          >
                            <Text size="xs" style={{ lineHeight: 1 }}>
                              ×
                            </Text>
                          </ActionIcon>
                        )}
                      </div>
                    );
                  })}

                  {/* New Tab Button */}
                  <Tooltip label="New Hook File" withArrow position="bottom">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => setIsNewFileModalOpen(true)}
                      style={{
                        marginLeft: 6,
                        color: "var(--color-text-dimmed)",
                      }}
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Tooltip>
                </div>

                {/* Editor Actions Toolbar (Right) */}
                <Group gap={6} pr="xs">
                  {saveSuccessMsg && (
                    <Badge
                      size="xs"
                      variant="filled"
                      leftSection={<IconCheck size={11} />}
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        color: "var(--color-neon-primary)",
                        border: "1px solid var(--color-border-glow)",
                      }}
                    >
                      Saved & Hot Reloaded
                    </Badge>
                  )}

                  {selectedFileName && (
                    <Button
                      size="xs"
                      leftSection={<IconDeviceFloppy size={13} />}
                      loading={savingFile}
                      onClick={() => handleSaveFile()}
                      style={{
                        backgroundColor: "var(--color-neon-primary)",
                        color: isDark ? "#052e16" : "#ffffff",
                        fontWeight: 700,
                        height: 26,
                        fontSize: "11px",
                        boxShadow: "var(--color-accent-glow)",
                      }}
                    >
                      Save (Ctrl+S)
                    </Button>
                  )}
                </Group>
              </div>

              {/* VS Code Breadcrumb Bar */}
              {selectedFileName && (
                <div
                  style={{
                    padding: "4px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "11.5px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-dimmed)",
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg-card)",
                  }}
                >
                  <span>_hooks</span>
                  <span>›</span>
                  <span style={{ color: "var(--color-neon-primary)" }}>
                    {selectedFileName}
                  </span>
                  <span>›</span>
                  <span style={{ opacity: 0.7 }}>
                    {getFileTypeLabel(selectedFileName)}
                  </span>
                </div>
              )}

              {/* Error Location Banner */}
              {selectedFileName && activeFileStatus?.error && (
                <div
                  style={{
                    padding: "8px 14px",
                    backgroundColor: isDark
                      ? "rgba(185, 28, 28, 0.2)"
                      : "rgba(254, 242, 242, 0.95)",
                    borderBottom: "1px solid rgba(239, 68, 68, 0.6)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Group
                      gap={8}
                      wrap="nowrap"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Badge
                        color="red"
                        variant="filled"
                        size="sm"
                        leftSection={<IconAlertTriangle size={12} />}
                      >
                        Hook Error
                      </Badge>
                      <Text
                        size="xs"
                        fw={700}
                        c="red"
                        style={{
                          fontFamily: "var(--font-mono)",
                          flexShrink: 0,
                        }}
                      >
                        {activeFileStatus.filename}
                        {activeFileStatus.errorLine
                          ? `:${activeFileStatus.errorLine}`
                          : ""}
                        {activeFileStatus.errorCol
                          ? `:${activeFileStatus.errorCol}`
                          : ""}
                      </Text>
                      <Text
                        size="xs"
                        c={isDark ? "#fca5a5" : "#b91c1c"}
                        fw={600}
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {activeFileStatus.error}
                      </Text>
                    </Group>

                    {activeFileStatus.errorLine && (
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="light"
                        onClick={() => {
                          if (editorRef.current && activeFileStatus.errorLine) {
                            editorRef.current.revealLineInCenter(
                              activeFileStatus.errorLine,
                            );
                            editorRef.current.setPosition({
                              lineNumber: activeFileStatus.errorLine,
                              column: activeFileStatus.errorCol || 1,
                            });
                            editorRef.current.focus();
                          }
                        }}
                        style={{ flexShrink: 0 }}
                      >
                        Jump to Line {activeFileStatus.errorLine}
                      </Button>
                    )}
                  </div>

                  {activeFileStatus.errorSnippet && (
                    <Paper
                      p="xs"
                      style={{
                        backgroundColor: isDark ? "#0f172a" : "#1e293b",
                        color: "#f87171",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        lineHeight: 1.4,
                        whiteSpace: "pre",
                        overflowX: "auto",
                        borderRadius: 4,
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      {activeFileStatus.errorSnippet}
                    </Paper>
                  )}
                </div>
              )}

              {/* Editor Content or Welcome Screen */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {selectedFileName ? (
                  isMediaFilename(selectedFileName).isMedia &&
                  !editSvgAsCode ? (
                    <MediaViewer
                      filename={selectedFileName}
                      src={`/api/hooks/files/raw?path=${encodeURIComponent(selectedFileName)}`}
                      sizeBytes={
                        overview?.files?.find(
                          (f) => (f.filename || f.name) === selectedFileName,
                        )?.sizeBytes
                      }
                      isDark={isDark}
                      showCodeToggle={selectedFileName
                        .toLowerCase()
                        .endsWith(".svg")}
                      onSwitchToCode={() => {
                        setEditSvgAsCode(true);
                        loadFileContent(selectedFileName, true);
                      }}
                    />
                  ) : (
                    <Editor
                      height="100%"
                      language={getLanguage(selectedFileName)}
                      theme={isDark ? "alsabase-dark" : "alsabase-light"}
                      value={fileContent}
                      onChange={(val) => setFileContent(val || "")}
                      onMount={handleEditorMount}
                      options={{
                        fontSize: 13.5,
                        lineNumbers: "on",
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: "on",
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        bracketPairColorization: { enabled: true },
                        suggestOnTriggerCharacters: true,
                      }}
                    />
                  )
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 40,
                      backgroundColor: "var(--color-bg-base)",
                      height: "100%",
                    }}
                  >
                    <Box
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        background: "var(--color-neon-dim)",
                        border: "1px solid var(--color-border-glow)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 16,
                      }}
                    >
                      <IconCode size={30} color="var(--color-neon-primary)" />
                    </Box>
                    <Title
                      order={3}
                      style={{
                        color: "var(--color-text-primary)",
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      AlsaBase Hooks Editor
                    </Title>
                    <Text
                      size="sm"
                      c="dimmed"
                      style={{
                        maxWidth: 460,
                        textAlign: "center",
                        marginBottom: 24,
                      }}
                    >
                      Create or select a JavaScript hook file to extend AlsaBase
                      with custom REST API endpoints, scheduled cron jobs, and
                      database hooks.
                    </Text>

                    <Group gap="md">
                      <Button
                        leftSection={<IconPlus size={15} />}
                        onClick={() => {
                          setNewFileName("api_routes.js");
                          setSelectedTemplate("route");
                          setIsNewFileModalOpen(true);
                        }}
                        style={{
                          backgroundColor: "var(--color-neon-primary)",
                          color: isDark ? "#052e16" : "#ffffff",
                          fontWeight: 700,
                        }}
                      >
                        New API Route Hook
                      </Button>
                      <Button
                        variant="default"
                        leftSection={<IconClock size={15} />}
                        onClick={() => {
                          setNewFileName("scheduled_tasks.js");
                          setSelectedTemplate("cron");
                          setIsNewFileModalOpen(true);
                        }}
                      >
                        New Scheduled Cron Hook
                      </Button>
                    </Group>
                  </div>
                )}
              </div>

              {/* VS Code Bottom Status Bar */}
              <div
                style={{
                  height: 24,
                  backgroundColor: activeFileStatus?.error
                    ? "#dc2626"
                    : isDark
                      ? "#10e57a"
                      : "#059669",
                  color:
                    isDark && !activeFileStatus?.error ? "#052e16" : "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  userSelect: "none",
                }}
              >
                <Group gap="md">
                  <span>AlsaBase Serverless (ES6)</span>
                  <span>_hooks/</span>
                  {activeFileStatus?.error ? (
                    <span
                      onClick={() => {
                        if (editorRef.current && activeFileStatus.errorLine) {
                          editorRef.current.revealLineInCenter(
                            activeFileStatus.errorLine,
                          );
                          editorRef.current.setPosition({
                            lineNumber: activeFileStatus.errorLine,
                            column: activeFileStatus.errorCol || 1,
                          });
                          editorRef.current.focus();
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontWeight: 700,
                      }}
                    >
                      Error at Ln {activeFileStatus.errorLine || 1}, Col{" "}
                      {activeFileStatus.errorCol || 1}
                    </span>
                  ) : (
                    <span>[Hot Reload Active]</span>
                  )}
                </Group>
                <Group gap="md">
                  <span>
                    Ln {editorCursorPos.line}, Col {editorCursorPos.col}
                  </span>
                  <span>Spaces: 2</span>
                  <span>UTF-8</span>
                  <span>{getLanguage(selectedFileName).toUpperCase()}</span>
                </Group>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: ACTIVE ENDPOINTS (SEPARATED BY FILE) */}
        {activeTab === "routes" && (
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              backgroundColor: "var(--color-bg-base)",
            }}
          >
            {/* Top Toolbar */}
            <Group justify="space-between" align="center" mb="md">
              <Group gap="xs">
                <Text
                  fw={700}
                  size="md"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Active Endpoints
                </Text>
                <Badge
                  size="sm"
                  variant="outline"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {overview?.routes?.length || 0} total in{" "}
                  {groupedRoutes.length}{" "}
                  {groupedRoutes.length === 1 ? "file" : "files"}
                </Badge>
              </Group>
              <TextInput
                placeholder="Filter endpoints by path, method, or file..."
                size="xs"
                leftSection={<IconSearch size={14} />}
                value={routesSearchQuery}
                onChange={(e) => setRoutesSearchQuery(e.currentTarget.value)}
                style={{ width: 340 }}
              />
            </Group>

            {/* Grouped By File Cards */}
            {groupedRoutes.map(({ filename, routes }) => (
              <Card
                key={filename}
                withBorder
                style={{
                  background: "var(--color-bg-card)",
                  borderColor: "var(--color-border)",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
                p={0}
              >
                <Group
                  justify="space-between"
                  align="center"
                  px="md"
                  py="xs"
                  style={{
                    backgroundColor: "var(--color-bg-well)",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <Group gap="xs">
                    <FileIcon name={filename} size={18} />
                    <Text
                      fw={700}
                      size="sm"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {filename}
                    </Text>
                    <Badge
                      size="xs"
                      variant="filled"
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        color: "var(--color-neon-primary)",
                        border: "1px solid var(--color-border-glow)",
                      }}
                    >
                      {routes.length} {routes.length === 1 ? "route" : "routes"}
                    </Badge>
                  </Group>
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconFileCode size={13} />}
                    onClick={() => {
                      handleTabChange("files");
                      loadFileContent(filename);
                    }}
                    style={{
                      backgroundColor: "var(--color-bg-card-hover)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Open in Editor
                  </Button>
                </Group>

                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 100 }}>Method</Table.Th>
                      <Table.Th>Path</Table.Th>
                      <Table.Th style={{ width: 120 }}>Auth Level</Table.Th>
                      <Table.Th style={{ width: 130 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {routes.map((route, idx) => (
                      <Table.Tr key={`${route.method}-${route.path}-${idx}`}>
                        <Table.Td>
                          <Badge
                            size="sm"
                            variant="filled"
                            style={{
                              backgroundColor:
                                route.method === "GET"
                                  ? "var(--color-neon-dim)"
                                  : route.method === "POST"
                                    ? "rgba(56, 189, 248, 0.15)"
                                    : route.method === "DELETE"
                                      ? "rgba(239, 68, 68, 0.15)"
                                      : "rgba(245, 158, 11, 0.15)",
                              color:
                                route.method === "GET"
                                  ? "var(--color-neon-primary)"
                                  : route.method === "POST"
                                    ? "#0284c7"
                                    : route.method === "DELETE"
                                      ? "#dc2626"
                                      : "#d97706",
                              border: "1px solid var(--color-border)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {route.method}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Code
                            style={{
                              backgroundColor: "var(--color-bg-well)",
                              color: "var(--color-text-primary)",
                              fontSize: "12px",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {route.path}
                          </Code>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="outline"
                            size="xs"
                            style={{
                              borderColor:
                                route.authLevel === "public"
                                  ? "var(--color-border-glow)"
                                  : route.authLevel === "superuser"
                                    ? "rgba(239, 68, 68, 0.3)"
                                    : "rgba(168, 85, 247, 0.3)",
                              color:
                                route.authLevel === "public"
                                  ? "var(--color-neon-primary)"
                                  : route.authLevel === "superuser"
                                    ? "#ef4444"
                                    : "#a855f7",
                            }}
                          >
                            {route.authLevel || "public"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconPlayerPlay size={12} />}
                            onClick={() => handleOpenTestRoute(route)}
                            style={{
                              backgroundColor: "var(--color-neon-dim)",
                              color: "var(--color-neon-primary)",
                              border: "1px solid var(--color-border-glow)",
                            }}
                          >
                            Test Route
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            ))}

            {groupedRoutes.length === 0 && (
              <Card
                withBorder
                style={{
                  background: "var(--color-bg-card)",
                  borderColor: "var(--color-border)",
                  textAlign: "center",
                }}
                p="xl"
              >
                <Text c="dimmed" size="sm">
                  {routesSearchQuery
                    ? "No endpoints match the search filter."
                    : "No active endpoints registered from _hooks yet."}
                </Text>
              </Card>
            )}
          </div>
        )}

        {/* PANEL 3: SCHEDULED CRONS */}
        {activeTab === "crons" && (
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              backgroundColor: "var(--color-bg-base)",
            }}
          >
            <Card
              withBorder
              style={{
                background: "var(--color-bg-card)",
                borderColor: "var(--color-border)",
              }}
              p="lg"
            >
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Job Name</Table.Th>
                    <Table.Th>Schedule Pattern</Table.Th>
                    <Table.Th>Source File</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Last Run</Table.Th>
                    <Table.Th>Last Result</Table.Th>
                    <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {overview?.crons.map((cronDef) => (
                    <Table.Tr key={cronDef.name}>
                      <Table.Td
                        fw={600}
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {cronDef.name}
                      </Table.Td>
                      <Table.Td>
                        <Code
                          style={{
                            backgroundColor: "var(--color-bg-well)",
                            color: "var(--color-neon-primary)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {cronDef.schedule}
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {cronDef.sourceFile}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="filled"
                          style={{
                            backgroundColor: cronDef.active
                              ? "var(--color-neon-dim)"
                              : "var(--color-bg-card-hover)",
                            color: cronDef.active
                              ? "var(--color-neon-primary)"
                              : "var(--color-text-dimmed)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {cronDef.active ? "Active" : "Paused"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {cronDef.last_run_at
                            ? new Date(cronDef.last_run_at).toLocaleString()
                            : "Never"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {cronDef.last_status === "SUCCESS" ? (
                          <Badge
                            size="xs"
                            variant="filled"
                            style={{
                              backgroundColor: "var(--color-neon-dim)",
                              color: "var(--color-neon-primary)",
                              border: "1px solid var(--color-border-glow)",
                            }}
                          >
                            SUCCESS ({cronDef.last_duration_ms}ms)
                          </Badge>
                        ) : cronDef.last_status === "ERROR" ? (
                          <Badge size="xs" color="red" variant="filled">
                            ERROR
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconPlayerPlay size={12} />}
                          loading={
                            cronRunning && selectedCron?.name === cronDef.name
                          }
                          onClick={() => handleExecuteCron(cronDef)}
                          style={{
                            backgroundColor: "var(--color-neon-dim)",
                            color: "var(--color-neon-primary)",
                            border: "1px solid var(--color-border-glow)",
                          }}
                        >
                          Run Now
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}

                  {overview?.crons.length === 0 && (
                    <Table.Tr>
                      <Table.Td
                        colSpan={7}
                        style={{ textAlign: "center", padding: "30px 0" }}
                      >
                        <Text c="dimmed" size="sm">
                          No cron jobs registered from _hooks yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Card>
          </div>
        )}

        {/* PANEL: CLI COMMANDS & SCRIPTS */}
        {activeTab === "commands" && (
          <div
            style={{
              flex: 1,
              padding: 20,
              overflowY: "auto",
              backgroundColor: "var(--color-bg-base)",
            }}
          >
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              {/* Header Section */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div>
                  <Group gap="xs" align="center">
                    <Title
                      order={4}
                      style={{
                        color: "var(--color-text-primary)",
                        fontWeight: 700,
                      }}
                    >
                      Commands & CLI Scripts
                    </Title>
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        color: "var(--color-neon-primary)",
                        border: "1px solid var(--color-border-glow)",
                      }}
                    >
                      {overview?.commands?.length || 0}{" "}
                      {overview?.commands?.length === 1 ? "Script" : "Scripts"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    Execute standalone Node.js CLI scripts or custom hook
                    commands in _hooks/ with interactive parameters and live
                    terminal logs.
                  </Text>
                </div>

                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleReloadHooks}
                  loading={loading}
                >
                  Rescan Scripts
                </Button>
              </div>

              {/* Commands List / Cards */}
              <Stack gap="lg">
                {overview?.commands?.map((cmd) => (
                  <Card
                    key={cmd.name}
                    withBorder
                    p="lg"
                    style={{
                      background: "var(--color-bg-card)",
                      borderColor: "var(--color-border)",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                      borderRadius: 10,
                    }}
                  >
                    {/* Card Top Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Group gap="sm" wrap="nowrap" align="center">
                        <Box
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: "var(--color-neon-dim)",
                            border: "1px solid var(--color-border-glow)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconTerminal2
                            size={20}
                            color="var(--color-neon-primary)"
                          />
                        </Box>
                        <div>
                          <Group gap="xs" align="center">
                            <Text
                              fw={700}
                              size="md"
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {cmd.name}
                            </Text>
                            <Badge
                              size="xs"
                              variant="filled"
                              style={{
                                backgroundColor:
                                  cmd.type === "script"
                                    ? "rgba(56, 189, 248, 0.15)"
                                    : "var(--color-neon-dim)",
                                color:
                                  cmd.type === "script"
                                    ? "#38bdf8"
                                    : "var(--color-neon-primary)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              {cmd.type === "script"
                                ? "CLI Script"
                                : "Hook Command"}
                            </Badge>
                            <Badge
                              size="xs"
                              variant="outline"
                              style={{
                                cursor: "pointer",
                                borderColor: "var(--color-border)",
                                color: "var(--color-text-dimmed)",
                                fontFamily: "var(--font-mono)",
                              }}
                              onClick={() => {
                                loadFileContent(cmd.sourceFile);
                                handleTabChange("files");
                              }}
                            >
                              _hooks/{cmd.sourceFile}
                            </Badge>
                          </Group>
                          <Text
                            size="sm"
                            c="dimmed"
                            mt={4}
                            style={{ lineHeight: 1.4 }}
                          >
                            {cmd.description}
                          </Text>
                        </div>
                      </Group>

                      <Button
                        size="sm"
                        leftSection={<IconPlayerPlay size={15} />}
                        onClick={() => handleOpenCommandModal(cmd)}
                        style={{
                          backgroundColor: "var(--color-neon-primary)",
                          color: isDark ? "#052e16" : "#ffffff",
                          fontWeight: 700,
                          boxShadow: "var(--color-accent-glow)",
                          flexShrink: 0,
                        }}
                      >
                        Run Script
                      </Button>
                    </div>

                    {/* Usage Syntax Block */}
                    {cmd.usage && (
                      <Paper
                        p="xs"
                        mb="md"
                        withBorder
                        style={{
                          backgroundColor: isDark ? "#090d16" : "#0f172a",
                          borderColor: "var(--color-border)",
                          borderRadius: 6,
                        }}
                      >
                        <Group justify="space-between" mb={4}>
                          <Text size="11px" fw={700} c="dimmed">
                            USAGE SYNTAX
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={async () => {
                              await copyToClipboard(cmd.usage || "");
                              notifications.show({
                                title: "Copied",
                                message: "Usage command copied to clipboard",
                                color: "teal",
                              });
                            }}
                          >
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Group>
                        <Code
                          block
                          style={{
                            background: "transparent",
                            color: "var(--color-neon-primary)",
                            fontSize: "12px",
                            lineHeight: 1.6,
                            fontFamily:
                              "'JetBrains Mono', 'Fira Code', monospace",
                            whiteSpace: "pre-wrap",
                            padding: 0,
                          }}
                        >
                          {cmd.usage}
                        </Code>
                      </Paper>
                    )}

                    {/* All Available Flags & Parameters */}
                    {cmd.options && cmd.options.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Text size="xs" fw={700} c="dimmed" mb={8}>
                          AVAILABLE FLAGS & OPTIONS ({cmd.options.length}):
                        </Text>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {cmd.options.map((opt) => {
                            const isParam = opt.name.includes("<");
                            const tooltipContent = (
                              <div>
                                <div style={{ fontWeight: 700 }}>
                                  {opt.name}
                                </div>
                                <div style={{ fontSize: "11px", opacity: 0.9 }}>
                                  {opt.description || opt.name}
                                </div>
                                {opt.aliases && opt.aliases.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: "10.5px",
                                      color: "var(--color-neon-primary)",
                                      marginTop: 2,
                                    }}
                                  >
                                    Aliases: {opt.aliases.join(", ")}
                                  </div>
                                )}
                              </div>
                            );

                            return (
                              <Tooltip
                                key={opt.name}
                                label={tooltipContent}
                                withArrow
                                position="top"
                              >
                                <Button
                                  size="compact-xs"
                                  variant="outline"
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "11.5px",
                                    backgroundColor: isParam
                                      ? "rgba(56, 189, 248, 0.08)"
                                      : "var(--color-bg-well)",
                                    borderColor: isParam
                                      ? "rgba(56, 189, 248, 0.3)"
                                      : "var(--color-border)",
                                    color: isParam
                                      ? "#38bdf8"
                                      : "var(--color-text-primary)",
                                    cursor: "pointer",
                                    padding: "4px 10px",
                                    height: "auto",
                                    borderRadius: "5px",
                                  }}
                                  onClick={() =>
                                    handleOpenCommandModal(cmd, opt.name)
                                  }
                                >
                                  {opt.name}
                                  {opt.aliases && opt.aliases.length > 0 && (
                                    <span
                                      style={{
                                        opacity: 0.5,
                                        marginLeft: 4,
                                        fontSize: "10px",
                                      }}
                                    >
                                      ({opt.aliases[0]})
                                    </span>
                                  )}
                                </Button>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Inline Arguments & Execution Bar */}
                    <div
                      style={{
                        paddingTop: 12,
                        borderTop: "1px solid var(--color-border)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <TextInput
                        placeholder="Quick arguments (e.g. --list)"
                        size="xs"
                        style={{ flex: 1 }}
                        styles={{
                          input: {
                            fontFamily: "var(--font-mono)",
                            backgroundColor: "var(--color-bg-well)",
                          },
                        }}
                        defaultValue="--list"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.target as HTMLInputElement).value;
                            handleOpenCommandModal(cmd, val);
                            handleExecuteCommand(cmd.name, val);
                          }
                        }}
                        id={`quick-args-${cmd.name}`}
                      />
                      <Button
                        size="xs"
                        variant="filled"
                        leftSection={<IconPlayerPlay size={13} />}
                        style={{
                          backgroundColor: "var(--color-neon-primary)",
                          color: isDark ? "#052e16" : "#ffffff",
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          const inputEl = document.getElementById(
                            `quick-args-${cmd.name}`,
                          ) as HTMLInputElement;
                          const val = inputEl ? inputEl.value : "--list";
                          handleOpenCommandModal(cmd, val);
                          handleExecuteCommand(cmd.name, val);
                        }}
                      >
                        Run Quick
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => handleOpenCommandModal(cmd)}
                      >
                        Open Console
                      </Button>
                    </div>
                  </Card>
                ))}

                {(!overview?.commands || overview.commands.length === 0) && (
                  <Card
                    withBorder
                    p="xl"
                    style={{
                      background: "var(--color-bg-card)",
                      borderColor: "var(--color-border)",
                      textAlign: "center",
                    }}
                  >
                    <Box
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "var(--color-neon-dim)",
                        margin: "0 auto 12px auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconTerminal2
                        size={26}
                        color="var(--color-neon-primary)"
                      />
                    </Box>
                    <Title
                      order={4}
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      No CLI Scripts or Commands Found
                    </Title>
                    <Text
                      size="sm"
                      c="dimmed"
                      mt={6}
                      style={{ maxWidth: 460, margin: "0 auto" }}
                    >
                      Place standalone executable scripts (such as
                      sync_data.mjs) or register custom commands with
                      commandAdd in _hooks/ to run them directly from here.
                    </Text>
                  </Card>
                )}
              </Stack>
            </div>
          </div>
        )}

        {/* PANEL 5: ALSA HOOKS GUIDE */}
        {activeTab === "guide" && (
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              backgroundColor: "var(--color-bg-base)",
            }}
          >
            <Stack gap="md">
              <Card
                withBorder
                style={{
                  background: "var(--color-bg-card)",
                  borderColor: "var(--color-border)",
                }}
                p="lg"
              >
                <Title
                  order={4}
                  mb="xs"
                  style={{ color: "var(--color-neon-primary)" }}
                >
                  AlsaBase Hooks & Serverless Architecture
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  AlsaBase automatically executes JavaScript and TypeScript
                  files placed in the{" "}
                  <Code
                    style={{
                      color: "var(--color-neon-primary)",
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    _hooks/
                  </Code>{" "}
                  directory. Whenever you save or update files, the serverless
                  engine reloads immediately with hot swapping.
                </Text>

                <Title
                  order={5}
                  mt="md"
                  mb="xs"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  1. Registering HTTP Endpoints (
                  <Code
                    style={{
                      color: "var(--color-neon-primary)",
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    routerAdd
                  </Code>
                  )
                </Title>
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    background: "var(--color-bg-well)",
                    borderColor: "var(--color-border)",
                  }}
                  mb="md"
                >
                  <Code
                    block
                    style={{
                      background: "transparent",
                      color: "var(--color-text-secondary)",
                    }}
                  >{`// Public Endpoint
routerAdd("GET", "/api/hello", (c) => {
  return c.json({ message: "Hello World", time: new Date().toISOString() });
});

// Authenticated Endpoint
routerAdd("POST", "/api/profile/update", (c) => {
  const user = c.user; // or c.auth
  const body = c.body;
  return c.json({ status: "success", user });
}, "auth"); // "public" | "auth" | "superuser"

// Superuser Endpoint
routerAdd("DELETE", "/api/maintenance/reset", (c) => {
  collections.run("DELETE FROM _logs WHERE timestamp < datetime('now', '-7 days')");
  return c.json({ success: true });
}, "superuser");`}</Code>
                </Paper>

                <Title
                  order={5}
                  mt="md"
                  mb="xs"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  2. Registering Scheduled Cron Tasks (
                  <Code
                    style={{
                      color: "var(--color-neon-primary)",
                      backgroundColor: "var(--color-bg-well)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    cronAdd
                  </Code>
                  )
                </Title>
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    background: "var(--color-bg-well)",
                    borderColor: "var(--color-border)",
                  }}
                  mb="md"
                >
                  <Code
                    block
                    style={{
                      background: "transparent",
                      color: "var(--color-text-secondary)",
                    }}
                  >{`// Run every 5 minutes
cronAdd("ping_service", "*/5 * * * *", () => {
  log("Heartbeat ping executed at: " + new Date().toISOString());
});

// Run daily at midnight
cronAdd("daily_summary", "0 0 * * *", () => {
  const totalLogs = collections.get("SELECT COUNT(*) as count FROM _logs");
  log("Total logs in database: " + totalLogs.count);
});`}</Code>
                </Paper>

                <Title
                  order={5}
                  mt="md"
                  mb="xs"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  3. Available Global APIs & Helpers
                </Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 340 }}>Identifier</Table.Th>
                      <Table.Th>Description</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "var(--color-neon-primary)",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          routerAdd(method, path, handler, [authLevel])
                        </Code>
                      </Table.Td>
                      <Table.Td>Registers dynamic HTTP endpoint route</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "var(--color-neon-primary)",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          cronAdd(name, schedule, handler)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Registers scheduled cron background task
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#0284c7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          c.json(data, status = 200)
                        </Code>
                      </Table.Td>
                      <Table.Td>Sends JSON response in router handler</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#0284c7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          c.req / c.res / c.body / c.query / c.params
                        </Code>
                      </Table.Td>
                      <Table.Td>Request context objects</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#0284c7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          c.user / c.auth
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Authenticated user record (if token supplied)
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#a855f7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          collections.list()
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Returns list of all collections definitions
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#a855f7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          collections.query(sql, ...params)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Executes SQL query returning multiple rows
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#a855f7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          collections.get(sql, ...params)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Executes SQL query returning single row
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#a855f7",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          collections.run(sql, ...params)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Executes SQL INSERT/UPDATE/DELETE statement
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#10e57a",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          onRecordAfterCreate(collection, (e) =&gt; ...)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Subscribes to record creation events on a collection
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#10e57a",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          onRecordAfterUpdate(collection, (e) =&gt; ...)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Subscribes to record update events on a collection
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#ef4444",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          onRecordAfterDelete(collection, (e) =&gt; ...)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Subscribes to record delete events on a collection
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#38bdf8",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          onEvent(topic, (data) =&gt; ...)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Subscribes to custom web events on the backend
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "#38bdf8",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          events.emit(topic, data)
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Broadcasts custom event to all SSE subscribers &amp;
                        listeners
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code
                          style={{
                            color: "var(--color-text-secondary)",
                            backgroundColor: "var(--color-bg-well)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          db
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        Direct Node.js SQLite DatabaseSync instance
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          </div>
        )}
      </div>

      {/* MODAL: Create New Hook File */}
      <Modal
        opened={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        title={
          <Group gap="xs">
            <IconFileCode size={18} color="#10e57a" />
            <Text fw={700}>Create New Hook File</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="File Name"
            description="Saved in the _hooks/ directory"
            placeholder="e.g. auth_middleware.js or custom_api.js"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            required
          />

          <div>
            <Text size="xs" fw={600} mb={6} c="dimmed">
              Starter Template
            </Text>
            <SegmentedControl
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              fullWidth
              size="xs"
              data={[
                { label: "API Route", value: "route" },
                { label: "Cron Task", value: "cron" },
                { label: "Helper Module", value: "helper" },
                { label: "NPM Example", value: "npm" },
                { label: "Events / SSE", value: "events" },
                { label: "Empty", value: "empty" },
              ]}
              color="neonGreen"
            />
          </div>

          <Group justify="flex-end" mt="xs">
            <Button
              variant="default"
              onClick={() => setIsNewFileModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateNewFile()}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: isDark ? "#052e16" : "#ffffff",
                fontWeight: 700,
                boxShadow: "var(--color-accent-glow)",
              }}
            >
              Create & Open in Monaco
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: Test Route */}
      <Modal
        opened={testRouteModalOpen}
        onClose={() => setTestRouteModalOpen(false)}
        title={
          <Group gap="xs">
            <IconPlayerPlay size={18} color="#10e57a" />
            <Text fw={700}>
              {testingRoute
                ? `Test Route: [${testingRoute.method}] ${testingRoute.path}`
                : "Test Route"}
            </Text>
          </Group>
        }
        size="lg"
      >
        {testingRoute && (
          <Stack gap="md">
            <Group grow>
              <Select
                label="HTTP Method"
                value={testMethod}
                onChange={(val) => setTestMethod(val || "GET")}
                data={["GET", "POST", "PUT", "PATCH", "DELETE"]}
              />
              <TextInput label="Path" value={testingRoute.path} disabled />
            </Group>

            {["POST", "PUT", "PATCH"].includes(testMethod) && (
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text
                    size="xs"
                    fw={600}
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Request Body
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={testBodyMode}
                    onChange={(val: any) => handleToggleBodyMode(val)}
                    data={[
                      {
                        label: (
                          <Group gap={4}>
                            <IconList size={13} />
                            <span>Fields</span>
                          </Group>
                        ),
                        value: "fields",
                      },
                      {
                        label: (
                          <Group gap={4}>
                            <IconBraces size={13} />
                            <span>JSON</span>
                          </Group>
                        ),
                        value: "json",
                      },
                    ]}
                  />
                </Group>

                {testBodyMode === "fields" ? (
                  <Paper
                    p="sm"
                    withBorder
                    style={{
                      background: "var(--color-bg-well)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <Stack gap="xs">
                      {testBodyFields.map((field) => (
                        <Group key={field.id} gap="xs" align="center">
                          <TextInput
                            placeholder="Key"
                            size="xs"
                            value={field.key}
                            onChange={(e) =>
                              handleUpdateField(
                                field.id,
                                e.currentTarget.value,
                                field.value,
                                field.type,
                              )
                            }
                            style={{ flex: 1.2 }}
                            styles={{
                              input: {
                                fontFamily: "var(--font-mono)",
                                fontSize: "12px",
                              },
                            }}
                          />
                          <Select
                            size="xs"
                            value={field.type}
                            onChange={(val: any) => {
                              const newType = val || "string";
                              let valToSet = field.value;
                              if (
                                newType === "boolean" &&
                                valToSet !== "true" &&
                                valToSet !== "false"
                              ) {
                                valToSet = "true";
                              }
                              handleUpdateField(
                                field.id,
                                field.key,
                                valToSet,
                                newType,
                              );
                            }}
                            data={[
                              { value: "string", label: "String" },
                              { value: "number", label: "Number" },
                              { value: "boolean", label: "Boolean" },
                              { value: "json", label: "JSON / Object" },
                            ]}
                            style={{ width: 110 }}
                          />
                          {field.type === "boolean" ? (
                            <Select
                              size="xs"
                              value={field.value === "true" ? "true" : "false"}
                              onChange={(val) =>
                                handleUpdateField(
                                  field.id,
                                  field.key,
                                  val || "true",
                                  field.type,
                                )
                              }
                              data={[
                                { value: "true", label: "true" },
                                { value: "false", label: "false" },
                              ]}
                              style={{ flex: 2 }}
                            />
                          ) : (
                            <TextInput
                              placeholder={
                                field.type === "number"
                                  ? "123"
                                  : field.type === "json"
                                    ? '{"sub": 1}'
                                    : "Value (e.g. test)"
                              }
                              size="xs"
                              value={field.value}
                              onChange={(e) =>
                                handleUpdateField(
                                  field.id,
                                  field.key,
                                  e.currentTarget.value,
                                  field.type,
                                )
                              }
                              style={{ flex: 2 }}
                              styles={{
                                input: {
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "12px",
                                },
                              }}
                            />
                          )}
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => handleRemoveField(field.id)}
                            title="Remove Field"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      ))}

                      <Group justify="space-between" mt={4}>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconPlus size={12} />}
                          onClick={handleAddField}
                          style={{
                            backgroundColor: "var(--color-neon-dim)",
                            color: "var(--color-neon-primary)",
                            border: "1px solid var(--color-border-glow)",
                          }}
                        >
                          Add Field
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="dimmed"
                          onClick={() => {
                            setTestBodyFields([
                              {
                                id: String(Date.now()),
                                key: "",
                                value: "",
                                type: "string" as const,
                              },
                            ]);
                            setTestRequestBody("{}");
                          }}
                        >
                          Clear Fields
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap={4}>
                    <Group justify="flex-end" mb={2}>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        leftSection={<IconSparkles size={12} />}
                        onClick={handleFormatJson}
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Format JSON
                      </Button>
                    </Group>
                    <Textarea
                      value={testRequestBody}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTestRequestBody(val);
                        try {
                          setTestBodyFields(parseJsonToFields(val));
                        } catch {}
                      }}
                      rows={6}
                      styles={{
                        input: {
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          backgroundColor: "var(--color-bg-well)",
                          borderColor: "var(--color-border)",
                        },
                      }}
                    />
                  </Stack>
                )}
              </Stack>
            )}

            <Button
              leftSection={<IconPlayerPlay size={16} />}
              loading={testLoading}
              onClick={handleExecuteTestRoute}
              style={{
                backgroundColor: "#10e57a",
                color: "#052e16",
                fontWeight: 700,
                boxShadow: "0 0 12px rgba(16, 229, 122, 0.25)",
              }}
            >
              Send Request
            </Button>

            {testResult && (
              <Paper
                p="md"
                withBorder
                style={{
                  background: "var(--color-bg-well)",
                  borderColor: "var(--color-border)",
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text
                    size="sm"
                    fw={600}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Response:
                  </Text>
                  {testResult.status && (
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor:
                          testResult.status >= 200 && testResult.status < 300
                            ? "var(--color-neon-dim)"
                            : "rgba(239, 68, 68, 0.15)",
                        color:
                          testResult.status >= 200 && testResult.status < 300
                            ? "var(--color-neon-primary)"
                            : "#dc2626",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      Status: {testResult.status} {testResult.statusText}
                    </Badge>
                  )}
                </Group>
                <Code
                  block
                  style={{
                    background: "transparent",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {JSON.stringify(testResult.data || testResult, null, 2)}
                </Code>
              </Paper>
            )}
          </Stack>
        )}
      </Modal>

      {/* MODAL: Run CLI Script / Command */}
      <Modal
        opened={commandModalOpen}
        onClose={() => {
          if (commandRunning) {
            handleCancelCommand();
          }
          setCommandModalOpen(false);
        }}
        title={
          <Group gap="xs">
            <IconTerminal2 size={20} color="var(--color-neon-primary)" />
            <Text fw={700} style={{ color: "var(--color-text-primary)" }}>
              {selectedCommand ? `Run: ${selectedCommand.name}` : "Run Command"}
            </Text>
            {selectedCommand && (
              <Badge
                size="xs"
                variant="filled"
                style={{
                  backgroundColor:
                    selectedCommand.type === "script"
                      ? "rgba(56, 189, 248, 0.15)"
                      : "var(--color-neon-dim)",
                  color:
                    selectedCommand.type === "script"
                      ? "#38bdf8"
                      : "var(--color-neon-primary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {selectedCommand.type === "script"
                  ? "CLI Script"
                  : "Hook Command"}
              </Badge>
            )}
            {commandRunning && (
              <Badge
                size="xs"
                color="red"
                variant="filled"
                style={{ fontWeight: 700 }}
              >
                Running (Ctrl+C to Cancel)
              </Badge>
            )}
          </Group>
        }
        size="xl"
      >
        {selectedCommand && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                {selectedCommand.description}
              </Text>
              {selectedCommand.usage && (
                <Paper
                  p="xs"
                  mt="xs"
                  withBorder
                  style={{
                    backgroundColor: isDark ? "#090d16" : "#0f172a",
                    borderColor: "var(--color-border)",
                    borderRadius: 6,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Text size="11px" fw={700} c="dimmed">
                      USAGE SYNTAX
                    </Text>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={async () => {
                        await copyToClipboard(
                          selectedCommand.usage || "",
                        );
                        notifications.show({
                          title: "Copied",
                          message: "Usage command copied to clipboard",
                          color: "teal",
                        });
                      }}
                    >
                      <IconCopy size={12} />
                    </ActionIcon>
                  </Group>
                  <Code
                    block
                    style={{
                      background: "transparent",
                      color: "var(--color-neon-primary)",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      whiteSpace: "pre-wrap",
                      padding: 0,
                    }}
                  >
                    {selectedCommand.usage}
                  </Code>
                </Paper>
              )}
            </div>

            {/* Quick Option Flags */}
            {selectedCommand.options && selectedCommand.options.length > 0 && (
              <div>
                <Text size="xs" fw={700} mb={6} c="dimmed">
                  Quick Flags & Options (Click to append):
                </Text>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedCommand.options.map((opt) => {
                    const isParam = opt.name.includes("<");
                    const flagToInsert = opt.flag || opt.name.split(" ")[0];

                    return (
                      <Tooltip
                        key={opt.name}
                        label={
                          <div>
                            <div style={{ fontWeight: 700 }}>{opt.name}</div>
                            <div style={{ fontSize: "11px" }}>
                              {opt.description || opt.name}
                            </div>
                            {opt.aliases && opt.aliases.length > 0 && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "var(--color-neon-primary)",
                                  marginTop: 2,
                                }}
                              >
                                Aliases: {opt.aliases.join(", ")}
                              </div>
                            )}
                          </div>
                        }
                        withArrow
                        position="top"
                      >
                        <Button
                          size="compact-xs"
                          variant="outline"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            backgroundColor: isParam
                              ? "rgba(56, 189, 248, 0.08)"
                              : "var(--color-bg-well)",
                            borderColor: isParam
                              ? "rgba(56, 189, 248, 0.3)"
                              : "var(--color-border)",
                            color: isParam
                              ? "#38bdf8"
                              : "var(--color-text-primary)",
                          }}
                          onClick={() => {
                            const trimmed = commandArgs.trim();
                            const insertVal = isParam
                              ? `${flagToInsert} `
                              : flagToInsert;
                            if (!trimmed) {
                              setCommandArgs(insertVal);
                            } else if (!trimmed.includes(flagToInsert)) {
                              setCommandArgs(`${trimmed} ${insertVal}`);
                            }
                          }}
                        >
                          {opt.name}
                        </Button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Arguments Input */}
            <TextInput
              label="Command Arguments"
              placeholder="e.g. --help, --list, or custom parameters"
              value={commandArgs}
              onChange={(e) => setCommandArgs(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !commandRunning) {
                  e.preventDefault();
                  handleExecuteCommand();
                }
              }}
              styles={{
                input: {
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  fontVariantLigatures: "none",
                  fontFeatureSettings: '"calt" 0, "liga" 0',
                  backgroundColor: "var(--color-bg-well)",
                },
              }}
            />

            {/* Execution Buttons */}
            <Group justify="space-between">
              <Group gap="xs">
                {commandRunning ? (
                  <Button
                    leftSection={<IconPlayerStop size={15} />}
                    color="red"
                    variant="filled"
                    onClick={handleCancelCommand}
                    style={{
                      fontWeight: 700,
                      boxShadow: "0 0 14px rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    Cancel / Stop (Ctrl+C)
                  </Button>
                ) : (
                  <Button
                    leftSection={<IconPlayerPlay size={15} />}
                    onClick={() => handleExecuteCommand()}
                    style={{
                      backgroundColor: "var(--color-neon-primary)",
                      color: isDark ? "#052e16" : "#ffffff",
                      fontWeight: 700,
                      boxShadow: "var(--color-accent-glow)",
                    }}
                  >
                    Execute Command
                  </Button>
                )}
                {commandOutput.length > 0 && !commandRunning && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setCommandOutput([]);
                      setCommandError(null);
                      setCommandExitCode(null);
                      setCommandDuration(null);
                    }}
                  >
                    Clear Output
                  </Button>
                )}
              </Group>

              {commandOutput.length > 0 && (
                <Button
                  variant="subtle"
                  size="sm"
                  leftSection={<IconCopy size={14} />}
                  onClick={async () => {
                    await copyToClipboard(commandOutput.join("\n"));
                    notifications.show({
                      title: "Copied",
                      message: "Terminal output copied to clipboard",
                      color: "teal",
                    });
                  }}
                >
                  Copy Output
                </Button>
              )}
            </Group>

            {/* Command Status / Meta */}
            {(commandDuration !== null || commandExitCode !== null) && (
              <Group gap="xs">
                {commandExitCode !== null && (
                  <Badge
                    size="sm"
                    variant="filled"
                    style={{
                      backgroundColor:
                        commandExitCode === 0
                          ? "var(--color-neon-dim)"
                          : "rgba(239, 68, 68, 0.15)",
                      color:
                        commandExitCode === 0
                          ? "var(--color-neon-primary)"
                          : "#dc2626",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Exit Code: {commandExitCode}
                  </Badge>
                )}
                {commandDuration !== null && (
                  <Badge
                    size="sm"
                    variant="outline"
                    style={{
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-dimmed)",
                    }}
                  >
                    Duration: {commandDuration}ms
                  </Badge>
                )}
              </Group>
            )}

            {/* Error Message */}
            {commandError && (
              <Paper
                p="xs"
                withBorder
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
              >
                <Group gap="xs">
                  <IconAlertTriangle size={16} color="#ef4444" />
                  <Text size="xs" c="red" fw={600}>
                    {commandError}
                  </Text>
                </Group>
              </Paper>
            )}

            {/* Terminal Output Viewer */}
            <div
              style={{
                backgroundColor: isDark ? "#090d16" : "#0f172a",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                padding: "12px",
                minHeight: "180px",
                maxHeight: "340px",
                overflowY: "auto",
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontVariantLigatures: "none",
                fontFeatureSettings: '"calt" 0, "liga" 0',
                fontSize: "12px",
                lineHeight: 1.5,
                color: "#e2e8f0",
              }}
            >
              {commandOutput.length === 0 ? (
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  Command output will appear here after execution...
                </Text>
              ) : (
                <>
                  {commandOutput.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color:
                          line.startsWith("[Error]") ||
                          line.startsWith("Error:") ||
                          line.startsWith("[stderr]")
                            ? "#f87171"
                            : line.startsWith("$")
                              ? "var(--color-neon-primary)"
                              : "#e2e8f0",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </>
              )}
            </div>
          </Stack>
        )}
      </Modal>

      {/* MODAL: Run Cron Job with Live Terminal Logs */}
      <Modal
        opened={cronModalOpen}
        onClose={() => {
          if (cronRunning) {
            handleCancelCron();
          }
          setCronModalOpen(false);
        }}
        title={
          <Group gap="xs">
            <IconClock size={20} color="var(--color-neon-primary)" />
            <Text fw={700} style={{ color: "var(--color-text-primary)" }}>
              {selectedCron ? `Cron: ${selectedCron.name}` : "Run Cron Job"}
            </Text>
            {selectedCron?.schedule && (
              <Code
                style={{
                  backgroundColor: "var(--color-bg-well)",
                  color: "var(--color-neon-primary)",
                  border: "1px solid var(--color-border)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {selectedCron.schedule}
              </Code>
            )}
            {selectedCron?.sourceFile && (
              <Badge
                size="xs"
                variant="outline"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-dimmed)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                _hooks/{selectedCron.sourceFile}
              </Badge>
            )}
            {cronRunning && (
              <Badge
                size="xs"
                color="red"
                variant="filled"
                style={{ fontWeight: 700 }}
              >
                Running (Ctrl+C to Cancel)
              </Badge>
            )}
          </Group>
        }
        size="xl"
      >
        {selectedCron && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                Running scheduled background job <b>{selectedCron.name}</b>{" "}
                on-demand with real-time log streaming.
              </Text>
            </div>

            {/* Execution Buttons */}
            <Group justify="space-between">
              <Group gap="xs">
                {cronRunning ? (
                  <Button
                    leftSection={<IconPlayerStop size={15} />}
                    color="red"
                    variant="filled"
                    onClick={handleCancelCron}
                    style={{
                      fontWeight: 700,
                      boxShadow: "0 0 14px rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    Cancel / Stop (Ctrl+C)
                  </Button>
                ) : (
                  <Button
                    leftSection={<IconPlayerPlay size={15} />}
                    onClick={() => handleExecuteCron()}
                    style={{
                      backgroundColor: "var(--color-neon-primary)",
                      color: isDark ? "#052e16" : "#ffffff",
                      fontWeight: 700,
                      boxShadow: "var(--color-accent-glow)",
                    }}
                  >
                    Run Again
                  </Button>
                )}
                {cronOutput.length > 0 && !cronRunning && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setCronOutput([]);
                      setCronError(null);
                      setCronStatus(null);
                      setCronDuration(null);
                    }}
                  >
                    Clear Output
                  </Button>
                )}
              </Group>

              {cronOutput.length > 0 && (
                <Button
                  variant="subtle"
                  size="sm"
                  leftSection={<IconCopy size={14} />}
                  onClick={async () => {
                    await copyToClipboard(cronOutput.join("\n"));
                    notifications.show({
                      title: "Copied",
                      message: "Cron log output copied to clipboard",
                      color: "teal",
                    });
                  }}
                >
                  Copy Output
                </Button>
              )}
            </Group>

            {/* Cron Status / Meta */}
            {(cronDuration !== null || cronStatus !== null) && (
              <Group gap="xs">
                {cronStatus !== null && (
                  <Badge
                    size="sm"
                    variant="filled"
                    style={{
                      backgroundColor:
                        cronStatus === "SUCCESS"
                          ? "var(--color-neon-dim)"
                          : "rgba(239, 68, 68, 0.15)",
                      color:
                        cronStatus === "SUCCESS"
                          ? "var(--color-neon-primary)"
                          : "#dc2626",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Result: {cronStatus}
                  </Badge>
                )}
                {cronDuration !== null && (
                  <Badge
                    size="sm"
                    variant="outline"
                    style={{
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-dimmed)",
                    }}
                  >
                    Duration: {cronDuration}ms
                  </Badge>
                )}
                <Badge
                  size="sm"
                  variant="outline"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-dimmed)",
                  }}
                >
                  {cronOutput.length} log lines
                </Badge>
              </Group>
            )}

            {/* Error Message */}
            {cronError && (
              <Paper
                p="xs"
                withBorder
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
              >
                <Group gap="xs">
                  <IconAlertTriangle size={16} color="#ef4444" />
                  <Text size="xs" c="red" fw={600}>
                    {cronError}
                  </Text>
                </Group>
              </Paper>
            )}

            {/* Terminal Output Viewer */}
            <div
              style={{
                backgroundColor: isDark ? "#090d16" : "#0f172a",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                padding: "12px",
                minHeight: "200px",
                maxHeight: "380px",
                overflowY: "auto",
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontVariantLigatures: "none",
                fontFeatureSettings: '"calt" 0, "liga" 0',
                fontSize: "12px",
                lineHeight: 1.5,
                color: "#e2e8f0",
              }}
            >
              {cronOutput.length === 0 ? (
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  Cron logs will stream live here once execution starts...
                </Text>
              ) : (
                <>
                  {cronOutput.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color:
                          line.startsWith("[Error]") ||
                          line.startsWith("Error:") ||
                          line.startsWith("[stderr]")
                            ? "#f87171"
                            : line.startsWith("$")
                              ? "var(--color-neon-primary)"
                              : "#e2e8f0",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={cronTerminalEndRef} />
                </>
              )}
            </div>
          </Stack>
        )}
      </Modal>

      {/* MODAL: NPM Packages Manager */}
      <NpmPackagesModal
        opened={packagesModalOpen}
        onClose={() => setPackagesModalOpen(false)}
      />
    </div>
  );
};
