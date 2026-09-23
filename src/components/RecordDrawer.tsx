import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Group,
  Text,
  ActionIcon,
  Stack,
  Button,
  TextInput,
  Switch,
  NumberInput,
  Textarea,
  Select,
  Tooltip,
  FileInput,
  Badge,
  Paper,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconX,
  IconKey,
  IconMail,
  IconInfoCircle,
  IconTrash,
  IconPhoto,
  IconUpload,
  IconLetterT,
  IconHash,
  IconToggleLeft,
  IconCode,
  IconCalendar,
  IconClock,
  IconLink,
  IconListCheck,
  IconEdit,
  IconPlus,
  IconLock,
  IconShieldCheck,
  IconCheck
} from '@tabler/icons-react';
import { CollectionDef, FieldDef, FieldType } from '../api/client';

interface RecordDrawerProps {
  opened: boolean;
  onClose: () => void;
  collection: CollectionDef | null;
  record: any | null;
  onSave: (data: Record<string, any>) => Promise<void>;
  onDelete?: (id: string) => void;
}

function getFieldIcon(type: FieldType) {
  switch (type) {
    case 'text':
      return <IconLetterT size={15} color="#38bdf8" />;
    case 'number':
      return <IconHash size={15} color="#fbbf24" />;
    case 'bool':
      return <IconToggleLeft size={15} color="#4ade80" />;
    case 'json':
      return <IconCode size={15} color="#f472b6" />;
    case 'file':
      return <IconPhoto size={15} color="#fb923c" />;
    case 'date':
      return <IconCalendar size={15} color="#a855f7" />;
    case 'autodate':
      return <IconClock size={15} color="#ec4899" />;
    case 'email':
      return <IconMail size={15} color="#06b6d4" />;
    case 'url':
      return <IconLink size={15} color="#3b82f6" />;
    case 'select':
      return <IconListCheck size={15} color="#14b8a6" />;
    default:
      return <IconLetterT size={15} color="#94a3b8" />;
  }
}

export const RecordDrawer: React.FC<RecordDrawerProps> = ({
  opened,
  onClose,
  collection,
  record,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const isAuth = collection?.type === 'auth' || collection?.name === 'users';
  const isEditing = Boolean(record?.id);

  useEffect(() => {
    if (record) {
      const data = { ...record };
      setFormData(data);
    } else {
      const initial: Record<string, any> = {};
      if (isAuth) {
        initial.email = '';
        initial.emailVisibility = false;
        initial.verified = false;
        initial.name = '';
        initial.avatar = '';
      }
      const fieldsList: FieldDef[] = Array.isArray(collection?.fields)
        ? collection.fields
        : typeof (collection?.fields as any) === 'string'
        ? (() => {
            try {
              return JSON.parse(collection?.fields as any);
            } catch {
              return [];
            }
          })()
        : [];

      fieldsList.forEach((f: FieldDef) => {
        if (f.type === 'bool') initial[f.name] = false;
        else if (f.type === 'number') initial[f.name] = 0;
        else if (f.type === 'file') initial[f.name] = '';
        else initial[f.name] = '';
      });
      setFormData(initial);
    }
    setChangePassword(false);
    setNewPassword('');
    setPasswordConfirm('');
  }, [record, collection, opened]);

  if (!collection) return null;

  const handleFileUpload = (fieldName: string, file: File | null) => {
    if (!file) {
      setFormData((prev) => ({ ...prev, [fieldName]: '' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: {
          name: file.name,
          size: file.size,
          type: file.type,
          data: reader.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (fieldName: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...formData };
      if (!isEditing && isAuth) {
        if (!newPassword || newPassword.length < 6) {
          notifications.show({
            title: 'Validation Error',
            message: 'Password must be at least 6 characters',
            color: 'red'
          });
          return;
        }
        if (newPassword !== passwordConfirm) {
          notifications.show({
            title: 'Validation Error',
            message: 'Passwords do not match',
            color: 'red'
          });
          return;
        }
        payload.password = newPassword;
        payload.passwordConfirm = passwordConfirm;
      } else if (isEditing && changePassword && newPassword) {
        if (newPassword.length < 6) {
          notifications.show({
            title: 'Validation Error',
            message: 'Password must be at least 6 characters',
            color: 'red'
          });
          return;
        }
        if (newPassword !== passwordConfirm) {
          notifications.show({
            title: 'Validation Error',
            message: 'Passwords do not match',
            color: 'red'
          });
          return;
        }
        payload.password = newPassword;
        payload.passwordConfirm = passwordConfirm;
      }
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fieldsList: FieldDef[] = Array.isArray(collection.fields)
    ? collection.fields
    : typeof (collection.fields as any) === 'string'
    ? (() => {
        try {
          return JSON.parse(collection.fields as any);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="620px"
      withCloseButton={false}
      styles={{
        content: {
          backgroundColor: 'var(--color-bg-base)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.4)'
        },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          backgroundColor: 'var(--color-bg-base)'
        }
      }}
    >
      {/* Drawer Header */}
      <Box
        px="lg"
        py="md"
        style={{
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Group gap="sm" align="center">
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'var(--color-neon-dim)',
              border: '1px solid var(--color-border-glow)'
            }}
          >
            {isEditing ? (
              <IconEdit size={16} color="var(--color-neon-primary)" />
            ) : (
              <IconPlus size={16} color="var(--color-neon-primary)" />
            )}
          </Box>
          <div>
            <Group gap="xs" align="center">
              <Text fw={700} size="sm" c="var(--color-text-primary)">
                {isEditing ? `Edit Record` : `New Record`}
              </Text>
              <Badge
                size="xs"
                variant="filled"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-neon-primary)',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600
                }}
              >
                {collection.name}
              </Badge>
            </Group>
            {isEditing && (
              <Text size="xs" c="var(--color-text-dimmed)" style={{ fontFamily: 'var(--font-mono)' }}>
                ID: {record?.id}
              </Text>
            )}
          </div>
        </Group>

        <Group gap="xs">
          {isEditing && onDelete && (
            <Tooltip label="Delete Record" withArrow>
              <ActionIcon
                variant="subtle"
                color="red"
                size="md"
                radius="md"
                onClick={() => onDelete(record.id)}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Close (Esc)" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              onClick={onClose}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)'
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      {/* Main Scrollable Form Body */}
      <Box style={{ flex: 1, overflowY: 'auto' }} p="lg">
        <Stack gap="md">
          {/* Record ID Box (Editing) */}
          {isEditing && (
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)'
              }}
            >
              <Group justify="space-between" align="center" mb={6}>
                <Group gap={6}>
                  <IconKey size={14} color="var(--color-text-dimmed)" />
                  <Text size="xs" fw={700} c="var(--color-text-dimmed)" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Record ID
                  </Text>
                </Group>
                <Badge size="xs" variant="outline" color="gray">System</Badge>
              </Group>
              <Text
                size="sm"
                fw={600}
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-primary)'
                }}
              >
                {record.id}
              </Text>
            </Paper>
          )}

          {/* Auth Collection Fields: Email, Password & Verification */}
          {isAuth && (
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)'
              }}
            >
              <Group justify="space-between" align="center" mb="sm">
                <Group gap={6}>
                  <IconShieldCheck size={16} color="var(--color-neon-primary)" />
                  <Text size="xs" fw={700} c="var(--color-text-primary)" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Authentication Credentials
                  </Text>
                </Group>
                <Badge size="xs" variant="filled" style={{ backgroundColor: 'var(--color-neon-dim)', color: 'var(--color-neon-primary)' }}>
                  Auth
                </Badge>
              </Group>

              <Stack gap="sm">
                {/* Email Field */}
                <div>
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="xs" fw={600} c="var(--color-text-secondary)">
                      Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </Text>
                    <Group
                      gap={4}
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          emailVisibility: !prev.emailVisibility
                        }))
                      }
                    >
                      <Badge
                        size="xs"
                        variant="outline"
                        color={formData.emailVisibility ? 'green' : 'gray'}
                        style={{ cursor: 'pointer' }}
                      >
                        Public: {formData.emailVisibility ? 'On' : 'Off'}
                      </Badge>
                    </Group>
                  </Group>
                  <TextInput
                    value={formData.email || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, email: val }));
                    }}
                    placeholder="user@example.com"
                    size="sm"
                    styles={{
                      input: {
                        backgroundColor: 'var(--color-bg-well)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)'
                      }
                    }}
                  />
                </div>

                <Divider my={4} style={{ borderColor: 'var(--color-border)' }} />

                {/* Password Fields */}
                {isEditing ? (
                  <>
                    <Group justify="space-between" align="center">
                      <Group gap={6}>
                        <IconLock size={14} color="var(--color-text-dimmed)" />
                        <Text size="xs" fw={600} c="var(--color-text-secondary)">
                          Change Password
                        </Text>
                      </Group>
                      <Switch
                        checked={changePassword}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setChangePassword(checked);
                        }}
                        size="sm"
                        color="neonGreen"
                      />
                    </Group>

                    {changePassword && (
                      <Stack gap="xs" pt="xs">
                        <TextInput
                          label="New Password *"
                          type="password"
                          placeholder="Min 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          size="sm"
                          required
                          styles={{
                            input: {
                              backgroundColor: 'var(--color-bg-well)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)'
                            }
                          }}
                        />
                        <TextInput
                          label="Confirm New Password *"
                          type="password"
                          placeholder="Repeat new password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          size="sm"
                          required
                          styles={{
                            input: {
                              backgroundColor: 'var(--color-bg-well)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)'
                            }
                          }}
                        />
                      </Stack>
                    )}
                  </>
                ) : (
                  <Stack gap="xs">
                    <TextInput
                      label="Password *"
                      type="password"
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      size="sm"
                      required
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }
                      }}
                    />
                    <TextInput
                      label="Confirm Password *"
                      type="password"
                      placeholder="Repeat password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      size="sm"
                      required
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }
                      }}
                    />
                  </Stack>
                )}

                <Divider my={4} style={{ borderColor: 'var(--color-border)' }} />

                {/* Verified Switch */}
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="xs" fw={600} c="var(--color-text-secondary)">
                      Verified Status
                    </Text>
                    <Text size="xs" c="var(--color-text-dimmed)">
                      Mark user account as verified
                    </Text>
                  </div>
                  <Switch
                    checked={Boolean(formData.verified)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setFormData((prev) => ({
                        ...prev,
                        verified: checked
                      }));
                    }}
                    size="sm"
                    color="neonGreen"
                  />
                </Group>
              </Stack>
            </Paper>
          )}

          {/* Custom Collection Fields */}
          {fieldsList
            .filter(
              (f: FieldDef) =>
                !['id', 'created', 'updated', 'created_at', 'updated_at', 'tokenKey', 'password'].includes(
                  f.name
                ) && (!isAuth || !['email', 'emailVisibility', 'verified'].includes(f.name))
            )
            .map((field: FieldDef) => {
              const isFile = field.type === 'file' || field.name === 'avatar';
              const val = formData[field.name];

              return (
                <Paper
                  key={field.name}
                  p="md"
                  radius="md"
                  withBorder
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="xs">
                    <Group gap={6}>
                      {getFieldIcon(field.type)}
                      <Text size="xs" fw={700} c="var(--color-text-primary)">
                        {field.name} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" variant="outline" color="gray" style={{ textTransform: 'lowercase', fontFamily: 'var(--font-mono)' }}>
                        {field.type}
                      </Badge>
                      {field.helpText && (
                        <Tooltip label={field.helpText} withArrow>
                          <ActionIcon variant="transparent" size="xs" color="gray">
                            <IconInfoCircle size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>

                  {isFile ? (
                    <div>
                      {val ? (
                        <Group
                          justify="space-between"
                          align="center"
                          p="xs"
                          style={{
                            backgroundColor: 'var(--color-bg-well)',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)'
                          }}
                        >
                          <Group gap="xs">
                            {(() => {
                              const isImg = typeof val === 'object'
                                ? Boolean(val?.data || (val?.name && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(val.name)))
                                : typeof val === 'string'
                                ? /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(val) || val.startsWith('data:image/') || val.startsWith('http')
                                : false;

                              const previewSrc = typeof val === 'object' && val?.data
                                ? val.data
                                : typeof val === 'string' && val && val !== '[object Object]'
                                ? (val.startsWith('data:') || val.startsWith('http') || val.startsWith('/api/')
                                    ? val
                                    : `/api/files/${encodeURIComponent(collection.name)}/${encodeURIComponent(record?.id || '')}/${encodeURIComponent(val)}`)
                                : '';

                              if (isImg && previewSrc) {
                                return (
                                  <img
                                    src={previewSrc}
                                    alt="preview"
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: field.name === 'avatar' ? '50%' : 6,
                                      objectFit: 'cover',
                                      border: '1px solid var(--color-border-glow)'
                                    }}
                                  />
                                );
                              }

                              return (
                                <Box
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: field.name === 'avatar' ? '50%' : 6,
                                    backgroundColor: 'rgba(16, 229, 122, 0.1)',
                                    border: '1px solid var(--color-border-glow)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--color-neon-primary)'
                                  }}
                                >
                                  <IconPhoto size={18} />
                                </Box>
                              );
                            })()}
                            <div>
                              <Text size="xs" fw={600} c="var(--color-text-primary)" truncate style={{ maxWidth: 300 }}>
                                {typeof val === 'object' ? val.name : String(val)}
                              </Text>
                              {typeof val === 'object' && val.size && (
                                <Text size="10px" c="var(--color-text-dimmed)">
                                  {(val.size / 1024).toFixed(1)} KB
                                </Text>
                              )}
                            </div>
                          </Group>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => handleRemoveFile(field.name)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                      ) : (
                        <FileInput
                          placeholder="Choose file..."
                          leftSection={<IconUpload size={14} color="var(--color-neon-primary)" />}
                          onChange={(file) => handleFileUpload(field.name, file)}
                          size="sm"
                          styles={{
                            input: {
                              backgroundColor: 'var(--color-bg-well)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)'
                            }
                          }}
                        />
                      )}
                    </div>
                  ) : field.type === 'bool' ? (
                    <Group justify="space-between" align="center">
                      <Text size="xs" c="var(--color-text-dimmed)">
                        Enable or disable {field.name}
                      </Text>
                      <Switch
                        checked={Boolean(val)}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setFormData((prev) => ({
                            ...prev,
                            [field.name]: checked
                          }));
                        }}
                        size="sm"
                        color="neonGreen"
                      />
                    </Group>
                  ) : field.type === 'number' ? (
                    <NumberInput
                      value={val ?? ''}
                      onChange={(num) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: num
                        }))
                      }
                      size="sm"
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-mono)'
                        }
                      }}
                    />
                  ) : field.type === 'select' && field.values && field.values.length > 0 ? (
                    <Select
                      data={field.values}
                      value={val || ''}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: v
                        }))
                      }
                      size="sm"
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }
                      }}
                    />
                  ) : field.type === 'json' ? (
                    <Textarea
                      value={typeof val === 'object' ? JSON.stringify(val, null, 2) : val || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: value
                        }));
                      }}
                      rows={4}
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: '#38bdf8'
                        }
                      }}
                    />
                  ) : (
                    <TextInput
                      value={val ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: value
                        }));
                      }}
                      placeholder={`Enter ${field.name}...`}
                      size="sm"
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-well)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }
                      }}
                    />
                  )}
                </Paper>
              );
            })}
        </Stack>
      </Box>

      {/* Drawer Actions Footer */}
      <Box
        px="lg"
        py="md"
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Button
          variant="subtle"
          color="gray"
          onClick={onClose}
          size="sm"
          styles={{
            root: {
              color: 'var(--color-text-secondary)',
              '&:hover': { backgroundColor: 'var(--color-bg-card-hover)' }
            }
          }}
        >
          Cancel
        </Button>

        <Group gap="sm">
          <Button
            onClick={handleSave}
            loading={saving}
            leftSection={<IconCheck size={16} />}
            style={{
              backgroundColor: 'var(--color-neon-primary)',
              color: '#052e16',
              fontWeight: 700,
              boxShadow: '0 0 16px var(--color-neon-glow)',
              border: 'none'
            }}
          >
            {isEditing ? 'Save Changes' : 'Create Record'}
          </Button>
        </Group>
      </Box>
    </Drawer>
  );
};
