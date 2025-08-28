import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Video } from "./types/Video";

interface DownloaderEvents {
	progressUpdate: [];
	downloaderOutput: [line: string]; // Verbose
}

export interface DownloadVideo {
	title: string;
	link: string;
	stdout: string;
	status: "queue" | "progress" | "done" | "error" | "silenced";
	exitCode: null | number;
	useAuthentication: boolean;
}

export default class Downloader extends EventEmitter<DownloaderEvents> {
	queue: DownloadVideo[];
	queueIndex: number;
	private downloadsDir: string;
	private currentlyActive: boolean;
	private cookiesBrowser: string;

	constructor(
		downloadsDirectory: string,
		downloadsDirectoryFallback: string,
		cookiesBrowser: string
	) {
		super();
		if (downloadsDirectory.startsWith("~")) {
			this.downloadsDir = resolve(homedir(), `.${downloadsDirectory.slice(1)}`);
		} else {
			this.downloadsDir = resolve(downloadsDirectory);
		}
		if (!fs.existsSync(this.downloadsDir)) {
			// Use fallback
			if (downloadsDirectoryFallback.startsWith("~")) {
				this.downloadsDir = resolve(
					homedir(),
					`.${downloadsDirectoryFallback.slice(1)}`
				);
			} else {
				this.downloadsDir = resolve(downloadsDirectoryFallback);
			}
		}
		this.queue = [];
		this.queueIndex = 0;
		this.currentlyActive = false;
		this.cookiesBrowser = cookiesBrowser;
	}

	private activateQueue() {
		if (this.currentlyActive) {
			throw new Error("Activate queue used when queue was already active!");
		}
		const currentItem = this.queue[this.queueIndex];
		if (currentItem != undefined) {
			this.currentlyActive = true;
			const item = currentItem;
			item.status = "progress";
			const args = [
				"--external-downloader",
				"aria2c",
				/* cspell: disable-next-line */
				"--sponsorblock-remove",
				"sponsor",
				"--embed-subs",
				"--embed-chapters",
				"--newline"
			];
			if (item.useAuthentication) {
				args.push("--cookies-from-browser");
				args.push(this.cookiesBrowser);
			}
			args.push(item.link);
			const dlp = spawn("yt-dlp", args, {
				cwd: this.downloadsDir
			});
			dlp.stdout.on("data", (data) => {
				item.stdout = `${item.stdout}${data.toString()}`;
				this.emit("downloaderOutput", data.toString());
			});
			dlp.stderr.on("data", (data) => {
				item.stdout = `${item.stdout}\u001B[38;5;196m${data.toString()}\u001B[0m`;
				this.emit("downloaderOutput", data.toString());
			});
			dlp.on("exit", (code) => {
				this.queueIndex++;
				item.exitCode = code;
				if (code == 0) {
					item.status = "done";
					// Immediately move on to the next one
					this.currentlyActive = false;
					this.activateQueue();
				} else {
					item.status = "error";
					// Wait a minute to continue, we might have made YouTube unhappy. The errored one will need manual intervention.
					setTimeout(() => {
						this.currentlyActive = false;
						this.emit("progressUpdate");
						this.activateQueue();
					}, 60000);
				}
				this.emit("progressUpdate");
			});
		}
	}

	addItem(video: Video | DownloadVideo, useAuthentication?: boolean) {
		this.queue.push({
			link: "link" in video ? video.link : `https://youtu.be/${video.videoId}`,
			stdout: "",
			status: "queue",
			exitCode: null,
			title: video.title,
			useAuthentication:
				useAuthentication ??
				("useAuthentication" in video ? video.useAuthentication : false)
		});
		if (!this.currentlyActive) {
			setImmediate(() => {
				this.activateQueue();
			});
		}
	}

	removeItem(index: number) {
		const item = this.queue[index];
		if (item != undefined && item.status == "queue") {
			this.queue.splice(index, 1);
			return true;
		}
		return false;
	}
}
