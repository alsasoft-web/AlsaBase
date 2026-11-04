import React, { useState } from "react";
import {
  Title,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  SegmentedControl,
  Box,
  Paper,
  SimpleGrid,
  Code,
  ScrollArea,
} from "@mantine/core";
import {
  IconRocket,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconCode,
  IconDownload,
  IconUpload,
  IconTerminal2,
  IconKey,
  IconDeviceDesktop,
  IconLock,
  IconBrandPython,
  IconBrandRust,
  IconBrandCSharp,
  IconBrandJavascript,
} from "@tabler/icons-react";
import { copyToClipboard } from "../../../utils/clipboard";
import { getDocModules, getModuleSnippet } from "./appDocsSnippets";
import { AppItem } from "../../../api/client";

interface AppDocsPanelProps {
  selectedApp: AppItem;
  docLanguage: string;
  setDocLanguage: (lang: string) => void;
  isMobile: boolean;
  onOpenSimulator: () => void;
}

export const AppDocsPanel: React.FC<AppDocsPanelProps> = ({
  selectedApp,
  docLanguage,
  setDocLanguage,
  isMobile,
  onOpenSimulator,
}) => {
  const [docActiveModule, setDocActiveModule] = useState<string>("updates");
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  const copySnippet = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const modules = getDocModules(selectedApp.slug, window.location.origin);
  const activeModules = modules.filter((m) => docActiveModule === "all" || m.id === docActiveModule);

  return (
    <Stack gap="xl" style={{ maxWidth: 1100, width: "100%", margin: "0 auto" }}>
      {/* Top Lifecycle & Simulator Card */}
      <Paper
        p={isMobile ? "md" : "lg"}
        radius="md"
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Box style={{ flex: 1, minWidth: 260 }}>
            <Group gap="xs" mb={4}>
              <IconRocket size={22} color="var(--color-neon-primary, #10e57a)" />
              <Title order={4} fw={700}>
                Client Integration &amp; API Documentation
              </Title>
            </Group>
            <Text size="xs" c="dimmed">
              Modular integration guides for <Code>{selectedApp.name}</Code> (<Code>{selectedApp.slug}</Code>). Pick only the features your app requires, or use raw REST HTTP without the SDK.
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" variant="outline" color="gray">
                Origin: {window.location.origin}
              </Badge>
              <Badge size="xs" variant="outline" color="teal">
                App Slug: {selectedApp.slug}
              </Badge>
            </Group>
          </Box>
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconPlayerPlay size={14} />}
            onClick={onOpenSimulator}
          >
            Open Live Test Simulator
          </Button>
        </Group>
      </Paper>

      {/* Language Selector Bar */}
      <Box>
        <Text size="xs" fw={700} c="dimmed" mb={6} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
          1. Select Client Language:
        </Text>
        <Box style={{ overflowX: "auto", maxWidth: "100%", paddingBottom: 4 }}>
          <SegmentedControl
            value={docLanguage}
            onChange={(val) => setDocLanguage(val)}
            style={{ minWidth: "max-content" }}
            data={[
              {
                value: "csharp",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconBrandCSharp size={15} color="#9d7cd8" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>C# (.NET / WPF)</Text>
                  </Group>
                ),
              },
              {
                value: "rust",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconBrandRust size={15} color="#ff9e64" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Rust (Tauri)</Text>
                  </Group>
                ),
              },
              {
                value: "python",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconBrandPython size={15} color="#7aa2f7" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Python</Text>
                  </Group>
                ),
              },
              {
                value: "fetch",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconCode size={15} color="#2ac3de" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>JS (Fetch)</Text>
                  </Group>
                ),
              },
              {
                value: "endpoints",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconTerminal2 size={15} color="#73daca" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>cURL / REST HTTP</Text>
                  </Group>
                ),
              },
              {
                value: "sdk",
                label: (
                  <Group gap={6} justify="center" wrap="nowrap">
                    <IconBrandJavascript size={15} color="#e0af68" style={{ flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>TypeScript SDK</Text>
                  </Group>
                ),
              },
            ]}
          />
        </Box>
      </Box>

      {/* Feature Module Selector */}
      <Box>
        <Text size="xs" fw={700} c="dimmed" mb={6} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
          2. Choose Feature Module to Copy:
        </Text>
        <Box style={{ overflowX: "auto", maxWidth: "100%", paddingBottom: 4 }}>
          <SegmentedControl
            value={docActiveModule}
            onChange={(val) => setDocActiveModule(val)}
            style={{ minWidth: "max-content" }}
            data={[
              {
                value: "updates",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconDownload size={14} color="#3b82f6" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>App Updates</Text>
                  </Group>
                ),
              },
              {
                value: "publish",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconUpload size={14} color="#a855f7" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Upload New Version</Text>
                  </Group>
                ),
              },
              {
                value: "gatekeeper",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconDeviceDesktop size={14} color="#10e57a" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>HWID Gatekeeper</Text>
                  </Group>
                ),
              },
              {
                value: "licenses",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconKey size={14} color="#a855f7" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Serial Licenses</Text>
                  </Group>
                ),
              },
              {
                value: "auth",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconLock size={14} color="#f59e0b" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Auth without SDK</Text>
                  </Group>
                ),
              },
              {
                value: "logs",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconTerminal2 size={14} color="#06b6d4" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Send Logs &amp; Crashes</Text>
                  </Group>
                ),
              },
              {
                value: "lifecycle",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconRocket size={14} color="#ec4899" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>Full Lifecycle</Text>
                  </Group>
                ),
              },
              {
                value: "all",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconCode size={14} color="#64748b" />
                    <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>View All</Text>
                  </Group>
                ),
              },
            ]}
          />
        </Box>
      </Box>

      {/* Modules Content List */}
      {activeModules.map((mod) => {
        const snippet = getModuleSnippet(mod.id, docLanguage, selectedApp.slug, window.location.origin);
        const isCopied = copiedSnippetId === mod.id;

        return (
          <Paper
            key={mod.id}
            p={isMobile ? "md" : "lg"}
            radius="md"
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Module Header */}
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md" mb="md">
              <Box style={{ flex: 1, minWidth: 260 }}>
                <Group gap="xs" mb={4}>
                  <Badge color={mod.badgeColor} variant="filled" size="sm">
                    {mod.badge}
                  </Badge>
                  <Title order={4} fw={700}>
                    {mod.title}
                  </Title>
                </Group>
                <Text size="xs" c="dimmed">
                  {mod.description}
                </Text>
              </Box>
              <Button
                size="xs"
                variant={isCopied ? "filled" : "light"}
                color={isCopied ? "teal" : "blue"}
                leftSection={isCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                onClick={() => copySnippet(snippet, mod.id)}
              >
                {isCopied ? "Copied to Clipboard" : `Copy ${docLanguage.toUpperCase()} Code`}
              </Button>
            </Group>

            {/* Endpoints & Request/Response Specification (if any) */}
            {mod.endpoints.length > 0 && (
              <Box mb="md">
                <Text size="xs" fw={700} c="dimmed" mb={8} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  REST HTTP Endpoints &amp; Payloads:
                </Text>
                <Stack gap="sm">
                  {mod.endpoints.map((ep, idx) => (
                    <Paper
                      key={idx}
                      p="sm"
                      radius="md"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="wrap" mb={6}>
                        <Group gap="xs">
                          <Badge color={ep.method === "POST" ? "teal" : "blue"} variant="filled" size="sm">
                            {ep.method}
                          </Badge>
                          <Text size="xs" fw={700} style={{ fontFamily: "var(--font-mono)" }}>
                            {ep.path}
                          </Text>
                        </Group>
                        <Badge
                          color={ep.auth.includes("Admin") ? "orange" : ep.auth.includes("User") ? "violet" : "gray"}
                          variant="light"
                          size="xs"
                        >
                          {ep.auth}
                        </Badge>
                      </Group>

                      <Text size="11px" c="dimmed" mb="xs">
                        {ep.description}
                      </Text>

                      {/* Parameters / Body Details */}
                      {ep.params && ep.params.length > 0 && (
                        <Box mb="xs">
                          <Text size="10px" fw={700} c="dimmed" mb={4}>
                            QUERY PARAMETERS:
                          </Text>
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                            {ep.params.map((p, pIdx) => (
                              <Paper
                                key={pIdx}
                                p={6}
                                radius="xs"
                                style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}
                              >
                                <Group justify="space-between" mb={2}>
                                  <Code style={{ fontSize: "10px" }}>{p.name}</Code>
                                  <Badge size="xs" variant="dot" color={p.required ? "red" : "gray"}>
                                    {p.required ? "Required" : "Optional"}
                                  </Badge>
                                </Group>
                                <Text size="10px" c="dimmed">
                                  {p.desc}
                                </Text>
                              </Paper>
                            ))}
                          </SimpleGrid>
                        </Box>
                      )}

                      {ep.requestBody && (
                        <Box mb="xs">
                          <Text size="10px" fw={700} c="dimmed" mb={4}>
                            JSON REQUEST BODY:
                          </Text>
                          <Code block style={{ fontSize: "11px", padding: 8, borderRadius: 4, whiteSpace: "pre" }}>
                            {ep.requestBody}
                          </Code>
                        </Box>
                      )}

                      {/* Success & Error Responses */}
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mt="xs">
                        <Box>
                          <Text size="10px" fw={700} c="teal" mb={4}>
                            SUCCESS RESPONSE (200 OK):
                          </Text>
                          <Code
                            block
                            style={{
                              fontSize: "11px",
                              padding: 8,
                              borderRadius: 4,
                              whiteSpace: "pre",
                              maxHeight: 180,
                              overflow: "auto",
                            }}
                          >
                            {ep.successResponse}
                          </Code>
                        </Box>
                        <Box>
                          <Text size="10px" fw={700} c="red" mb={4}>
                            ERROR RESPONSE (4xx):
                          </Text>
                          <Code
                            block
                            style={{
                              fontSize: "11px",
                              padding: 8,
                              borderRadius: 4,
                              whiteSpace: "pre",
                              maxHeight: 180,
                              overflow: "auto",
                            }}
                          >
                            {ep.errorResponse}
                          </Code>
                        </Box>
                      </SimpleGrid>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Code Implementation */}
            <Box mt="md">
              <Group justify="space-between" align="center" mb={6}>
                <Group gap="xs">
                  <IconCode size={14} color="var(--color-neon-primary, #10e57a)" />
                  <Text size="xs" fw={700} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {docLanguage.toUpperCase()} Implementation:
                  </Text>
                </Group>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color={isCopied ? "teal" : "gray"}
                  leftSection={isCopied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  onClick={() => copySnippet(snippet, mod.id)}
                >
                  {isCopied ? "Copied" : "Copy Code"}
                </Button>
              </Group>

              <ScrollArea
                h={isMobile ? 360 : 460}
                type="auto"
                offsetScrollbars
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  backgroundColor: "rgba(0,0,0,0.45)",
                }}
              >
                <Code
                  block
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.6,
                    padding: 16,
                    backgroundColor: "transparent",
                    border: "none",
                    fontFamily: "var(--font-mono, Consolas, Monaco, monospace)",
                    whiteSpace: "pre",
                    overflow: "visible",
                    minWidth: "100%",
                  }}
                >
                  {snippet}
                </Code>
              </ScrollArea>
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
};
