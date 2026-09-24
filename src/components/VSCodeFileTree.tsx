import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Text,
  ActionIcon,
  Tooltip,
  TextInput,
  Group,
  Stack,
  Button,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronRight,
  IconChevronDown,
  IconFilePlus,
  IconFolderPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconFold,
  IconEdit,
  IconCopy,
  IconCut,
  IconClipboard,
  IconFolder,
  IconLink,
} from "@tabler/icons-react";
import { FileIcon } from "./FileIcon";
import { copyToClipboard } from "../utils/clipboard";
import { openHoldToConfirmModal } from "./HoldToConfirmModal";

export interface TreeFileItem {
  name: string;
  sizeBytes?: number;
  updatedAt?: string;
  isModified?: boolean;
  error?: string | null;
  isFolder?: boolean;
  fullPath?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: TreeNode[];
  sizeBytes?: number;
  updatedAt?: string;
  isModified?: boolean;
  error?: string | null;
  loaded?: boolean;
}

export interface ClipboardOperation {
  op: "copy" | "cut";
  path: string;
  isFolder: boolean;
}

interface VSCodeFileTreeProps {
  title: string;
  files: TreeFileItem[];
  selectedFileName: string | null;
  onSelectFile: (path: string) => void;
  onNewFile?: (targetFolder?: string) => void;
  onNewFolder?: (targetFolder?: string) => void;
  onUploadFolder?: () => void;
  onUploadFiles?: () => void;
  onRefresh?: () => void;
  onDeleteFile?: (path: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onRename?: (oldPath: string, newPath: string) => Promise<void> | void;
  onCopy?: (sourcePath: string, targetPath: string) => Promise<void> | void;
  onUploadBatch?: (
    files: { path: string; content: string; isBase64?: boolean }[],
  ) => Promise<void>;
  loading?: boolean;
  searchPlaceholder?: string;
  onLoadDirectory?: (dirPath: string) => Promise<{
    name: string;
    fullPath: string;
    isFolder: boolean;
    sizeBytes?: number;
    updatedAt?: string;
    error?: string | null;
  }[]>;
  onSearch?: (query: string) => Promise<{
    name: string;
    sizeBytes?: number;
    updatedAt?: string;
    error?: string | null;
  }[]>;
}

const PAGE_SIZE = 100;

export const VSCodeFileTree: React.FC<VSCodeFileTreeProps> = ({
  title,
  files,
  selectedFileName,
  onSelectFile,
  onNewFile,
  onNewFolder,
  onUploadFolder,
  onUploadFiles,
  onRefresh,
  onDeleteFile,
  onDeleteFolder,
  onRename,
  onCopy,
  onUploadBatch,
  loading = false,
  searchPlaceholder = "Search files...",
  onLoadDirectory,
  onSearch,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TreeFileItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  
  // Folders are COLLAPSED by default (expandedFolders holds true for open folders)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadedFolders, setLoadedFolders] = useState<Record<string, boolean>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  const [dynamicChildren, setDynamicChildren] = useState<Record<string, TreeNode[]>>({});
  const [folderPageLimits, setFolderPageLimits] = useState<Record<string, number>>({});
  const [activeFolderContext, setActiveFolderContext] = useState<string>("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Execute remote search when debounced search changes and onSearch is provided
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    if (onSearch) {
      setSearching(true);
      onSearch(debouncedSearch)
        .then((res) => {
          setSearchResults(res);
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }
  }, [debouncedSearch, onSearch]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode | null;
    isBackground?: boolean;
  } | null>(null);

  // Drag and Drop State
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isDragOverTree, setIsDragOverTree] = useState<boolean>(false);

  // Internal In-App Clipboard
  const [internalClipboard, setInternalClipboard] = useState<ClipboardOperation | null>(null);

  // Rename Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingNode, setRenamingNode] = useState<TreeNode | null>(null);
  const [newNameInput, setNewNameInput] = useState("");
  const [submittingRename, setSubmittingRename] = useState(false);

  // New Folder Modal State
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState("");
  const [targetParentFolder, setTargetParentFolder] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-expand ancestors and load their directories when a file is selected
  useEffect(() => {
    if (!selectedFileName) return;
    const parts = selectedFileName.split(/[/\\]/);
    if (parts.length > 1) {
      const ancestorsToExpand: Record<string, boolean> = {};
      let cur = "";
      const ancestorPaths: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        ancestorsToExpand[cur] = true;
        ancestorPaths.push(cur);
      }
      setExpandedFolders((prev) => ({ ...prev, ...ancestorsToExpand }));

      if (onLoadDirectory) {
        (async () => {
          for (const anc of ancestorPaths) {
            if (!loadedFolders[anc]) {
              try {
                const items = await onLoadDirectory(anc);
                const childrenNodes: TreeNode[] = items.map((item) => ({
                  id: item.fullPath,
                  name: item.name,
                  fullPath: item.fullPath,
                  isFolder: item.isFolder,
                  children: [],
                  sizeBytes: item.sizeBytes,
                  updatedAt: item.updatedAt,
                  error: item.error,
                  loaded: false,
                }));
                setDynamicChildren((prev) => ({
                  ...prev,
                  [anc]: childrenNodes,
                }));
                setLoadedFolders((prev) => ({ ...prev, [anc]: true }));
              } catch {}
            }
          }
        })();
      }
    }
  }, [selectedFileName, onLoadDirectory]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const toggleFolder = async (folderPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentlyExpanded = !!expandedFolders[folderPath];
    const willExpand = !currentlyExpanded;

    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: willExpand,
    }));

    if (willExpand && onLoadDirectory && !loadedFolders[folderPath]) {
      setLoadingFolders((prev) => ({ ...prev, [folderPath]: true }));
      try {
        const items = await onLoadDirectory(folderPath);
        const childrenNodes: TreeNode[] = items.map((item) => ({
          id: item.fullPath,
          name: item.name,
          fullPath: item.fullPath,
          isFolder: item.isFolder,
          children: [],
          sizeBytes: item.sizeBytes,
          updatedAt: item.updatedAt,
          error: item.error,
          loaded: false,
        }));

        setDynamicChildren((prev) => ({
          ...prev,
          [folderPath]: childrenNodes,
        }));
        setLoadedFolders((prev) => ({ ...prev, [folderPath]: true }));
      } catch (err: any) {
        notifications.show({
          title: "Directory Load Failed",
          message: err.message || `Failed to load directory ${folderPath}`,
          color: "red",
        });
      } finally {
        setLoadingFolders((prev) => ({ ...prev, [folderPath]: false }));
      }
    }
  };

  const collapseAll = () => {
    setExpandedFolders({});
  };

  const handleRefreshTree = async () => {
    if (onRefresh) {
      onRefresh();
    }
    if (onLoadDirectory) {
      const foldersToRefetch = Object.keys(expandedFolders).filter((k) => expandedFolders[k]);
      for (const folderPath of foldersToRefetch) {
        try {
          const items = await onLoadDirectory(folderPath);
          const childrenNodes: TreeNode[] = items.map((item) => ({
            id: item.fullPath,
            name: item.name,
            fullPath: item.fullPath,
            isFolder: item.isFolder,
            children: [],
            sizeBytes: item.sizeBytes,
            updatedAt: item.updatedAt,
            error: item.error,
            loaded: false,
          }));
          setDynamicChildren((prev) => ({
            ...prev,
            [folderPath]: childrenNodes,
          }));
        } catch {}
      }
    }
  };

  // Build hierarchical tree data
  const treeData = useMemo(() => {
    const effectiveFiles = searchResults !== null ? searchResults : files;
    const rootNodes: Record<string, any> = {};

    const filtered = (searchResults === null && debouncedSearch)
      ? effectiveFiles.filter((f) =>
          f.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
        )
      : effectiveFiles;

    for (const file of filtered) {
      const parts = file.name.split(/[/\\]/);
      let currentLevel = rootNodes;
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLeaf = i === parts.length - 1;
        const isFolder = file.isFolder !== undefined ? (isLeaf ? file.isFolder : true) : !isLeaf;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            id: currentPath,
            name: part,
            fullPath: currentPath,
            isFolder,
            children: {},
            sizeBytes: isLeaf ? file.sizeBytes : undefined,
            updatedAt: isLeaf ? file.updatedAt : undefined,
            isModified: isLeaf ? file.isModified : false,
            error: isLeaf ? file.error : undefined,
            loaded: false,
          };
        }

        currentLevel = currentLevel[part].children;
      }
    }

    const convertToArray = (obj: Record<string, any>): TreeNode[] => {
      return Object.values(obj).map((node) => ({
        ...node,
        children: convertToArray(node.children),
      }));
    };

    const attachDynamicChildren = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        let childList = node.children;
        if (dynamicChildren[node.fullPath] !== undefined) {
          childList = dynamicChildren[node.fullPath];
        }
        const resolvedChildren = attachDynamicChildren(childList);

        // Sort folders first, then index.html, then alphabetical
        resolvedChildren.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          if (a.name === "index.html") return -1;
          if (b.name === "index.html") return 1;
          return a.name.localeCompare(b.name);
        });

        return {
          ...node,
          children: resolvedChildren,
        };
      });
    };

    const initialTree = convertToArray(rootNodes);
    const finalTree = attachDynamicChildren(initialTree);

    finalTree.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (a.name === "index.html") return -1;
      if (b.name === "index.html") return 1;
      return a.name.localeCompare(b.name);
    });

    return finalTree;
  }, [files, searchResults, debouncedSearch, dynamicChildren]);

  // Helper to read file from File object (binary base64 or text)
  const readFilePayload = (
    file: File,
    targetRelPath: string,
  ): Promise<{ path: string; content: string; isBase64?: boolean }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isBinary =
        !/\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|svg|xml|map|env|yml|yaml|sql)$/i.test(
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
          resolve({ path: targetRelPath, content: base64, isBase64: true });
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => {
          resolve({
            path: targetRelPath,
            content: reader.result as string,
            isBase64: false,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  // Helper to extract files recursively from DataTransfer (supporting files and whole dropped folders)
  const extractFilesFromDataTransfer = async (
    dataTransfer: DataTransfer,
    targetPrefix: string = "",
  ): Promise<{ path: string; content: string; isBase64?: boolean }[]> => {
    const results: { path: string; content: string; isBase64?: boolean }[] = [];

    async function traverseEntry(entry: any, currentPath: string): Promise<void> {
      if (entry.isFile) {
        const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        const payload = await readFilePayload(file, relPath);
        results.push(payload);
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = (): Promise<any[]> =>
          new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));

        let entries: any[] = [];
        let batch: any[];
        do {
          batch = await readEntries();
          entries = entries.concat(batch);
        } while (batch.length > 0);

        const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        for (const child of entries) {
          await traverseEntry(child, nextPath);
        }
      }
    }

    const items = dataTransfer.items;
    if (items && items.length > 0) {
      const entryPromises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if ("webkitGetAsEntry" in item && typeof (item as any).webkitGetAsEntry === "function") {
          const entry = (item as any).webkitGetAsEntry();
          if (entry) {
            entryPromises.push(traverseEntry(entry, targetPrefix));
            continue;
          }
        }
        const file = item.getAsFile();
        if (file) {
          const relPath = targetPrefix ? `${targetPrefix}/${file.name}` : file.name;
          entryPromises.push(
            readFilePayload(file, relPath).then((payload) => {
              results.push(payload);
            }),
          );
        }
      }
      await Promise.all(entryPromises);
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      const filesArray = Array.from(dataTransfer.files);
      const promises = filesArray.map((file) => {
        const relPath = targetPrefix ? `${targetPrefix}/${file.name}` : file.name;
        return readFilePayload(file, relPath);
      });
      const payloads = await Promise.all(promises);
      results.push(...payloads);
    }

    return results;
  };

  // Unified Drop Handler (for internal moving or external OS file/folder uploading)
  const handleDropEvent = async (targetFolder: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    setIsDragOverTree(false);

    // 1. Internal node reordering / move
    if (draggedNode) {
      const srcPath = draggedNode.fullPath;
      const baseName = draggedNode.name;
      const targetPath = targetFolder ? `${targetFolder}/${baseName}` : baseName;

      // Prevent dropping onto exact same path
      if (srcPath === targetPath) {
        setDraggedNode(null);
        return;
      }

      // Prevent dropping a folder into itself or its own subfolder
      if (draggedNode.isFolder && (targetFolder === srcPath || targetFolder.startsWith(srcPath + "/"))) {
        notifications.show({
          title: "Invalid Move",
          message: "Cannot move a folder into itself or its own subfolder.",
          color: "red",
        });
        setDraggedNode(null);
        return;
      }

      try {
        if (onRename) {
          await onRename(srcPath, targetPath);
          notifications.show({
            title: "Moved Successfully",
            message: `Moved "${baseName}" into "${targetFolder || "root"}".`,
            color: "teal",
          });
          if (targetFolder) {
            setExpandedFolders((prev) => ({ ...prev, [targetFolder]: true }));
          }
          if (onRefresh) onRefresh();
        }
      } catch (err: any) {
        notifications.show({
          title: "Move Failed",
          message: err.message || "Failed to move file/folder.",
          color: "red",
        });
      } finally {
        setDraggedNode(null);
      }
      return;
    }

    // 2. External OS Files / Folder drop
    if (onUploadBatch) {
      notifications.show({
        id: "drop-upload",
        title: "Uploading Files",
        message: `Processing and uploading files into "${targetFolder || "root"}"...`,
        color: "blue",
        loading: true,
        autoClose: false,
      });

      try {
        const payloads = await extractFilesFromDataTransfer(e.dataTransfer, targetFolder);
        if (payloads.length === 0) {
          notifications.hide("drop-upload");
          return;
        }

        await onUploadBatch(payloads);

        notifications.update({
          id: "drop-upload",
          title: "Files Uploaded & Replaced",
          message: `Successfully uploaded ${payloads.length} file(s) into "${targetFolder || "root"}". Existing files replaced.`,
          color: "teal",
          loading: false,
          autoClose: 3000,
        });

        if (targetFolder) {
          setExpandedFolders((prev) => ({ ...prev, [targetFolder]: true }));
        }
        if (onRefresh) onRefresh();
      } catch (err: any) {
        notifications.update({
          id: "drop-upload",
          title: "Upload Failed",
          message: err.message || "Failed to upload dropped files.",
          color: "red",
          loading: false,
          autoClose: 5000,
        });
      }
    }
  };

  // Handle OS File Clipboard Paste or In-App Paste
  const handlePasteEvent = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    // 1. Check if files are present in the clipboard (copied from OS Explorer/Finder or screenshots)
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0 && onUploadBatch) {
      e.preventDefault();
      e.stopPropagation();

      const filesArray = Array.from(clipboardFiles);
      const targetFolder = activeFolderContext || "";

      notifications.show({
        id: "paste-upload",
        title: "Pasting & Uploading Files",
        message: `Uploading ${filesArray.length} file(s) from clipboard...`,
        color: "blue",
        loading: true,
        autoClose: false,
      });

      try {
        const payloadPromises = filesArray.map((file) => {
          const cleanName = file.name;
          const targetPath = targetFolder ? `${targetFolder}/${cleanName}` : cleanName;
          return readFilePayload(file, targetPath);
        });

        const payloads = await Promise.all(payloadPromises);
        await onUploadBatch(payloads);

        notifications.update({
          id: "paste-upload",
          title: "Files Uploaded & Replaced",
          message: `Successfully uploaded ${payloads.length} file(s) from clipboard.`,
          color: "teal",
          loading: false,
          autoClose: 3000,
        });

        if (onRefresh) onRefresh();
      } catch (err: any) {
        notifications.update({
          id: "paste-upload",
          title: "Upload Failed",
          message: err.message || "Failed to upload pasted files.",
          color: "red",
          loading: false,
          autoClose: 5000,
        });
      }
      return;
    }

    // 2. Check if internal in-app clipboard has item to paste
    if (internalClipboard) {
      e.preventDefault();
      e.stopPropagation();
      handleExecutePaste(activeFolderContext);
    }
  };

  const handleExecutePaste = async (destFolder: string = "") => {
    if (!internalClipboard) return;

    const { op, path: srcPath, isFolder } = internalClipboard;
    const baseName = srcPath.split(/[/\\]/).pop() || srcPath;
    let targetPath = destFolder ? `${destFolder}/${baseName}` : baseName;

    // If source and target are the same path in copy mode, create a copy name
    if (srcPath === targetPath && op === "copy") {
      if (isFolder) {
        targetPath = `${destFolder ? destFolder + "/" : ""}${baseName}_copy`;
      } else {
        const dotIdx = baseName.lastIndexOf(".");
        if (dotIdx > 0) {
          const namePart = baseName.substring(0, dotIdx);
          const extPart = baseName.substring(dotIdx);
          targetPath = `${destFolder ? destFolder + "/" : ""}${namePart}_copy${extPart}`;
        } else {
          targetPath = `${destFolder ? destFolder + "/" : ""}${baseName}_copy`;
        }
      }
    }

    try {
      if (op === "copy" && onCopy) {
        await onCopy(srcPath, targetPath);
        notifications.show({
          title: "Pasted Successfully",
          message: `Copied "${srcPath}" to "${targetPath}".`,
          color: "teal",
        });
      } else if (op === "cut" && onRename) {
        await onRename(srcPath, targetPath);
        setInternalClipboard(null);
        notifications.show({
          title: "Moved Successfully",
          message: `Moved "${srcPath}" to "${targetPath}".`,
          color: "teal",
        });
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Paste Failed",
        message: err.message || "Could not complete paste operation.",
        color: "red",
      });
    }
  };

  const handleOpenRenameModal = (node: TreeNode) => {
    setRenamingNode(node);
    setNewNameInput(node.name);
    setRenameModalOpen(true);
    setContextMenu(null);
  };

  const handleConfirmRename = async () => {
    if (!renamingNode || !newNameInput.trim() || !onRename) return;
    const oldPath = renamingNode.fullPath;
    const parts = oldPath.split(/[/\\]/);
    parts.pop();
    const parentPath = parts.join("/");
    const newPath = parentPath ? `${parentPath}/${newNameInput.trim()}` : newNameInput.trim();

    if (oldPath === newPath) {
      setRenameModalOpen(false);
      return;
    }

    setSubmittingRename(true);
    try {
      await onRename(oldPath, newPath);
      setRenameModalOpen(false);
      notifications.show({
        title: "Renamed",
        message: `Successfully renamed to "${newPath}".`,
        color: "teal",
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Rename Failed",
        message: err.message || "Failed to rename.",
        color: "red",
      });
    } finally {
      setSubmittingRename(false);
    }
  };

  const handleConfirmDeleteFolder = (folderPath: string) => {
    if (!onDeleteFolder) return;
    openHoldToConfirmModal({
      title: "Delete Folder",
      centered: true,
      children: (
        <Text size="sm">
          Move folder <b>{folderPath}</b> and all of its contents to the .trash directory?
        </Text>
      ),
      labels: { confirm: "Move to Trash", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await onDeleteFolder(folderPath);
          notifications.show({
            title: "Folder Deleted",
            message: `Moved folder "${folderPath}" to .trash.`,
            color: "teal",
          });
          if (onRefresh) onRefresh();
        } catch (err: any) {
          notifications.show({
            title: "Delete Failed",
            message: err.message || "Failed to delete folder.",
            color: "red",
          });
        }
      },
    });
  };

  const handleCreateFolderSubmit = async () => {
    const cleanName = newFolderNameInput.trim();
    if (!cleanName) return;
    const folderPath = targetParentFolder ? `${targetParentFolder}/${cleanName}` : cleanName;

    try {
      if (onNewFolder) {
        onNewFolder(folderPath);
      }
      setNewFolderModalOpen(false);
      setNewFolderNameInput("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Failed to Create Folder",
        message: err.message,
        color: "red",
      });
    }
  };

  const handleDuplicateNode = async (node: TreeNode) => {
    if (!onCopy) return;
    const baseName = node.name;
    const parts = node.fullPath.split(/[/\\]/);
    parts.pop();
    const parentPath = parts.join("/");

    let targetPath = "";
    if (node.isFolder) {
      targetPath = parentPath ? `${parentPath}/${baseName}_copy` : `${baseName}_copy`;
    } else {
      const dotIdx = baseName.lastIndexOf(".");
      if (dotIdx > 0) {
        const namePart = baseName.substring(0, dotIdx);
        const extPart = baseName.substring(dotIdx);
        targetPath = parentPath
          ? `${parentPath}/${namePart}_copy${extPart}`
          : `${namePart}_copy${extPart}`;
      } else {
        targetPath = parentPath ? `${parentPath}/${baseName}_copy` : `${baseName}_copy`;
      }
    }

    try {
      await onCopy(node.fullPath, targetPath);
      notifications.show({
        title: "Duplicated",
        message: `Created duplicate "${targetPath}".`,
        color: "teal",
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Duplicate Failed",
        message: err.message,
        color: "red",
      });
    }
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = !!expandedFolders[node.fullPath];
    const isCollapsed = !isExpanded;
    const isFolderLoading = !!loadingFolders[node.fullPath];
    const isSelected = selectedFileName === node.fullPath;
    const isCut = internalClipboard?.op === "cut" && internalClipboard?.path === node.fullPath;
    const isDragFolderTarget = dragOverFolder === node.fullPath;

    if (node.isFolder) {
      const pageLimit = folderPageLimits[node.fullPath] || PAGE_SIZE;
      const visibleChildren = node.children.slice(0, pageLimit);
      const remainingCount = node.children.length - pageLimit;

      return (
        <div key={node.fullPath}>
          <div
            draggable={true}
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggedNode(node);
              e.dataTransfer.setData("text/plain", node.fullPath);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDraggedNode(null);
              setDragOverFolder(null);
              setIsDragOverTree(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverFolder !== node.fullPath) {
                setDragOverFolder(node.fullPath);
              }
              e.dataTransfer.dropEffect = draggedNode ? "move" : "copy";
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (dragOverFolder === node.fullPath) {
                setDragOverFolder(null);
              }
            }}
            onDrop={(e) => {
              handleDropEvent(node.fullPath, e);
            }}
            onClick={(e) => {
              setActiveFolderContext(node.fullPath);
              toggleFolder(node.fullPath, e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveFolderContext(node.fullPath);
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                node,
              });
            }}
            style={{
              paddingLeft: `${12 + depth * 14}px`,
              paddingRight: "12px",
              paddingTop: "4px",
              paddingBottom: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.15s ease",
              userSelect: "none",
              opacity: isCut ? 0.45 : 1,
              backgroundColor: isDragFolderTarget
                ? "rgba(56, 189, 248, 0.22)"
                : undefined,
              outline: isDragFolderTarget
                ? "1.5px dashed #38bdf8"
                : "1.5px dashed transparent",
              borderRadius: isDragFolderTarget ? "4px" : "0px",
            }}
            className="vscode-tree-row"
          >
            <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", width: 14 }}>
                {isFolderLoading ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      border: "2px solid #38bdf8",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                ) : isCollapsed ? (
                  <IconChevronRight size={13} color="#94a3b8" />
                ) : (
                  <IconChevronDown size={13} color="#94a3b8" />
                )}
              </span>
              <FileIcon name={node.name} isFolder={true} isOpen={!isCollapsed} size={16} />
              <Text
                size="xs"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: isDragFolderTarget ? "#38bdf8" : "var(--color-text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontWeight: isDragFolderTarget ? 700 : 500,
                }}
              >
                {node.name}
              </Text>
            </Group>

            <Group gap={4}>
              {onDeleteFolder && (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmDeleteFolder(node.fullPath);
                  }}
                  style={{ opacity: 0.4 }}
                  className="delete-hover-btn"
                  title="Delete Folder"
                >
                  <IconTrash size={12} />
                </ActionIcon>
              )}
            </Group>
          </div>

          {!isCollapsed && (
            <div>
              {isFolderLoading && node.children.length === 0 && (
                <div
                  style={{
                    paddingLeft: `${12 + (depth + 1) * 14 + 14}px`,
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    fontSize: "11px",
                    color: "var(--color-text-dimmed)",
                    fontStyle: "italic",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Loading directory...
                </div>
              )}
              {visibleChildren.map((child) => renderNode(child, depth + 1))}
              {remainingCount > 0 && (
                <div
                  style={{
                    paddingLeft: `${12 + (depth + 1) * 14 + 14}px`,
                    paddingTop: "6px",
                    paddingBottom: "6px",
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderPageLimits((prev) => ({
                        ...prev,
                        [node.fullPath]: (prev[node.fullPath] || PAGE_SIZE) + PAGE_SIZE * 2,
                      }));
                    }}
                    style={{
                      background: "rgba(56, 189, 248, 0.12)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#38bdf8",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Show more ({Math.min(PAGE_SIZE * 2, remainingCount)} of {remainingCount} remaining)
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderPageLimits((prev) => ({
                        ...prev,
                        [node.fullPath]: node.children.length,
                      }));
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-dimmed)",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Show all ({node.children.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.fullPath}
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedNode(node);
          e.dataTransfer.setData("text/plain", node.fullPath);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDraggedNode(null);
          setDragOverFolder(null);
          setIsDragOverTree(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const parts = node.fullPath.split(/[/\\]/);
          parts.pop();
          const parentFolder = parts.join("/");
          if (dragOverFolder !== parentFolder) {
            setDragOverFolder(parentFolder);
          }
          e.dataTransfer.dropEffect = draggedNode ? "move" : "copy";
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
        }}
        onDrop={(e) => {
          const parts = node.fullPath.split(/[/\\]/);
          parts.pop();
          const parentFolder = parts.join("/");
          handleDropEvent(parentFolder, e);
        }}
        onClick={() => {
          const parts = node.fullPath.split(/[/\\]/);
          parts.pop();
          setActiveFolderContext(parts.join("/"));
          onSelectFile(node.fullPath);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const parts = node.fullPath.split(/[/\\]/);
          parts.pop();
          setActiveFolderContext(parts.join("/"));
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            node,
          });
        }}
        style={{
          paddingLeft: `${12 + depth * 14 + 14}px`,
          paddingRight: "12px",
          paddingTop: "4px",
          paddingBottom: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          backgroundColor: isSelected
            ? "rgba(4, 57, 94, 0.55)"
            : "transparent",
          borderLeft: isSelected
            ? "2px solid #38bdf8"
            : "2px solid transparent",
          transition: "background-color 0.1s ease",
          userSelect: "none",
          opacity: isCut ? 0.45 : 1,
        }}
        className="vscode-tree-row"
      >
        <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <FileIcon name={node.name} isFolder={false} size={16} />
          <Text
            size="xs"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: isSelected ? "#38bdf8" : "var(--color-text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            {node.name}
          </Text>
        </Group>

        <Group gap={6}>
          {node.error && (
            <Tooltip
              label={`Error: ${node.error}`}
              withArrow
              position="right"
              color="red"
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                !
              </span>
            </Tooltip>
          )}
          {node.isModified && (
            <Text
              size="xs"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 700,
                color: "#eab308",
              }}
            >
              M
            </Text>
          )}
          {onDeleteFile && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(node.fullPath);
              }}
              style={{ opacity: 0.4 }}
              className="delete-hover-btn"
              title="Delete File"
            >
              <IconTrash size={12} />
            </ActionIcon>
          )}
        </Group>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPaste={handlePasteEvent}
      onContextMenu={(e) => {
        // Background click
        if (e.target === containerRef.current || (e.target as HTMLElement).closest(".tree-scroll-container")) {
          e.preventDefault();
          setActiveFolderContext("");
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            node: null,
            isBackground: true,
          });
        }
      }}
      style={{
        width: 260,
        minWidth: 260,
        maxWidth: 260,
        height: "100%",
        backgroundColor: "var(--color-bg-base)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        outline: "none",
        position: "relative",
      }}
    >
      {/* VS Code Tree Header */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-card)",
        }}
      >
        <Text
          fw={700}
          size="xs"
          style={{
            color: "var(--color-text-dimmed)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "11px",
          }}
        >
          {title}
        </Text>

        <Group gap={3}>
          {onNewFile && (
            <Tooltip label="New File" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => onNewFile(activeFolderContext)}
                style={{ color: "var(--color-text-dimmed)" }}
              >
                <IconFilePlus size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {onNewFolder && (
            <Tooltip label="New Folder" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => {
                  setTargetParentFolder(activeFolderContext);
                  setNewFolderNameInput("");
                  setNewFolderModalOpen(true);
                }}
                style={{ color: "var(--color-text-dimmed)" }}
              >
                <IconFolderPlus size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {onUploadFiles && (
            <Tooltip label="Upload Files" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={onUploadFiles}
                style={{ color: "var(--color-text-dimmed)" }}
              >
                <IconUpload size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {onUploadFolder && (
            <Tooltip label="Upload Folder" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={onUploadFolder}
                style={{ color: "var(--color-text-dimmed)" }}
              >
                <IconFolder size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {onRefresh && (
            <Tooltip label="Refresh" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={handleRefreshTree}
                loading={loading}
                style={{ color: "var(--color-text-dimmed)" }}
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Collapse All" withArrow position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={collapseAll}
              style={{ color: "var(--color-text-dimmed)" }}
            >
              <IconFold size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* Filter / Search Box */}
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={13} color="var(--color-text-dimmed)" />}
          rightSection={
            searching ? (
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  border: "2px solid #38bdf8",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            ) : null
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="xs"
          styles={{
            input: {
              backgroundColor: "var(--color-bg-well)",
              border: "1px solid var(--color-border)",
              height: 26,
              fontSize: "12px",
            },
          }}
        />
      </div>

      {/* Hierarchical Tree Body with Drag & Drop Area */}
      <div
        className="tree-scroll-container"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOverTree(true);
          e.dataTransfer.dropEffect = draggedNode ? "move" : "copy";
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDragOverTree(false);
          setDragOverFolder(null);
        }}
        onDrop={(e) => {
          handleDropEvent("", e);
        }}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0",
          position: "relative",
          outline:
            isDragOverTree && !dragOverFolder
              ? "1.5px dashed var(--color-neon-primary)"
              : "1.5px dashed transparent",
          backgroundColor:
            isDragOverTree && !dragOverFolder
              ? "rgba(56, 189, 248, 0.05)"
              : undefined,
          transition: "outline 0.15s ease, background-color 0.15s ease",
        }}
      >
        {treeData.map((node) => renderNode(node, 0))}

        {isDragOverTree && !dragOverFolder && (
          <div
            style={{
              position: "sticky",
              bottom: 8,
              left: 8,
              right: 8,
              margin: "6px 8px 0",
              padding: "6px 10px",
              backgroundColor: "#0284c7",
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            Drop to upload / move into Root (/)
          </div>
        )}

        {treeData.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <Text size="xs" c="dimmed" mb="xs">
              {files.length === 0 ? "No files found" : "No matches"}
            </Text>
            {files.length === 0 && (
              <Stack gap="xs">
                {onUploadFolder && (
                  <Button
                    size="xs"
                    variant="filled"
                    color="neonGreen"
                    leftSection={<IconUpload size={14} />}
                    onClick={onUploadFolder}
                    fullWidth
                    style={{ fontSize: "11px", fontWeight: 700 }}
                  >
                    Upload Folder
                  </Button>
                )}
                {onNewFile && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconFilePlus size={13} />}
                    onClick={() => onNewFile()}
                    fullWidth
                    style={{ fontSize: "11px" }}
                  >
                    Create File
                  </Button>
                )}
              </Stack>
            )}
          </div>
        )}
      </div>

      {/* Custom Sleek Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 300),
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            padding: "4px",
            zIndex: 9999,
            minWidth: 190,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {/* File Context Menu */}
          {contextMenu.node && !contextMenu.node.isFolder && (
            <>
              {onRename && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => handleOpenRenameModal(contextMenu.node!)}
                >
                  <IconEdit size={14} />
                  <span>Rename / Edit Name</span>
                </button>
              )}
              {onCopy && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setInternalClipboard({
                      op: "copy",
                      path: contextMenu.node!.fullPath,
                      isFolder: false,
                    });
                    setContextMenu(null);
                    notifications.show({
                      title: "Copied to Clipboard",
                      message: `"${contextMenu.node!.name}" ready to paste.`,
                      color: "teal",
                    });
                  }}
                >
                  <IconCopy size={14} />
                  <span>Copy</span>
                  <span className="vscode-ctx-shortcut">Ctrl+C</span>
                </button>
              )}
              {onRename && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setInternalClipboard({
                      op: "cut",
                      path: contextMenu.node!.fullPath,
                      isFolder: false,
                    });
                    setContextMenu(null);
                    notifications.show({
                      title: "Cut to Clipboard",
                      message: `"${contextMenu.node!.name}" ready to move.`,
                      color: "teal",
                    });
                  }}
                >
                  <IconCut size={14} />
                  <span>Cut</span>
                  <span className="vscode-ctx-shortcut">Ctrl+X</span>
                </button>
              )}
              {onCopy && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    handleDuplicateNode(contextMenu.node!);
                    setContextMenu(null);
                  }}
                >
                  <IconCopy size={14} />
                  <span>Duplicate</span>
                </button>
              )}
              <button
                className="vscode-ctx-item"
                onClick={async () => {
                  await copyToClipboard(contextMenu.node!.fullPath || "");
                  setContextMenu(null);
                  notifications.show({
                    title: "Path Copied",
                    message: contextMenu.node!.fullPath,
                    color: "teal",
                  });
                }}
              >
                <IconLink size={14} />
                <span>Copy Path</span>
              </button>
              <div className="vscode-ctx-divider" />
              {onDeleteFile && (
                <button
                  className="vscode-ctx-item vscode-ctx-danger"
                  onClick={() => {
                    const fullPath = contextMenu.node!.fullPath;
                    setContextMenu(null);
                    onDeleteFile(fullPath);
                  }}
                >
                  <IconTrash size={14} />
                  <span>Delete</span>
                  <span className="vscode-ctx-shortcut">Del</span>
                </button>
              )}
            </>
          )}

          {/* Folder Context Menu */}
          {contextMenu.node && contextMenu.node.isFolder && (
            <>
              {onNewFile && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    const target = contextMenu.node!.fullPath;
                    setContextMenu(null);
                    onNewFile(target);
                  }}
                >
                  <IconFilePlus size={14} />
                  <span>New File Here</span>
                </button>
              )}
              {onNewFolder && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setTargetParentFolder(contextMenu.node!.fullPath);
                    setNewFolderNameInput("");
                    setNewFolderModalOpen(true);
                    setContextMenu(null);
                  }}
                >
                  <IconFolderPlus size={14} />
                  <span>New Folder Here</span>
                </button>
              )}
              <div className="vscode-ctx-divider" />
              {onRename && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => handleOpenRenameModal(contextMenu.node!)}
                >
                  <IconEdit size={14} />
                  <span>Rename Folder</span>
                </button>
              )}
              {onCopy && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setInternalClipboard({
                      op: "copy",
                      path: contextMenu.node!.fullPath,
                      isFolder: true,
                    });
                    setContextMenu(null);
                    notifications.show({
                      title: "Folder Copied",
                      message: `"${contextMenu.node!.name}" ready to paste.`,
                      color: "teal",
                    });
                  }}
                >
                  <IconCopy size={14} />
                  <span>Copy Folder</span>
                </button>
              )}
              {onRename && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setInternalClipboard({
                      op: "cut",
                      path: contextMenu.node!.fullPath,
                      isFolder: true,
                    });
                    setContextMenu(null);
                    notifications.show({
                      title: "Folder Cut",
                      message: `"${contextMenu.node!.name}" ready to move.`,
                      color: "teal",
                    });
                  }}
                >
                  <IconCut size={14} />
                  <span>Cut Folder</span>
                </button>
              )}
              {internalClipboard && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    const dest = contextMenu.node!.fullPath;
                    setContextMenu(null);
                    handleExecutePaste(dest);
                  }}
                >
                  <IconClipboard size={14} />
                  <span>Paste</span>
                  <span className="vscode-ctx-shortcut">Ctrl+V</span>
                </button>
              )}
              <button
                className="vscode-ctx-item"
                onClick={async () => {
                  await copyToClipboard(contextMenu.node!.fullPath || "");
                  setContextMenu(null);
                  notifications.show({
                    title: "Path Copied",
                    message: contextMenu.node!.fullPath,
                    color: "teal",
                  });
                }}
              >
                <IconLink size={14} />
                <span>Copy Path</span>
              </button>
              <div className="vscode-ctx-divider" />
              {onDeleteFolder && (
                <button
                  className="vscode-ctx-item vscode-ctx-danger"
                  onClick={() => {
                    const folderPath = contextMenu.node!.fullPath;
                    setContextMenu(null);
                    handleConfirmDeleteFolder(folderPath);
                  }}
                >
                  <IconTrash size={14} />
                  <span>Delete Folder</span>
                </button>
              )}
            </>
          )}

          {/* Background / Root Context Menu */}
          {(!contextMenu.node || contextMenu.isBackground) && (
            <>
              {onNewFile && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setContextMenu(null);
                    onNewFile();
                  }}
                >
                  <IconFilePlus size={14} />
                  <span>New File</span>
                </button>
              )}
              {onNewFolder && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setTargetParentFolder("");
                    setNewFolderNameInput("");
                    setNewFolderModalOpen(true);
                    setContextMenu(null);
                  }}
                >
                  <IconFolderPlus size={14} />
                  <span>New Folder</span>
                </button>
              )}
              {internalClipboard && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setContextMenu(null);
                    handleExecutePaste("");
                  }}
                >
                  <IconClipboard size={14} />
                  <span>Paste</span>
                  <span className="vscode-ctx-shortcut">Ctrl+V</span>
                </button>
              )}
              {onRefresh && (
                <button
                  className="vscode-ctx-item"
                  onClick={() => {
                    setContextMenu(null);
                    onRefresh();
                  }}
                >
                  <IconRefresh size={14} />
                  <span>Refresh</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Rename File or Folder */}
      <Modal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title={renamingNode?.isFolder ? "Rename Folder" : "Rename / Edit Name"}
        centered
        size="sm"
        styles={{
          header: { backgroundColor: "var(--color-bg-card)", borderBottom: "1px solid var(--color-border)" },
          content: { backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" },
        }}
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Original: <code>{renamingNode?.fullPath}</code>
          </Text>
          <TextInput
            label="New Name"
            value={newNameInput}
            onChange={(e) => setNewNameInput(e.target.value)}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmRename();
              }
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={() => setRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              loading={submittingRename}
              onClick={handleConfirmRename}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Rename
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create New Folder */}
      <Modal
        opened={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        title="Create New Folder"
        centered
        size="sm"
        styles={{
          header: { backgroundColor: "var(--color-bg-card)", borderBottom: "1px solid var(--color-border)" },
          content: { backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" },
        }}
      >
        <Stack gap="md">
          {targetParentFolder && (
            <Text size="xs" c="dimmed">
              Creating inside: <code>{targetParentFolder}/</code>
            </Text>
          )}
          <TextInput
            label="Folder Name"
            placeholder="e.g. assets, components, helpers"
            value={newFolderNameInput}
            onChange={(e) => setNewFolderNameInput(e.target.value)}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateFolderSubmit();
              }
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={() => setNewFolderModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={handleCreateFolderSubmit}
              style={{
                backgroundColor: "var(--color-neon-primary)",
                color: "#052e16",
                fontWeight: 700,
              }}
            >
              Create Folder
            </Button>
          </Group>
        </Stack>
      </Modal>

      <style>{`
        .vscode-tree-row:hover {
          background-color: rgba(255, 255, 255, 0.04) !important;
        }
        .vscode-tree-row:hover .delete-hover-btn {
          opacity: 0.9 !important;
        }
        .vscode-ctx-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--color-text-primary);
          font-size: 12px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background-color 0.1s ease;
          user-select: none;
        }
        .vscode-ctx-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
        .vscode-ctx-danger {
          color: #ef4444;
        }
        .vscode-ctx-danger:hover {
          background-color: rgba(239, 68, 68, 0.15);
        }
        .vscode-ctx-shortcut {
          margin-left: auto;
          font-size: 10.5px;
          color: var(--color-text-dimmed);
          font-family: var(--font-mono);
          opacity: 0.7;
        }
        .vscode-ctx-divider {
          height: 1px;
          background-color: var(--color-border);
          margin: 3px 0;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
