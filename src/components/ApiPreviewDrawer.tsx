import React, { useState } from "react";
import {
  Drawer,
  Box,
  Text,
  Group,
  ActionIcon,
  Stack,
  ScrollArea,
  Badge,
  Tabs,
  Tooltip,
} from "@mantine/core";
import { IconX, IconCopy, IconCheck } from "@tabler/icons-react";
import { CollectionDef } from "../api/client";
import { copyToClipboard } from "../utils/clipboard";

interface ApiPreviewDrawerProps {
  opened: boolean;
  onClose: () => void;
  collection: CollectionDef | null;
}

type ApiEndpointKey =
  | "list"
  | "view"
  | "create"
  | "update"
  | "delete"
  | "realtime"
  | "batch"
  | "auth_methods"
  | "auth_password"
  | "auth_oauth2"
  | "auth_otp"
  | "auth_refresh"
  | "verification"
  | "password_reset"
  | "confirm_email_change";

export const ApiPreviewDrawer: React.FC<ApiPreviewDrawerProps> = ({
  opened,
  onClose,
  collection,
}) => {
  const [activeEndpoint, setActiveEndpoint] = useState<ApiEndpointKey>("list");
  const [activeLang, setActiveLang] = useState<string>("js");
  const [copied, setCopied] = useState(false);

  if (!collection) return null;

  const colName = collection.name;
  const isAuth = collection.type === "auth" || colName === "users";
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://127.0.0.1:8090";

  const baseEndpoints: { key: ApiEndpointKey; label: string }[] = [
    { key: "list", label: "List/Search" },
    { key: "view", label: "View" },
    { key: "create", label: "Create" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
    { key: "realtime", label: "Realtime" },
    { key: "batch", label: "Batch" },
  ];

  const authEndpoints: { key: ApiEndpointKey; label: string }[] = [
    { key: "auth_methods", label: "List auth methods" },
    { key: "auth_password", label: "Auth with password" },
    { key: "auth_oauth2", label: "Auth with OAuth2" },
    { key: "auth_otp", label: "Auth with OTP" },
    { key: "auth_refresh", label: "Auth refresh" },
    { key: "verification", label: "Verification" },
    { key: "password_reset", label: "Password reset" },
    { key: "confirm_email_change", label: "Confirm email change" },
  ];

  const getEndpointData = () => {
    switch (activeEndpoint) {
      case "list":
        return {
          title: `List/Search (${colName})`,
          description: `Fetch a paginated ${colName} records list, supporting sorting and filtering.`,
          method: "GET",
          path: `/api/collections/${colName}/records`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// fetch a paginated records list
const resultList = await alsa.collection('${colName}').getList(1, 50, {
    filter: 'created >= "2026-01-01 00:00:00"',
});

// you can also fetch all records at once via getFullList
const records = await alsa.collection('${colName}').getFullList({
    sort: '-created',
});

// or fetch only the first record that matches the specified filter
const record = await alsa.collection('${colName}').getFirstListItem(
    'title != ""',
    { expand: 'relField1,relField2' },
);`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

// fetch a paginated records list
final resultList = await alsa.collection('${colName}').getList(
  page: 1,
  perPage: 50,
  filter: 'created >= "2026-01-01 00:00:00"',
);

// fetch all records at once
final records = await alsa.collection('${colName}').getFullList(
  sort: '-created',
);`,
          curl: `curl -X GET "${baseUrl}/api/collections/${colName}/records?page=1&perPage=50" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
        };

      case "view":
        return {
          title: `View (${colName})`,
          description: `Fetch a single ${colName} record by its unique ID.`,
          method: "GET",
          path: `/api/collections/${colName}/records/RECORD_ID`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const record = await alsa.collection('${colName}').getOne('RECORD_ID', {
    expand: 'relField1,relField2',
});`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final record = await alsa.collection('${colName}').getOne('RECORD_ID');`,
          curl: `curl -X GET "${baseUrl}/api/collections/${colName}/records/RECORD_ID" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
        };

      case "create":
        return {
          title: `Create (${colName})`,
          description: `Create a new ${colName} record. Supports multipart/form-data for file uploads.`,
          method: "POST",
          path: `/api/collections/${colName}/records`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// example create data
const data = {
    "title": "test",
    "description": "example description"
};

const record = await alsa.collection('${colName}').create(data);`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final body = <String, dynamic>{
  "title": "test",
  "description": "example description"
};

final record = await alsa.collection('${colName}').create(body: body);`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/records" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"title": "test"}'`,
        };

      case "update":
        return {
          title: `Update (${colName})`,
          description: `Update an existing ${colName} record by ID.`,
          method: "PATCH",
          path: `/api/collections/${colName}/records/RECORD_ID`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const data = {
    "title": "updated title"
};

const record = await alsa.collection('${colName}').update('RECORD_ID', data);`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final record = await alsa.collection('${colName}').update('RECORD_ID', body: {
  "title": "updated title",
});`,
          curl: `curl -X PATCH "${baseUrl}/api/collections/${colName}/records/RECORD_ID" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"title": "updated title"}'`,
        };

      case "delete":
        return {
          title: `Delete (${colName})`,
          description: `Permanently delete a ${colName} record by ID.`,
          method: "DELETE",
          path: `/api/collections/${colName}/records/RECORD_ID`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

await alsa.collection('${colName}').delete('RECORD_ID');`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

await alsa.collection('${colName}').delete('RECORD_ID');`,
          curl: `curl -X DELETE "${baseUrl}/api/collections/${colName}/records/RECORD_ID" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
        };

      case "realtime":
        return {
          title: `Realtime (${colName})`,
          description: `Subscribe to realtime changes (create, update, delete) on ${colName}.`,
          method: "SSE",
          path: `/api/realtime`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// Subscribe to changes in any record in collection
alsa.collection('${colName}').subscribe('*', function (e) {
    console.log(e.action); // 'create', 'update', or 'delete'
    console.log(e.record);
});

// Subscribe to changes in a single record
alsa.collection('${colName}').subscribe('RECORD_ID', function (e) {
    console.log(e.action, e.record);
});

// Unsubscribe
// alsa.collection('${colName}').unsubscribe('*');`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

alsa.collection('${colName}').subscribe('*', (e) {
  print(e.action);
  print(e.record);
});`,
          curl: `# Server-Sent Events (SSE) stream endpoint:
curl -N "${baseUrl}/api/realtime"`,
        };

      case "batch":
        return {
          title: `Batch (${colName})`,
          description: `Execute multiple create, update, and delete operations in a single transactional batch.`,
          method: "POST",
          path: `/api/batch`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const batch = alsa.createBatch();

batch.collection('${colName}').create({ "title": "record 1" });
batch.collection('${colName}').create({ "title": "record 2" });
batch.collection('${colName}').update('RECORD_ID', { "title": "updated" });
batch.collection('${colName}').delete('RECORD_ID_2');

const results = await batch.send();`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final batch = alsa.createBatch();
batch.collection('${colName}').create(body: { "title": "record 1" });
final results = await batch.send();`,
          curl: `curl -X POST "${baseUrl}/api/batch" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"requests": [...]}'`,
        };

      case "auth_methods":
        return {
          title: `List auth methods (${colName})`,
          description: `Returns all enabled authentication methods (password, OAuth2, OTP, MFA).`,
          method: "GET",
          path: `/api/collections/${colName}/auth-methods`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const authMethods = await alsa.collection('${colName}').listAuthMethods();`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final authMethods = await alsa.collection('${colName}').listAuthMethods();`,
          curl: `curl -X GET "${baseUrl}/api/collections/${colName}/auth-methods"`,
        };

      case "auth_password":
        return {
          title: `Auth with password (${colName})`,
          description: `Authenticate an auth record using email/username and password.`,
          method: "POST",
          path: `/api/collections/${colName}/auth-with-password`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const authData = await alsa.collection('${colName}').authWithPassword(
    'YOUR_EMAIL@example.com',
    'YOUR_PASSWORD',
);

// "authStore" is now saved locally with valid token:
console.log(alsa.authStore.isValid);
console.log(alsa.authStore.token);
console.log(alsa.authStore.record.id);`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final authData = await alsa.collection('${colName}').authWithPassword(
  'YOUR_EMAIL@example.com',
  'YOUR_PASSWORD',
);`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/auth-with-password" \\
  -H "Content-Type: application/json" \\
  -d '{"identity":"YOUR_EMAIL@example.com","password":"YOUR_PASSWORD"}'`,
        };

      case "auth_oauth2":
        return {
          title: `Auth with OAuth2 (${colName})`,
          description: `Authenticate with external OAuth2 providers (Google, GitHub, Discord, Apple, etc.).`,
          method: "POST",
          path: `/api/collections/${colName}/auth-with-oauth2`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// Opens OAuth2 popup in browser
const authData = await alsa.collection('${colName}').authWithOAuth2({ provider: 'google' });`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final authData = await alsa.collection('${colName}').authWithOAuth2('google', (url) {
  // launch url in custom browser tab
});`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/auth-with-oauth2" \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"google","code":"AUTH_CODE","codeVerifier":"VERIFIER","redirectUrl":"REDIRECT_URL"}'`,
        };

      case "auth_otp":
        return {
          title: `Auth with OTP (${colName})`,
          description: `Send and authenticate with one-time password (email OTP).`,
          method: "POST",
          path: `/api/collections/${colName}/auth-with-otp`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// 1. Request OTP
const otpResponse = await alsa.collection('${colName}').requestOTP('YOUR_EMAIL@example.com');

// 2. Authenticate with OTP received via email
const authData = await alsa.collection('${colName}').authWithOTP(otpResponse.otpId, '123456');`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final otpRes = await alsa.collection('${colName}').requestOTP('YOUR_EMAIL@example.com');
final authData = await alsa.collection('${colName}').authWithOTP(otpRes.otpId, '123456');`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/auth-with-otp" \\
  -H "Content-Type: application/json" \\
  -d '{"otpId":"OTP_ID","password":"OTP_CODE"}'`,
        };

      case "auth_refresh":
        return {
          title: `Auth refresh (${colName})`,
          description: `Refresh the current auth record token.`,
          method: "POST",
          path: `/api/collections/${colName}/auth-refresh`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

const authData = await alsa.collection('${colName}').authRefresh();`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

final authData = await alsa.collection('${colName}').authRefresh();`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/auth-refresh" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
        };

      case "verification":
        return {
          title: `Verification (${colName})`,
          description: `Request or confirm email address verification.`,
          method: "POST",
          path: `/api/collections/${colName}/request-verification`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// Request verification email
await alsa.collection('${colName}').requestVerification('YOUR_EMAIL@example.com');

// Confirm verification with token
await alsa.collection('${colName}').confirmVerification('TOKEN');`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

await alsa.collection('${colName}').requestVerification('YOUR_EMAIL@example.com');
await alsa.collection('${colName}').confirmVerification('TOKEN');`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/request-verification" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"YOUR_EMAIL@example.com"}'`,
        };

      case "password_reset":
        return {
          title: `Password reset (${colName})`,
          description: `Request a password reset email or confirm password reset with token.`,
          method: "POST",
          path: `/api/collections/${colName}/request-password-reset`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// Request password reset email
await alsa.collection('${colName}').requestPasswordReset('YOUR_EMAIL@example.com');

// Confirm password reset with token
await alsa.collection('${colName}').confirmPasswordReset(
    'RESET_TOKEN',
    'NEW_PASSWORD',
    'NEW_PASSWORD',
);`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

await alsa.collection('${colName}').requestPasswordReset('YOUR_EMAIL@example.com');
await alsa.collection('${colName}').confirmPasswordReset('TOKEN', 'NEW_PASSWORD', 'NEW_PASSWORD');`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/request-password-reset" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"YOUR_EMAIL@example.com"}'`,
        };

      case "confirm_email_change":
        return {
          title: `Confirm email change (${colName})`,
          description: `Confirm change of email address with token and password.`,
          method: "POST",
          path: `/api/collections/${colName}/confirm-email-change`,
          js: `import AlsaBase from 'alsabase';

const alsa = new AlsaBase('${baseUrl}');

...

// Request email change
await alsa.collection('${colName}').requestEmailChange('NEW_EMAIL@example.com');

// Confirm email change
await alsa.collection('${colName}').confirmEmailChange('TOKEN', 'PASSWORD');`,
          dart: `import 'package:alsabase/alsabase.dart';

final alsa = AlsaBase('${baseUrl}');

...

await alsa.collection('${colName}').requestEmailChange('NEW_EMAIL@example.com');
await alsa.collection('${colName}').confirmEmailChange('TOKEN', 'PASSWORD');`,
          curl: `curl -X POST "${baseUrl}/api/collections/${colName}/confirm-email-change" \\
  -H "Content-Type: application/json" \\
  -d '{"token":"TOKEN","password":"PASSWORD"}'`,
        };

      default:
        return {
          title: `API (${colName})`,
          description: "",
          method: "GET",
          path: `/api/collections/${colName}/records`,
          js: "",
          dart: "",
          curl: "",
        };
    }
  };

  const endpointData = getEndpointData();

  const currentCode =
    activeLang === "js"
      ? endpointData.js
      : activeLang === "dart"
        ? endpointData.dart
        : endpointData.curl;

  const handleCopyCode = async () => {
    await copyToClipboard(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHighlightedCode = (code: string) => {
    // Simple line-based syntax styling
    const lines = code.split("\n");
    return lines.map((line, idx) => {
      let styledLine: React.ReactNode = line;

      if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
        styledLine = (
          <span style={{ color: "#71717a", fontStyle: "italic" }}>{line}</span>
        );
      } else {
        // Highlight keywords
        const parts = line.split(
          /(\b(?:import|from|const|let|var|await|async|final|new|function|return)\b|'[^']*'|"[^"]*")/g,
        );
        styledLine = parts.map((part, pIdx) => {
          if (
            /^(?:import|from|const|let|var|await|async|final|new|function|return)$/.test(
              part,
            )
          ) {
            return (
              <span key={pIdx} style={{ color: "#f43f5e", fontWeight: 600 }}>
                {part}
              </span>
            );
          }
          if (
            (part.startsWith("'") && part.endsWith("'")) ||
            (part.startsWith('"') && part.endsWith('"'))
          ) {
            return (
              <span key={pIdx} style={{ color: "#4ade80" }}>
                {part}
              </span>
            );
          }
          if (part.includes("AlsaBase") || part.includes("alsa.")) {
            return (
              <span key={pIdx} style={{ color: "#c084fc" }}>
                {part}
              </span>
            );
          }
          return (
            <span key={pIdx} style={{ color: "#e4e4e7" }}>
              {part}
            </span>
          );
        });
      }

      return (
        <div key={idx} style={{ lineHeight: "22px" }}>
          {styledLine}
        </div>
      );
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="880px"
      withCloseButton={false}
      styles={{
        content: {
          backgroundColor: "var(--color-bg-base)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.4)",
        },
        body: {
          padding: 0,
          display: "flex",
          height: "100vh",
          backgroundColor: "var(--color-bg-base)",
        },
      }}
    >
      {/* Drawer Left Sidebar Navigation */}
      <Box
        style={{
          width: 220,
          minWidth: 220,
          backgroundColor: "var(--color-bg-surface)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 10px",
        }}
      >
        <Box px="xs" mb="sm">
          <Text
            size="xs"
            fw={700}
            c="var(--color-text-dimmed)"
            style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Endpoints
          </Text>
        </Box>
        <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
          <Stack gap={3}>
            {baseEndpoints.map((ep) => {
              const isActive = activeEndpoint === ep.key;
              return (
                <Box
                  key={ep.key}
                  onClick={() => setActiveEndpoint(ep.key)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    backgroundColor: isActive
                      ? "var(--color-neon-dim)"
                      : "transparent",
                    color: isActive
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-secondary)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13px",
                    border: isActive
                      ? "1px solid var(--color-border-glow)"
                      : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  {ep.label}
                </Box>
              );
            })}

            {isAuth && (
              <>
                <Box
                  my={8}
                  style={{ borderTop: "1px solid var(--color-border)" }}
                />
                <Box px="xs" mb="xs">
                  <Text
                    size="10px"
                    fw={700}
                    c="var(--color-text-dimmed)"
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Auth Endpoints
                  </Text>
                </Box>
                {authEndpoints.map((ep) => {
                  const isActive = activeEndpoint === ep.key;
                  return (
                    <Box
                      key={ep.key}
                      onClick={() => setActiveEndpoint(ep.key)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        backgroundColor: isActive
                          ? "var(--color-neon-dim)"
                          : "transparent",
                        color: isActive
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-secondary)",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "13px",
                        border: isActive
                          ? "1px solid var(--color-border-glow)"
                          : "1px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {ep.label}
                    </Box>
                  );
                })}
              </>
            )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Drawer Right Content Area */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--color-bg-base)",
          padding: "24px 28px",
          overflowY: "auto",
        }}
      >
        {/* Top Header */}
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Group gap="xs" align="center">
              <Text size="lg" fw={700} c="var(--color-text-primary)">
                {endpointData.title}
              </Text>
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
                {colName}
              </Badge>
            </Group>
            <Text size="xs" c="var(--color-text-dimmed)" mt={4}>
              {endpointData.description}
            </Text>
          </div>
          <Tooltip label="Close (Esc)" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              onClick={onClose}
              style={{
                backgroundColor: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Language Tabs & Code Container */}
        <Box mt="xs">
          <Tabs value={activeLang} onChange={(v) => setActiveLang(v || "js")}>
            <Tabs.List
              style={{
                borderBottom: "none",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <Tabs.Tab
                value="js"
                style={{
                  backgroundColor:
                    activeLang === "js"
                      ? "var(--color-bg-card)"
                      : "transparent",
                  color:
                    activeLang === "js"
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-dimmed)",
                  border:
                    activeLang === "js"
                      ? "1px solid var(--color-border)"
                      : "1px solid transparent",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "5px 12px",
                }}
              >
                JS SDK
              </Tabs.Tab>
              <Tabs.Tab
                value="dart"
                style={{
                  backgroundColor:
                    activeLang === "dart"
                      ? "var(--color-bg-card)"
                      : "transparent",
                  color:
                    activeLang === "dart"
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-dimmed)",
                  border:
                    activeLang === "dart"
                      ? "1px solid var(--color-border)"
                      : "1px solid transparent",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "5px 12px",
                }}
              >
                Dart SDK
              </Tabs.Tab>
              <Tabs.Tab
                value="curl"
                style={{
                  backgroundColor:
                    activeLang === "curl"
                      ? "var(--color-bg-card)"
                      : "transparent",
                  color:
                    activeLang === "curl"
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-dimmed)",
                  border:
                    activeLang === "curl"
                      ? "1px solid var(--color-border)"
                      : "1px solid transparent",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "5px 12px",
                }}
              >
                cURL
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {/* Code Container */}
          <Box
            style={{
              backgroundColor: "var(--color-bg-card)",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              padding: "16px 20px",
              position: "relative",
              fontFamily: "var(--font-mono)",
              fontSize: "12.5px",
              minHeight: 280,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            }}
          >
            <Tooltip label={copied ? "Copied!" : "Copy code"} withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleCopyCode}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  backgroundColor: "var(--color-bg-well)",
                  border: "1px solid var(--color-border)",
                  color: copied
                    ? "var(--color-neon-primary)"
                    : "var(--color-text-dimmed)",
                }}
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </ActionIcon>
            </Tooltip>

            <div style={{ overflowX: "auto", whiteSpace: "pre" }}>
              {renderHighlightedCode(currentCode)}
            </div>

            {activeLang === "js" && (
              <Box
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 14,
                }}
              >
                <Text size="xs" c="var(--color-text-dimmed)">
                  AlsaBase Client SDK
                </Text>
              </Box>
            )}
          </Box>
        </Box>

        {/* API Details Section */}
        <Box mt="xl">
          <Text
            size="xs"
            fw={700}
            c="var(--color-text-secondary)"
            mb="xs"
            style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            HTTP Request Details
          </Text>

          <Box
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Badge
              color={
                endpointData.method === "GET"
                  ? "blue"
                  : endpointData.method === "POST"
                    ? "teal"
                    : endpointData.method === "PATCH"
                      ? "yellow"
                      : endpointData.method === "DELETE"
                        ? "red"
                        : "gray"
              }
              variant="filled"
              size="sm"
              style={{ fontWeight: 800, borderRadius: 4 }}
            >
              {endpointData.method}
            </Badge>
            <Text
              size="xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-neon-primary)",
                fontWeight: 600,
              }}
            >
              {endpointData.path}
            </Text>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};
