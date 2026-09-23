import React, { useState } from 'react';
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
  Code
} from '@mantine/core';
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
  IconCheck
} from '@tabler/icons-react';
import { CollectionDef, FieldType } from '../api/client';

interface CollectionsOverviewModalProps {
  opened: boolean;
  onClose: () => void;
  collections: CollectionDef[];
  onSelectCollection?: (col: CollectionDef) => void;
}

function getFieldIcon(type: FieldType) {
  switch (type) {
    case 'text':
      return <IconLetterT size={13} color="#94a3b8" />;
    case 'number':
      return <IconHash size={13} color="#fbbf24" />;
    case 'bool':
      return <IconToggleLeft size={13} color="#4ade80" />;
    case 'json':
      return <IconCode size={13} color="#f472b6" />;
    case 'file':
      return <IconFile size={13} color="#fb923c" />;
    case 'date':
      return <IconCalendar size={13} color="#a855f7" />;
    case 'autodate':
      return <IconClock size={13} color="#ec4899" />;
    case 'email':
      return <IconMail size={13} color="#06b6d4" />;
    case 'url':
      return <IconLink size={13} color="#3b82f6" />;
    case 'select':
      return <IconListCheck size={13} color="#14b8a6" />;
    default:
      return <IconLetterT size={13} color="#94a3b8" />;
  }
}

export const CollectionsOverviewModal: React.FC<CollectionsOverviewModalProps> = ({
  opened,
  onClose,
  collections,
  onSelectCollection
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'rules'>('fields');
  const [showSystem, setShowSystem] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // System collections definition for diagram
  const systemCollections: CollectionDef[] = [
    {
      id: '_system_logs',
      name: '_logs',
      type: 'base',
      rules: { list: '@request.auth.id != ""', view: '@request.auth.id != ""' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fields: [
        { name: 'id', type: 'text', required: true, system: true },
        { name: 'url', type: 'url' },
        { name: 'method', type: 'text' },
        { name: 'status', type: 'number' },
        { name: 'ip', type: 'text' },
        { name: 'auth', type: 'text' },
        { name: 'created', type: 'autodate', system: true }
      ]
    },
    {
      id: '_system_superusers',
      name: '_superusers',
      type: 'auth',
      rules: { list: '@request.auth.id != ""', view: '@request.auth.id != ""' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fields: [
        { name: 'id', type: 'text', required: true, system: true },
        { name: 'email', type: 'email', required: true, unique: true },
        { name: 'password', type: 'text', hidden: true, system: true },
        { name: 'created', type: 'autodate', system: true },
        { name: 'updated', type: 'autodate', system: true }
      ]
    }
  ];

  const visibleCollections = showSystem
    ? [...collections, ...systemCollections]
    : collections;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.6));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.6));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="96vw"
      withCloseButton={false}
      styles={{
        content: {
          backgroundColor: '#161618',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          overflow: 'hidden'
        },
        body: {
          padding: 0,
          backgroundColor: '#161618',
          height: '86vh',
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
        py="md"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#19191d'
        }}
      >
        <Text fw={700} size="md" c="white">
          Collections overview
        </Text>

        <Group gap="lg" align="center">
          <Switch
            label="System collections"
            checked={showSystem}
            onChange={(e) => setShowSystem(e.currentTarget.checked)}
            size="xs"
            color="dark"
            styles={{
              label: { color: '#a1a1aa', fontSize: '13px', cursor: 'pointer' }
            }}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onClose}
            style={{ color: '#a1a1aa' }}
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Tabs Header */}
      <Box
        px="lg"
        pt="xs"
        style={{
          backgroundColor: '#161618',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <Group gap="xs">
          <Box
            onClick={() => setActiveTab('fields')}
            style={{
              padding: '8px 24px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              backgroundColor: activeTab === 'fields' ? '#212126' : 'transparent',
              color: activeTab === 'fields' ? '#ffffff' : '#71717a',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.15s ease',
              borderBottom: activeTab === 'fields' ? '2px solid #10e57a' : '2px solid transparent'
            }}
          >
            Fields and relations
          </Box>
          <Box
            onClick={() => setActiveTab('rules')}
            style={{
              padding: '8px 24px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              backgroundColor: activeTab === 'rules' ? '#212126' : 'transparent',
              color: activeTab === 'rules' ? '#ffffff' : '#71717a',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.15s ease',
              borderBottom: activeTab === 'rules' ? '2px solid #10e57a' : '2px solid transparent'
            }}
          >
            Rules
          </Box>
        </Group>
      </Box>

      {/* Main Content Area */}
      <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTab === 'fields' ? (
          <ScrollArea
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              backgroundColor: '#121214'
            }}
          >
            <Box
              p="xl"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                alignItems: 'flex-start',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top left',
                transition: 'transform 0.15s ease',
                minWidth: '1000px',
                padding: '40px'
              }}
            >
              {visibleCollections.map((col) => {
                const isAuth = col.type === 'auth' || col.name === 'users';
                return (
                  <Box
                    key={col.id || col.name}
                    onClick={() => {
                      if (onSelectCollection) {
                        onSelectCollection(col);
                        onClose();
                      }
                    }}
                    style={{
                      width: 220,
                      backgroundColor: '#1b1b1f',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, transform 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    {/* Collection Card Header */}
                    <Box
                      px="sm"
                      py="xs"
                      style={{
                        backgroundColor: '#232328',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        textAlign: 'center'
                      }}
                    >
                      <Text size="xs" fw={700} c="white" truncate>
                        {col.name}
                      </Text>
                    </Box>

                    {/* Collection Card Fields List */}
                    <Box py={4}>
                      {/* ID Field */}
                      <Group
                        justify="space-between"
                        px="sm"
                        py={4}
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                      >
                        <Group gap={6} wrap="nowrap">
                          <IconLetterT size={12} color="#71717a" />
                          <Text size="11px" c="#e4e4e7" fw={500}>id</Text>
                        </Group>
                      </Group>

                      {/* Custom Fields */}
                      {col.fields.map((f) => (
                        <Group
                          key={f.name}
                          justify="space-between"
                          px="sm"
                          py={4}
                          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                        >
                          <Group gap={6} wrap="nowrap">
                            {getFieldIcon(f.type)}
                            <Text size="11px" c="#e4e4e7">
                              {f.name}
                            </Text>
                          </Group>
                          <Group gap={4}>
                            {f.unique && (
                              <Badge size="xs" color="blue" variant="outline" style={{ height: 16, fontSize: '9px', padding: '0 4px', borderWidth: 1 }}>
                                unique
                              </Badge>
                            )}
                            {f.hidden && (
                              <Badge size="xs" color="red" variant="filled" style={{ height: 16, fontSize: '9px', padding: '0 4px' }}>
                                hidden
                              </Badge>
                            )}
                            {f.type === 'file' && (
                              <Badge size="xs" color="gray" variant="subtle" style={{ height: 16, fontSize: '9px', padding: '0 4px' }}>
                                single
                              </Badge>
                            )}
                          </Group>
                        </Group>
                      ))}

                      {/* Default Auth Fields if auth */}
                      {isAuth && !col.fields.some(f => f.name === 'email') && (
                        <>
                          <Group justify="space-between" px="sm" py={4} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <Group gap={6} wrap="nowrap">
                              <IconMail size={12} color="#06b6d4" />
                              <Text size="11px" c="#e4e4e7">email</Text>
                            </Group>
                          </Group>
                          <Group justify="space-between" px="sm" py={4} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <Group gap={6} wrap="nowrap">
                              <IconEye size={12} color="#a1a1aa" />
                              <Text size="11px" c="#e4e4e7">emailVisibility</Text>
                            </Group>
                          </Group>
                          <Group justify="space-between" px="sm" py={4} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <Group gap={6} wrap="nowrap">
                              <IconCheck size={12} color="#4ade80" />
                              <Text size="11px" c="#e4e4e7">verified</Text>
                            </Group>
                          </Group>
                        </>
                      )}

                      {/* Created & Updated */}
                      <Group justify="space-between" px="sm" py={4} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <Group gap={6} wrap="nowrap">
                          <IconCalendar size={12} color="#71717a" />
                          <Text size="11px" c="#71717a">created</Text>
                        </Group>
                      </Group>
                      <Group justify="space-between" px="sm" py={4}>
                        <Group gap={6} wrap="nowrap">
                          <IconCalendar size={12} color="#71717a" />
                          <Text size="11px" c="#71717a">updated</Text>
                        </Group>
                      </Group>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </ScrollArea>
        ) : (
          /* Rules Tab Content */
          <ScrollArea style={{ width: '100%', height: '100%', backgroundColor: '#131315' }} p="xl">
            <Table highlightOnHover style={{ fontSize: '13px' }}>
              <Table.Thead style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
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
                  <Table.Tr key={col.name} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <Table.Td>
                      <Text fw={600} size="sm" c="white">
                        {col.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {col.rules?.list ? (
                        <Code color="dark" style={{ color: '#38bdf8' }}>{col.rules.list}</Code>
                      ) : (
                        <Badge size="xs" color="gray" variant="subtle">Unlocked</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {col.rules?.view ? (
                        <Code color="dark" style={{ color: '#38bdf8' }}>{col.rules.view}</Code>
                      ) : (
                        <Badge size="xs" color="gray" variant="subtle">Unlocked</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {col.rules?.create !== undefined && col.rules.create !== '' ? (
                        <Code color="dark" style={{ color: '#4ade80' }}>{col.rules.create}</Code>
                      ) : col.rules?.create === null ? (
                        <Badge size="xs" color="red" variant="filled">Locked</Badge>
                      ) : (
                        <Badge size="xs" color="gray" variant="subtle">Unlocked</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {col.rules?.update ? (
                        <Code color="dark" style={{ color: '#fbbf24' }}>{col.rules.update}</Code>
                      ) : col.rules?.update === null ? (
                        <Badge size="xs" color="red" variant="filled">Locked</Badge>
                      ) : (
                        <Badge size="xs" color="gray" variant="subtle">Unlocked</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {col.rules?.delete ? (
                        <Code color="dark" style={{ color: '#f43f5e' }}>{col.rules.delete}</Code>
                      ) : col.rules?.delete === null ? (
                        <Badge size="xs" color="red" variant="filled">Locked</Badge>
                      ) : (
                        <Badge size="xs" color="gray" variant="subtle">Unlocked</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {/* Zoom Controls at bottom right */}
        {activeTab === 'fields' && (
          <Group
            gap={4}
            style={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              backgroundColor: '#232328',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: 4,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
            }}
          >
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleZoomIn}>
              <IconPlus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleZoomOut}>
              <IconMinus size={16} />
            </ActionIcon>
          </Group>
        )}
      </Box>
    </Modal>
  );
};
