import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

interface DownloaderEvents {
	progressUpdate: [];
	downloaderOutput: [line: string]; // Verbose
}

interface DownloadVideo {
	link: string;
	stdout: string;
	stderr: string;
	status: "queue" | "progress" | "done" | "error";
	exitCode: null | number;
}

export default class Downloader extends EventEmitter<DownloaderEvents> {
	queue: DownloadVideo[];
	queueIndex: number;
	downloadsFolder: string;
	private currentlyActive: boolean;

	constructor(downloadsFolder: string) {
		super();
		this.downloadsFolder = downloadsFolder;
		this.queue = [];
		this.queueIndex = 0;
		this.currentlyActive = false;
	}

	private activateQueue() {
		if (this.currentlyActive)
			throw new Error("Activate queue used when queue was already active!");
		const currentItem = this.queue[this.queueIndex];
		if (currentItem != undefined) {
			this.currentlyActive = true;
			const item = currentItem;
			item.status = "progress";
			const dlp = spawn(
				/* cspell: disable-next-line */
				`yt-dlp --external-downloader aria2c --sponsorblock-remove sponsor --embed-subs --embed-chapters --newline "${item.link}"`
			);
			dlp.stdout.on("data", (data) => {
				item.stdout = `${item.stdout}\n${data.toString()}`;
				this.emit("downloaderOutput", data.toString());
			});
			dlp.stderr.on("data", (data) => {
				item.stdout = `${item.stdout}\n${data.toString()}`;
				this.emit("downloaderOutput", data.toString());
			});
			dlp.on("exit", (code) => {
				this.emit("progressUpdate");
				item.exitCode = code;
				if (code == 0) {
					item.status = "done";
					// Immediately move on to the next one
					this.currentlyActive = false;
					this.queueIndex++;
					this.activateQueue();
				} else {
					item.status = "error";
					// Wait a minute to continue, we might have made YouTube unhappy. The errored one will need manual intervention.
					setTimeout(() => {
						this.currentlyActive = false;
						this.queueIndex++;
						this.activateQueue();
					}, 60000);
				}
			});
		}
	}

	addItem(link: string) {
		this.queue.push({
			link,
			stdout: "",
			stderr: "",
			status: "queue",
			exitCode: null
		});
	}
}
