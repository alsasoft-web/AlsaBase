import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  Group,
  Text,
  TextInput,
  Button,
  Stack,
  Table,
  Badge,
  ActionIcon,
  ScrollArea,
  Code,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPackage,
  IconTrash,
  IconRefresh,
  IconCode,
  IconDownload
} from '@tabler/icons-react';
import { api } from '../api/client';

interface NpmPackagesModalProps {
  opened: boolean;
  onClose: () => void;
}

export const NpmPackagesModal: React.FC<NpmPackagesModalProps> = ({
  opened,
  onClose
}) => {
  const [packages, setPackages] = useState<{ name: string; version: string; isDev: boolean }[]>([]);
  const [packageName, setPackageName] = useState('');
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [uninstallingName, setUninstallingName] = useState<string | null>(null);

  const popularPackages = [
    'axios',
    'dayjs',
    'lodash',
    'nanoid',
    'zod',
    'jsonwebtoken',
    'crypto-js',
    'uuid',
    'nodemailer'
  ];

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await api.listPackages();
      const rawList = res.packages || [];
      const filtered = rawList.filter((p) => {
        const n = p.name;
        if (n.startsWith('@mantine/') || n.startsWith('@types/') || n.startsWith('@vitejs/') || n.startsWith('postcss')) return false;
        if (['react', 'react-dom', 'better-sqlite3', 'cors', 'dotenv', 'express', 'node-cron', 'tsx', 'typescript', 'vite', 'concurrently', '@monaco-editor/react', '@tabler/icons-react'].includes(n)) return false;
        return true;
      });
      setPackages(filtered);
    } catch (err: any) {
      notifications.show({
        title: 'Failed to list packages',
        message: err.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      loadPackages();
    }
  }, [opened]);

  const handleInstall = async (pkgToInstall?: string) => {
    const target = (pkgToInstall || packageName).trim();
    if (!target) return;

    setInstalling(true);
    try {
      const res = await api.installPackage(target);
      notifications.show({
        title: 'Package Installed',
        message: res.message || `Successfully installed ${target}`,
        color: 'teal'
      });
      setPackageName('');
      loadPackages();
    } catch (err: any) {
      notifications.show({
        title: 'Install Failed',
        message: err.message || `Could not install ${target}`,
        color: 'red'
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (name: string) => {
    setUninstallingName(name);
    try {
      const res = await api.uninstallPackage(name);
      notifications.show({
        title: 'Package Uninstalled',
        message: res.message || `Removed ${name}`,
        color: 'teal'
      });
      loadPackages();
    } catch (err: any) {
      notifications.show({
        title: 'Uninstall Failed',
        message: err.message,
        color: 'red'
      });
    } finally {
      setUninstallingName(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={
        <Group gap="xs">
          <IconPackage size={20} color="#10e57a" />
          <Text fw={700} size="md">NPM Packages & Custom Modules</Text>
        </Group>
      }
      styles={{
        header: {
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          padding: '16px 20px'
        },
        body: {
          backgroundColor: '#131315',
          padding: 20
        }
      }}
    >
      <Stack gap="lg">
        {/* Install Input Form */}
        <Box>
          <Text size="xs" fw={700} c="dimmed" mb={6}>
            Install NPM Package
          </Text>
          <Group gap="xs">
            <TextInput
              placeholder="e.g. axios, dayjs, lodash, nanoid"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInstall();
              }}
              style={{ flex: 1 }}
              styles={{
                input: {
                  backgroundColor: '#1c1c20',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px'
                }
              }}
            />
            <Button
              leftSection={<IconDownload size={14} />}
              onClick={() => handleInstall()}
              loading={installing}
              disabled={!packageName.trim()}
              style={{
                backgroundColor: '#10e57a',
                color: '#052e16',
                fontWeight: 700
              }}
            >
              Install
            </Button>
          </Group>

          {/* Popular Suggestions */}
          <Group gap={6} mt="xs">
            <Text size="11px" c="dimmed">Popular:</Text>
            {popularPackages.map((pkg) => {
              const isInstalled = packages.some((p) => p.name === pkg);
              return (
                <Badge
                  key={pkg}
                  size="xs"
                  variant={isInstalled ? 'filled' : 'outline'}
                  color={isInstalled ? 'teal' : 'gray'}
                  style={{ cursor: isInstalled ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (!isInstalled) handleInstall(pkg);
                  }}
                >
                  {pkg} {isInstalled ? '' : '+'}
                </Badge>
              );
            })}
          </Group>
        </Box>

        {/* Installed Packages Table */}
        <Box>
          <Group justify="space-between" align="center" mb={6}>
            <Text size="xs" fw={700} c="dimmed">
              Installed Dependencies ({packages.length})
            </Text>
            <ActionIcon variant="subtle" size="xs" color="gray" onClick={loadPackages} loading={loading}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Group>

          <ScrollArea style={{ maxHeight: 200 }} scrollbarSize={4}>
            <Table highlightOnHover style={{ backgroundColor: '#18181b', borderRadius: 6, fontSize: '13px' }}>
              <Table.Thead style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Table.Tr>
                  <Table.Th>Package Name</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th style={{ width: 60, textAlign: 'right' }}>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {packages.map((pkg) => (
                  <Table.Tr key={pkg.name} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <Table.Td>
                      <Text size="xs" fw={600} style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                        {pkg.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="subtle" color="gray">
                        {pkg.version}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Tooltip label="Uninstall package" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="xs"
                          loading={uninstallingName === pkg.name}
                          onClick={() => handleUninstall(pkg.name)}
                        >
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}

                {packages.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3} style={{ textAlign: 'center', padding: '24px 0' }}>
                      <Text size="xs" c="dimmed">No custom npm packages installed yet.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        {/* Usage Guide Box */}
        <Box p="md" style={{ backgroundColor: '#18181b', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Group gap={6} mb="xs">
            <IconCode size={16} color="#38bdf8" />
            <Text size="xs" fw={700} c="white">How to import in your hooks</Text>
          </Group>
          <Code block style={{ backgroundColor: '#121214', color: '#38bdf8', padding: 10, borderRadius: 6, fontSize: '11.5px' }}>
{`// 1. Import installed npm packages:
const axios = require('axios');
const dayjs = require('dayjs');
const _ = require('lodash');

// 2. Import helper files in _hooks/ (e.g. _hooks/utils.js):
const { sendAlert, calculateTotal } = require('./utils.js');

// In _hooks/utils.js:
// module.exports = { sendAlert, calculateTotal };`}
          </Code>
        </Box>
      </Stack>
    </Modal>
  );
};
