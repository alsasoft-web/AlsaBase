import { createTheme, MantineColorsTuple } from "@mantine/core";

export const neonGreen: MantineColorsTuple = [
  "#e6fcf0",
  "#c2f7db",
  "#87f0b8",
  "#45e592",
  "#16d573",
  "#10e57a", // Primary Neon Green [5]
  "#00c862",
  "#009e4c",
  "#007b3b",
  "#005829"
];

export const brandDark: MantineColorsTuple = [
  "#f3f4f6", // shade 0: primary text
  "#e5e7eb", // shade 1: secondary text
  "#9ca3af", // shade 2: dimmed text
  "#4b5058", // shade 3: subtle text / icons
  "#373a40", // shade 4: subtle borders (never white)
  "#2f3238", // shade 5: container borders
  "#282a30", // shade 6: elevated surfaces / popovers
  "#23252a", // shade 7: card containers
  "#1e1f24", // shade 8: header / navbar
  "#18191c"  // shade 9: main background (balanced dark, not pitch black)
];

export const theme = createTheme({
  primaryColor: "neonGreen",
  primaryShade: 5,
  colors: {
    neonGreen,
    dark: brandDark
  },
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', monospace",
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Button: {
      defaultProps: {
        radius: "md"
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: "all 0.15s ease",
          letterSpacing: "-0.01em"
        }
      }
    },
    Card: {
      defaultProps: {
        radius: "md"
      },
      styles: {
        root: {
          backgroundColor: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)"
        }
      }
    },
    Paper: {
      defaultProps: {
        radius: "md"
      },
      styles: {
        root: {
          backgroundColor: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)"
        }
      }
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: "var(--color-bg-well)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        },
        label: {
          color: "var(--color-text-secondary)",
          fontWeight: 500,
          marginBottom: 4,
        },
      },
    },
    PasswordInput: {
      styles: {
        input: {
          backgroundColor: "var(--color-bg-well)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        },
        label: {
          color: "var(--color-text-secondary)",
          fontWeight: 500,
          marginBottom: 4,
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: "var(--color-bg-well)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        },
        dropdown: {
          backgroundColor: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
        },
        option: {
          color: "var(--color-text-primary)",
        },
      },
    },
    Modal: {
      styles: {
        content: {
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)"
        },
        header: {
          backgroundColor: "var(--color-bg-card)"
        },
        title: {
          fontWeight: 600,
          color: "var(--color-text-primary)"
        }
      }
    },
    Badge: {
      styles: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: "0.02em"
        }
      }
    }
  }
});
