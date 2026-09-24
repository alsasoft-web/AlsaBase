/**
 * Cross-browser, secure & non-secure context clipboard copy utility.
 * Supports modern Clipboard API with graceful fallback to execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== "string") {
    text = String(text ?? "");
  }

  // 1. Try modern navigator.clipboard API if available (HTTPS or localhost)
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback using invisible textarea + execCommand for plain HTTP / restricted environments
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      textArea.setAttribute("readonly", "");
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) return true;
    } catch (err) {
      console.error("Clipboard copy fallback failed:", err);
    }
  }

  return false;
}
