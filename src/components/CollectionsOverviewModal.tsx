import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Box,
  Group,
  Text,
  ActionIcon,
  Switch,
  ScrollArea,
  Badge,
  Table,
  Code,
  Button,
  Select,
  TextInput,
  SegmentedControl,
  Tooltip,
  Stack,
  Paper,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconX,
  IconPlus,
  IconMinus,
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
  IconEye,
  IconCheck,
  IconArrowsMaximize,
  IconLayoutGrid,
  IconGitBranch,
  IconExternalLink,
  IconGripVertical,
  IconTrash,
  IconKey,
  IconArrowRight,
  IconSparkles
} from '@tabler/icons-react';
import { api, CollectionDef, FieldDef, FieldType } from '../api/client';

interface CollectionsOverviewModalProps {
  opened: boolean;
  onClose: () => void;
  collections: CollectionDef[];
  onSelectCollection?: (col: CollectionDef) => void;
  onCollectionsChange?: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface DisplayField {
  name: string;
  type: FieldType;
  isPrimary?: boolean;
  isSystem?: boolean;
  unique?: boolean;
  hidden?: boolean;
  required?: boolean;
  relationCollection?: string;
  relationField?: string;
  maxSelect?: number;
  cascadeDelete?: boolean;
  rawField?: FieldDef;
}

interface DragConnectionState {
  sourceCol: string;
  sourceField: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface HoveredTarget {
  colName: string;
  fieldName: string;
}

const CARD_WIDTH = 256;
const HEADER_HEIGHT = 42;
const FIELD_ROW_HEIGHT = 28;
const CARD_PADDING_Y = 6;
const STORAGE_POS_KEY = 'alsabase_overview_node_positions_v2';

function getFieldIcon(type: FieldType, isPrimary?: boolean, hasRelation?: boolean) {
  if (isPrimary) {
    return <IconKey size={13} color="#fbbf24" style={{ flexShrink: 0 }} />;
  }
  if (type === 'relation' || hasRelation) {
    return <IconGitBranch size={13} color="var(--color-neon-primary)" style={{ flexShrink: 0 }} />;
  }
  switch (type) {
    case 'text':
      return <IconLetterT size={13} color="#38bdf8" style={{ flexShrink: 0 }} />;
    case 'number':
      return <IconHash size={13} color="#fbbf24" style={{ flexShrink: 0 }} />;
    case 'bool':
      return <IconToggleLeft size={13} color="#4ade80" style={{ flexShrink: 0 }} />;
    case 'json':
      return <IconCode size={13} color="#f472b6" style={{ flexShrink: 0 }} />;
    case 'file':
      return <IconFile size={13} color="#fb923c" style={{ flexShrink: 0 }} />;
    case 'date':
      return <IconCalendar size={13} color="#a855f7" style={{ flexShrink: 0 }} />;
    case 'autodate':
      return <IconClock size={13} color="#ec4899" style={{ flexShrink: 0 }} />;
    case 'email':
      return <IconMail size={13} color="#06b6d4" style={{ flexShrink: 0 }} />;
    case 'url':
      return <IconLink size={13} color="#3b82f6" style={{ flexShrink: 0 }} />;
    case 'select':
      return <IconListCheck size={13} color="#14b8a6" style={{ flexShrink: 0 }} />;
    default:
      return <IconLetterT size={13} color="#94a3b8" style={{ flexShrink: 0 }} />;
  }
}

function buildDisplayFields(col: CollectionDef): DisplayField[] {
  const isAuth = col.type === 'auth' || col.name === 'users';
  const list: DisplayField[] = [
    { name: 'id', type: 'text', isPrimary: true, isSystem: true, unique: true }
  ];

  const seen = new Set<string>(['id']);

  for (const f of col.fields || []) {
    if (f.name === 'id' || f.name === 'created' || f.name === 'updated' || f.name === 'created_at' || f.name === 'updated_at') {
      continue;
    }
    seen.add(f.name);
    list.push({
      name: f.name,
      type: f.relationCollection ? 'relation' : f.type,
      unique: f.unique,
      hidden: f.hidden,
      required: f.required,
      relationCollection: f.relationCollection,
      relationField: f.relationField || (f.relationCollection ? 'id' : undefined),
      maxSelect: f.maxSelect,
      cascadeDelete: f.cascadeDelete,
      rawField: f
    });
  }

  if (isAuth) {
    if (!seen.has('email')) {
      list.push({ name: 'email', type: 'email', unique: true, isSystem: true });
    }
    if (!seen.has('emailVisibility')) {
      list.push({ name: 'emailVisibility', type: 'bool', isSystem: true });
    }
    if (!seen.has('verified')) {
      list.push({ name: 'verified', type: 'bool', isSystem: true });
    }
  }

  list.push({ name: 'created', type: 'autodate', isSystem: true });
  list.push({ name: 'updated', type: 'autodate', isSystem: true });

  return list;
}

export const CollectionsOverviewModal: React.FC<CollectionsOverviewModalProps> = ({
  opened,
  onClose,
  collections,
  onSelectCollection,
  onCollectionsChange
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'rules'>('fields');
  const [showSystem, setShowSystem] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 36 });

  // Node positions map: collectionName -> { x, y }
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Dragging node state
  const [draggingNode, setDraggingNode] = useState<{
    colName: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  // Panning canvas state
  const [panningCanvas, setPanningCanvas] = useState<{
    startMouseX: number;
    startMouseY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Dragging relation wire state
  const [dragConnect, setDragConnect] = useState<DragConnectionState | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<HoveredTarget | null>(null);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);

  // Relation Builder / Editor Modal State
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relSourceCol, setRelSourceCol] = useState<string>('');
  const [relFieldMode, setRelFieldMode] = useState<'existing' | 'new'>('existing');
  const [relExistingFieldName, setRelExistingFieldName] = useState<string>('');
  const [relNewFieldName, setRelNewFieldName] = useState<string>('');
  const [relTargetCol, setRelTargetCol] = useState<string>('');
  const [relTargetField, setRelTargetField] = useState<string>('id');
  const [relCardinality, setRelCardinality] = useState<'single' | 'multiple'>('single');
  const [relRequired, setRelRequired] = useState<boolean>(false);
  const [relCascadeDelete, setRelCascadeDelete] = useState<boolean>(false);
  const [relEditingExisting, setRelEditingExisting] = useState<boolean>(false);
  const [savingRelation, setSavingRelation] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // System collections definition for diagram
  const systemCollections: CollectionDef[] = useMemo(
    () => [
      {
        id: '_system_logs',
        name: '_logs',
        type: 'base',
        rules: { list: '@request.auth.id != ""', view: '@request.auth.id != ""' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        fields: [
          { name: 'url', type: 'url' },
          { name: 'method', type: 'text' },
          { name: 'status', type: 'number' },
          { name: 'ip', type: 'text' },
          { name: 'auth', type: 'text' }
        ]
      }
    ],
    []
  );

  const visibleCollections = useMemo(() => {
    const baseList = showSystem
      ? [...collections, ...systemCollections.filter((sc) => !collections.some((c) => c.name === sc.name))]
      : collections.filter((c) => !c.name.startsWith('_'));
    return baseList;
  }, [collections, showSystem, systemCollections]);

  const computeAutoLayout = useCallback((cols: CollectionDef[]): Record<string, NodePosition> => {
    const next: Record<string, NodePosition> = {};
    const columnsCount = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(cols.length + 1))));
    const gapX = 330;
    const colHeights = new Array(columnsCount).fill(20);

    cols.forEach((col, idx) => {
      const colIdx = idx % columnsCount;
      const fieldsCount = buildDisplayFields(col).length;
      const cardHeight = HEADER_HEIGHT + CARD_PADDING_Y * 2 + fieldsCount * FIELD_ROW_HEIGHT;

      next[col.name] = {
        x: colIdx * gapX + 20,
        y: colHeights[colIdx]
      };

      colHeights[colIdx] += cardHeight + 44;
    });

    return next;
  }, []);

  // Ensure every visible collection has a valid position
  useEffect(() => {
    if (!opened) return;
    setPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      const missingCols = visibleCollections.filter((c) => !next[c.name]);
      if (missingCols.length > 0) {
        const autoPos = computeAutoLayout(visibleCollections);
        for (const col of missingCols) {
          next[col.name] = autoPos[col.name] || { x: 40, y: 40 };
          changed = true;
        }
      }
      if (changed) {
        try {
          localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });
  }, [opened, visibleCollections, computeAutoLayout]);

  const savePositions = (next: Record<string, NodePosition>) => {
    setPositions(next);
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleAutoArrange = () => {
    const arranged = computeAutoLayout(visibleCollections);
    savePositions(arranged);
    setPan({ x: 40, y: 36 });
    setZoom(1);
    notifications.show({
      title: 'Layout Arranged',
      message: 'Collections have been neatly aligned on the canvas.',
      color: 'teal'
    });
  };

  const handleResetView = () => {
    setPan({ x: 40, y: 36 });
    setZoom(1);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 1.8));
  const handleZoomOut = () => setZoom((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.45));

  // Convert screen coordinates to canvas world coordinates
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      };
    },
    [pan, zoom]
  );

  // Global mouse move / up listeners for smooth node dragging, canvas panning, and wire connecting
  useEffect(() => {
    if (!draggingNode && !panningCanvas && !dragConnect) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNode) {
        const dx = (e.clientX - draggingNode.startMouseX) / zoom;
        const dy = (e.clientY - draggingNode.startMouseY) / zoom;
        setPositions((prev) => {
          const updated = {
            ...prev,
            [draggingNode.colName]: {
              x: Math.round(draggingNode.startNodeX + dx),
              y: Math.round(draggingNode.startNodeY + dy)
            }
          };
          return updated;
        });
      } else if (panningCanvas) {
        const dx = e.clientX - panningCanvas.startMouseX;
        const dy = e.clientY - panningCanvas.startMouseY;
        setPan({
          x: panningCanvas.startPanX + dx,
          y: panningCanvas.startPanY + dy
        });
      } else if (dragConnect) {
        const pt = screenToCanvas(e.clientX, e.clientY);
        setDragConnect((prev) => (prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null));
      }
    };

    const handleMouseUp = () => {
      if (draggingNode) {
        setPositions((prev) => {
          try {
            localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(prev));
          } catch {}
          return prev;
        });
        setDraggingNode(null);
      }
      if (panningCanvas) {
        setPanningCanvas(null);
      }
      if (dragConnect) {
        if (hoveredTarget && hoveredTarget.colName !== dragConnect.sourceCol) {
          openRelationBuilder(
            dragConnect.sourceCol,
            dragConnect.sourceField,
            hoveredTarget.colName,
            hoveredTarget.fieldName || 'id'
          );
        }
        setDragConnect(null);
        setHoveredTarget(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNode, panningCanvas, dragConnect, hoveredTarget, zoom, screenToCanvas]);

  // Open relation modal pre-populated from drag-connect or button click
  const openRelationBuilder = (
    sourceColName: string,
    sourceFieldName: string,
    targetColName: string,
    targetFieldName = 'id'
  ) => {
    const srcCol = collections.find((c) => c.name === sourceColName);
    if (!srcCol || srcCol.name.startsWith('_')) {
      notifications.show({
        title: 'System Collection',
        message: 'Cannot modify schema of internal system collections.',
        color: 'yellow'
      });
      return;
    }

    const existingField = (srcCol.fields || []).find((f) => f.name === sourceFieldName);
    const isSystemOrPrimary =
      !sourceFieldName ||
      ['id', 'created', 'updated', 'created_at', 'updated_at', 'password'].includes(sourceFieldName);

    setRelSourceCol(sourceColName);
    setRelTargetCol(targetColName);
    setRelTargetField(targetFieldName || 'id');

    if (existingField && !isSystemOrPrimary) {
      setRelFieldMode('existing');
      setRelExistingFieldName(existingField.name);
      setRelNewFieldName(`${targetColName.replace(/s$/, '')}_id`);
      setRelCardinality(existingField.maxSelect && existingField.maxSelect > 1 ? 'multiple' : 'single');
      setRelRequired(Boolean(existingField.required));
      setRelCascadeDelete(Boolean(existingField.cascadeDelete));
      setRelEditingExisting(Boolean(existingField.relationCollection));
    } else {
      const customFields = (srcCol.fields || []).filter(
        (f) => !['id', 'created', 'updated', 'created_at', 'updated_at', 'password'].includes(f.name)
      );
      setRelFieldMode('new');
      setRelExistingFieldName(customFields[0]?.name || '');
      const suggested = `${targetColName.replace(/^_/, '').replace(/s$/, '')}_${targetFieldName || 'id'}`;
      setRelNewFieldName(suggested);
      setRelCardinality('single');
      setRelRequired(false);
      setRelCascadeDelete(false);
      setRelEditingExisting(false);
    }

    setRelationModalOpen(true);
  };

  // Save or update relation in the source collection schema
  const handleSaveRelation = async () => {
    const srcCol = collections.find((c) => c.name === relSourceCol);
    if (!srcCol) return;

    if (!relTargetCol) {
      notifications.show({
        title: 'Target Required',
        message: 'Please select a target collection to reference.',
        color: 'red'
      });
      return;
    }

    setSavingRelation(true);
    try {
      let updatedFields: FieldDef[] = [...(srcCol.fields || [])];

      if (relFieldMode === 'existing') {
        if (!relExistingFieldName) {
          notifications.show({
            title: 'Field Required',
            message: 'Please select an existing field or switch to creating a new field.',
            color: 'red'
          });
          setSavingRelation(false);
          return;
        }
        updatedFields = updatedFields.map((f) =>
          f.name === relExistingFieldName
            ? {
                ...f,
                type: 'relation' as FieldType,
                relationCollection: relTargetCol,
                relationField: relTargetField || 'id',
                maxSelect: relCardinality === 'multiple' ? 10 : 1,
                required: relRequired,
                cascadeDelete: relCascadeDelete,
                indexed: true
              }
            : f
        );
      } else {
        const cleanName = relNewFieldName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
        if (!cleanName) {
          notifications.show({
            title: 'Invalid Field Name',
            message: 'Please provide a valid alphanumeric field name.',
            color: 'red'
          });
          setSavingRelation(false);
          return;
        }
        if (updatedFields.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
          notifications.show({
            title: 'Field Already Exists',
            message: `Field "${cleanName}" already exists in ${srcCol.name}. Use "Link existing field" instead.`,
            color: 'red'
          });
          setSavingRelation(false);
          return;
        }
        updatedFields.push({
          name: cleanName,
          type: 'relation',
          relationCollection: relTargetCol,
          relationField: relTargetField || 'id',
          maxSelect: relCardinality === 'multiple' ? 10 : 1,
          required: relRequired,
          cascadeDelete: relCascadeDelete,
          indexed: true
        });
      }

      await api.updateCollection(srcCol.name, {
        fields: updatedFields
      });

      notifications.show({
        title: 'Relation Connected',
        message: `Connected ${srcCol.name}.${relFieldMode === 'existing' ? relExistingFieldName : relNewFieldName.trim()} → ${relTargetCol}.${relTargetField || 'id'}`,
        color: 'teal'
      });

      setRelationModalOpen(false);
      if (onCollectionsChange) {
        onCollectionsChange();
      }
    } catch (err: any) {
      notifications.show({
        title: 'Failed to Save Relation',
        message: err.message || 'Could not update collection schema',
        color: 'red'
      });
    } finally {
      setSavingRelation(false);
    }
  };

  // Remove relation link from an existing field
  const handleRemoveRelation = async () => {
    const srcCol = collections.find((c) => c.name === relSourceCol);
    if (!srcCol || !relExistingFieldName) return;

    setSavingRelation(true);
    try {
      const updatedFields: FieldDef[] = (srcCol.fields || []).map((f) => {
        if (f.name === relExistingFieldName) {
          const copy: FieldDef = {
            ...f,
            type: 'text',
            relationCollection: undefined,
            relationField: undefined,
            cascadeDelete: undefined
          };
          delete copy.relationCollection;
          delete copy.relationField;
          delete copy.cascadeDelete;
          return copy;
        }
        return f;
      });

      await api.updateCollection(srcCol.name, {
        fields: updatedFields
      });

      notifications.show({
        title: 'Relation Removed',
        message: `Unlinked relation on ${srcCol.name}.${relExistingFieldName}`,
        color: 'teal'
      });

      setRelationModalOpen(false);
      if (onCollectionsChange) {
        onCollectionsChange();
      }
    } catch (err: any) {
      notifications.show({
        title: 'Failed to Remove Relation',
        message: err.message,
        color: 'red'
      });
    } finally {
      setSavingRelation(false);
    }
  };

  // Compute all active relation edges between visible collections
  const relationEdges = useMemo(() => {
    const edges: Array<{
      id: string;
      sourceCol: string;
      sourceField: string;
      targetCol: string;
      targetField: string;
      isMultiple: boolean;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      pathD: string;
      midX: number;
      midY: number;
    }> = [];

    for (const col of visibleCollections) {
      const srcPos = positions[col.name];
      if (!srcPos) continue;
      const srcFields = buildDisplayFields(col);

      srcFields.forEach((f, srcFieldIdx) => {
        if (!f.relationCollection) return;
        const targetColObj = visibleCollections.find(
          (c) => c.name === f.relationCollection || c.id === f.relationCollection
        );
        if (!targetColObj) return;
        const tgtPos = positions[targetColObj.name];
        if (!tgtPos) return;

        const tgtFields = buildDisplayFields(targetColObj);
        const targetFieldName = f.relationField || 'id';
        const tgtFieldIdx = Math.max(
          0,
          tgtFields.findIndex((tf) => tf.name === targetFieldName)
        );

        const srcY =
          srcPos.y +
          HEADER_HEIGHT +
          CARD_PADDING_Y +
          srcFieldIdx * FIELD_ROW_HEIGHT +
          FIELD_ROW_HEIGHT / 2;
        const tgtY =
          tgtPos.y +
          HEADER_HEIGHT +
          CARD_PADDING_Y +
          tgtFieldIdx * FIELD_ROW_HEIGHT +
          FIELD_ROW_HEIGHT / 2;

        // Pick sides based on horizontal relative position
        const srcCenterX = srcPos.x + CARD_WIDTH / 2;
        const tgtCenterX = tgtPos.x + CARD_WIDTH / 2;

        let startX: number;
        let endX: number;
        let c1X: number;
        let c2X: number;

        if (srcCenterX <= tgtCenterX) {
          startX = srcPos.x + CARD_WIDTH;
          endX = tgtPos.x;
          const dist = Math.max(60, Math.abs(endX - startX) * 0.5);
          c1X = startX + dist;
          c2X = endX - dist;
        } else {
          startX = srcPos.x;
          endX = tgtPos.x + CARD_WIDTH;
          const dist = Math.max(60, Math.abs(endX - startX) * 0.5);
          c1X = startX - dist;
          c2X = endX + dist;
        }

        const pathD = `M ${startX} ${srcY} C ${c1X} ${srcY}, ${c2X} ${tgtY}, ${endX} ${tgtY}`;
        const midX = (startX + endX) / 2;
        const midY = (srcY + tgtY) / 2;

        edges.push({
          id: `${col.name}.${f.name}->${targetColObj.name}.${targetFieldName}`,
          sourceCol: col.name,
          sourceField: f.name,
          targetCol: targetColObj.name,
          targetField: targetFieldName,
          isMultiple: Boolean(f.maxSelect && f.maxSelect > 1),
          startX,
          startY: srcY,
          endX,
          endY: tgtY,
          pathD,
          midX,
          midY
        });
      });
    }

    return edges;
  }, [visibleCollections, positions]);

  const sourceColForModal = collections.find((c) => c.name === relSourceCol);
  const targetColForModal = visibleCollections.find((c) => c.name === relTargetCol);
  const sourceCustomFields = (sourceColForModal?.fields || []).filter(
    (f) => !['id', 'created', 'updated', 'created_at', 'updated_at', 'password'].includes(f.name)
  );
  const targetAvailableFields = targetColForModal
    ? buildDisplayFields(targetColForModal).map((f) => ({
        value: f.name,
        label: `${f.name} (${f.isPrimary ? 'primary key' : f.type})`
      }))
    : [{ value: 'id', label: 'id (primary key)' }];

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="96vw"
        withCloseButton={false}
        padding={0}
        styles={{
          content: {
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)'
          },
          body: {
            padding: 0,
            backgroundColor: 'var(--color-bg-base)',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Top Header Bar */}
        <Group
          justify="space-between"
          align="center"
          px="lg"
          py="sm"
          style={{
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-surface)',
            flexShrink: 0
          }}
        >
          <Group gap="sm" align="center">
            <Box
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: 'var(--color-neon-dim)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconGitBranch size={16} color="var(--color-neon-primary)" />
            </Box>
            <div>
              <Text fw={700} size="sm" c="var(--color-text-primary)">
                Collections Overview & Schema Relations
              </Text>
              <Text size="11px" c="var(--color-text-dimmed)">
                Drag tables to arrange • Drag from any field port to another table's field to link a relation
              </Text>
            </div>
          </Group>

          {/* Center Tabs */}
          <Group gap={6}>
            <Button
              size="xs"
              variant={activeTab === 'fields' ? 'light' : 'subtle'}
              color={activeTab === 'fields' ? 'neonGreen' : 'gray'}
              onClick={() => setActiveTab('fields')}
              style={{
                fontWeight: 600,
                border:
                  activeTab === 'fields'
                    ? '1px solid var(--color-border-glow)'
                    : '1px solid transparent'
              }}
            >
              Fields & Relations ({relationEdges.length})
            </Button>
            <Button
              size="xs"
              variant={activeTab === 'rules' ? 'light' : 'subtle'}
              color={activeTab === 'rules' ? 'neonGreen' : 'gray'}
              onClick={() => setActiveTab('rules')}
              style={{
                fontWeight: 600,
                border:
                  activeTab === 'rules'
                    ? '1px solid var(--color-border-glow)'
                    : '1px solid transparent'
              }}
            >
              Access Rules
            </Button>
          </Group>

          <Group gap="md" align="center">
            <Switch
              label="System collections"
              checked={showSystem}
              onChange={(e) => setShowSystem(e.currentTarget.checked)}
              size="xs"
              color="neonGreen"
              styles={{
                label: {
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }
              }}
            />
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              onClick={onClose}
              style={{
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Main Content Area */}
        <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {activeTab === 'fields' ? (
            <Box
              ref={canvasRef}
              onMouseDown={(e) => {
                // Only start canvas pan if clicking directly on the canvas background
                if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
                  setPanningCanvas({
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startPanX: pan.x,
                    startPanY: pan.y
                  });
                }
              }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                setZoom((prev) => Math.min(1.8, Math.max(0.45, Number((prev + delta).toFixed(2)))));
              }}
              data-canvas-bg="true"
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                cursor: panningCanvas
                  ? 'grabbing'
                  : dragConnect
                  ? 'crosshair'
                  : 'grab',
                backgroundColor: 'var(--color-bg-base)',
                backgroundImage:
                  'radial-gradient(var(--color-border-subtle) 1.25px, transparent 1.25px)',
                backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`,
                userSelect: 'none'
              }}
            >
              {/* Transform World Container */}
              <Box
                data-canvas-bg="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: 4000,
                  height: 3000,
                  pointerEvents: 'none'
                }}
              >
                {/* SVG Layer for Relation Lines & Active Drag Connection */}
                <svg
                  width={4000}
                  height={3000}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    overflow: 'visible',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  <defs>
                    <marker
                      id="rel-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-neon-primary)" />
                    </marker>
                  </defs>

                  {/* Saved Relation Edges */}
                  {relationEdges.map((edge) => {
                    const isHovered = hoveredRelationId === edge.id;
                    return (
                      <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                        {/* Invisible wider hit path for easier clicking/hovering */}
                        <path
                          d={edge.pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={16}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredRelationId(edge.id)}
                          onMouseLeave={() => setHoveredRelationId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRelationBuilder(
                              edge.sourceCol,
                              edge.sourceField,
                              edge.targetCol,
                              edge.targetField
                            );
                          }}
                        />
                        {/* Visible glowing relation curve */}
                        <path
                          d={edge.pathD}
                          fill="none"
                          stroke="var(--color-neon-primary)"
                          strokeWidth={isHovered ? 3 : 2}
                          strokeDasharray={edge.isMultiple ? '6 3' : undefined}
                          markerEnd="url(#rel-arrow)"
                          style={{
                            filter: isHovered
                              ? 'drop-shadow(0 0 8px var(--color-neon-primary))'
                              : undefined,
                            opacity: isHovered ? 1 : 0.82,
                            transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                            pointerEvents: 'none'
                          }}
                        />
                        {/* Source port dot */}
                        <circle
                          cx={edge.startX}
                          cy={edge.startY}
                          r={4}
                          fill="var(--color-neon-primary)"
                        />
                        {/* Interactive mid-point pill label */}
                        <foreignObject
                          x={edge.midX - 75}
                          y={edge.midY - 13}
                          width={150}
                          height={26}
                          style={{ overflow: 'visible', pointerEvents: 'auto' }}
                        >
                          <div
                            onMouseEnter={() => setHoveredRelationId(edge.id)}
                            onMouseLeave={() => setHoveredRelationId(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRelationBuilder(
                                edge.sourceCol,
                                edge.sourceField,
                                edge.targetCol,
                                edge.targetField
                              );
                            }}
                            title="Click to edit or remove relation"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              margin: '0 auto',
                              padding: '2px 8px',
                              borderRadius: 999,
                              backgroundColor: 'var(--color-bg-card)',
                              border: `1px solid ${
                                isHovered ? 'var(--color-neon-primary)' : 'var(--color-border)'
                              }`,
                              color: 'var(--color-text-primary)',
                              fontSize: 10,
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              whiteSpace: 'nowrap',
                              transform: 'translateX(-50%)',
                              marginLeft: '50%'
                            }}
                          >
                            <span style={{ color: 'var(--color-neon-primary)' }}>
                              {edge.isMultiple ? 'M:N' : 'N:1'}
                            </span>
                            <span>
                              {edge.sourceField} → {edge.targetField}
                            </span>
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}

                  {/* Live Dragging Connection Line */}
                  {dragConnect && (
                    <g>
                      <path
                        d={`M ${dragConnect.startX} ${dragConnect.startY} C ${
                          dragConnect.startX + (dragConnect.currentX - dragConnect.startX) * 0.5
                        } ${dragConnect.startY}, ${
                          dragConnect.currentX - (dragConnect.currentX - dragConnect.startX) * 0.5
                        } ${dragConnect.currentY}, ${dragConnect.currentX} ${dragConnect.currentY}`}
                        fill="none"
                        stroke="var(--color-neon-primary)"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        markerEnd="url(#rel-arrow)"
                      />
                      <circle
                        cx={dragConnect.startX}
                        cy={dragConnect.startY}
                        r={5}
                        fill="var(--color-neon-primary)"
                      />
                    </g>
                  )}
                </svg>

                {/* Collection Node Cards */}
                {visibleCollections.map((col) => {
                  const pos = positions[col.name] || { x: 40, y: 40 };
                  const displayFields = buildDisplayFields(col);
                  const isDraggingThis = draggingNode?.colName === col.name;
                  const isDropTargetCol =
                    dragConnect &&
                    dragConnect.sourceCol !== col.name &&
                    hoveredTarget?.colName === col.name;

                  return (
                    <Box
                      key={col.id || col.name}
                      onMouseEnter={() => {
                        if (dragConnect && dragConnect.sourceCol !== col.name) {
                          setHoveredTarget((prev) =>
                            prev?.colName === col.name ? prev : { colName: col.name, fieldName: 'id' }
                          );
                        }
                      }}
                      onMouseLeave={() => {
                        if (dragConnect && hoveredTarget?.colName === col.name) {
                          setHoveredTarget(null);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y,
                        width: CARD_WIDTH,
                        backgroundColor: 'var(--color-bg-card)',
                        border: isDropTargetCol
                          ? '2px solid var(--color-neon-primary)'
                          : isDraggingThis
                          ? '1px solid var(--color-neon-primary)'
                          : '1px solid var(--color-border)',
                        borderRadius: 10,
                        boxShadow: isDraggingThis
                          ? '0 16px 36px rgba(0, 0, 0, 0.35), 0 0 0 2px var(--color-neon-dim)'
                          : isDropTargetCol
                          ? '0 0 20px var(--color-neon-glow)'
                          : '0 8px 24px rgba(0, 0, 0, 0.16)',
                        pointerEvents: 'auto',
                        zIndex: isDraggingThis ? 20 : 10,
                        transition: isDraggingThis ? 'none' : 'border-color 0.15s ease, box-shadow 0.15s ease'
                      }}
                    >
                      {/* Draggable Card Header */}
                      <Group
                        justify="space-between"
                        align="center"
                        px="sm"
                        style={{
                          height: HEADER_HEIGHT,
                          backgroundColor: 'var(--color-bg-surface)',
                          borderBottom: '1px solid var(--color-border)',
                          borderRadius: '9px 9px 0 0',
                          cursor: isDraggingThis ? 'grabbing' : 'grab'
                        }}
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          e.stopPropagation();
                          setDraggingNode({
                            colName: col.name,
                            startMouseX: e.clientX,
                            startMouseY: e.clientY,
                            startNodeX: pos.x,
                            startNodeY: pos.y
                          });
                        }}
                        onDoubleClick={() => {
                          if (onSelectCollection && !col.name.startsWith('_')) {
                            onSelectCollection(col);
                            onClose();
                          }
                        }}
                      >
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                          <IconGripVertical
                            size={14}
                            color="var(--color-text-dimmed)"
                            style={{ flexShrink: 0 }}
                          />
                          <Text
                            size="xs"
                            fw={700}
                            c="var(--color-text-primary)"
                            truncate
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {col.name}
                          </Text>
                        </Group>

                        <Group gap={4} wrap="nowrap">
                          {!col.name.startsWith('_') && (
                            <Tooltip label="Add / Connect Relation" withArrow>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="neonGreen"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const defaultTarget =
                                    visibleCollections.find((c) => c.name !== col.name)?.name || '';
                                  openRelationBuilder(col.name, '', defaultTarget, 'id');
                                }}
                              >
                                <IconPlus size={13} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {onSelectCollection && !col.name.startsWith('_') && (
                            <Tooltip label={`Open ${col.name} table`} withArrow>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="gray"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectCollection(col);
                                  onClose();
                                }}
                              >
                                <IconExternalLink size={13} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Group>

                      {/* Card Fields List */}
                      <Box py={CARD_PADDING_Y}>
                        {displayFields.map((f, fIdx) => {
                          const hasRel = Boolean(f.relationCollection);
                          const isHoveredFieldTarget =
                            isDropTargetCol && hoveredTarget?.fieldName === f.name;

                          const startPortDrag = (e: React.MouseEvent, side: 'left' | 'right') => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (col.name.startsWith('_')) return;
                            const portX = side === 'right' ? pos.x + CARD_WIDTH : pos.x;
                            const portY =
                              pos.y +
                              HEADER_HEIGHT +
                              CARD_PADDING_Y +
                              fIdx * FIELD_ROW_HEIGHT +
                              FIELD_ROW_HEIGHT / 2;
                            setDragConnect({
                              sourceCol: col.name,
                              sourceField: f.name,
                              startX: portX,
                              startY: portY,
                              currentX: portX,
                              currentY: portY
                            });
                          };

                          return (
                            <Group
                              key={f.name}
                              justify="space-between"
                              px="sm"
                              wrap="nowrap"
                              onMouseEnter={() => {
                                if (dragConnect && dragConnect.sourceCol !== col.name) {
                                  setHoveredTarget({ colName: col.name, fieldName: f.name });
                                }
                              }}
                              onClick={(e) => {
                                if (hasRel) {
                                  e.stopPropagation();
                                  openRelationBuilder(
                                    col.name,
                                    f.name,
                                    f.relationCollection!,
                                    f.relationField || 'id'
                                  );
                                }
                              }}
                              style={{
                                height: FIELD_ROW_HEIGHT,
                                position: 'relative',
                                backgroundColor: isHoveredFieldTarget
                                  ? 'var(--color-neon-dim)'
                                  : hasRel
                                  ? 'rgba(16, 229, 122, 0.05)'
                                  : 'transparent',
                                borderBottom:
                                  fIdx < displayFields.length - 1
                                    ? '1px solid var(--color-border)'
                                    : 'none',
                                cursor: hasRel ? 'pointer' : 'default',
                                transition: 'background-color 0.12s ease'
                              }}
                            >
                              {/* Left Connection Handle */}
                              <Tooltip
                                label={
                                  col.name.startsWith('_')
                                    ? 'Target port'
                                    : `Drag from ${col.name}.${f.name} to another table field to link relation`
                                }
                                position="left"
                                withArrow
                                openDelay={300}
                              >
                                <Box
                                  onMouseDown={(e) => startPortDrag(e, 'left')}
                                  style={{
                                    position: 'absolute',
                                    left: -6,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 11,
                                    height: 11,
                                    borderRadius: '50%',
                                    backgroundColor:
                                      hasRel || isHoveredFieldTarget || f.isPrimary
                                        ? 'var(--color-neon-primary)'
                                        : 'var(--color-bg-surface)',
                                    border: '2px solid var(--color-border-subtle)',
                                    cursor: 'crosshair',
                                    zIndex: 15
                                  }}
                                />
                              </Tooltip>

                              {/* Field Icon & Name */}
                              <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                                {f.name === 'emailVisibility' ? (
                                  <IconEye size={13} color="var(--color-text-dimmed)" />
                                ) : f.name === 'verified' ? (
                                  <IconCheck size={13} color="#4ade80" />
                                ) : (
                                  getFieldIcon(f.type, f.isPrimary, hasRel)
                                )}
                                <Text
                                  size="11.5px"
                                  fw={f.isPrimary || hasRel ? 600 : 500}
                                  c={
                                    f.isSystem && !f.isPrimary
                                      ? 'var(--color-text-dimmed)'
                                      : 'var(--color-text-primary)'
                                  }
                                  truncate
                                  style={{ fontFamily: 'var(--font-mono)' }}
                                >
                                  {f.name}
                                </Text>
                              </Group>

                              {/* Field Badges / Relation Target */}
                              <Group gap={4} wrap="nowrap">
                                {hasRel && (
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color="teal"
                                    style={{
                                      height: 16,
                                      fontSize: '9px',
                                      padding: '0 5px',
                                      fontFamily: 'var(--font-mono)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    → {f.relationCollection}.{f.relationField || 'id'}
                                  </Badge>
                                )}
                                {f.isPrimary && (
                                  <Badge
                                    size="xs"
                                    color="yellow"
                                    variant="outline"
                                    style={{ height: 15, fontSize: '8.5px', padding: '0 4px' }}
                                  >
                                    PK
                                  </Badge>
                                )}
                                {f.unique && !f.isPrimary && (
                                  <Badge
                                    size="xs"
                                    color="blue"
                                    variant="outline"
                                    style={{ height: 15, fontSize: '8.5px', padding: '0 4px' }}
                                  >
                                    unique
                                  </Badge>
                                )}
                                {f.hidden && (
                                  <Badge
                                    size="xs"
                                    color="red"
                                    variant="light"
                                    style={{ height: 15, fontSize: '8.5px', padding: '0 4px' }}
                                  >
                                    hidden
                                  </Badge>
                                )}
                              </Group>

                              {/* Right Connection Handle */}
                              <Tooltip
                                label={
                                  col.name.startsWith('_')
                                    ? 'Target port'
                                    : `Drag from ${col.name}.${f.name} to another table field to link relation`
                                }
                                position="right"
                                withArrow
                                openDelay={300}
                              >
                                <Box
                                  onMouseDown={(e) => startPortDrag(e, 'right')}
                                  style={{
                                    position: 'absolute',
                                    right: -6,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 11,
                                    height: 11,
                                    borderRadius: '50%',
                                    backgroundColor:
                                      hasRel || isHoveredFieldTarget
                                        ? 'var(--color-neon-primary)'
                                        : 'var(--color-bg-surface)',
                                    border: '2px solid var(--color-border-subtle)',
                                    cursor: 'crosshair',
                                    zIndex: 15
                                  }}
                                />
                              </Tooltip>
                            </Group>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Floating Canvas Controls (Bottom Right) */}
              <Paper
                withBorder
                p={4}
                radius="md"
                style={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
                  zIndex: 30
                }}
              >
                <Group gap={4}>
                  <Tooltip label="Auto-arrange tables" withArrow>
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={handleAutoArrange}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <IconLayoutGrid size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Reset pan & zoom" withArrow>
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={handleResetView}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <IconArrowsMaximize size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Divider orientation="vertical" style={{ borderColor: 'var(--color-border)' }} />
                  <Tooltip label="Zoom out" withArrow>
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={handleZoomOut}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <IconMinus size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Badge
                    variant="subtle"
                    color="gray"
                    onClick={handleResetView}
                    style={{
                      cursor: 'pointer',
                      minWidth: 48,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    {Math.round(zoom * 100)}%
                  </Badge>
                  <Tooltip label="Zoom in" withArrow>
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={handleZoomIn}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <IconPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            </Box>
          ) : (
            /* Access Rules Tab Content */
            <ScrollArea
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--color-bg-base)'
              }}
              p="xl"
            >
              <Paper
                withBorder
                radius="md"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                  overflow: 'hidden'
                }}
              >
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Collection</Table.Th>
                      <Table.Th>List / Search</Table.Th>
                      <Table.Th>View</Table.Th>
                      <Table.Th>Create</Table.Th>
                      <Table.Th>Update</Table.Th>
                      <Table.Th>Delete</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visibleCollections.map((col) => (
                      <Table.Tr key={col.name}>
                        <Table.Td>
                          <Text
                            fw={600}
                            size="sm"
                            c="var(--color-text-primary)"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {col.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {col.rules?.list ? (
                            <Code
                              style={{
                                backgroundColor: 'var(--color-bg-well)',
                                color: '#38bdf8',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              {col.rules.list}
                            </Code>
                          ) : col.rules?.list === null ? (
                            <Badge size="xs" color="red" variant="light">
                              Locked (Superuser)
                            </Badge>
                          ) : (
                            <Badge size="xs" color="teal" variant="light">
                              Public
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {col.rules?.view ? (
                            <Code
                              style={{
                                backgroundColor: 'var(--color-bg-well)',
                                color: '#38bdf8',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              {col.rules.view}
                            </Code>
                          ) : col.rules?.view === null ? (
                            <Badge size="xs" color="red" variant="light">
                              Locked (Superuser)
                            </Badge>
                          ) : (
                            <Badge size="xs" color="teal" variant="light">
                              Public
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {col.rules?.create ? (
                            <Code
                              style={{
                                backgroundColor: 'var(--color-bg-well)',
                                color: '#4ade80',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              {col.rules.create}
                            </Code>
                          ) : col.rules?.create === null ? (
                            <Badge size="xs" color="red" variant="light">
                              Locked (Superuser)
                            </Badge>
                          ) : (
                            <Badge size="xs" color="teal" variant="light">
                              Public
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {col.rules?.update ? (
                            <Code
                              style={{
                                backgroundColor: 'var(--color-bg-well)',
                                color: '#fbbf24',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              {col.rules.update}
                            </Code>
                          ) : col.rules?.update === null ? (
                            <Badge size="xs" color="red" variant="light">
                              Locked (Superuser)
                            </Badge>
                          ) : (
                            <Badge size="xs" color="teal" variant="light">
                              Public
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {col.rules?.delete ? (
                            <Code
                              style={{
                                backgroundColor: 'var(--color-bg-well)',
                                color: '#f43f5e',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              {col.rules.delete}
                            </Code>
                          ) : col.rules?.delete === null ? (
                            <Badge size="xs" color="red" variant="light">
                              Locked (Superuser)
                            </Badge>
                          ) : (
                            <Badge size="xs" color="teal" variant="light">
                              Public
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </ScrollArea>
          )}
        </Box>
      </Modal>

      {/* Relation Connection Builder Modal */}
      <Modal
        opened={relationModalOpen}
        onClose={() => setRelationModalOpen(false)}
        centered
        size="md"
        title={
          <Group gap="xs">
            <IconGitBranch size={18} color="var(--color-neon-primary)" />
            <Text fw={700} size="sm" c="var(--color-text-primary)">
              {relEditingExisting ? 'Edit Table Relation' : 'Connect Fields (Table Relation)'}
            </Text>
          </Group>
        }
        styles={{
          header: {
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border)'
          },
          content: {
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)'
          },
          body: {
            padding: '16px 20px',
            backgroundColor: 'var(--color-bg-card)'
          }
        }}
      >
        <Stack gap="md">
          {/* Visual Connection Summary Banner */}
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{
              backgroundColor: 'var(--color-bg-well)',
              borderColor: 'var(--color-border)'
            }}
          >
            <Group justify="center" gap="xs" wrap="nowrap">
              <Badge
                size="sm"
                variant="light"
                color="gray"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {relSourceCol}.
                {relFieldMode === 'existing'
                  ? relExistingFieldName || '?'
                  : relNewFieldName || '?'}
              </Badge>
              <IconArrowRight size={15} color="var(--color-neon-primary)" />
              <Badge
                size="sm"
                variant="light"
                color="teal"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {relTargetCol || '?'}.{relTargetField || 'id'}
              </Badge>
            </Group>
          </Paper>

          {/* Source Field Selection */}
          <div>
            <Text size="xs" fw={600} c="var(--color-text-secondary)" mb={6}>
              Source Field in <Code>{relSourceCol}</Code>
            </Text>
            {sourceCustomFields.length > 0 && (
              <SegmentedControl
                fullWidth
                size="xs"
                mb="xs"
                value={relFieldMode}
                onChange={(val) => setRelFieldMode(val as 'existing' | 'new')}
                data={[
                  { label: 'Link existing field', value: 'existing' },
                  { label: 'Create new relation field', value: 'new' }
                ]}
              />
            )}

            {relFieldMode === 'existing' && sourceCustomFields.length > 0 ? (
              <Select
                size="xs"
                placeholder="Select field in source table"
                value={relExistingFieldName}
                onChange={(v) => setRelExistingFieldName(v || '')}
                data={sourceCustomFields.map((f) => ({
                  value: f.name,
                  label: `${f.name} (${f.type})`
                }))}
              />
            ) : (
              <TextInput
                size="xs"
                placeholder="e.g. user_id, repack_id, author"
                value={relNewFieldName}
                onChange={(e) => setRelNewFieldName(e.currentTarget.value)}
                leftSection={<IconSparkles size={13} color="var(--color-neon-primary)" />}
              />
            )}
          </div>

          {/* Target Collection & Target Field Selection */}
          <Group grow align="flex-start">
            <Select
              size="xs"
              label="Referenced Table"
              placeholder="Select target collection"
              value={relTargetCol}
              onChange={(v) => {
                setRelTargetCol(v || '');
                setRelTargetField('id');
              }}
              data={visibleCollections
                .filter((c) => c.name !== relSourceCol)
                .map((c) => ({ value: c.name, label: c.name }))}
            />
            <Select
              size="xs"
              label="Referenced Field"
              placeholder="Select target column"
              value={relTargetField}
              onChange={(v) => setRelTargetField(v || 'id')}
              data={targetAvailableFields}
            />
          </Group>

          {/* Cardinality & Constraints */}
          <div>
            <Text size="xs" fw={600} c="var(--color-text-secondary)" mb={6}>
              Relation Cardinality
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={relCardinality}
              onChange={(v) => setRelCardinality(v as 'single' | 'multiple')}
              data={[
                { label: 'Single Reference (N:1 / 1:1)', value: 'single' },
                { label: 'Multiple References (M:N)', value: 'multiple' }
              ]}
            />
          </div>

          <Paper
            p="xs"
            withBorder
            radius="md"
            style={{
              backgroundColor: 'var(--color-bg-well)',
              borderColor: 'var(--color-border)'
            }}
          >
            <Stack gap="xs">
              <Group justify="space-between">
                <div>
                  <Text size="xs" fw={600} c="var(--color-text-primary)">
                    Required Field
                  </Text>
                  <Text size="10.5px" c="var(--color-text-dimmed)">
                    Require a valid target reference when creating records
                  </Text>
                </div>
                <Switch
                  size="xs"
                  color="neonGreen"
                  checked={relRequired}
                  onChange={(e) => setRelRequired(e.currentTarget.checked)}
                />
              </Group>
              <Divider style={{ borderColor: 'var(--color-border)' }} />
              <Group justify="space-between">
                <div>
                  <Text size="xs" fw={600} c="var(--color-text-primary)">
                    Cascade Delete
                  </Text>
                  <Text size="10.5px" c="var(--color-text-dimmed)">
                    Delete dependent {relSourceCol} records if referenced {relTargetCol} record is deleted
                  </Text>
                </div>
                <Switch
                  size="xs"
                  color="neonGreen"
                  checked={relCascadeDelete}
                  onChange={(e) => setRelCascadeDelete(e.currentTarget.checked)}
                />
              </Group>
            </Stack>
          </Paper>

          {/* Modal Footer Actions */}
          <Group justify="space-between" mt="xs">
            {relEditingExisting ? (
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                loading={savingRelation}
                onClick={handleRemoveRelation}
              >
                Unlink Relation
              </Button>
            ) : (
              <div />
            )}
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => setRelationModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                color="neonGreen"
                loading={savingRelation}
                onClick={handleSaveRelation}
                style={{ color: 'var(--color-neon-text)' }}
              >
                {relEditingExisting ? 'Update Relation' : 'Connect Fields'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
