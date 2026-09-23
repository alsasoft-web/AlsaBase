import { useState, useEffect } from "react";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider, AppShell } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { theme } from "./theme";
import { api } from "./api/client";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { AuthView } from "./components/views/AuthView";
import { CollectionsView } from "./components/views/CollectionsView";
import { HooksView } from "./components/views/HooksView";
import { LogsView } from "./components/views/LogsView";
import { StaticHostingView } from "./components/views/StaticHostingView";
import { SettingsView } from "./components/views/SettingsView";
import { ErrorBoundary } from "./components/ErrorBoundary";

const VALID_TABS = [
  "collections",
  "hooks",
  "logs",
  "public",
  "settings",
] as const;
type TabType = (typeof VALID_TABS)[number];

const TAB_TITLES: Record<TabType, string> = {
  collections: "Collections",
  hooks: "Hooks",
  logs: "Logs & Traces",
  public: "Static Hosting",
  settings: "Settings & Backups",
};

function getTabFromPath(pathname: string): TabType | null {
  const clean = pathname.replace(/^\/_/, "").replace(/^\//, "");
  const firstSegment = clean.split("/")[0]?.toLowerCase();
  if (firstSegment === "static") return "public";
  if (VALID_TABS.includes(firstSegment as any)) {
    return firstSegment as TabType;
  }
  return null;
}

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem("alsabase_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const fromPath = getTabFromPath(window.location.pathname);
    if (fromPath) return fromPath;
    const saved = localStorage.getItem("alsabase_active_tab");
    if (saved && VALID_TABS.includes(saved as any)) {
      return saved;
    }
    return "collections";
  });
  const [health, setHealth] = useState<any>(null);

  const updateUrlAndTitle = (tab: string, replace = false) => {
    const title = `AlsaBase - ${TAB_TITLES[tab as TabType] || tab}`;
    document.title = title;
    const targetUrl = `/_/${tab}`;
    if (window.location.pathname !== targetUrl) {
      if (replace) {
        window.history.replaceState({ tab }, "", targetUrl);
      } else {
        window.history.pushState({ tab }, "", targetUrl);
      }
    }
  };

  const handleSelectTab = (tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    localStorage.setItem("alsabase_active_tab", tab);
    updateUrlAndTitle(tab, false);
  };

  // Sync initial URL on mount if logged in
  useEffect(() => {
    if (user) {
      const fromPath = getTabFromPath(window.location.pathname);
      if (!fromPath) {
        updateUrlAndTitle(activeTab, true);
      } else {
        document.title = `AlsaBase - ${TAB_TITLES[activeTab as TabType] || activeTab}`;
      }
    }
  }, [user]);

  // Handle browser back and forward button navigation
  useEffect(() => {
    const handlePopState = () => {
      const tabFromUrl =
        getTabFromPath(window.location.pathname) || "collections";
      setActiveTab(tabFromUrl);
      localStorage.setItem("alsabase_active_tab", tabFromUrl);
      document.title = `AlsaBase - ${TAB_TITLES[tabFromUrl as TabType] || tabFromUrl}`;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    api
      .getHealth()
      .then(setHealth)
      .catch(() => {});
  }, [user]);

  const handleAuthSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const [navType, setNavType] = useState<"sidebar" | "header">(() => {
    const saved = localStorage.getItem("alsabase_nav_type");
    return saved === "header" ? "header" : "sidebar";
  });

  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("alsabase_nav_collapsed") === "true";
  });

  const toggleNavCollapse = () => {
    const next = !navCollapsed;
    setNavCollapsed(next);
    localStorage.setItem("alsabase_nav_collapsed", String(next));
    window.dispatchEvent(
      new CustomEvent("alsabase_nav_change", {
        detail: { navType, navCollapsed: next },
      }),
    );
  };

  // Listen for navigation layout changes triggered from SettingsView
  useEffect(() => {
    const handleNavChange = (e: any) => {
      if (e.detail?.navType !== undefined) {
        setNavType((prev) => (prev !== e.detail.navType ? e.detail.navType : prev));
      }
      if (e.detail?.navCollapsed !== undefined) {
        setNavCollapsed((prev) => (prev !== e.detail.navCollapsed ? e.detail.navCollapsed : prev));
      }
    };

    window.addEventListener("alsabase_nav_change", handleNavChange);
    return () =>
      window.removeEventListener("alsabase_nav_change", handleNavChange);
  }, []);

  if (!user) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ModalsProvider>
          <Notifications position="top-right" zIndex={10000} />
          <AuthView onAuthSuccess={handleAuthSuccess} />
        </ModalsProvider>
      </MantineProvider>
    );
  }

  const sidebarWidth = navCollapsed ? 60 : 240;
  const mainPaddingLeft = navType === "header" ? 0 : sidebarWidth;

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ModalsProvider>
        <Notifications position="bottom-right" zIndex={10000} />
        <AppShell
          header={{ height: 64 }}
          navbar={
            navType === "sidebar"
              ? { width: sidebarWidth, breakpoint: "xs" }
              : undefined
          }
          padding={0}
          style={{
            "--app-shell-navbar-width": `${sidebarWidth}px`,
            "--app-shell-navbar-offset": `${mainPaddingLeft}px`,
            backgroundColor: "var(--color-bg-base)",
            height: "100vh",
            maxHeight: "100vh",
            overflow: "hidden",
            color: "var(--color-text-primary)",
          } as React.CSSProperties}
        >
          <AppShell.Header
            style={{
              background: "var(--color-bg-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <Header
              user={user}
              health={health}
              onLogout={handleLogout}
              navType={navType}
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
            />
          </AppShell.Header>

          {navType === "sidebar" && (
            <AppShell.Navbar
              p={8}
              style={{
                background: "var(--color-bg-surface)",
                borderColor: "var(--color-border)",
                width: sidebarWidth,
                minWidth: sidebarWidth,
                maxWidth: sidebarWidth,
                transition: "width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease",
              }}
            >
              <Sidebar
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                isCollapsed={navCollapsed}
                onToggleCollapse={toggleNavCollapse}
              />
            </AppShell.Navbar>
          )}

          <AppShell.Main
            style={{
              height: "calc(100vh - 64px)",
              maxHeight: "calc(100vh - 64px)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              paddingTop: 64,
              paddingLeft: mainPaddingLeft,
              transition: "padding-left 0.2s ease",
            }}
          >
            <ErrorBoundary>
              {activeTab === "collections" && <CollectionsView />}
              {activeTab === "hooks" && <HooksView />}
              {activeTab === "logs" && <LogsView />}
              {activeTab === "public" && <StaticHostingView />}
              {activeTab === "settings" && <SettingsView />}
            </ErrorBoundary>
          </AppShell.Main>
        </AppShell>
      </ModalsProvider>
    </MantineProvider>
  );
}
