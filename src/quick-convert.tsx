import React, { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Form,
  getSelectedFinderItems,
  getFrontmostApplication,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import path from "path";
import os from "os";

import errorInfo from "./components/ffmpegNotFound";
import { convertVideo, isFFmpegInstalled } from "./utils/ffmpeg";
import Conversion from "./components/conversion";
import { Values } from "./convert-video";

// ------------------------------------
// Constants
// ------------------------------------
const AVAILABLE_VIDEO_FORMATS = ["mp4", "mov", "avi", "mkv", "webm", "mpeg"] as const;
type VideoFormat = (typeof AVAILABLE_VIDEO_FORMATS)[number];

const CODEC_OPTIONS: Record<VideoFormat, string> = {
  mp4: "h264",
  mov: "h264",
  avi: "h264",
  mkv: "vp9",
  webm: "vp9",
  mpeg: "mpeg2",
};

const DEFAULT_SETTINGS: Values = {
  videoFormat: "mp4",
  videoCodec: "h264",
  compressionMode: "bitrate",
  preset: "medium",
  bitrate: "10000",
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

// ------------------------------------
// Helpers
// ------------------------------------
function filterByExtensions(paths: string[], extensions: readonly string[]) {
  return paths.filter((p) =>
    extensions.some((ext) => p.toLowerCase().endsWith(`.${ext}`))
  );
}

// ------------------------------------
// Main Component
// ------------------------------------
export default function VideoConverter() {
  const [formData, setFormData] = useState<Values | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFfmpegInstalled, setIsFfmpegInstalled] = useState(true);

  useEffect(() => {
    async function initializeForm() {
      const app = await getFrontmostApplication();

      let initialFiles: string[] = [];
      if (app?.name === "Finder") {
        const items = await getSelectedFinderItems();
        const paths = items.filter((i) => !i.path.endsWith("/")).map((i) => i.path);
        initialFiles = filterByExtensions(paths, AVAILABLE_VIDEO_FORMATS);
      }

      const uniqueParents = [...new Set(initialFiles.map((p) => path.dirname(p)))];
      const outputFolder = uniqueParents.length === 1
        ? [uniqueParents[0]]
        : DEFAULT_SETTINGS.outputFolder;

      setFormData({
        ...DEFAULT_SETTINGS,
        videoFiles: initialFiles,
        outputFolder,
      });
    }

    setIsFfmpegInstalled(isFFmpegInstalled());
    initializeForm();
  }, []);

  const handleChange = <K extends keyof Values>(key: K, value: Values[K]) => {
    setFormData((prev) => prev ? { ...prev, [key]: value } : null);
  };

  const handleFormatChange = (format: VideoFormat) => {
    handleChange("videoFormat", format);
    handleChange("videoCodec", CODEC_OPTIONS[format]);
  };

  const handleSubmit = (values: Values) => {
    showToast({
      style: Toast.Style.Success,
      title: "Conversion Started",
      message: `${values.videoFiles.length} file(s)`,
    });
    setIsSubmitted(true);
    // Optionally: convertVideo(values);
  };

  // ------------------------------------
  // Render Logic
  // ------------------------------------
  if (!isFfmpegInstalled) return errorInfo();
  if (!formData) return <Form isLoading />;

  if (isSubmitted) return <Conversion {...formData} />;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Separator />

      <Form.FilePicker
        id="videoFiles"
        title="Files"
        value={formData.videoFiles}
        onChange={(files) =>
          handleChange("videoFiles", filterByExtensions(files, AVAILABLE_VIDEO_FORMATS))
        }
        allowMultipleSelection
        canChooseFiles
        canChooseDirectories={false}
      />

      <Form.Dropdown
        id="videoFormat"
        title="Format"
        value={formData.videoFormat}
        onChange={(v) => handleFormatChange(v as VideoFormat)}
      >
        {AVAILABLE_VIDEO_FORMATS.map((fmt) => (
          <Form.Dropdown.Item key={fmt} value={fmt} title={fmt.toUpperCase()} />
        ))}
      </Form.Dropdown>

      <Form.FilePicker
        id="outputFolder"
        title="Output Folder"
        value={formData.outputFolder}
        onChange={(folders) => handleChange("outputFolder", folders)}
        canChooseDirectories
        allowMultipleSelection={false}
        canChooseFiles={false}
      />

      <Form.Checkbox
        id="useHardwareAcceleration"
        label="Use Hardware Acceleration"
        info="Enable hardware acceleration for encoding. This may speed up conversion but may not be supported on all formats."
        value={formData.useHardwareAcceleration}
        onChange={(v) => handleChange("useHardwareAcceleration", v)}
      />
    </Form>
  );
}
