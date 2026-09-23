import { Component, ErrorInfo, ReactNode } from "react";
import { Box, Paper, Title, Text, Button, Group, Code, Stack } from "@mantine/core";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box p="lg" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
          <Paper
            p="xl"
            radius="md"
            style={{
              backgroundColor: "var(--color-bg-card, #202024)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              maxWidth: 600,
              width: "100%",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
            }}
          >
            <Stack gap="md">
              <Group gap="sm">
                <Box
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    padding: 8,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconAlertTriangle size={24} color="#f87171" />
                </Box>
                <div>
                  <Title order={4} c="white">
                    {this.props.fallbackTitle || "Something went wrong"}
                  </Title>
                  <Text size="xs" c="dimmed">
                    An error occurred while rendering this component.
                  </Text>
                </div>
              </Group>

              {this.state.error && (
                <Code
                  block
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    color: "#fca5a5",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    maxHeight: 180,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error.toString()}
                </Code>
              )}

              <Group justify="flex-end" mt="xs">
                <Button
                  leftSection={<IconRefresh size={15} />}
                  variant="filled"
                  color="red"
                  size="xs"
                  onClick={this.handleReset}
                >
                  Try Again
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
