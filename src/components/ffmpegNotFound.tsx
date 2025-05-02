import { Detail, ActionPanel, Action, environment, open } from "@raycast/api";

export default function FfmpegMissing() {
  const brewCmd = "brew install ffmpeg";

  return (
    <Detail
      markdown={`
# FFmpeg not found

Raycast couldn’t locate **ffmpeg** on your system.

---

### Quick fix  

\`\`\`bash
${brewCmd}
\`\`\`

(Requires Homebrew)
      `}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Homebrew Command" content={brewCmd} />

          <Action title="Run in Terminal" onAction={() => open(`terminal:///${encodeURIComponent(brewCmd)}`)} />

          <Action.OpenInBrowser title="Homebrew Installation Guide" url="https://brew.sh/" />
        </ActionPanel>
      }
    />
  );
}
