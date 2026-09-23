import React from "react";
import {
  Stack,
  UnstyledButton,
  Group,
  Text,
  Box,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import {
  IconDatabase,
  IconCode,
  IconTerminal2,
  IconWorld,
  IconSettings,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const navItems: NavItem[] = [
  {
    id: "collections",
    label: "Collections",
    icon: <IconDatabase size={19} />,
  },
  {
    id: "hooks",
    label: "Hooks",
    icon: <IconCode size={19} />,
  },
  {
    id: "logs",
    label: "Logs & Traces",
    icon: <IconTerminal2 size={19} />,
  },
  {
    id: "public",
    label: "Static Hosting",
    icon: <IconWorld size={19} />,
  },
  {
    id: "settings",
    label: "Settings & Backups",
    icon: <IconSettings size={19} />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <Stack
      gap="xs"
      py={4}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Group
          justify={isCollapsed ? "center" : "space-between"}
          px={2}
          mb={8}
          h={36}
          align="center"
          wrap="nowrap"
        >
          {!isCollapsed && (
            <Text
              size="xs"
              fw={700}
              pl={6}
              style={{
                color: "var(--color-text-dimmed)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "10.5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Navigation
            </Text>
          )}
          {onToggleCollapse && (
            <Tooltip
              label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              position="right"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                size={34}
                w={34}
                h={34}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                style={{
                  color: "var(--color-text-dimmed)",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isCollapsed ? (
                  <IconLayoutSidebarLeftExpand size={17} />
                ) : (
                  <IconLayoutSidebarLeftCollapse size={17} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <Stack gap={6}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const buttonContent = (
              <UnstyledButton
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                p={4}
                h={42}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  borderRadius: 8,
                  backgroundColor: isActive
                    ? "var(--color-neon-dim)"
                    : "transparent",
                  color: isActive
                    ? "var(--color-neon-primary)"
                    : "var(--color-text-dimmed)",
                  border: isActive
                    ? "1px solid var(--color-border-glow)"
                    : "1px solid transparent",
                  transition: "background-color 0.15s ease, border-color 0.15s ease",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  overflow: "hidden",
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
                <Box
                  style={{
                    width: 34,
                    minWidth: 34,
                    maxWidth: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive
                      ? "var(--color-neon-primary)"
                      : "var(--color-text-dimmed)",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
                {!isCollapsed && (
                  <Text
                    size="sm"
                    style={{
                      marginLeft: 10,
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.label}
                  </Text>
                )}
              </UnstyledButton>
            );

            if (isCollapsed) {
              return (
                <Tooltip
                  key={item.id}
                  label={item.label}
                  position="right"
                  withArrow
                  offset={12}
                >
                  {buttonContent}
                </Tooltip>
              );
            }

            return buttonContent;
          })}
        </Stack>
      </Box>

      {/* Bottom Toggle Rail when Collapsed */}
      {isCollapsed && onToggleCollapse && (
        <Box pt="xs" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          <Tooltip label="Expand Sidebar" position="right" withArrow offset={12}>
            <ActionIcon
              variant="light"
              color="gray"
              size={36}
              w="100%"
              radius="md"
              onClick={onToggleCollapse}
              style={{
                color: "var(--color-neon-primary)",
                backgroundColor: "var(--color-neon-dim)",
                border: "1px solid var(--color-border-glow)",
                cursor: "pointer",
              }}
            >
              <IconLayoutSidebarLeftExpand size={17} />
            </ActionIcon>
          </Tooltip>
        </Box>
      )}
    </Stack>
  );
};
