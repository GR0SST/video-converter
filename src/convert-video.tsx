import React, { useEffect, useState } from "react";
import {
  ActionPanel,
  Action,
  Form,
  getSelectedFinderItems,
  showToast,
  getFrontmostApplication,
  Toast,
  List
} from "@raycast/api";
import path from "path";
import { loadSettings, saveSettings, defaultSettings } from "./utils/settings";
import  errorInfo  from "./components/ffmpegNotFound"; 
import { convertVideo, isFFmpegInstalled } from "./utils/ffmpeg";
export interface Values {
  videoFormat: string;
  videoCodec: string;
  deleteOriginalFiles: boolean;
  videoFiles: string[];
  preset: string;
  audioFiles: string[];
  outputFolder: string[];
  subfolderName: string;
  compressionMode: "bitrate" | "filesize";
  bitrate: string;
  maxSize: string;
  rename: string;
  audioBitrate: string;
  useHardwareAcceleration: boolean;
}
import Conversion from "./components/conversion";
type VideoFormat = (typeof AVAILABLE_VIDEO_FORMATS)[number];

const AVAILABLE_VIDEO_FORMATS = ["mp4", "mov", "avi", "mkv", "webm", "mpeg"] as const;
const AVAILABLE_AUDIO_FORMATS = ["mp3", "wav", "flac", "aac", "ogg", "wma"] as const;

const CODEC_OPTIONS: Record<VideoFormat, string[]> = {
  mp4: ["h264", "h265"],
  mov: ["h264", "h265"],
  avi: ["mpeg4","h264"],
  mkv: ["h264", "vp9"],
  webm: ["vp8", "vp9"],
  mpeg: ["mpeg1","mpeg2"],
};

const AVAILABLE_PRESETS = [ "ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "veryslow"]; 

function filterByExtensions(paths: string[], extensions: readonly string[]) {
  return paths.filter((p) => extensions.some((ext) => p.toLowerCase().endsWith(`.${ext}`)));
}

export default function VideoConverter() {
  const [formData, setFormData] = useState<Values | null>(null);
  const [isSubmited, setSubmit] = useState(false);
  const [isFfmpegInstalled, setFfmpegInstalled] = useState(true);

  useEffect(() => {
    async function init() {
      const settings = await loadSettings();
      setFormData(settings);

      const app = await getFrontmostApplication();
      if (app?.name === "Finder") {
        const items = await getSelectedFinderItems();
        const paths = items.filter((i) => !i.path.endsWith("/")).map((i) => i.path);
        const videoFiles = filterByExtensions(paths, AVAILABLE_VIDEO_FORMATS);

        const parents = [...new Set(videoFiles.map((p) => path.dirname(p)))];
        const isCommonFolder = parents.length === 1;
        const outputFolder = isCommonFolder ? [parents[0]] : settings.outputFolder;

        setFormData((prev) => ({
          ...(prev || settings),
          videoFiles: filterByExtensions(paths, AVAILABLE_VIDEO_FORMATS),
          audioFiles: filterByExtensions(paths, [...AVAILABLE_AUDIO_FORMATS]).slice(0, 1),
          outputFolder,
        }));
      }
    }

    
    setFfmpegInstalled(isFFmpegInstalled());
    init();
  }, []);

  if(!isFfmpegInstalled)
    return errorInfo();
  const handleChange = <K extends keyof Values>(key: K, value: Values[K]) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : null));
  };
  const isInteger = (value: string) => /^\d+$/.test(value);
  const isNumber = (value: string) => /^\d+(\.\d+)?$/.test(value);

  const validate = (data: Values): boolean => {
    if (data.videoFiles.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: "No video files selected",
        message: "Select at least one video file.",
      });
      return false;
    }
    if (!data.outputFolder[0]) {
      showToast({
        style: Toast.Style.Failure,
        title: "No output folder",
        message: "Choose an output folder.",
      });
      return false;
    }
    if (data.compressionMode === "bitrate" && !isInteger(data.bitrate)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid Bitrate",
        message: "Bitrate must be a whole number.",
      });
      return false;
    }
    if (data.compressionMode === "filesize" && !isNumber(data.maxSize)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid File Size",
        message: "Max size must be a number.",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = (values: Values) => {
    if (!validate(values)) return;
    showToast({
      style: Toast.Style.Success,
      title: "Conversion started",
      message: `${values.videoFiles.length} file(s)`,
    });
    setSubmit(true);

  };

  const handleSaveDefaults = async () => {
    if (!formData) return;
    if (formData.compressionMode === "bitrate" && !isInteger(formData.bitrate)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid Bitrate",
        message: "Bitrate must be a whole number to save defaults.",
      });
      return;
    }
    if (formData.compressionMode === "filesize" && !isNumber(formData.maxSize)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid File Size",
        message: "Max size must be a number to save defaults.",
      });
      return;
    }

    const { videoFiles, audioFiles, ...settingsToSave } = formData;
    await saveSettings(settingsToSave);
    showToast({ style: Toast.Style.Success, title: "Defaults saved" });
  };

  const handleResetDefaults = async () => {
    await saveSettings(defaultSettings);
    const defaults = await loadSettings();
    setFormData(defaults);
    showToast({ style: Toast.Style.Success, title: "Defaults reset" });
  };

  if (!formData) return <Form isLoading />;

  const availableCodecs = CODEC_OPTIONS[formData.videoFormat as VideoFormat];

  const form = (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert" onSubmit={handleSubmit} />
          <Action
            title="Save as Defaults Settings"
            shortcut={{ modifiers: ["cmd"], key: "s" }}
            onAction={handleSaveDefaults}
          />
          <Action
            title="Reset Defaults Settings"
            shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
            onAction={handleResetDefaults}
          />
        </ActionPanel>
      }
    >
      <Form.Separator />
      <Form.FilePicker
        id="videoFiles"
        title="Video Files"
        value={formData.videoFiles}
        onChange={(files) => handleChange("videoFiles", filterByExtensions(files, AVAILABLE_VIDEO_FORMATS))}
        allowMultipleSelection
        canChooseFiles
        canChooseDirectories={false}
      />

      <Form.Dropdown
        id="videoFormat"
        title="Format"
        value={formData.videoFormat}
        onChange={(v) => handleChange("videoFormat", v as Values["videoFormat"])}
      >
        {AVAILABLE_VIDEO_FORMATS.map((fmt) => (
          <Form.Dropdown.Item key={fmt} value={fmt} title={fmt.toUpperCase()} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="videoCodec"
        title="Codec"
        value={formData.videoCodec}
        onChange={(v) => handleChange("videoCodec", v as Values["videoCodec"])}
      >
        {availableCodecs.map((codec) => (
          <Form.Dropdown.Item key={codec} value={codec} title={codec} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="preset"
        title="Preset"
        value={formData.preset}
         info="Faster presets (like ultrafast, superfast) encode quicker but result in larger files or lower quality for the same bitrate. Slower presets (like slow, veryslow) take longer to encode but produce better compression (smaller size or better quality)."
        onChange={(v) => handleChange("preset", v as Values["preset"])}
      >
        {AVAILABLE_PRESETS.map((preset) => (
          <Form.Dropdown.Item key={preset} value={preset} title={preset.charAt(0).toUpperCase() + preset.slice(1)} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="compressionMode"
        title="Compression Mode"
        value={formData.compressionMode}
        onChange={(v) => handleChange("compressionMode", v as Values["compressionMode"])}
      >
        <Form.Dropdown.Item value="bitrate" title="Bitrate (kbps)" />
        <Form.Dropdown.Item value="filesize" title="Max File Size (MB)" />
      </Form.Dropdown>

      {formData.compressionMode === "bitrate" ? (
        <Form.TextField
          id="bitrate"
          title="Bitrate (kbps)"
          value={formData.bitrate}
          onChange={(v) => handleChange("bitrate", v)}
        />
      ) : (
        <Form.TextField
          id="maxSize"
          title="Max Size (MB)"
          value={formData.maxSize}
          onChange={(v) => handleChange("maxSize", v)}
        />
      )}

      <Form.Separator />

      <Form.FilePicker
        id="audioFiles"
        title="Replace Audio"
        value={formData.audioFiles}
        onChange={(files) =>
          handleChange(
            "audioFiles",
            filterByExtensions(files, [...AVAILABLE_VIDEO_FORMATS, ...AVAILABLE_AUDIO_FORMATS]),
          )
        }
        allowMultipleSelection={false}
        canChooseFiles
        canChooseDirectories={false}
      />

      <Form.Dropdown
        id="audioBitrate"
        title="Audio Bitrate (kbps)"
        value={formData.audioBitrate}
        onChange={(v) => handleChange("audioBitrate", v)}
      >
        <Form.Dropdown.Item value="64" title="64 kbps (very low)" />
        <Form.Dropdown.Item value="96" title="96 kbps (low)" />
        <Form.Dropdown.Item value="128" title="128 kbps (standard)" />
        <Form.Dropdown.Item value="192" title="192 kbps (good quality)" />
        <Form.Dropdown.Item value="256" title="256 kbps (high)" />
        <Form.Dropdown.Item value="320" title="320 kbps (maximum)" />
      </Form.Dropdown>

      <Form.Separator />

      <Form.FilePicker
        id="outputFolder"
        title="Output Folder"
        value={formData.outputFolder}
        onChange={(folders) => handleChange("outputFolder", folders)}
        canChooseDirectories
        allowMultipleSelection={false}
        canChooseFiles={false}
      />

      <Form.TextField
        id="subfolderName"
        title="Subfolder (Optional)"
        value={formData.subfolderName}
        onChange={(v) => handleChange("subfolderName", v)}
      />

      <Form.TextField
        id="rename"
        title="Rename (Optional)"
        value={formData.rename}
        onChange={(v) => handleChange("rename", v)}
        info="Shortcuts: {name} - Original name, {ext} - Original extension, {format} - Output format, {codec} - Output codec {length} - Output length in seconds"
      />

      <Form.Checkbox
        id="useHardwareAcceleration"
        label="Use Hardware Acceleration"
        info = "Enable hardware acceleration for encoding. This may speed up conversion but can lead to inaccurate results and is not supported by all formats"
        value={formData.useHardwareAcceleration}
        onChange={(v) => handleChange("useHardwareAcceleration", v)}
      />

      <Form.Checkbox
        id="deleteOriginalFiles"
        label="Delete Original Files"
        value={formData.deleteOriginalFiles}
        onChange={(v) => handleChange("deleteOriginalFiles", v)}
      />
    </Form>
  );

  if (!isSubmited) return form;
  


  return (<Conversion {...formData} />);
}
