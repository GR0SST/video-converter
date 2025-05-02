import React, { use, useEffect, useState } from "react";
import path from "path";
import { ActionPanel, Action, Toast, Icon, List, showInFinder, showToast } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { cancelConversion, ConversionTask, convertVideo } from "../utils/ffmpeg";
import { Values } from "../convert-video";

export default function Conversion(values: Values) {
  const [tasks, setTasks] = useState<ConversionTask[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  useEffect(() => {
    convertVideo(values, (t) => setTasks(t.map((x) => ({ ...x }))));
  }, []);

  if (tasks.length === 0) return;
  const completed = tasks.every((t) => t.status === "done" || t.status === "error" || t.status === "cancelled");
  if (completed && !isCompleted) {
    setIsCompleted(true);
    showToast({
      title: "Conversion Completed",
      message: `All ${tasks.length} files have been converted.`,
      style: Toast.Style.Success,
    });
  }
  const title = completed ? "Conversion Completed" : "Converting…";

  return (
    <List
      navigationTitle={title}
    >
      <List.Section title="⚠︎  Do not close this window while converting">
        {tasks.map((t) => {
          const isDone = t.status === "done";
          const percent = isDone ? `Completed in ${formatElapsed(t.elapsed)}` : `${t.progress}%`;

          const subtitle = {
            done: "Done",
            error: "Error",
            converting: `Converting... ${t.fps} fps`,
            queued: "Queued",
            cancelled: "Cancelled",
          };

          const icons = {
            done: Icon.Checkmark,
            error: Icon.XMarkCircle,
            converting: getProgressIcon(t.progress / 100),
            queued: Icon.Clock,
            cancelled: Icon.XMarkCircle,
          };

          return (
            <List.Item
              key={t.id}
              title={path.basename(t.file)}
              subtitle={subtitle[t.status]}
              icon={icons[t.status]}
              accessories={[{ text: percent }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Show in Finder"
                    onAction={() => {
                      const filePath = path.dirname(t.file);
                      showInFinder(filePath);
                    }}
                    icon={Icon.Finder}
                  />
                  <Action
                    title="Cancel Conversion"
                    onAction={() => cancelConversion()}
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
