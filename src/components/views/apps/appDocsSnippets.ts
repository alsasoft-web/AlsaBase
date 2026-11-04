/**
 * Modular Client Integration Snippet & Documentation Engine for AlsaBase Apps
 * Provides copy-ready, production-grade code for:
 * - C# (.NET / WPF / WinUI / Console)
 * - Rust (Tauri / reqwest / serde)
 * - Python (requests)
 * - JavaScript / TypeScript (Native Fetch)
 * - cURL / Raw REST HTTP
 * - Official TypeScript SDK (alsabase)
 */

export interface DocModuleInfo {
  id: "updates" | "publish" | "gatekeeper" | "licenses" | "auth" | "logs" | "lifecycle";
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  endpoints: Array<{
    method: "GET" | "POST";
    path: string;
    auth: "Public / Client" | "Admin Only" | "User / Bearer";
    description: string;
    params?: Array<{ name: string; type: string; required: boolean; desc: string }>;
    requestBody?: string;
    successResponse: string;
    errorResponse: string;
  }>;
}

export function getDocModules(appSlug: string, _origin?: string): DocModuleInfo[] {
  return [
    {
      id: "updates",
      title: "App Updates & Release Management",
      badge: "Version Control",
      badgeColor: "blue",
      description: "Detect new software versions, evaluate semver, distinguish between mandatory (force-update) and optional updates, and download installer binaries.",
      endpoints: [
        {
          method: "GET",
          path: `/api/apps/${appSlug}/check-update`,
          auth: "Public / Client",
          description: "Check if a newer version is available compared to the client's current version.",
          params: [
            { name: "currentVersion", type: "string", required: true, desc: "Current app version (e.g. '1.0.0')" },
            { name: "platform", type: "string", required: false, desc: "'windows', 'linux', 'darwin', 'android', 'ios', or 'all' (default: 'all')" },
            { name: "channel", type: "string", required: false, desc: "'stable', 'beta', 'alpha', or 'latest'" },
            { name: "deviceId", type: "string", required: false, desc: "Hardware GUID (enforces device lock policy during update check)" },
          ],
          successResponse: JSON.stringify(
            {
              hasUpdate: true,
              updateAvailable: true,
              currentVersion: "1.0.0",
              latestVersion: "1.2.0",
              importance: "automatic",
              isAutomatic: true,
              isMandatory: true,
              releaseNotes: "Critical security patch and performance improvements.",
              downloadUrl: `/api/apps/${appSlug}/versions/1.2.0/download`,
              version: {
                id: "rel_01",
                version: "1.2.0",
                platform: "windows",
                channel: "stable",
                fileSize: 15482910,
                downloadUrl: `/api/apps/${appSlug}/versions/1.2.0/download`,
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              updateAvailable: false,
              hasUpdate: false,
              isDeviceLocked: true,
              error: "This device has been locked from accessing this application",
              lockReason: "Hardware banned by administrator",
            },
            null,
            2
          ),
        },
        {
          method: "GET",
          path: `/api/apps/${appSlug}/versions/:version/download`,
          auth: "Public / Client",
          description: "Download the executable installer or archive file for a specific version. Increments download statistics.",
          successResponse: `HTTP/1.1 200 OK\nContent-Type: application/octet-stream\nContent-Disposition: attachment; filename="${appSlug}-setup.exe"\n[Binary Stream]`,
          errorResponse: JSON.stringify({ error: "Version not found or has no binary attached" }, null, 2),
        },
      ],
    },
    {
      id: "publish",
      title: "Publish & Upload Releases (Admin & CI/CD)",
      badge: "Superuser Auth + Upload",
      badgeColor: "grape",
      description: "Authenticate using administrator / superuser credentials and upload new software versions with installer binary packages directly from your automated CI/CD pipeline or build script.",
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/superusers/login",
          auth: "Public / Client",
          description: "Authenticate as an administrator/superuser to obtain a high-privilege JWT bearer token required for version publishing and application management.",
          requestBody: JSON.stringify({ email: "admin@example.com", password: "your-secret-password" }, null, 2),
          successResponse: JSON.stringify(
            {
              token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              user: {
                id: "su_01a2b3c4",
                email: "admin@example.com",
                role: "superuser",
                created_at: "2026-11-01T00:00:00Z"
              }
            },
            null,
            2
          ),
          errorResponse: JSON.stringify({ error: "Invalid email or password" }, null, 2),
        },
        {
          method: "POST",
          path: "/api/apps/manage/versions",
          auth: "Admin Only",
          description: "Publish a new app version release with metadata (version, build number, channel, platform, release notes) and attached installer binary.",
          requestBody: JSON.stringify(
            {
              appSlug: appSlug,
              version: "1.2.0",
              buildNumber: 120,
              importance: "automatic",
              channel: "stable",
              platform: "windows",
              releaseNotes: "Critical performance fixes, updated UI components, and improved cloud sync.",
              file: {
                name: `${appSlug}-Setup-1.2.0.exe`,
                data: "data:application/octet-stream;base64,TVqQAAMAAAAEAAAA//8AALg...",
                size: 15482910
              }
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              id: "rel_9876abcd",
              appId: "app_12345",
              appSlug: appSlug,
              version: "1.2.0",
              buildNumber: 120,
              importance: "automatic",
              channel: "stable",
              platform: "windows",
              fileName: `${appSlug}-Setup-1.2.0.exe`,
              fileSize: 15482910,
              fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              downloadUrl: `/api/apps/${appSlug}/versions/1.2.0/download`,
              downloadCount: 0,
              isActive: true,
              createdAt: "2026-11-04T12:00:00Z"
            },
            null,
            2
          ),
          errorResponse: JSON.stringify({ error: "Version string (e.g. '1.0.0') is required" }, null, 2),
        },
        {
          method: "POST",
          path: "/api/apps/manage/versions/:id/upload",
          auth: "Admin Only",
          description: "High-performance direct binary streaming upload for existing releases. Recommended for large installers (>10MB) to eliminate Base64 encoding overhead.",
          params: [
            { name: "fileName", type: "string", required: true, desc: "Name of the binary installer (e.g. 'Setup-1.2.0.exe')" }
          ],
          successResponse: JSON.stringify(
            {
              id: "rel_9876abcd",
              fileName: `${appSlug}-Setup-1.2.0.exe`,
              fileSize: 45291820,
              fileHash: "a1b2c3d4...",
              downloadUrl: `/api/apps/${appSlug}/versions/1.2.0/download`,
              updatedAt: "2026-11-04T12:05:00Z"
            },
            null,
            2
          ),
          errorResponse: JSON.stringify({ error: "Version release not found" }, null, 2),
        },
      ],
    },
    {
      id: "gatekeeper",
      title: "Device HWID & Gatekeeper",
      badge: "Access Control",
      badgeColor: "teal",
      description: "Verify that the host PC or device is not locked or banned. Extract persistent hardware identifiers (such as Windows Registry MachineGuid) to enforce zero-trust access control without serial numbers.",
      endpoints: [
        {
          method: "GET",
          path: `/api/apps/${appSlug}/devices/check`,
          auth: "Public / Client",
          description: "Check device status or auto-register this machine upon boot.",
          params: [
            { name: "deviceId", type: "string", required: true, desc: "Persistent Hardware ID (HWID)" },
            { name: "deviceName", type: "string", required: false, desc: "Host computer name (e.g. 'Accounting-PC-3')" },
            { name: "platform", type: "string", required: false, desc: "OS platform ('windows', 'linux', 'darwin')" },
            { name: "osName", type: "string", required: false, desc: "Detailed OS version string" },
          ],
          successResponse: JSON.stringify(
            {
              allowed: true,
              isLocked: false,
              isRegistered: true,
              lockReason: null,
              device: {
                id: "dev_98234",
                deviceId: "PC-HWID-98234",
                deviceName: "Office-PC-1",
                isLocked: false,
                firstSeen: "2026-10-15T08:00:00Z",
                lastSeen: "2026-11-04T02:00:00Z",
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              allowed: false,
              isLocked: true,
              limitReached: false,
              error: "This device has been locked from accessing this application",
              lockReason: "License expired or administrative lockout",
            },
            null,
            2
          ),
        },
      ],
    },
    {
      id: "licenses",
      title: "Serial License Keys & Seat Management",
      badge: "Licensing",
      badgeColor: "violet",
      description: "Activate serial keys with maximum PC activation seat limits, perform daily validation checks, and allow users to deactivate/transfer seats to new machines.",
      endpoints: [
        {
          method: "POST",
          path: `/api/apps/${appSlug}/licenses/activate`,
          auth: "Public / Client",
          description: "Bind a license key to a specific device ID up to the license's maximum allowed seats.",
          requestBody: JSON.stringify(
            {
              key: "XXXX-XXXX-XXXX-XXXX",
              deviceId: "PC-HWID-98234",
              deviceName: "Office-PC-1",
              platform: "windows",
              osName: "Windows 11 Pro",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              success: true,
              license: {
                id: "lic_01",
                serialKey: "XXXX-XXXX-XXXX-XXXX",
                status: "active",
                maxActivations: 2,
                activatedCount: 1,
                expiresAt: "2027-12-31T23:59:59.000Z",
                customerName: "Acme Corp",
              },
              device: {
                deviceId: "PC-HWID-98234",
                isLocked: false,
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              error: "Activation seat limit reached (maximum 2 machines)",
              code: "SEAT_LIMIT_REACHED",
            },
            null,
            2
          ),
        },
        {
          method: "POST",
          path: `/api/apps/${appSlug}/licenses/validate`,
          auth: "Public / Client",
          description: "Verify that an existing serial key remains active and unexpired on subsequent application launches.",
          requestBody: JSON.stringify(
            {
              key: "XXXX-XXXX-XXXX-XXXX",
              deviceId: "PC-HWID-98234",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              valid: true,
              isLocked: false,
              license: {
                status: "active",
                expiresAt: "2027-12-31T23:59:59.000Z",
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              valid: false,
              error: "License has expired",
              isExpired: true,
            },
            null,
            2
          ),
        },
        {
          method: "POST",
          path: `/api/apps/${appSlug}/licenses/deactivate`,
          auth: "Public / Client",
          description: "Unbind the current PC from the serial key to free up an activation slot for transferring to another computer.",
          requestBody: JSON.stringify(
            {
              key: "XXXX-XXXX-XXXX-XXXX",
              deviceId: "PC-HWID-98234",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              success: true,
              message: "Device successfully deactivated. Activation seat freed.",
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              error: "Device not found or not associated with this license key",
            },
            null,
            2
          ),
        },
      ],
    },
    {
      id: "auth",
      title: "Authentication without SDK (Admin & User)",
      badge: "Security & JWT",
      badgeColor: "orange",
      description: "How to authenticate both Administrators/Superusers and regular App Users without using the JavaScript SDK. Acquire JWT bearer tokens and include them in HTTP request headers across any programming language.",
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/superusers/login",
          auth: "Admin Only",
          description: "Authenticate an Administrator / Superuser with email and password.",
          requestBody: JSON.stringify(
            {
              email: "admin@example.com",
              password: "your-admin-password",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              user: {
                id: "admin_id",
                email: "admin@example.com",
                isSuperuser: true,
                role: "admin",
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify({ error: "Invalid superuser credentials" }, null, 2),
        },
        {
          method: "POST",
          path: "/api/collections/users/auth-with-password",
          auth: "User / Bearer",
          description: "Authenticate a regular client user from the 'users' auth collection.",
          requestBody: JSON.stringify(
            {
              identity: "user@example.com",
              password: "user-password",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              record: {
                id: "rec_user_123",
                email: "user@example.com",
                username: "alex",
                role: "user",
              },
            },
            null,
            2
          ),
          errorResponse: JSON.stringify({ error: "Identity (email or username) and password are required" }, null, 2),
        },
      ],
    },
    {
      id: "logs",
      title: "Crash Reporting & Diagnostics Logs Upload",
      badge: "Logging & Telemetry",
      badgeColor: "cyan",
      description: "Send client-side crash reports, exception stack traces, diagnostic telemetry, or full log files directly to AlsaBase from any desktop, mobile, web, or backend application.",
      endpoints: [
        {
          method: "POST",
          path: `/api/apps/${appSlug}/logs`,
          auth: "Public / Client",
          description: "Upload a single log entry, exception trace, or batch of telemetry logs from the application.",
          requestBody: JSON.stringify(
            {
              level: "ERROR",
              message: "Unhandled NullReferenceException in PaymentProcessor",
              stackTrace: "at PaymentProcessor.Process (line 42)\\nat Main (line 12)",
              deviceId: "PC-HWID-8AC0-B851",
              deviceName: "Workstation-A",
              appVersion: "1.0.0",
              platform: "windows",
              metadata: {
                userId: "usr_123",
                feature: "billing",
              },
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              success: true,
              count: 1,
              message: "Successfully logged 1 entries.",
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              error: "No valid log payload provided.",
            },
            null,
            2
          ),
        },
        {
          method: "POST",
          path: `/api/apps/${appSlug}/logs/upload`,
          auth: "Public / Client",
          description: "Upload a raw log file string (.log, .txt, or JSON) directly from a client machine.",
          requestBody: JSON.stringify(
            {
              rawContent: "2026-11-04 12:00:00 [ERROR] Connection lost\\n   at System.Net.Sockets...",
              fileName: "crash_dump.log",
              deviceId: "PC-HWID-8AC0-B851",
              appVersion: "1.0.0",
            },
            null,
            2
          ),
          successResponse: JSON.stringify(
            {
              success: true,
              count: 1,
              message: "Successfully logged 1 entries.",
            },
            null,
            2
          ),
          errorResponse: JSON.stringify(
            {
              error: "No valid log payload provided.",
            },
            null,
            2
          ),
        },
      ],
    },
    {
      id: "lifecycle",
      title: "Complete Integration Lifecycle",
      badge: "All-in-One",
      badgeColor: "teal",
      description: "A complete turnkey client integration boilerplate combining Hardware ID extraction, Device Gatekeeper, Auto-Updating, and Serial License Validation in a single class.",
      endpoints: [],
    },
  ];
}

// ============================================================================
// CODE GENERATOR BY MODULE & LANGUAGE
// ============================================================================

export function getModuleSnippet(
  moduleId: "updates" | "publish" | "gatekeeper" | "licenses" | "auth" | "logs" | "lifecycle",
  lang: string,
  appSlug: string,
  origin: string
): string {
  switch (moduleId) {
    case "updates":
      return getUpdateSnippet(lang, appSlug, origin);
    case "publish":
      return getPublishSnippet(lang, appSlug, origin);
    case "gatekeeper":
      return getGatekeeperSnippet(lang, appSlug, origin);
    case "licenses":
      return getLicenseSnippet(lang, appSlug, origin);
    case "auth":
      return getAuthSnippet(lang, origin);
    case "logs":
      return getLogsSnippet(lang, appSlug, origin);
    case "lifecycle":
    default:
      return getFullLifecycleSnippet(lang, appSlug, origin);
  }
}

// ----------------------------------------------------------------------------
// 1. APP UPDATES
// ----------------------------------------------------------------------------
function getUpdateSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public class AppUpdateChecker
{
    private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    private const string BaseUrl = "${origin}";
    private const string AppSlug = "${appSlug}";

    public static async Task CheckForUpdatesAsync(string currentVersion = "1.0.0")
    {
        string platform = "windows";
        string url = $"{BaseUrl}/api/apps/{AppSlug}/check-update?currentVersion={currentVersion}&platform={platform}";

        var res = await _http.GetAsync(url);
        if (!res.IsSuccessStatusCode)
        {
            Console.WriteLine($"Update check failed with HTTP {res.StatusCode}");
            return;
        }

        var update = await res.Content.ReadFromJsonAsync<JsonElement>();
        bool hasUpdate = update.GetProperty("hasUpdate").GetBoolean();

        if (hasUpdate)
        {
            string latest = update.GetProperty("latestVersion").GetString();
            bool isMandatory = update.GetProperty("isMandatory").GetBoolean();
            string downloadPath = update.GetProperty("downloadUrl").GetString();
            string releaseNotes = update.TryGetProperty("releaseNotes", out var rn) ? rn.GetString() : "";

            Console.WriteLine($"New version available: v{latest} (Mandatory: {isMandatory})");
            Console.WriteLine($"Release Notes: {releaseNotes}");

            // Download update installer binary
            string downloadUrl = $"{BaseUrl}{downloadPath}";
            byte[] installerData = await _http.GetByteArrayAsync(downloadUrl);
            string savePath = Path.Combine(Path.GetTempPath(), $"{AppSlug}-update-v{latest}.exe");
            await File.WriteAllBytesAsync(savePath, installerData);

            Console.WriteLine($"Downloaded installer to: {savePath}");
            if (isMandatory)
            {
                Console.WriteLine("Mandatory upgrade: relaunching application with update installer...");
                // System.Diagnostics.Process.Start(savePath);
                // Environment.Exit(0);
            }
        }
        else
        {
            Console.WriteLine($"Application is up to date (v{currentVersion}).");
        }
    }
}`;

    case "rust":
      return `use reqwest::Client;
use serde::Deserialize;
use std::error::Error;

#[derive(Debug, Deserialize)]
struct UpdateCheckResult {
    #[serde(rename = "hasUpdate")]
    has_update: bool,
    #[serde(rename = "latestVersion")]
    latest_version: Option<String>,
    #[serde(rename = "isMandatory")]
    is_mandatory: Option<bool>,
    #[serde(rename = "downloadUrl")]
    download_url: Option<String>,
    #[serde(rename = "releaseNotes")]
    release_notes: Option<String>,
}

pub async fn check_for_updates(current_version: &str) -> Result<(), Box<dyn Error>> {
    let client = Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;
    let url = format!(
        "${origin}/api/apps/${appSlug}/check-update?currentVersion={}&platform=windows",
        current_version
    );

    let res = client.get(&url).send().await?.json::<UpdateCheckResult>().await?;

    if res.has_update {
        let latest = res.latest_version.unwrap_or_default();
        let mandatory = res.is_mandatory.unwrap_or(false);
        let path = res.download_url.unwrap_or_default();

        println!("Update available: v{} (Mandatory: {})", latest, mandatory);
        if let Some(notes) = res.release_notes {
            println!("Notes: {}", notes);
        }

        // Download release binary
        let download_url = format!("${origin}{}", path);
        let bytes = client.get(&download_url).send().await?.bytes().await?;
        std::fs::write(format!("update-v{}.exe", latest), &bytes)?;
        println!("Installer saved successfully.");
    } else {
        println!("Application is up to date.");
    }

    Ok(())
}`;

    case "python":
      return `import requests

BASE_URL = "${origin}"
APP_SLUG = "${appSlug}"

def check_for_updates(current_version: str = "1.0.0", platform: str = "windows"):
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/check-update"
    params = {"currentVersion": current_version, "platform": platform}
    
    res = requests.get(url, params=params, timeout=10)
    res.raise_for_status()
    data = res.json()

    if data.get("hasUpdate"):
        latest = data["latestVersion"]
        mandatory = data.get("isMandatory", False)
        download_path = data["downloadUrl"]
        print(f"Update available: v{latest} (Mandatory: {mandatory})")
        
        # Download update binary
        dl_res = requests.get(f"{BASE_URL}{download_path}", stream=True, timeout=30)
        dl_res.raise_for_status()
        filename = f"{APP_SLUG}-v{latest}.exe"
        with open(filename, "wb") as f:
            for chunk in dl_res.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Saved update to {filename}")
        return True
    else:
        print(f"App is up to date (v{currentVersion}).")
        return False`;

    case "fetch":
      return `const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";

async function checkForUpdate(currentVersion = "1.0.0", platform = "windows") {
  const params = new URLSearchParams({ currentVersion, platform });
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/check-update?\${params.toString()}\`);
  
  if (!res.ok) {
    throw new Error(\`Update check failed: HTTP \${res.status}\`);
  }
  
  const update = await res.json();
  if (update.hasUpdate) {
    console.log(\`Update available: v\${update.latestVersion} (Mandatory: \${update.isMandatory})\`);
    console.log("Release notes:", update.releaseNotes);
    console.log("Download link:", \`\${BASE_URL}\${update.downloadUrl}\`);
    return update;
  }
  
  console.log("App is currently up to date.");
  return null;
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";
import fs from "node:fs";

const ab = new AlsaBase("${origin}");

// ============================================================================
// PART A: Client App - Check For & Download Updates
// ============================================================================
const update = await ab.apps.checkUpdate("${appSlug}", {
  currentVersion: "1.0.0",
  platform: "windows",
});

if (update.hasUpdate) {
  console.log("New version available:", update.latestVersion);
  console.log("Is mandatory force update:", update.isAutomatic);
  console.log("Direct download URL:", update.downloadUrl);
} else {
  console.log("App is up to date.");
}

// ============================================================================
// PART B: Developer / CI/CD - Login & Upload New Version (One Combined Script)
// ============================================================================
// Step 1: Login as Superuser / Admin
await ab.superusers.authWithPassword("admin@example.com", "your-admin-password");

// Step 2: Read binary installer and publish release
const installer = fs.readFileSync("./dist/MyApp-Setup-1.2.0.exe");

const release = await ab.apps.uploadVersion({
  appSlug: "${appSlug}",
  version: "1.2.0",
  buildNumber: 120,
  channel: "stable",
  platform: "windows",
  importance: "automatic",
  releaseNotes: "Feature update and performance optimizations.",
  file: {
    name: "MyApp-Setup-1.2.0.exe",
    data: installer.toString("base64"),
    size: installer.length,
  },
});

console.log("Release published successfully:", release.version, release.id);`;

    case "endpoints":
    default:
      return `# 1. Query if an update exists for currentVersion 1.0.0 on Windows
curl "${origin}/api/apps/${appSlug}/check-update?currentVersion=1.0.0&platform=windows"

# 2. Query beta channel releases
curl "${origin}/api/apps/${appSlug}/check-update?currentVersion=1.0.0&platform=windows&channel=beta"

# 3. Download the version 1.2.0 installer binary directly
curl -O "${origin}/api/apps/${appSlug}/versions/1.2.0/download"`;
  }
}

// ----------------------------------------------------------------------------
// 1b. PUBLISH & UPLOAD RELEASES (SUPERUSER AUTH + RELEASE UPLOAD)
// ----------------------------------------------------------------------------
function getPublishSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public class AlsaBaseReleasePublisher
{
    private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
    private const string BaseUrl = "${origin}";
    private const string AppSlug = "${appSlug}";

    /// <summary>
    /// Authenticates as a Superuser and publishes a new version with an attached installer binary.
    /// Demonstrates the complete flow: Superuser Login -> Acquire Bearer Token -> Upload Release.
    /// </summary>
    public static async Task PublishReleaseAsync(
        string adminEmail,
        string adminPassword,
        string version,
        int buildNumber,
        string installerFilePath,
        string channel = "stable",
        string platform = "windows",
        bool isMandatory = true,
        string releaseNotes = "Automated production build update.")
    {
        Console.WriteLine($"[1/2] Authenticating as Superuser ({adminEmail})...");

        // Step 1: Login to obtain high-privilege JWT Bearer Token
        var loginPayload = new { email = adminEmail, password = adminPassword };
        var loginRes = await _http.PostAsJsonAsync($"{BaseUrl}/api/auth/superusers/login", loginPayload);
        if (!loginRes.IsSuccessStatusCode)
        {
            var err = await loginRes.Content.ReadAsStringAsync();
            throw new Exception($"Superuser authentication failed ({loginRes.StatusCode}): {err}");
        }

        var loginData = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
        string token = loginData.GetProperty("token").GetString();
        Console.WriteLine("Superuser authenticated successfully. Bearer token acquired.");

        // Step 2: Read binary installer and encode to Base64
        Console.WriteLine($"[2/2] Reading installer binary: {Path.GetFileName(installerFilePath)}...");
        if (!File.Exists(installerFilePath))
        {
            throw new FileNotFoundException("Installer binary not found", installerFilePath);
        }

        byte[] fileBytes = await File.ReadAllBytesAsync(installerFilePath);
        string fileBase64 = Convert.ToBase64String(fileBytes);
        string fileName = Path.GetFileName(installerFilePath);

        var uploadPayload = new
        {
            appSlug = AppSlug,
            version = version,
            buildNumber = buildNumber,
            importance = isMandatory ? "automatic" : "optional",
            channel = channel,
            platform = platform,
            releaseNotes = releaseNotes,
            file = new
            {
                name = fileName,
                data = $"data:application/octet-stream;base64,{fileBase64}",
                size = fileBytes.Length
            }
        };

        // Attach authorization header for superuser request
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/apps/manage/versions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(uploadPayload);

        Console.WriteLine($"Uploading and publishing version v{version} to AlsaBase...");
        var releaseRes = await _http.SendAsync(request);
        if (!releaseRes.IsSuccessStatusCode)
        {
            var err = await releaseRes.Content.ReadAsStringAsync();
            throw new Exception($"Failed to upload version ({releaseRes.StatusCode}): {err}");
        }

        var releaseData = await releaseRes.Content.ReadFromJsonAsync<JsonElement>();
        string releaseId = releaseData.GetProperty("id").GetString();
        string downloadUrl = releaseData.GetProperty("downloadUrl").GetString();

        Console.WriteLine($"Release v{version} published successfully!");
        Console.WriteLine($"Release ID: {releaseId}");
        Console.WriteLine($"Download URL: {BaseUrl}{downloadUrl}");
    }

    public static async Task Main(string[] args)
    {
        await PublishReleaseAsync(
            adminEmail: "admin@example.com",
            adminPassword: "your-admin-password",
            version: "1.2.0",
            buildNumber: 120,
            installerFilePath: "./dist/MyApp-Setup-1.2.0.exe",
            channel: "stable",
            platform: "windows",
            isMandatory: true,
            releaseNotes: "Critical performance fixes, updated UI components, and security patches."
        );
    }
}`;

    case "rust":
      return `use reqwest::Client;
use serde_json::json;
use std::error::Error;
use std::path::Path;

const BASE_URL: &str = "${origin}";
const APP_SLUG: &str = "${appSlug}";

/// Demonstrates the complete flow:
/// Step 1: Login as Superuser -> Step 2: Upload new version with binary installer.
pub async fn publish_new_version(
    admin_email: &str,
    admin_password: &str,
    version: &str,
    build_number: u32,
    installer_path: &str,
) -> Result<(), Box<dyn Error>> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    // Step 1: Login to obtain JWT Bearer token
    println!("[1/2] Authenticating as superuser ({})...", admin_email);
    let login_res = client
        .post(format!("{}/api/auth/superusers/login", BASE_URL))
        .json(&json!({
            "email": admin_email,
            "password": admin_password
        }))
        .send()
        .await?;

    if !login_res.status().is_success() {
        let err = login_res.text().await?;
        return Err(format!("Superuser login failed: {}", err).into());
    }

    let login_data: serde_json::Value = login_res.json().await?;
    let token = login_data["token"].as_str().ok_or("Missing token in login response")?;
    println!("Superuser authenticated successfully. Bearer token acquired.");

    // Step 2: Read binary installer and encode to base64
    println!("[2/2] Reading installer binary: {}", installer_path);
    let file_bytes = std::fs::read(installer_path)?;
    let file_base64 = base64::encode(&file_bytes);
    let file_name = Path::new(installer_path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("release.exe");

    let payload = json!({
        "appSlug": APP_SLUG,
        "version": version,
        "buildNumber": build_number,
        "importance": "automatic",
        "channel": "stable",
        "platform": "windows",
        "releaseNotes": "Automated production build release.",
        "file": {
            "name": file_name,
            "data": format!("data:application/octet-stream;base64,{}", file_base64),
            "size": file_bytes.len()
        }
    });

    println!("Uploading and publishing version v{} to AlsaBase...", version);
    let upload_res = client
        .post(format!("{}/api/apps/manage/versions", BASE_URL))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await?;

    if !upload_res.status().is_success() {
        let err = upload_res.text().await?;
        return Err(format!("Version upload failed: {}", err).into());
    }

    let release_data: serde_json::Value = upload_res.json().await?;
    println!("Version v{} published successfully!", version);
    println!("Release ID: {}", release_data["id"]);
    println!("Download URL: {}{}", BASE_URL, release_data["downloadUrl"]);

    Ok(())
}`;

    case "python":
      return `import os
import base64
import requests

BASE_URL = "${origin}"
APP_SLUG = "${appSlug}"

def publish_new_version(
    admin_email: str,
    admin_password: str,
    version: str,
    build_number: int,
    installer_path: str,
    channel: str = "stable",
    platform: str = "windows",
    is_mandatory: bool = True,
    release_notes: str = "Automated release update"
):
    """
    Complete release workflow in one function:
    1. Authenticates as Superuser / Admin to retrieve the JWT Bearer token.
    2. Reads the installer binary from disk, encodes it, and publishes the new version.
    """
    print(f"[1/2] Authenticating as superuser ({admin_email})...")
    login_url = f"{BASE_URL}/api/auth/superusers/login"
    login_res = requests.post(
        login_url,
        json={"email": admin_email, "password": admin_password},
        timeout=15
    )
    login_res.raise_for_status()
    token = login_res.json().get("token")
    print("Superuser authenticated successfully. Bearer token acquired.")

    print(f"[2/2] Reading and encoding binary installer: {installer_path}...")
    if not os.path.exists(installer_path):
        raise FileNotFoundError(f"Installer binary not found: {installer_path}")

    with open(installer_path, "rb") as f:
        file_bytes = f.read()

    file_base64 = base64.b64encode(file_bytes).decode("utf-8")
    file_name = os.path.basename(installer_path)

    upload_url = f"{BASE_URL}/api/apps/manage/versions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "appSlug": APP_SLUG,
        "version": version,
        "buildNumber": build_number,
        "importance": "automatic" if is_mandatory else "optional",
        "channel": channel,
        "platform": platform,
        "releaseNotes": release_notes,
        "file": {
            "name": file_name,
            "data": f"data:application/octet-stream;base64,{file_base64}",
            "size": len(file_bytes)
        }
    }

    print(f"Uploading and publishing version v{version} to AlsaBase...")
    upload_res = requests.post(upload_url, headers=headers, json=payload, timeout=120)
    upload_res.raise_for_status()
    release = upload_res.json()

    print(f"Version v{version} published successfully!")
    print(f"Release ID: {release.get('id')}")
    print(f"Download URL: {BASE_URL}{release.get('downloadUrl')}")
    return release

if __name__ == "__main__":
    publish_new_version(
        admin_email="admin@example.com",
        admin_password="your-admin-password",
        version="1.2.0",
        build_number=120,
        installer_path="./dist/MyApp-Setup-1.2.0.exe",
        channel="stable",
        platform="windows",
        is_mandatory=True,
        release_notes="Bug fixes, performance improvements, and updated assets."
    )`;

    case "fetch":
      return `import fs from "node:fs";
import path from "node:path";

const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";

/**
 * Complete release publishing workflow:
 * 1. Log in as Superuser to obtain Bearer Token.
 * 2. Read installer file from disk and upload new version release.
 */
async function publishNewVersion({
  adminEmail,
  adminPassword,
  version,
  buildNumber,
  installerPath,
  channel = "stable",
  platform = "windows",
  isMandatory = true,
  releaseNotes = "New production update",
}) {
  // Step 1: Authenticate as Superuser / Admin
  console.log(\`[1/2] Authenticating as superuser (\${adminEmail})...\`);
  const loginRes = await fetch(\`\${BASE_URL}/api/auth/superusers/login\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!loginRes.ok) {
    const errorText = await loginRes.text();
    throw new Error(\`Login failed (\${loginRes.status}): \${errorText}\`);
  }

  const { token } = await loginRes.json();
  console.log("Superuser authenticated successfully. Bearer token acquired.");

  // Step 2: Read binary installer and convert to base64
  console.log(\`[2/2] Reading installer binary: \${installerPath}...\`);
  const fileBuffer = fs.readFileSync(installerPath);
  const fileBase64 = fileBuffer.toString("base64");
  const fileName = path.basename(installerPath);

  // Step 3: Publish release to AlsaBase
  console.log(\`Uploading and publishing version v\${version} to AlsaBase...\`);
  const uploadRes = await fetch(\`\${BASE_URL}/api/apps/manage/versions\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appSlug: APP_SLUG,
      version,
      buildNumber,
      importance: isMandatory ? "automatic" : "optional",
      channel,
      platform,
      releaseNotes,
      file: {
        name: fileName,
        data: \`data:application/octet-stream;base64,\${fileBase64}\`,
        size: fileBuffer.length,
      },
    }),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(\`Release upload failed (\${uploadRes.status}): \${errorText}\`);
  }

  const release = await uploadRes.json();
  console.log(\`Version v\${version} published successfully!\`);
  console.log(\`Release ID: \${release.id}\`);
  console.log(\`Download URL: \${BASE_URL}\${release.downloadUrl}\`);
  return release;
}

// Example Execution:
publishNewVersion({
  adminEmail: "admin@example.com",
  adminPassword: "your-admin-password",
  version: "1.2.0",
  buildNumber: 120,
  installerPath: "./dist/MyApp-Setup-1.2.0.exe",
  channel: "stable",
  platform: "windows",
  isMandatory: true,
  releaseNotes: "Feature update and critical bug fixes.",
});`;

    case "sdk":
      return `import AlsaBase from "alsabase";
import fs from "node:fs";

// Initialize AlsaBase client
const ab = new AlsaBase("${origin}");

async function publishRelease() {
  // Step 1: Login as Superuser / Admin (Stores Bearer token in authStore automatically)
  console.log("[1/2] Authenticating as superuser...");
  const admin = await ab.superusers.authWithPassword("admin@example.com", "your-admin-password");
  console.log("Authenticated as:", admin.user.email);

  // Step 2: Read binary installer file from disk
  console.log("[2/2] Reading installer binary...");
  const installerBuffer = fs.readFileSync("./dist/MyApp-Setup-1.2.0.exe");

  // Step 3: Publish new version with attached binary (Both login and upload in one script!)
  console.log("Uploading version release v1.2.0...");
  const release = await ab.apps.uploadVersion({
    appSlug: "${appSlug}",
    version: "1.2.0",
    buildNumber: 120,
    channel: "stable",           // "stable" | "beta" | "alpha" | "latest"
    platform: "windows",          // "windows" | "linux" | "darwin" | "all"
    importance: "automatic",      // "automatic" (mandatory force-update) or "optional"
    releaseNotes: "### What's New in v1.2.0\\n- Realtime database sync engine\\n- Critical security patches",
    file: {
      name: "MyApp-Setup-1.2.0.exe",
      data: installerBuffer.toString("base64"),
      size: installerBuffer.length,
    },
  });

  console.log("Release published successfully!");
  console.log("Release ID:", release.id);
  console.log("Download URL:", ab.apps.getDownloadUrl("${appSlug}", "1.2.0"));

  // --------------------------------------------------------------------------
  // Alternative: High-Performance Direct Binary Streaming Upload
  // (Recommended for large installers > 10MB to eliminate Base64 memory overhead)
  // --------------------------------------------------------------------------
  // const releaseMeta = await ab.apps.uploadVersion({
  //   appSlug: "${appSlug}",
  //   version: "1.2.1",
  //   importance: "optional",
  //   platform: "windows",
  // });
  // await ab.apps.uploadVersionBinary(releaseMeta.id, installerBuffer, "MyApp-Setup-1.2.1.exe");
}

publishRelease().catch(console.error);`;

    case "endpoints":
    default:
      return `#!/usr/bin/env bash
# ==============================================================================
# AlsaBase CI/CD Release Publisher (Login + Upload in One Script)
# ==============================================================================
set -e

BASE_URL="${origin}"
APP_SLUG="${appSlug}"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-admin-password"
VERSION="1.2.0"
BUILD_NUMBER=120
INSTALLER_PATH="./dist/MyApp-Setup-1.2.0.exe"

# Step 1: Login to AlsaBase as Superuser to obtain Bearer Token
echo "[1/3] Logging in as superuser ($ADMIN_EMAIL)..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/superusers/login" \\
  -H "Content-Type: application/json" \\
  -d "{\\"email\\":\\"$ADMIN_EMAIL\\",\\"password\\":\\"$ADMIN_PASSWORD\\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: Failed to authenticate as superuser:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "Authenticated successfully. Bearer token acquired."

# Step 2: Read installer file and encode to Base64
echo "[2/3] Encoding binary installer ($INSTALLER_PATH)..."
FILE_NAME=$(basename "$INSTALLER_PATH")
FILE_SIZE=$(wc -c < "$INSTALLER_PATH" | tr -d ' ')
FILE_BASE64=$(base64 -w 0 "$INSTALLER_PATH" 2>/dev/null || base64 "$INSTALLER_PATH")

# Step 3: Publish new release version with attached installer binary
echo "[3/3] Uploading and publishing version v$VERSION to AlsaBase..."
RELEASE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/apps/manage/versions" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"appSlug\\": \\"$APP_SLUG\\",
    \\"version\\": \\"$VERSION\\",
    \\"buildNumber\\": $BUILD_NUMBER,
    \\"importance\\": \\"automatic\\",
    \\"channel\\": \\"stable\\",
    \\"platform\\": \\"windows\\",
    \\"releaseNotes\\": \\"Automated CI/CD build release\\",
    \\"file\\": {
      \\"name\\": \\"$FILE_NAME\\",
      \\"data\\": \\"$FILE_BASE64\\",
      \\"size\\": $FILE_SIZE
    }
  }")

echo "Release published successfully:"
echo "$RELEASE_RESPONSE"`;
  }
}

// ----------------------------------------------------------------------------
// 2. DEVICE HWID & GATEKEEPER
// ----------------------------------------------------------------------------
function getGatekeeperSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

public class DeviceGatekeeper
{
    private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    private const string BaseUrl = "${origin}";
    private const string AppSlug = "${appSlug}";

    /// <summary>
    /// Reads persistent Windows Registry MachineGuid. 
    /// Stable across hardware reboots, user profile changes, and app re-installs.
    /// </summary>
    public static string GetHardwareId()
    {
        try
        {
            using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                       .OpenSubKey(@"SOFTWARE\\Microsoft\\Cryptography");
            var guid = key?.GetValue("MachineGuid")?.ToString();
            if (!string.IsNullOrEmpty(guid)) return guid;
        }
        catch { }
        return Environment.MachineName;
    }

    /// <summary>
    /// Checks device lock status against AlsaBase gatekeeper.
    /// Returns true if permitted; throws Exception if banned/locked.
    /// </summary>
    public static async Task<bool> VerifyDeviceGatekeeperAsync()
    {
        string deviceId = GetHardwareId();
        string deviceName = Uri.EscapeDataString(Environment.MachineName);
        string url = $"{BaseUrl}/api/apps/{AppSlug}/devices/check?deviceId={Uri.EscapeDataString(deviceId)}&deviceName={deviceName}&platform=windows";

        var res = await _http.GetAsync(url);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        if (res.StatusCode == System.Net.HttpStatusCode.Forbidden || !json.GetProperty("allowed").GetBoolean())
        {
            string reason = json.TryGetProperty("lockReason", out var r) ? r.GetString() : "Access prohibited by administrator";
            throw new Exception($"Access Prohibited: {reason}");
        }

        Console.WriteLine($"Device permitted: {deviceId}");
        return true;
    }
}`;

    case "rust":
      return `use reqwest::Client;
use serde::Deserialize;
use std::error::Error;

#[derive(Debug, Deserialize)]
struct DeviceCheckResult {
    allowed: bool,
    #[serde(rename = "isLocked")]
    is_locked: bool,
    #[serde(rename = "lockReason")]
    lock_reason: Option<String>,
}

/// Helper function to retrieve a persistent machine ID
pub fn get_hardware_id() -> String {
    // In production, use the 'machine-uid' crate for cross-platform HWID
    // machine_uid::get().unwrap_or_else(|_| whoami::hostname())
    format!("PC-{}", whoami::hostname())
}

pub async fn verify_device_gatekeeper() -> Result<bool, Box<dyn Error>> {
    let client = Client::new();
    let device_id = get_hardware_id();
    let url = format!(
        "${origin}/api/apps/${appSlug}/devices/check?deviceId={}&platform=windows",
        device_id
    );

    let res = client.get(&url).send().await?;
    let data: DeviceCheckResult = res.json().await?;

    if !data.allowed || data.is_locked {
        let reason = data.lock_reason.unwrap_or_else(|| "Hardware banned".into());
        return Err(format!("Device is locked: {}", reason).into());
    }

    println!("Device verified successfully.");
    Ok(true)
}`;

    case "python":
      return `import uuid
import platform
import requests

BASE_URL = "${origin}"
APP_SLUG = "${appSlug}"

def get_hardware_id() -> str:
    """Returns stable MAC-node based hardware ID."""
    return f"PC-{uuid.getnode():012x}"

def verify_device_gatekeeper():
    device_id = get_hardware_id()
    device_name = platform.node()
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/devices/check"
    params = {
        "deviceId": device_id,
        "deviceName": device_name,
        "platform": "windows",
        "osName": f"{platform.system()} {platform.release()}"
    }

    res = requests.get(url, params=params, timeout=10)
    data = res.json()

    if res.status_code == 403 or not data.get("allowed", False):
        reason = data.get("lockReason") or data.get("error") or "Hardware is locked"
        raise PermissionError(f"Computer Locked: {reason}")

    print(f"Device allowed: {device_id}")
    return True`;

    case "fetch":
      return `const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";

async function checkDeviceGatekeeper(deviceId, deviceName = "Client-PC") {
  const params = new URLSearchParams({
    deviceId,
    deviceName,
    platform: "windows"
  });

  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/devices/check?\${params.toString()}\`);
  const data = await res.json();

  if (!res.ok || !data.allowed) {
    const reason = data.lockReason || data.error || "Access denied";
    throw new Error(\`Device is locked: \${reason}\`);
  }

  console.log("Device access verified.");
  return data;
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";

const ab = new AlsaBase("${origin}");

// Generate always-consistent Hardware ID for this machine
const deviceId = await ab.apps.getHwid();

// Check device status and auto-register host
const check = await ab.apps.checkDevice("${appSlug}", deviceId, {
  deviceName: "Workstation-1",
  platform: "windows"
});

if (check.isLocked) {
  throw new Error("This computer is locked: " + (check.lockReason || "Access prohibited"));
}
console.log("Device permitted.");`;

    case "endpoints":
    default:
      return `# Check if hardware ID is permitted or locked
curl "${origin}/api/apps/${appSlug}/devices/check?deviceId=PC-HWID-98234&deviceName=Office-PC&platform=windows"`;
  }
}

// ----------------------------------------------------------------------------
// 3. LICENSES & ACTIVATION
// ----------------------------------------------------------------------------
function getLicenseSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public class LicenseManager
{
    private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    private const string BaseUrl = "${origin}";
    private const string AppSlug = "${appSlug}";

    // 1. Activate a Serial Key on this Device
    public static async Task<bool> ActivateSerialKeyAsync(string serialKey, string deviceId)
    {
        var payload = new
        {
            key = serialKey.Trim().ToUpper(),
            deviceId = deviceId,
            deviceName = Environment.MachineName,
            platform = "windows"
        };

        var res = await _http.PostAsJsonAsync($"{BaseUrl}/api/apps/{AppSlug}/licenses/activate", payload);
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadFromJsonAsync<JsonElement>();
            string message = err.TryGetProperty("error", out var e) ? e.GetString() : "Activation failed";
            throw new Exception(message);
        }

        Console.WriteLine("Serial key activated and bound to this hardware seat!");
        return true;
    }

    // 2. Validate Serial Key on Startup
    public static async Task<bool> ValidateLicenseAsync(string serialKey, string deviceId)
    {
        var payload = new { key = serialKey.Trim().ToUpper(), deviceId = deviceId };
        var res = await _http.PostAsJsonAsync($"{BaseUrl}/api/apps/{AppSlug}/licenses/validate", payload);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        return res.IsSuccessStatusCode && json.GetProperty("valid").GetBoolean();
    }

    // 3. Deactivate / Release Seat (Transfers License to Another PC)
    public static async Task<bool> DeactivateLicenseAsync(string serialKey, string deviceId)
    {
        var payload = new { key = serialKey.Trim().ToUpper(), deviceId = deviceId };
        var res = await _http.PostAsJsonAsync($"{BaseUrl}/api/apps/{AppSlug}/licenses/deactivate", payload);
        return res.IsSuccessStatusCode;
    }
}`;

    case "rust":
      return `use reqwest::Client;
use serde_json::json;
use std::error::Error;

pub async fn activate_serial_key(key: &str, device_id: &str) -> Result<bool, Box<dyn Error>> {
    let client = Client::new();
    let url = "${origin}/api/apps/${appSlug}/licenses/activate";
    let body = json!({
        "key": key.trim().to_uppercase(),
        "deviceId": device_id,
        "platform": "windows"
    });

    let res = client.post(url).json(&body).send().await?;
    if !res.status().is_success() {
        let err: serde_json::Value = res.json().await?;
        return Err(err["error"].as_str().unwrap_or("Activation failed").into());
    }

    println!("License activated successfully.");
    Ok(true)
}

pub async fn validate_license(key: &str, device_id: &str) -> Result<bool, Box<dyn Error>> {
    let client = Client::new();
    let url = "${origin}/api/apps/${appSlug}/licenses/validate";
    let body = json!({ "key": key, "deviceId": device_id });

    let res = client.post(url).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    Ok(json["valid"].as_bool().unwrap_or(false))
}

pub async fn deactivate_license(key: &str, device_id: &str) -> Result<bool, Box<dyn Error>> {
    let client = Client::new();
    let url = "${origin}/api/apps/${appSlug}/licenses/deactivate";
    let body = json!({ "key": key, "deviceId": device_id });

    let res = client.post(url).json(&body).send().await?;
    Ok(res.status().is_success())
}`;

    case "python":
      return `import requests

BASE_URL = "${origin}"
APP_SLUG = "${appSlug}"

def activate_license(serial_key: str, device_id: str):
    """Binds serial key to this PC machine."""
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/licenses/activate"
    payload = {
        "key": serial_key.strip().upper(),
        "deviceId": device_id,
        "platform": "windows"
    }
    res = requests.post(url, json=payload, timeout=10)
    if not res.ok:
        raise ValueError(res.json().get("error", "Activation failed"))
    print("License activated successfully.")
    return res.json()

def validate_license(serial_key: str, device_id: str) -> bool:
    """Verifies that license key is valid and unexpired."""
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/licenses/validate"
    res = requests.post(url, json={"key": serial_key, "deviceId": device_id}, timeout=10)
    return res.ok and res.json().get("valid", False)

def deactivate_license(serial_key: str, device_id: str) -> bool:
    """Frees seat for transferring to another machine."""
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/licenses/deactivate"
    res = requests.post(url, json={"key": serial_key, "deviceId": device_id}, timeout=10)
    return res.status_code == 200`;

    case "fetch":
      return `const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";

// 1. Activate serial key
async function activateLicense(key, deviceId, deviceName = "Office-PC") {
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/licenses/activate\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: key.trim().toUpperCase(), deviceId, deviceName, platform: "windows" })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Activation failed");
  return data;
}

// 2. Validate serial key on startup
async function validateLicense(key, deviceId) {
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/licenses/validate\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, deviceId })
  });
  return res.json();
}

// 3. Deactivate serial key (frees slot for seat transfer)
async function deactivateLicense(key, deviceId) {
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/licenses/deactivate\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, deviceId })
  });
  return res.ok;
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";

const ab = new AlsaBase("${origin}");

// Generate consistent Hardware ID for this machine
const deviceId = await ab.apps.getHwid();

// 1. Activate serial number
const activation = await ab.apps.activateLicense("${appSlug}", {
  key: "XXXX-XXXX-XXXX-XXXX",
  deviceId,
  deviceName: "Office-PC",
  platform: "windows"
});
console.log("Seats used:", activation.license.activatedCount, "/", activation.license.maxActivations);

// 2. Validate license
const val = await ab.apps.validateLicense("${appSlug}", {
  key: "XXXX-XXXX-XXXX-XXXX",
  deviceId
});
console.log("Is valid:", val.valid);

// 3. Deactivate license
await ab.apps.deactivateLicense("${appSlug}", {
  key: "XXXX-XXXX-XXXX-XXXX",
  deviceId
});`;

    case "endpoints":
    default:
      return `# 1. Activate serial key on this device
curl -X POST "${origin}/api/apps/${appSlug}/licenses/activate" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"XXXX-XXXX-XXXX-XXXX","deviceId":"PC-HWID-98234","deviceName":"Office-PC","platform":"windows"}'

# 2. Validate existing serial key
curl -X POST "${origin}/api/apps/${appSlug}/licenses/validate" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"XXXX-XXXX-XXXX-XXXX","deviceId":"PC-HWID-98234"}'

# 3. Deactivate license from machine (frees seat)
curl -X POST "${origin}/api/apps/${appSlug}/licenses/deactivate" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"XXXX-XXXX-XXXX-XXXX","deviceId":"PC-HWID-98234"}'`;
  }
}

// ----------------------------------------------------------------------------
// 4. AUTH WITHOUT SDK (ADMIN & USER)
// ----------------------------------------------------------------------------
function getAuthSnippet(lang: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public class AlsaBaseAuthClient
{
    private readonly HttpClient _http = new HttpClient { BaseAddress = new Uri("${origin}") };
    private string _jwtToken = "";

    // =========================================================================
    // 1. ADMIN / SUPERUSER AUTHENTICATION
    // Endpoint: POST /api/auth/superusers/login
    // =========================================================================
    public async Task<string> LoginAsAdminAsync(string email, string password)
    {
        var payload = new { email, password };
        var res = await _http.PostAsJsonAsync("/api/auth/superusers/login", payload);
        
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadFromJsonAsync<JsonElement>();
            throw new Exception(err.GetProperty("error").GetString());
        }

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        _jwtToken = json.GetProperty("token").GetString();
        
        // Attach JWT bearer token to default headers for all subsequent requests
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _jwtToken);
        Console.WriteLine($"Authenticated as Superuser! JWT Token: {_jwtToken}");
        return _jwtToken;
    }

    // =========================================================================
    // 2. REGULAR USER AUTHENTICATION (Auth Collection e.g. 'users')
    // Endpoint: POST /api/collections/users/auth-with-password
    // =========================================================================
    public async Task<string> LoginAsUserAsync(string identity, string password, string collection = "users")
    {
        var payload = new { identity, password };
        var res = await _http.PostAsJsonAsync($"/api/collections/{collection}/auth-with-password", payload);
        
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadFromJsonAsync<JsonElement>();
            throw new Exception(err.GetProperty("error").GetString());
        }

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        _jwtToken = json.GetProperty("token").GetString();
        var userRecord = json.GetProperty("record");

        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _jwtToken);
        Console.WriteLine($"Authenticated as user {userRecord.GetProperty("email").GetString()}!");
        return _jwtToken;
    }

    // =========================================================================
    // 3. MAKING AUTHENTICATED REQUESTS
    // Simply use the HttpClient with the Authorization header attached
    // =========================================================================
    public async Task FetchProtectedRecordsAsync(string collectionName)
    {
        var res = await _http.GetAsync($"/api/collections/{collectionName}/records?page=1&perPage=20");
        res.EnsureSuccessStatusCode();
        var records = await res.Content.ReadFromJsonAsync<JsonElement>();
        Console.WriteLine($"Fetched records: {records}");
    }
}`;

    case "rust":
      return `use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::Client;
use serde_json::{json, Value};
use std::error::Error;

pub struct AlsaBaseAuthClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl AlsaBaseAuthClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: "${origin}".into(),
            token: None,
        }
    }

    // 1. Superuser / Admin Login (POST /api/auth/superusers/login)
    pub async fn login_admin(&mut self, email: &str, password: &str) -> Result<String, Box<dyn Error>> {
        let url = format!("{}/api/auth/superusers/login", self.base_url);
        let res = self.client.post(&url)
            .json(&json!({ "email": email, "password": password }))
            .send().await?;

        let json: Value = res.json().await?;
        if let Some(token) = json["token"].as_str() {
            self.token = Some(token.to_string());
            println!("Admin authenticated successfully!");
            Ok(token.to_string())
        } else {
            Err(json["error"].as_str().unwrap_or("Admin login failed").into())
        }
    }

    // 2. Client User Login (POST /api/collections/users/auth-with-password)
    pub async fn login_user(&mut self, identity: &str, password: &str) -> Result<String, Box<dyn Error>> {
        let url = format!("{}/api/collections/users/auth-with-password", self.base_url);
        let res = self.client.post(&url)
            .json(&json!({ "identity": identity, "password": password }))
            .send().await?;

        let json: Value = res.json().await?;
        if let Some(token) = json["token"].as_str() {
            self.token = Some(token.to_string());
            println!("User authenticated successfully!");
            Ok(token.to_string())
        } else {
            Err(json["error"].as_str().unwrap_or("User login failed").into())
        }
    }

    // 3. Make an Authenticated Request using Bearer Token
    pub async fn get_protected_data(&self, path: &str) -> Result<Value, Box<dyn Error>> {
        let token = self.token.as_ref().ok_or("Not authenticated")?;
        let url = format!("{}{}", self.base_url, path);

        let res = self.client.get(&url)
            .bearer_auth(token)
            .send().await?;

        let data = res.json::<Value>().await?;
        Ok(data)
    }
}`;

    case "python":
      return `import requests

class AlsaBaseAuthClient:
    def __init__(self, base_url: str = "${origin}"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.token = None

    # 1. Superuser / Admin Login (POST /api/auth/superusers/login)
    def login_admin(self, email: str, password: str) -> str:
        url = f"{self.base_url}/api/auth/superusers/login"
        resp = self.session.post(url, json={"email": email, "password": password}, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        self.token = data["token"]
        # Attach Bearer token to all session requests automatically
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in as Admin: {data['user']['email']}")
        return self.token

    # 2. Regular User Login (POST /api/collections/users/auth-with-password)
    def login_user(self, identity: str, password: str, collection: str = "users") -> str:
        url = f"{self.base_url}/api/collections/{collection}/auth-with-password"
        resp = self.session.post(url, json={"identity": identity, "password": password}, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        self.token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in as User: {data['record']['email']}")
        return self.token

    # 3. Performing Authenticated Database Queries
    def get_records(self, collection_name: str, page: int = 1, per_page: int = 20):
        url = f"{self.base_url}/api/collections/{collection_name}/records"
        params = {"page": page, "perPage": per_page}
        resp = self.session.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()`;

    case "fetch":
      return `const BASE_URL = "${origin}";

// =========================================================================
// 1. ADMIN / SUPERUSER AUTHENTICATION
// Endpoint: POST /api/auth/superusers/login
// =========================================================================
async function loginAdmin(email, password) {
  const res = await fetch(\`\${BASE_URL}/api/auth/superusers/login\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Admin authentication failed");
  }

  const { token, user } = await res.json();
  console.log("Admin authenticated successfully:", user.email);
  return token;
}

// =========================================================================
// 2. REGULAR USER AUTHENTICATION
// Endpoint: POST /api/collections/users/auth-with-password
// =========================================================================
async function loginUser(identity, password, collection = "users") {
  const res = await fetch(\`\${BASE_URL}/api/collections/\${collection}/auth-with-password\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "User authentication failed");
  }

  const { token, record } = await res.json();
  console.log("User authenticated successfully:", record.email);
  return token;
}

// =========================================================================
// 3. MAKING AUTHENTICATED REQUESTS USING BEARER TOKEN
// =========================================================================
async function fetchProtectedRecords(token, collection = "posts") {
  const res = await fetch(\`\${BASE_URL}/api/collections/\${collection}/records\`, {
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json"
    }
  });
  return res.json();
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";

const ab = new AlsaBase("${origin}");

// 1. Superuser / Admin Login
const adminAuth = await ab.auth.loginSuperuser("admin@example.com", "password");
console.log("Admin Token:", adminAuth.token);

// 2. Regular User Login
const userAuth = await ab.collection("users").authWithPassword("user@example.com", "password");
console.log("User Token:", userAuth.token);
console.log("User Record:", userAuth.record);

// Subsequent calls automatically use the cached JWT token in headers!
const records = await ab.collection("posts").getList(1, 20);`;

    case "endpoints":
    default:
      return `# 1. Authenticate Superuser / Admin
curl -X POST "${origin}/api/auth/superusers/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@example.com","password":"your-admin-password"}'

# 2. Authenticate Regular Client User
curl -X POST "${origin}/api/collections/users/auth-with-password" \\
  -H "Content-Type: application/json" \\
  -d '{"identity":"user@example.com","password":"your-user-password"}'

# 3. Call any protected endpoint using the returned JWT Token
curl "${origin}/api/collections/posts/records" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`;
  }
}

// ----------------------------------------------------------------------------
// 5. FULL INTEGRATED LIFECYCLE
// ----------------------------------------------------------------------------
function getFullLifecycleSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

public class AlsaBaseAppIntegration
{
    private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    private readonly string _baseUrl = "${origin}";
    private readonly string _appSlug = "${appSlug}";

    // Step 1: Read persistent Windows MachineGuid HWID
    public static string GetHardwareId()
    {
        try
        {
            using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                       .OpenSubKey(@"SOFTWARE\\Microsoft\\Cryptography");
            var guid = key?.GetValue("MachineGuid")?.ToString();
            if (!string.IsNullOrEmpty(guid)) return guid;
        }
        catch { }
        return Environment.MachineName;
    }

    // Step 2: Device Gatekeeper Check (lock/ban enforcement)
    public async Task CheckDeviceGatekeeperAsync(string deviceId)
    {
        var url = $"{_baseUrl}/api/apps/{_appSlug}/devices/check?deviceId={Uri.EscapeDataString(deviceId)}&platform=windows";
        var res = await _http.GetAsync(url);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        if (res.StatusCode == System.Net.HttpStatusCode.Forbidden || !json.GetProperty("allowed").GetBoolean())
        {
            string reason = json.TryGetProperty("lockReason", out var r) ? r.GetString() : "Access denied";
            throw new Exception($"Application locked: {reason}");
        }
    }

    // Step 3: Check for Mandatory / Automatic Updates
    public async Task CheckUpdateAsync(string currentVersion, string deviceId)
    {
        var url = $"{_baseUrl}/api/apps/{_appSlug}/check-update?currentVersion={currentVersion}&platform=windows&deviceId={Uri.EscapeDataString(deviceId)}";
        var res = await _http.GetAsync(url);
        if (!res.IsSuccessStatusCode) return;

        var update = await res.Content.ReadFromJsonAsync<JsonElement>();
        if (update.GetProperty("hasUpdate").GetBoolean())
        {
            string latest = update.GetProperty("latestVersion").GetString();
            bool isMandatory = update.GetProperty("isMandatory").GetBoolean();
            Console.WriteLine($"Update available: v{latest} (Mandatory: {isMandatory})");
        }
    }

    // Step 4: Activate Serial Key
    public async Task ActivateLicenseAsync(string serialKey, string deviceId)
    {
        var payload = new
        {
            key = serialKey.Trim().ToUpper(),
            deviceId = deviceId,
            deviceName = Environment.MachineName,
            platform = "windows"
        };
        var res = await _http.PostAsJsonAsync($"{_baseUrl}/api/apps/{_appSlug}/licenses/activate", payload);
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadFromJsonAsync<JsonElement>();
            throw new Exception(err.GetProperty("error").GetString());
        }
    }

    // Step 5: Validate License on Launch
    public async Task<bool> ValidateLicenseAsync(string serialKey, string deviceId)
    {
        var payload = new { key = serialKey.Trim().ToUpper(), deviceId = deviceId };
        var res = await _http.PostAsJsonAsync($"{_baseUrl}/api/apps/{_appSlug}/licenses/validate", payload);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return res.IsSuccessStatusCode && json.GetProperty("valid").GetBoolean();
    }
}`;

    case "rust":
      return `use reqwest::Client;
use serde_json::json;
use std::error::Error;

pub struct AlsaBaseAppClient {
    client: Client,
    base_url: String,
    app_slug: String,
}

impl AlsaBaseAppClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: "${origin}".into(),
            app_slug: "${appSlug}".into(),
        }
    }

    // 1. Gatekeeper check
    pub async fn check_device(&self, device_id: &str) -> Result<bool, Box<dyn Error>> {
        let url = format!("{}/api/apps/{}/devices/check?deviceId={}", self.base_url, self.app_slug, device_id);
        let res = self.client.get(&url).send().await?;
        let json: serde_json::Value = res.json().await?;
        Ok(json["allowed"].as_bool().unwrap_or(false))
    }

    // 2. Check update
    pub async fn check_update(&self, current_ver: &str) -> Result<bool, Box<dyn Error>> {
        let url = format!("{}/api/apps/{}/check-update?currentVersion={}&platform=windows", self.base_url, self.app_slug, current_ver);
        let res = self.client.get(&url).send().await?;
        let json: serde_json::Value = res.json().await?;
        Ok(json["hasUpdate"].as_bool().unwrap_or(false))
    }

    // 3. Activate serial key
    pub async fn activate_license(&self, key: &str, device_id: &str) -> Result<bool, Box<dyn Error>> {
        let url = format!("{}/api/apps/{}/licenses/activate", self.base_url, self.app_slug);
        let body = json!({ "key": key, "deviceId": device_id, "platform": "windows" });
        let res = self.client.post(&url).json(&body).send().await?;
        Ok(res.status().is_success())
    }
}`;

    case "python":
      return `import uuid
import platform
import requests

class AlsaBaseAppClient:
    def __init__(self):
        self.base_url = "${origin}"
        self.app_slug = "${appSlug}"
        self.session = requests.Session()

    def get_hardware_id(self) -> str:
        return f"PC-{uuid.getnode():012x}"

    def check_device(self, device_id: str) -> bool:
        url = f"{self.base_url}/api/apps/{self.app_slug}/devices/check"
        res = self.session.get(url, params={"deviceId": device_id}, timeout=10)
        return res.ok and res.json().get("allowed", False)

    def check_update(self, current_version: str, device_id: str) -> dict:
        url = f"{self.base_url}/api/apps/{self.app_slug}/check-update"
        params = {"currentVersion": current_version, "platform": "windows", "deviceId": device_id}
        return self.session.get(url, params=params, timeout=10).json()

    def activate_license(self, serial_key: str, device_id: str) -> dict:
        url = f"{self.base_url}/api/apps/{self.app_slug}/licenses/activate"
        payload = {"key": serial_key.strip().upper(), "deviceId": device_id, "platform": "windows"}
        res = self.session.post(url, json=payload, timeout=10)
        res.raise_for_status()
        return res.json()`;

    case "fetch":
      return `const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";

// 1. Device Gatekeeper check
async function checkDevice(deviceId) {
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/devices/check?deviceId=\${encodeURIComponent(deviceId)}\`);
  const data = await res.json();
  if (!res.ok || !data.allowed) throw new Error(data.lockReason || "Device locked");
  return data;
}

// 2. Check for application update
async function checkUpdate(currentVersion, deviceId) {
  const params = new URLSearchParams({ currentVersion, platform: "windows", deviceId });
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/check-update?\${params.toString()}\`);
  return res.json();
}

// 3. Activate serial key
async function activateLicense(key, deviceId) {
  const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/licenses/activate\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, deviceId, platform: "windows" })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";

const ab = new AlsaBase("${origin}");

// Consistent HWID generator
const deviceId = await ab.apps.getHwid();

// 1. Gatekeeper Check
const check = await ab.apps.checkDevice("${appSlug}", deviceId);
if (check.isLocked) throw new Error(check.lockReason || "Device locked");

// 2. Update Check (with device enforcement)
const update = await ab.apps.checkUpdate("${appSlug}", {
  currentVersion: "1.0.0",
  platform: "windows",
  deviceId
});
if (update.hasUpdate) {
  console.log("Update available: v" + update.latestVersion);
}

// 3. License Activation
const activation = await ab.apps.activateLicense("${appSlug}", {
  key: "XXXX-XXXX-XXXX-XXXX",
  deviceId
});`;

    case "endpoints":
    default:
      return `# 1. Gatekeeper check
curl "${origin}/api/apps/${appSlug}/devices/check?deviceId=PC-HWID-98234"

# 2. Check updates
curl "${origin}/api/apps/${appSlug}/check-update?currentVersion=1.0.0&platform=windows&deviceId=PC-HWID-98234"

# 3. Activate serial key
curl -X POST "${origin}/api/apps/${appSlug}/licenses/activate" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"XXXX-XXXX-XXXX-XXXX","deviceId":"PC-HWID-98234","platform":"windows"}'

# 4. Validate serial key
curl -X POST "${origin}/api/apps/${appSlug}/licenses/validate" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"XXXX-XXXX-XXXX-XXXX","deviceId":"PC-HWID-98234"}'`;
  }
}

// ----------------------------------------------------------------------------
// 6. APP LOGS & CRASH REPORTING
// ----------------------------------------------------------------------------
function getLogsSnippet(lang: string, appSlug: string, origin: string): string {
  switch (lang) {
    case "csharp":
      return `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace AlsaBaseClient
{
    public class AlsaBaseLogger
    {
        private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        private const string BaseUrl = "${origin}";
        private const string AppSlug = "${appSlug}";
        private const string AppVersion = "1.0.0";

        /// <summary>
        /// Reads persistent Windows Registry MachineGuid.
        /// </summary>
        public static string GetHardwareId()
        {
            try
            {
                using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                           .OpenSubKey(@"SOFTWARE\\Microsoft\\Cryptography");
                var guid = key?.GetValue("MachineGuid")?.ToString();
                if (!string.IsNullOrEmpty(guid)) return guid;
            }
            catch { }
            return Environment.MachineName;
        }

        /// <summary>
        /// Upload a single log entry or crash report to AlsaBase
        /// </summary>
        public static async Task<bool> SendLogAsync(string level, string message, Exception ex = null, object metadata = null)
        {
            try
            {
                var payload = new
                {
                    level = level.ToUpper(),
                    message = message,
                    stackTrace = ex?.ToString(),
                    deviceId = GetHardwareId(),
                    deviceName = Environment.MachineName,
                    appVersion = AppVersion,
                    platform = "windows",
                    metadata = metadata
                };

                var response = await _http.PostAsJsonAsync($"{BaseUrl}/api/apps/{AppSlug}/logs", payload);
                return response.IsSuccessStatusCode;
            }
            catch (Exception e)
            {
                Console.WriteLine($"[AlsaBaseLogger] Failed to upload log: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Upload a full .log or .txt file from disk to AlsaBase
        /// </summary>
        public static async Task<bool> SendLogFileAsync(string filePath)
        {
            if (!File.Exists(filePath)) return false;

            try
            {
                var content = await File.ReadAllTextAsync(filePath);
                var payload = new
                {
                    rawContent = content,
                    fileName = Path.GetFileName(filePath),
                    deviceId = GetHardwareId(),
                    appVersion = AppVersion,
                    platform = "windows"
                };

                var response = await _http.PostAsJsonAsync($"{BaseUrl}/api/apps/{AppSlug}/logs/upload", payload);
                return response.IsSuccessStatusCode;
            }
            catch (Exception e)
            {
                Console.WriteLine($"[AlsaBaseLogger] Failed to upload log file: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Install automatic global crash and unhandled exception reporter
        /// </summary>
        public static void HookGlobalExceptions()
        {
            AppDomain.CurrentDomain.UnhandledException += async (sender, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                {
                    await SendLogAsync("FATAL", $"Crash in AppDomain: {ex.Message}", ex);
                }
            };
        }
    }
}`;

    case "rust":
      return `// Cargo.toml dependencies:
// reqwest = { version = "0.12", features = ["json"] }
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"
// tokio = { version = "1", features = ["full"] }

use reqwest::Client;
use serde_json::json;
use std::time::Duration;

const BASE_URL: &str = "${origin}";
const APP_SLUG: &str = "${appSlug}";
const APP_VERSION: &str = "1.0.0";

pub struct AlsaBaseLogger {
    client: Client,
    device_id: String,
}

impl AlsaBaseLogger {
    pub fn new(device_id: impl Into<String>) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            device_id: device_id.into(),
        }
    }

    /// Upload a single log or crash report
    pub async fn send_log(
        &self,
        level: &str,
        message: &str,
        stack_trace: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let url = format!("{}/api/apps/{}/logs", BASE_URL, APP_SLUG);
        let payload = json!({
            "level": level.to_uppercase(),
            "message": message,
            "stackTrace": stack_trace,
            "deviceId": self.device_id,
            "appVersion": APP_VERSION,
            "platform": std::env::consts::OS,
            "metadata": metadata,
        });

        let resp = self.client.post(&url).json(&payload).send().await?;
        Ok(resp.status().is_success())
    }

    /// Upload a raw log file string
    pub async fn send_log_file(
        &self,
        file_name: &str,
        raw_content: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let url = format!("{}/api/apps/{}/logs/upload", BASE_URL, APP_SLUG);
        let payload = json!({
            "rawContent": raw_content,
            "fileName": file_name,
            "deviceId": self.device_id,
            "appVersion": APP_VERSION,
            "platform": std::env::consts::OS,
        });

        let resp = self.client.post(&url).json(&payload).send().await?;
        Ok(resp.status().is_success())
    }
}`;

    case "python":
      return `import sys
import platform
import traceback
import requests

BASE_URL = "${origin}"
APP_SLUG = "${appSlug}"
APP_VERSION = "1.0.0"

def get_hardware_id() -> str:
    """Returns a stable machine identifier."""
    return f"PC-{platform.node()}-{platform.machine()}"

def send_log(level: str, message: str, stack_trace: str = None, metadata: dict = None) -> bool:
    """Send an error, warning, or diagnostic log to AlsaBase."""
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/logs"
    payload = {
        "level": level.upper(),
        "message": str(message),
        "stackTrace": stack_trace,
        "deviceId": get_hardware_id(),
        "deviceName": platform.node(),
        "appVersion": APP_VERSION,
        "platform": platform.system().lower(),
        "metadata": metadata or {}
    }
    try:
        res = requests.post(url, json=payload, timeout=10)
        return res.status_code == 200
    except Exception as e:
        print(f"[AlsaBaseLogger] Failed to upload log: {e}")
        return False

def send_log_file(file_path: str) -> bool:
    """Upload a full log file (.log, .txt, or .json) to AlsaBase."""
    url = f"{BASE_URL}/api/apps/{APP_SLUG}/logs/upload"
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_content = f.read()
        payload = {
            "rawContent": raw_content,
            "fileName": file_path.split("/")[-1].split("\\\\")[-1],
            "deviceId": get_hardware_id(),
            "appVersion": APP_VERSION,
            "platform": platform.system().lower()
        }
        res = requests.post(url, json=payload, timeout=20)
        return res.status_code == 200
    except Exception as e:
        print(f"[AlsaBaseLogger] Failed to upload log file: {e}")
        return False

# Automatic global unhandled exception hook
def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    trace = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    send_log("FATAL", f"Unhandled exception: {exc_value}", stack_trace=trace)
    sys.__excepthook__(exc_type, exc_value, exc_traceback)

sys.excepthook = handle_uncaught_exception`;

    case "fetch":
      return `const BASE_URL = "${origin}";
const APP_SLUG = "${appSlug}";
const APP_VERSION = "1.0.0";

/**
 * Report an error, crash, or telemetry log to AlsaBase
 */
export async function sendAppLog(options: {
  level?: "INFO" | "WARN" | "ERROR" | "FATAL" | "DEBUG";
  message: string;
  stackTrace?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const res = await fetch(\`\${BASE_URL}/api/apps/\${APP_SLUG}/logs\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: options.level || "INFO",
        message: options.message,
        stackTrace: options.stackTrace,
        deviceId: options.deviceId,
        appVersion: APP_VERSION,
        platform: typeof window !== "undefined" ? "web" : process.platform,
        metadata: options.metadata,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[AlsaBaseLogger] Failed to upload log:", err);
    return false;
  }
}

// Global browser error listeners
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    sendAppLog({
      level: "ERROR",
      message: event.message,
      stackTrace: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    sendAppLog({
      level: "ERROR",
      message: \`Unhandled Promise Rejection: \${event.reason}\`,
      stackTrace: event.reason?.stack,
    });
  });
}`;

    case "sdk":
      return `import AlsaBase from "alsabase";

const ab = new AlsaBase("${origin}");

// 1. Report a single error or crash event
await ab.apps.uploadLog("${appSlug}", {
  level: "ERROR",
  message: "Failed to connect to billing gateway",
  stackTrace: error.stack,
  deviceId: await ab.apps.getHwid(), // Stable cross-platform HWID
  appVersion: "1.0.0",
  platform: "windows",
  metadata: {
    userId: "usr_123",
    feature: "checkout",
  },
});

// 2. Batch upload multiple telemetry logs
await ab.apps.uploadLogs("${appSlug}", [
  { level: "INFO", message: "Application launched", appVersion: "1.0.0" },
  { level: "WARN", message: "High latency detected (450ms)", appVersion: "1.0.0" },
]);

// 3. Upload a raw log file string (.log, .txt, or .json)
import fs from "node:fs";
const fileContent = fs.readFileSync("./crash_dump.log", "utf8");

await ab.apps.uploadLogFile("${appSlug}", fileContent, {
  fileName: "crash_dump.log",
  deviceId: await ab.apps.getHwid(),
  appVersion: "1.0.0",
  level: "ERROR",
});`;

    case "endpoints":
    default:
      return `# 1. Send a single error or crash report
curl -X POST "${origin}/api/apps/${appSlug}/logs" \\
  -H "Content-Type: application/json" \\
  -d '{
    "level": "ERROR",
    "message": "Connection timeout after 30000ms",
    "stackTrace": "at Socket.connect (line 45)\\nat Client (line 12)",
    "deviceId": "PC-HWID-8AC0-B851",
    "deviceName": "Workstation-A",
    "appVersion": "1.0.0",
    "platform": "windows",
    "metadata": { "endpoint": "/sync", "code": "ETIMEDOUT" }
  }'

# 2. Batch upload multiple log entries
curl -X POST "${origin}/api/apps/${appSlug}/logs" \\
  -H "Content-Type: application/json" \\
  -d '{
    "logs": [
      { "level": "INFO", "message": "App started", "appVersion": "1.0.0" },
      { "level": "WARN", "message": "Disk space under 2GB", "appVersion": "1.0.0" }
    ]
  }'

# 3. Upload a raw log file string
curl -X POST "${origin}/api/apps/${appSlug}/logs/upload" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rawContent": "2026-11-04 12:00:00 [ERROR] Out of memory\\n  at MemoryManager...",
    "fileName": "crash.log",
    "deviceId": "PC-HWID-8AC0-B851",
    "appVersion": "1.0.0"
  }'`;
  }
}
