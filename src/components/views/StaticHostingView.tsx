import React, { useState, useEffect, useRef } from "react";
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
  Box,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDeviceFloppy,
  IconCheck,
  IconWorld,
  IconExternalLink,
} from "@tabler/icons-react";
import Editor, { OnMount } from "@monaco-editor/react";
import { api } from "../../api/client";
import { VSCodeFileTree } from "../VSCodeFileTree";
import { FileIcon } from "../FileIcon";
import { MediaViewer, isMediaFilename } from "../MediaViewer";
import { openHoldToConfirmModal } from "../HoldToConfirmModal";

function getLanguage(filename: string | null): string {
  if (!filename) return "html";
  if (filename.endsWith(".html") || filename.endsWith(".htm")) return "html";
  if (filename.endsWith(".css")) return "css";
  if (
    filename.endsWith(".js") ||
    filename.endsWith(".mjs") ||
    filename.endsWith(".cjs")
  )
    return "javascript";
  if (filename.endsWith(".ts") || filename.endsWith(".tsx")) return "typescript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".svg") || filename.endsWith(".xml")) return "xml";
  return "html";
}

export const StaticHostingView: React.FC = () => {
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const [files, setFiles] = useState<
    { name: string; sizeBytes: number; updatedAt: string; isFolder?: boolean }[]
  >([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editorCursorPos, setEditorCursorPos] = useState({ line: 1, col: 1 });
  const [uploading, setUploading] = useState(false);
  const [editSvgAsCode, setEditSvgAsCode] = useState(false);
  const editorRef = useRef<any>(null);
  const selectedFileNameRef = useRef<string | null>(selectedFileName);
  selectedFileNameRef.current = selectedFileName;
  const fileContentRef = useRef<string>(fileContent);
  fileContentRef.current = fileContent;
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = fileContent !== savedContent && selectedFileName !== null;

  const readFileData = (
    file: File,
    targetPath: string,
  ): Promise<{ path: string; content: string; isBase64?: boolean }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isBinary =
        !/\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|svg|xml|map|env|yml|yaml)$/i.test(
          file.name,
        );

      if (isBinary) {
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          resolve({ path: targetPath, content: base64, isBase64: true });
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => {
          resolve({
            path: targetPath,
            content: reader.result as string,
            isBase64: false,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const filesArray = Array.from(fileList);

    notifications.show({
      id: "folder-upload",
      title: "Uploading Folder",
      message: `Uploading ${filesArray.length} files to _public...`,
      color: "blue",
      loading: true,
      autoClose: false,
    });

    try {
      const payloadPromises = filesArray.map((file) => {
        const relPath = file.webkitRelativePath || file.name;
        const parts = relPath.split(/[/\\]/);
        // Strip the top-level container folder name so files are uploaded directly inside _public
        const cleanPath = parts.length > 1 ? parts.slice(1).join("/") : relPath;
        return readFileData(file, cleanPath);
      });

      const filePayloads = await Promise.all(payloadPromises);
      const res = await api.uploadPublicBatch(filePayloads);

      notifications.update({
        id: "folder-upload",
        title: "Folder Upload Complete",
        message: `Successfully uploaded ${res.count} files into _public.`,
        color: "teal",
        loading: false,
        autoClose: 3000,
      });

      await loadFiles();
      const hasIndex = filePayloads.some((f) => f.path === "index.html");
      if (hasIndex) {
        loadFileContent("index.html");
      } else if (filePayloads.length > 0) {
        loadFileContent(filePayloads[0].path);
      }
    } catch (err: any) {
      notifications.update({
        id: "folder-upload",
        title: "Upload Failed",
        message: err.message || "Failed to upload folder.",
        color: "red",
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setUploading(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const filesArray = Array.from(fileList);

    notifications.show({
      id: "files-upload",
      title: "Uploading Files",
      message: `Uploading ${filesArray.length} file(s)...`,
      color: "blue",
      loading: true,
      autoClose: false,
    });

    try {
      const payloadPromises = filesArray.map((file) => {
        return readFileData(file, file.name);
      });

      const filePayloads = await Promise.all(payloadPromises);
      const res = await api.uploadPublicBatch(filePayloads);

      notifications.update({
        id: "files-upload",
        title: "Files Uploaded",
        message: `Successfully uploaded ${res.count} file(s).`,
        color: "teal",
        loading: false,
        autoClose: 3000,
      });

      await loadFiles();
      if (filePayloads.length > 0) {
        loadFileContent(filePayloads[0].path);
      }
    } catch (err: any) {
      notifications.update({
        id: "files-upload",
        title: "Upload Failed",
        message: err.message || "Failed to upload files.",
        color: "red",
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.listPublicFiles(true);
      setFiles(res.items);
      if (res.items.length > 0) {
        if (!selectedFileName) {
          const savedFile = localStorage.getItem("alsabase_public_file");
          const firstFile = res.items.find((item) => !item.isFolder);
          const targetFile =
            savedFile && !res.items.some((item) => item.name === savedFile && item.isFolder)
              ? savedFile
              : firstFile
                ? firstFile.name
                : null;
          if (targetFile) {
            loadFileContent(targetFile);
          }
        }
      }
    } catch (err: any) {
      notifications.show({
        title: "Failed to load public files",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (filename: string, forceCode = false) => {
    if (!filename) return;
    const isKnownFolder = files.some((f) => f.name === filename && f.isFolder);
    if (isKnownFolder) return;

    try {
      setSelectedFileName(filename);
      localStorage.setItem("alsabase_public_file", filename);
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

      const res = await api.getPublicFile(filename);
      setFileContent(res.content);
      setSavedContent(res.content);
      setSaveSuccessMsg(false);
    } catch (err: any) {
      notifications.show({
        title: "Load Failed",
        message: `Could not load ${filename}: ${err.message}`,
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
        localStorage.removeItem("alsabase_public_file");
        setFileContent("");
        setSavedContent("");
      }
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleSaveFile = async (customContent?: string) => {
    if (!selectedFileName) return;
    const contentToSave =
      customContent !== undefined ? customContent : fileContent;
    setSavingFile(true);
    try {
      await api.savePublicFile(selectedFileName, contentToSave);
      setSavedContent(contentToSave);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
      loadFiles();
      notifications.show({
        title: "File Saved",
        message: `Saved "${selectedFileName}".`,
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

  const handleCreateNewFile = async (customName?: string) => {
    let name = (customName || newFileName).trim();
    if (!name) return;
    if (!name.includes(".")) {
      name += ".html";
    }

    try {
      const starterTemplate = name.endsWith(".html")
        ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${name}</title>\n</head>\n<body>\n  <h1>${name}</h1>\n</body>\n</html>`
        : name.endsWith(".css")
          ? `/* Stylesheet: ${name} */\nbody {\n  margin: 0;\n  font-family: sans-serif;\n}\n`
          : `// Script: ${name}\nconsole.log('${name} loaded');\n`;

      await api.savePublicFile(name, starterTemplate);
      setIsNewFileModalOpen(false);
      setNewFileName("");
      await loadFiles();
      loadFileContent(name);
      notifications.show({
        title: "File Created",
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
          Move public file <b>{filename}</b> to the .trash directory?
        </Text>
      ),
      labels: { confirm: "Move to Trash", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deletePublicFile(filename);
          setOpenFiles((prev) => prev.filter((f) => f !== filename));
          if (selectedFileName === filename) {
            setSelectedFileName(null);
            setFileContent("");
            setSavedContent("");
          }
          await loadFiles();
          notifications.show({
            title: "File Moved to Trash",
            message: `Public file "${filename}" moved to .trash.`,
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

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor coordinates for status bar
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

    // Add Ctrl+S / Cmd+S save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentVal = editor.getValue();
      handleSaveFile(currentVal);
    });
  };

  return (
    <>
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
        <div
          style={{
            display: "flex",
            flex: 1,
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* VS Code Explorer Sidebar (Left) */}
          <VSCodeFileTree
            title="AlsaBase"
            files={files.map((f) => ({
              name: f.name,
              sizeBytes: f.sizeBytes,
              updatedAt: f.updatedAt,
              isModified: selectedFileName === f.name && isDirty,
              isFolder: f.isFolder,
            }))}
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
                await api.createPublicFolder(folderPath);
                await loadFiles();
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
              await api.renamePublicFile(oldPath, newPath);
              if (selectedFileName === oldPath) {
                setSelectedFileName(newPath);
              }
              setOpenFiles((prev) =>
                prev.map((f) => (f === oldPath ? newPath : f)),
              );
              await loadFiles();
            }}
            onCopy={async (sourcePath, targetPath) => {
              await api.copyPublicFile(sourcePath, targetPath);
              await loadFiles();
            }}
            onDeleteFolder={async (folderPath) => {
              await api.deletePublicFolder(folderPath);
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
              await loadFiles();
            }}
            onUploadFolder={() => folderInputRef.current?.click()}
            onUploadFiles={() => fileInputRef.current?.click()}
            onUploadBatch={async (files) => {
              await api.uploadPublicBatch(files);
              await loadFiles();
            }}
            onRefresh={loadFiles}
            onDeleteFile={handleDeleteFile}
            loading={loading || uploading}
            onLoadDirectory={async (dirPath) => {
              const res = await api.getStaticTree(dirPath);
              return res.items;
            }}
            onSearch={async (query) => {
              const res = await api.searchStaticFiles(query);
              return res.items;
            }}
          />

          {/* Hidden File & Folder Inputs */}
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: "none" }}
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderSelect}
          />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            onChange={handleFilesSelect}
          />

          {/* Main VS Code Editor Workspace */}
          <div
            style={{
              flex: 1,
              height: "100%",
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
                minHeight: 38,
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
                          ? "2px solid var(--color-accent)"
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
                <Tooltip label="New Public File" withArrow position="bottom">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setIsNewFileModalOpen(true)}
                    style={{ marginLeft: 6, color: "var(--color-text-dimmed)" }}
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
                      backgroundColor: "var(--color-accent-subtle)",
                      color: "var(--color-accent)",
                      border: "1px solid var(--color-accent-border)",
                    }}
                  >
                    Saved
                  </Badge>
                )}

                {selectedFileName && (
                  <>
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconExternalLink size={13} />}
                      component="a"
                      href={`/${selectedFileName === "index.html" ? "" : selectedFileName}`}
                      target="_blank"
                      style={{
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        color: "#38bdf8",
                        height: 26,
                        fontSize: "11px",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                      }}
                    >
                      Preview File
                    </Button>
                    <Button
                      size="xs"
                      leftSection={<IconDeviceFloppy size={13} />}
                      loading={savingFile}
                      onClick={() => handleSaveFile()}
                      style={{
                        backgroundColor: "var(--color-accent)",
                        color: isDark ? "#052e16" : "#ffffff",
                        fontWeight: 700,
                        height: 26,
                        fontSize: "11px",
                        boxShadow: "var(--color-accent-glow)",
                      }}
                    >
                      Save (Ctrl+S)
                    </Button>
                  </>
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
                <span>_public</span>
                <span>›</span>
                <span style={{ color: "var(--color-accent)" }}>
                  {selectedFileName}
                </span>
                <span>›</span>
                <span style={{ opacity: 0.7 }}>
                  Static Document ({getLanguage(selectedFileName).toUpperCase()}
                  )
                </span>
              </div>
            )}

            {/* Editor Content or Welcome Screen */}
            <div
              style={{
                flex: 1,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {selectedFileName ? (
                isMediaFilename(selectedFileName).isMedia && !editSvgAsCode ? (
                  <MediaViewer
                    filename={selectedFileName}
                    src={`/api/static-files/raw?path=${encodeURIComponent(selectedFileName)}`}
                    sizeBytes={files.find((f) => f.name === selectedFileName)?.sizeBytes}
                    isDark={isDark}
                    showCodeToggle={selectedFileName.toLowerCase().endsWith(".svg")}
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
                      background: "var(--color-accent-subtle)",
                      border: "1px solid var(--color-accent-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <IconWorld size={30} color="var(--color-accent)" />
                  </Box>
                  <Title
                    order={3}
                    style={{
                      color: "var(--color-text-primary)",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    AlsaBase Static Hosting Editor
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
                    Deploy and edit client-side single page apps (React, Vue,
                    Svelte, HTML/CSS) hosted directly from the{" "}
                    <code style={{ color: "var(--color-accent)" }}>
                      ./_public
                    </code>{" "}
                    directory.
                  </Text>

                  <Group gap="md">
                    <Button
                      leftSection={<FileIcon name="index.html" size={15} />}
                      onClick={() => handleCreateNewFile("index.html")}
                      style={{
                        backgroundColor: "var(--color-accent)",
                        color: isDark ? "#052e16" : "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      Create index.html
                    </Button>
                    <Button
                      variant="default"
                      leftSection={<FileIcon name="styles.css" size={15} />}
                      onClick={() => handleCreateNewFile("styles.css")}
                    >
                      Create styles.css
                    </Button>
                    <Button
                      variant="default"
                      leftSection={<FileIcon name="app.js" size={15} />}
                      onClick={() => handleCreateNewFile("app.js")}
                    >
                      Create app.js
                    </Button>
                  </Group>
                </div>
              )}
            </div>

            {/* VS Code Bottom Status Bar */}
            <div
              style={{
                height: 24,
                minHeight: 24,
                backgroundColor: isDark ? "#10e57a" : "#059669",
                color: isDark ? "#052e16" : "#ffffff",
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
                <span>AlsaBase Static Server</span>
                <span>_public/</span>
                <span>[SPA Fallback Active]</span>
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
      </div>

      {/* MODAL: Create New Public File */}
      <Modal
        opened={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        title={
          <Group gap="xs">
            <IconPlus size={18} color="var(--color-accent)" />
            <Text fw={700}>Create New Public File</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="File Name"
            description="Stored in ./_public directory (e.g. index.html, styles.css, app.js)"
            placeholder="e.g. index.html"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            required
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setIsNewFileModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateNewFile()}
              style={{
                backgroundColor: "var(--color-accent)",
                color: isDark ? "#052e16" : "#ffffff",
                fontWeight: 700,
                boxShadow: "var(--color-accent-glow)",
              }}
            >
              Create File
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
