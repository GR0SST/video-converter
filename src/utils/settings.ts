import os from "os";
import path from "path";
import { LocalStorage } from "@raycast/api";
import { Values } from "../convert-video";

const SETTINGS_KEY = "video-converter-settings";

export const defaultSettings: Values = {
  videoFormat: "mp4",
  videoCodec: "h264",
  compressionMode: "bitrate",
  preset: "medium",
  bitrate: "12000",
  maxSize: "100",
  audioBitrate: "128",
  outputFolder: [path.join(os.homedir(), "Downloads")],
  rename: "",
  subfolderName: "",
  useHardwareAcceleration: false,
  deleteOriginalFiles: false,
  videoFiles: [],
  audioFiles: [],
};

export async function loadSettings(): Promise<Values> {
  const stored = await LocalStorage.getItem<string>(SETTINGS_KEY);
  const parsed = stored ? JSON.parse(stored) : {};
  return { ...defaultSettings, ...parsed };
}

export async function saveSettings(values: Partial<Values>): Promise<void> {
    const current = await loadSettings();
    const merged = { ...current, ...values };
    await LocalStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}