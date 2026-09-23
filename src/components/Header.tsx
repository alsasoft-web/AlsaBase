import React from "react";
import {
  Group,
  Title,
  Badge,
  ActionIcon,
  Text,
  Box,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconLogout,
  IconUser,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { Logo } from "./Logo";
import { navItems } from "./Sidebar";

interface HeaderProps {
  user: any;
  health: any;
  onLogout: () => void;
  navType?: "sidebar" | "header";
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  navType = "sidebar",
  activeTab,
  onSelectTab,
}) => {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
      {/* Brand & Engine Identifier */}
      <Group gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, rgba(16, 229, 122, 0.2) 0%, rgba(16, 229, 122, 0.05) 100%)",
              border: "1px solid rgba(16, 229, 122, 0.3)",
              boxShadow: "0 0 16px rgba(16, 229, 122, 0.2)",
              overflow: "hidden",
              padding: 6,
            }}
          >
            <Logo size={24} />
          </Box>

          <Group gap="xs" wrap="nowrap">
            <Title
              order={3}
              style={{
                color: "var(--color-text-primary)",
                fontWeight: 800,
                fontSize: "1.25rem",
                letterSpacing: "-0.03em",
              }}
            >
              Alsa
              <Text span style={{ color: "var(--color-neon-primary)" }}>
                Base
              </Text>
            </Title>
            <Badge
              variant="filled"
              size="xs"
              style={{
                backgroundColor: "var(--color-neon-dim)",
                color: "var(--color-neon-primary)",
                border: "1px solid var(--color-border-glow)",
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
              }}
            >
              v{__APP_VERSION__}
            </Badge>
          </Group>
        </Group>

        {/* Top Header Navigation Tabs when navType === 'header' */}
        {navType === "header" && onSelectTab && (
          <Group gap={6} ml="lg" wrap="nowrap">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <UnstyledButton
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  px="sm"
                  py={6}
                  style={{
                    borderRadius: 6,
                    backgroundColor: isActive
                      ? "var(--color-neon-dim)"
                      : "transparent",
                    color: isActive
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-dimmed)",
                    border: isActive
                      ? "1px solid var(--color-border-glow)"
                      : "1px solid transparent",
                    transition: "all 0.15s ease",
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-card-hover)";
                      e.currentTarget.style.color = "var(--color-text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--color-text-dimmed)";
                    }
                  }}
                >
                  <Group gap={6} wrap="nowrap">
                    <Box
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isActive
                          ? "var(--color-neon-primary)"
                          : "var(--color-text-dimmed)",
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Text size="xs" fw={isActive ? 600 : 500}>
                      {item.label}
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Group>
        )}
      </Group>

      {/* Engine Status & Session Controls */}
      <Group gap="md" wrap="nowrap">
        {/* Theme Toggle Button */}
        <Tooltip
          label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          withArrow
          position="bottom"
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={toggleTheme}
            style={{
              backgroundColor: "var(--color-bg-card-hover)",
              border: "1px solid var(--color-border)",
              color: isDark ? "#fbbf24" : "#0284c7",
              transition: "all 0.15s ease",
            }}
          >
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Tooltip>

        <Group
          gap="xs"
          px="sm"
          py={5}
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
          }}
        >
          <IconUser size={15} color="var(--color-text-dimmed)" />
          <Text
            size="xs"
            fw={500}
            style={{ color: "var(--color-text-secondary)", maxWidth: 180 }}
            truncate
          >
            {user?.email || user?.username}
          </Text>
        </Group>

        <Tooltip label="Logout" withArrow position="bottom">
          <ActionIcon
            variant="subtle"
            color="red"
            size="lg"
            radius="md"
            onClick={onLogout}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              transition: "all 0.15s ease",
            }}
          >
            <IconLogout size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
};
