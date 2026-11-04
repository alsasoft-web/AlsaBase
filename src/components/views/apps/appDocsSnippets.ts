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
  id: "updates" | "gatekeeper" | "licenses" | "auth" | "lifecycle";
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
  moduleId: "updates" | "gatekeeper" | "licenses" | "auth" | "lifecycle",
  lang: string,
  appSlug: string,
  origin: string
): string {
  switch (moduleId) {
    case "updates":
      return getUpdateSnippet(lang, appSlug, origin);
    case "gatekeeper":
      return getGatekeeperSnippet(lang, appSlug, origin);
    case "licenses":
      return getLicenseSnippet(lang, appSlug, origin);
    case "auth":
      return getAuthSnippet(lang, origin);
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

const ab = new AlsaBase("${origin}");

// Check for updates with automatic semver evaluation
const update = await ab.apps.checkUpdate("${appSlug}", {
  currentVersion: "1.0.0",
  platform: "windows",
});

if (update.hasUpdate) {
  console.log("New version available:", update.latestVersion);
  console.log("Is mandatory:", update.isAutomatic);
  console.log("Direct download URL:", update.downloadUrl);
} else {
  console.log("App is up to date.");
}`;

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
