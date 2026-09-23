import React, { useState } from "react";
import {
  Box,
  Container,
  Paper,
  Title,
  Text,
  Alert,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconShieldLock,
  IconArrowRight,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { api } from "../../api/client";
import { Logo } from "../Logo";

interface AuthViewProps {
  hasSuperuser?: boolean | null;
  onAuthSuccess: (user: any) => void;
  onSetupSuccess?: (user: any) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  hasSuperuser = true,
  onAuthSuccess,
  onSetupSuccess,
}) => {
  const isFirstRun = hasSuperuser === false;
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Setup State
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await api.loginSuperuser(loginEmail, loginPassword);
      onAuthSuccess(res.user);
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError("");

    if (setupPassword !== setupPasswordConfirm) {
      setSetupError("Passwords do not match");
      setSetupLoading(false);
      return;
    }

    if (setupPassword.length < 8) {
      setSetupError("Password must be at least 8 characters");
      setSetupLoading(false);
      return;
    }

    try {
      const res = await api.setupInitialSuperuser(setupEmail, setupPassword);
      if (onSetupSuccess) {
        onSetupSuccess(res.user);
      } else {
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setSetupError(err.message || "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
      }}
    >
      {/* Top right theme toggle */}
      <Box style={{ position: "absolute", top: 20, right: 20 }}>
        <Tooltip
          label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          withArrow
          position="left"
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={() => setColorScheme(isDark ? "light" : "dark")}
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              color: isDark ? "#fbbf24" : "#0284c7",
              transition: "all 0.15s ease",
            }}
          >
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Tooltip>
      </Box>

      <Container size={440} w="100%">
        <Paper
          radius="lg"
          p="xl"
          withBorder
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            boxShadow: isDark
              ? "0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px -10px rgba(16, 229, 122, 0.15)"
              : "0 20px 35px -10px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Brand Header */}
          <Stack align="center" gap="xs" mb="lg">
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(16, 229, 122, 0.25) 0%, rgba(16, 229, 122, 0.05) 100%)",
                border: "1px solid rgba(16, 229, 122, 0.35)",
                boxShadow: "0 0 20px rgba(16, 229, 122, 0.25)",
                overflow: "hidden",
                padding: 8,
              }}
            >
              <Logo size={36} />
            </Box>
            <Title
              order={2}
              style={{
                color: "var(--color-text-primary)",
                fontWeight: 800,
                fontSize: "1.6rem",
                letterSpacing: "-0.03em",
              }}
            >
              Alsa
              <Text span style={{ color: "var(--color-neon-primary)" }}>
                Base
              </Text>
            </Title>
            <Text
              size="xs"
              ta="center"
              style={{
                letterSpacing: "0.01em",
                color: "var(--color-text-dimmed)",
              }}
            >
              {isFirstRun
                ? "Create initial Superuser Administrator account"
                : "Backend-as-a-Service Engine for Node.js"}
            </Text>
          </Stack>

          {isFirstRun ? (
            <>
              {setupError && (
                <Alert
                  icon={<IconAlertTriangle size={16} />}
                  title="Setup Error"
                  color="red"
                  mb="md"
                  radius="md"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {setupError}
                </Alert>
              )}

              <form onSubmit={handleSetup}>
                <Stack gap="md">
                  <TextInput
                    label="Admin Email"
                    placeholder="admin@yourdomain.com"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    required
                  />
                  <PasswordInput
                    label="Password"
                    description="Minimum 8 characters"
                    placeholder="Choose a strong password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    required
                  />
                  <PasswordInput
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    value={setupPasswordConfirm}
                    onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    fullWidth
                    loading={setupLoading}
                    size="md"
                    mt="xs"
                    rightSection={<IconArrowRight size={16} />}
                    style={{
                      backgroundColor: "#10e57a",
                      color: "#052e16",
                      fontWeight: 700,
                      boxShadow: "0 0 15px rgba(16, 229, 122, 0.35)",
                    }}
                  >
                    Create Superuser & Launch
                  </Button>
                </Stack>
              </form>
            </>
          ) : (
            <>
              {loginError && (
                <Alert
                  icon={<IconAlertTriangle size={16} />}
                  title="Authentication Error"
                  color="red"
                  mb="md"
                  radius="md"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {loginError}
                </Alert>
              )}

              <form onSubmit={handleLogin}>
                <Stack gap="md">
                  <TextInput
                    label="Superuser Email"
                    placeholder="admin@yourdomain.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  <PasswordInput
                    label="Superuser Password"
                    placeholder="Your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    fullWidth
                    loading={loginLoading}
                    size="md"
                    mt="xs"
                    rightSection={<IconShieldLock size={16} />}
                    style={{
                      backgroundColor: "#10e57a",
                      color: "#052e16",
                      fontWeight: 700,
                      boxShadow: "0 0 15px rgba(16, 229, 122, 0.35)",
                    }}
                  >
                    Login to Dashboard
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};
