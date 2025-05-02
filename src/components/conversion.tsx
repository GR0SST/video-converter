import React, { use, useEffect, useState } from "react";
import path from "path";
import { ActionPanel, Action, Toast, Icon, List } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { cancelConversion, ConversionTask, convertVideo } from "../utils/ffmpeg";
import { Values } from "../convert-video";

export default function Conversion(values: Values) {
  const [tasks, setTasks] = useState<ConversionTask[]>([]);
  useEffect(() => {
    convertVideo(values, (t) => setTasks(t.map((x) => ({ ...x }))));
  }, []);

  return (
    <List
      navigationTitle="Converting…" // auto-focus newest row
    >
      <List.Section title="⚠︎  Do not close this window while converting">
        {tasks.map((t) => {
          const isDone = t.status === "done";
          const percent = isDone?`Completed in ${formatElapsed(t.elapsed)}` :`${t.progress}%`;

          const subtitle = {
            done: "Done",
            error: "Error",
            converting: `Converting... ${t.fps} fps`,
            queued: "Queued",
          }

          return (
            <List.Item
              key={t.id}
              title={path.basename(t.file)}
              subtitle={subtitle[t.status]}
              icon={
                t.status === "done"
                  ? Icon.Checkmark
                  : t.status === "error"
                    ? Icon.XMarkCircle
                    : getProgressIcon(t.progress / 100)
              }
              accessories={[{ text: percent }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Cancel Conversion"
                    onAction={cancelConversion}
                    shortcut={{ modifiers: ["cmd"], key: "x" }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

function formatElapsed(seconds: number | undefined): string {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
}