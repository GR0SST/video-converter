import ffmpeg from 'fluent-ffmpeg';
import fs from "fs";
import util from "util";
import { exec } from "child_process";
import { Values } from "../convert-video";

const path = require("path");

export interface ConversionTask {
    id: number;
    file: string;
    started: Date;
    elapsed?: number;
    progress: number;
    fps: number;
    status: "converting" | "done" | "queued" | "error";
}
const codecs: Record<string, Record<string, string>> = {
    mp4: { h264: "h264", h265: "libx265" },
    mov: { h264: "h264", h265: "libx265" },
    avi: { mpeg4: "mpeg4", h264: "h264" },
    mkv: { h264: "h264", vp9: "libvpx-vp9" },
    webm: { vp8: "libvpx", vp9: "libvpx-vp9" },
    mpeg: { mpeg1: "mpeg1video", mpeg2: "mpeg2video" },
};
const audioCodecs: Record<string, string> = {
    webm: "libopus",
    mpeg: "mp2",
    default: "aac",
}
const currentTasks: ConversionTask[] = [];
const ffmpegPath = "/usr/local/bin/ffmpeg";
const altPath = "/opt/homebrew/bin/ffmpeg";
let hasRun = false;
setFFmpegPath()

export async function convertVideo(values: Values, progress: (task: ConversionTask[]) => void) {
    if (hasRun) return;
    hasRun = true;

    values.videoFiles.map((file, i) => {
        const task: ConversionTask = {
            id: i,
            file,
            started: new Date(),
            fps: 0,
            progress: 0,
            status: "queued",
        };
        currentTasks.push(task);
        return task;
    });

    progress(currentTasks);
    for (const task of currentTasks) {
        await convertFile(task, values, (t) => {
            currentTasks[t.id] = t;
            progress(currentTasks);
        })
    }

}

async function convertFile(task: ConversionTask, params: Values, progress: (task: ConversionTask) => void) {
    if (task.status === "done" || task.status === "error") return progress(task);
    task.status = "converting";
    task.progress = 0;
    task.started = new Date();
    let bitrate = 0;
    const duration = await getVideoDuration(task.file)

    if (params.compressionMode === "bitrate") {
        bitrate = parseInt(params.bitrate);
    } else if (params.compressionMode === "filesize") {
        const size = parseInt(params.maxSize);
        const sizeKb = size * 1000 * 8;
        bitrate = Math.floor((sizeKb - parseInt(params.audioBitrate) * duration) / duration);
    } else {
        throw new Error("Invalid compression mode");
    }
    progress(task);
    return new Promise((res) => {
        const video = ffmpeg().input(task.file);
        params.audioFiles.length && video.input(params.audioFiles[0]);
        const fileName = path.basename(task.file);
        const outputDir = path.join(params.outputFolder[0], params.subfolderName);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const output = getAvailableFilePath(outputDir, fileName, params.videoFormat);

        let videoCodec = codecs[params.videoFormat][params.videoCodec];
        const audioCodec = audioCodecs[params.videoFormat] || audioCodecs.default;

        if (params.useHardwareAcceleration) {
            videoCodec = params.videoCodec === "h265" ? "hevc_videotoolbox" : "h264_videotoolbox";
        }
        const options = [
            `-c:a ${audioCodec}`,
            `-b:a ${params.audioBitrate}k`,
            `-c:v ${videoCodec}`,
            '-map 0:v:0',
            `-b:v ${bitrate}k`,
            `-minrate ${bitrate}k`,
            `-maxrate ${bitrate}k`,
            `-bufsize ${bitrate * 2}k`,
            `-preset ${params.preset}`,
            //'-x264-params', `nal-hrd=cbr:force-cfr=1`,
            '-y'
        ];

        params.audioFiles.length ? options.push('-map 1:a:0') : options.push('-map 0:a:0');

        if (params.useHardwareAcceleration) {
            options.push("-hwaccel videotoolbox")
        } else if (params.videoCodec === "h265") {
            options.push('-vtag hvc1');
        }

        video.outputOptions(options);
        video.duration(duration);
        video.on('error', () => {
            task.status = "error";
            progress(task);
            //console.log(`Error converting ${task.file}`);

            res(false)
        });
        video.on('end', () => {
            task.status = "done";
            task.progress = 100;
            task.elapsed = Math.floor((new Date().getTime() - task.started.getTime()) / 1000);
            progress(task);
            //console.log(`Finished converting ${task.file}`);
            res(true)
        });
        video.on('progress', (p) => {
            if (p.percent)
                task.progress = Math.round(p.percent);
            if (p.frames)
                task.fps = p.currentFps
            console.log(p);
            progress(task);
        });
        console.log(output);

        video.saveToFile(output);
    })

}

export function cancelConversion() {

}


export async function isFFmpegInstalled(): Promise<boolean> {
    try {
        const exists = fs.existsSync(ffmpegPath) || fs.existsSync(altPath);
        return exists;
    } catch (error) {
        console.error("Error checking FFmpeg installation:", error);
        return false;
    }
}

export async function setFFmpegPath(): Promise<void> {
    let path = ""
    if (fs.existsSync(ffmpegPath)) path = ffmpegPath;
    else if (fs.existsSync(altPath)) path = altPath;
    else throw new Error("FFmpeg not found");

    ffmpeg.setFfmpegPath(path);
}

function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration; // in seconds
            if (duration === undefined) return resolve(60)//reject(new Error("Duration not found"));
            resolve(duration);
        });
    });
}

function getAvailableFilePath(outputDir: string, fileName: string, extension: string): string {
    const baseName = path.parse(fileName).name;
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    let finalName = `${baseName}${ext}`;
    let counter = 1;

    let fullPath = path.join(outputDir, finalName);

    while (fs.existsSync(fullPath)) {
        finalName = `${baseName}_${counter}${ext}`;
        fullPath = path.join(outputDir, finalName);
        counter++;
    }

    return fullPath;
}

