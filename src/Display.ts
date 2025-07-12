import { EventEmitter } from "node:events";
import emojiRegex from "emoji-regex";
import type { DownloadVideo } from "./Downloader";
import type { Video } from "./types/Video";
import { msToMostSignificantWord, msToShort } from "./util";

const MARGIN_VERTICAL = 2;
const MARGIN_HORIZONTAL = 4;
const GUTTER = 4;
const SCROLL_BUFFER = 3;

interface DisplayEvents {
	needsData: [];
}

export default class Display extends EventEmitter<DisplayEvents> {
	left: {
		content: string;
		videoId: string;
		bold: boolean;
	}[];
	right: {
		content: string;
		formatting?: string[];
		wrap?: boolean;
		center?: boolean;
		justify?: boolean;
	}[];
	bottom: string[];
	selectedIndex: number;
	private emittedNeedsData: boolean;
	scrollOffset: number;

	downloadQueueTotal: number;
	downloadQueueCompleted: number;
	downloadQueueError: boolean;
	displayDownloadQueue: DownloadVideo[];
	downloadQueueOpen: boolean;
	downloadQueueSelectedIndex: number;
	downloadQueueScrollOffset: number;

	constructor() {
		super();
		this.left = [];
		this.right = [];
		this.bottom = [];
		this.selectedIndex = 0;
		this.emittedNeedsData = false;
		this.scrollOffset = 0;

		this.downloadQueueTotal = 0;
		this.downloadQueueCompleted = 0;
		this.downloadQueueError = false;
		this.displayDownloadQueue = [];
		this.downloadQueueOpen = false;
		this.downloadQueueSelectedIndex = 0;
		this.downloadQueueScrollOffset = 0;
	}

	populateVideoList(data: Video[]) {
		const selectedVideoId = this.left[this.selectedIndex]?.videoId;

		let longestNameLength = 0;

		for (let i = 0; i < data.length; i++) {
			const thisItem = data[i];
			if (thisItem != undefined && thisItem.username.length > longestNameLength) {
				longestNameLength = thisItem.username.length;
			}
		}

		const titleShiftRight = Math.ceil((longestNameLength + 1) / 4) * 4;

		const regex = emojiRegex();

		this.left = data.map((v) => {
			let formattedUsername = `${v.username.slice(1)}:`;
			while (formattedUsername.length < titleShiftRight) {
				formattedUsername = `${formattedUsername} `;
			}
			let title = v.title.replaceAll(regex, "").trim();
			if (title.length == 0) {
				title = "< Title contained exclusively emojis >";
			}
			return {
				// Might think of something better to put here
				content: `${formattedUsername}${title}`,
				videoId: v.videoId,
				bold: v.unread
			};
		});
		if (selectedVideoId != undefined) {
			this.selectedIndex = this.left.findIndex(
				(i) => i.videoId == selectedVideoId
			);
		}
		if (this.selectedIndex == -1 || selectedVideoId == undefined) {
			this.selectedIndex = 0;
		}
		this.emittedNeedsData = false;
	}

	populateKeyLabels(keyLabels: string[]) {
		this.bottom = keyLabels;
	}

	populateVideoInformation(
		video: Video | null,
		fullVideoSponsorSegment: null | "sponsor" | "selfpromo" | "exclusive_access"
	) {
		this.right = [];
		if (video == null) return;
		const videoTypeFormatting =
			video.type == "video"
				? "\u001B[37m"
				: video.type == "stream"
					? "\u001B[38;5;21m"
					: "\u001B[38;5;196m";
		this.right.push({
			content: video.title,
			formatting: [`\u001B[1m${videoTypeFormatting}`],
			center: true
		});
		this.right.push({
			content: `${video.displayName}\t${video.duration == null ? "Unknown Duration" : msToShort(video.duration * 1000)}`,
			formatting: ["\u001B[3;31m", "\u001B[33m"],
			justify: true
		});
		this.right.push({
			content: `${video.type == "video" ? "Video" : video.type == "stream" ? "Stream" : "Short"}\t${msToMostSignificantWord(Date.now() - video.timestampMS)} Ago`,
			formatting: [videoTypeFormatting, "\u001B[32m"],
			justify: true
		});
		switch (fullVideoSponsorSegment) {
			case "sponsor": {
				this.right.push({
					content: "Full Video Sponsor",
					formatting: ["\u001B[38;5;46m"],
					center: true
				});
				break;
			}
			case "exclusive_access": {
				this.right.push({
					content: "Exclusive Access",
					formatting: ["\u001B[38;5;35m"],
					center: true
				});
				break;
			}
			case "selfpromo": {
				this.right.push({
					content: "Self Promotion",
					formatting: ["\u001B[38;5;220m"],
					center: true
				});
				break;
			}
		}
		this.right.push({
			content: video.platform,
			formatting: [],
			center: true
		});
		if (video.isCurrentlyLive) {
			this.right.push({
				content: "Currently Live",
				formatting: ["\u001B[38;5;196m"],
				center: true
			});
		}
		this.right.push({
			content: "",
			formatting: []
		});
		this.right.push({
			content:
				video.description != null
					? `${video.title}\n\n${video.description}`
					: video.title,
			formatting: [],
			wrap: true
		});
	}

	writeFrame() {
		let stdout = Display.clearScreenText;
		function write(str: string) {
			stdout = `${stdout}${str}`;
		}
		const width = process.stdout.columns;
		const height = process.stdout.rows;

		let screenScrollTop = 0;
		let screenScrollBottom = 0;

		function calculateScrollBounds(selectedIndex: number, scrollOffset: number) {
			screenScrollTop = selectedIndex - scrollOffset;
			screenScrollBottom = height - MARGIN_VERTICAL * 3 - 3 - screenScrollTop;
		}

		calculateScrollBounds(this.selectedIndex, this.scrollOffset);

		while (screenScrollTop < SCROLL_BUFFER && this.scrollOffset > 0) {
			this.scrollOffset--;
			calculateScrollBounds(this.selectedIndex, this.scrollOffset);
		}

		while (screenScrollBottom < SCROLL_BUFFER) {
			this.scrollOffset++;
			calculateScrollBounds(this.selectedIndex, this.scrollOffset);
		}

		let rightWrapIndex = 0;

		for (let row = 0; row < height; row++) {
			let col = 0;
			if (row == height - MARGIN_VERTICAL - 1) {
				// Download Queue Indicator
				for (; col < MARGIN_HORIZONTAL; col++) {
					write(" ");
				}
				let bottomContent = "";
				let bottomLength = 2;
				if (this.downloadQueueTotal == 0) {
					bottomContent = "[]";
				} else {
					const space = width - 2 * MARGIN_HORIZONTAL;
					// Use two-thirds of the space, rounded
					const toUse = Math.round((space * 2) / 3);
					while (bottomContent.length < toUse - 2) {
						bottomContent = `${bottomContent} `;
					}
					bottomLength = bottomContent.length + 2;
					const shareComplete =
						this.downloadQueueCompleted / this.downloadQueueTotal;
					const markDone = Math.round(shareComplete * bottomContent.length);
					const doneEscapeSequence = this.downloadQueueError
						? "\u001B[48;5;196m"
						: "\u001B[48;5;231m";
					if (markDone == 0) {
						bottomContent = `\u001B[48;5;16m${bottomContent}\u001B[0m`;
					} else if (shareComplete == 1) {
						bottomContent = `${doneEscapeSequence}${bottomContent}\u001B[0m`;
					} else {
						let done = "";
						let togo = "";
						while (done.length < markDone) {
							done = `${done} `;
						}
						while (done.length + togo.length < bottomContent.length) {
							togo = `${togo} `;
						}
						bottomContent = `${doneEscapeSequence}${done}\u001B[48;5;16m${togo}\u001B[0m`;
					}
					bottomContent = `[${bottomContent}]`;
				}
				const extra = width - 2 * MARGIN_HORIZONTAL - bottomLength;
				const padding = Math.floor(extra / 2);
				for (let i = 0; i < padding; i++) {
					write(" ");
					col++;
				}
				write(`${bottomContent}\n`);
			} else if (row == height - MARGIN_VERTICAL - 2) {
				// Bottom row
				for (; col < MARGIN_HORIZONTAL; col++) {
					write(" ");
				}
				let bottomContent = "";
				let tmpCol = col;
				for (let i = 0; i < this.bottom.length; i++) {
					let item = this.bottom[i];
					if (i > 0) item = ` ${item}`;
					if (
						item == undefined ||
						tmpCol + item.length > width - MARGIN_HORIZONTAL - 1
					)
						break;
					bottomContent = `${bottomContent}${item}`;
					tmpCol += item.length;
				}
				bottomContent = bottomContent.trim();
				const extra = width - 2 * MARGIN_HORIZONTAL - bottomContent.length;
				const padding = Math.floor(extra / 2);
				for (let i = 0; i < padding; i++) {
					write(" ");
					col++;
				}
				write(`${bottomContent}\n`);
			} else if (
				row < MARGIN_VERTICAL ||
				(row > height - (2 * MARGIN_VERTICAL + 3) && row < height - 1)
			) {
				write("\n");
			} else if (row == height - 1) {
				// Last margin row; nothing needs printing here
			} else {
				// Content row
				for (; col < MARGIN_HORIZONTAL; col++) {
					write(" ");
				}
				if (this.downloadQueueOpen) {
					const index = row - MARGIN_VERTICAL + this.downloadQueueScrollOffset;
					const item = this.displayDownloadQueue[index];
					if (item == undefined) {
						write("\n");
						continue;
					}
					const selected =
						this.downloadQueueSelectedIndex == index && item != undefined;
					if (selected) {
						write("\u001B[1;97m>\u001B[0m \u001B[4m");
					} else {
						write("  ");
					}
					col += 2;
					let statusText = "";
					let statusFormatting = "";
					switch (item.status) {
						case "queue": {
							statusText = "";
							statusFormatting = "\u001B[38;5;249m";
							break;
						}
						case "progress": {
							statusText = "Working";
							statusFormatting = "\u001B[38;5;226m";
							break;
						}
						case "done": {
							statusText = "Success";
							statusFormatting = "\u001B[38;5;46m";
							break;
						}
						case "error": {
							statusText = "ERROR";
							statusFormatting = "\u001B[38;5;196m";
							break;
						}
						case "silenced": {
							statusText = "ERROR";
							statusFormatting = "\u001B[38;5;124m";
							break;
						}
					}
					while (statusText.length < 7) {
						statusText = `${statusText} `;
					}
					statusText = `[${statusText}] `;
					write(statusFormatting);
					write(statusText);
					col += statusText.length;
					const space = width - MARGIN_HORIZONTAL - col - 2;
					for (let i = 0; i < space; i++) {
						if (i == space - 1 && item.title.length > space) {
							write("\u2026");
						} else if (i == space - 1) {
							write(" \u001B[0m");
						} else {
							write(item.title[i] ?? " ");
						}
						col++;
					}
					write("\u001B[0m");
					if (selected) {
						write(" \u001B[1;97m<\u001B[0m");
					} else {
						write("  ");
					}
					col += 2;
				} else {
					// Left content
					const leftIndex = row - MARGIN_VERTICAL + this.scrollOffset;
					const leftItem = this.left[leftIndex];
					if (leftItem == undefined && !this.emittedNeedsData) {
						// Needs more data to fill the whole screen!
						this.emittedNeedsData = true;
						this.emit("needsData");
					}
					const selected = this.selectedIndex == leftIndex && leftItem != undefined;
					const leftSpace =
						Math.floor((width - 2 * MARGIN_HORIZONTAL) / 2) - GUTTER / 2 - 4;
					if (selected) {
						write("\u001B[1;97m>\u001B[0m \u001B[4m");
					} else {
						write("  ");
					}
					col += 2;
					if (leftItem?.bold) {
						write("\u001B[1;97m");
					} else {
						write("\u001B[38;5;249m");
					}
					for (let i = 0; i < leftSpace; i++) {
						if (
							leftItem != undefined &&
							i == leftSpace - 1 &&
							leftItem.content.length > leftSpace
						) {
							write("\u2026");
						} else if (i == leftSpace - 1) {
							write(" \u001B[0m");
						} else {
							write(leftItem?.content[i] ?? " ");
						}
						col++;
					}
					write("\u001B[0m");
					if (selected) {
						write(" \u001B[1;97m<\u001B[0m");
					} else {
						write("  ");
					}
					col += 2;

					// Gutter
					for (let i = 0; i < GUTTER; i++) {
						write(" ");
						col++;
					}

					// Right content
					let rightItem = this.right[row - MARGIN_VERTICAL];
					if (rightItem == undefined && this.right[this.right.length - 1]?.wrap) {
						rightItem = this.right[this.right.length - 1];
					}
					if (
						rightItem != undefined &&
						(!rightItem.wrap || rightWrapIndex < rightItem.content.length)
					) {
						const rightSpace =
							Math.floor((width - 2 * MARGIN_HORIZONTAL) / 2) - GUTTER / 2;
						if (rightItem.justify) {
							const formattingOne = rightItem.formatting?.[0];
							const formattingTwo = rightItem.formatting?.[1];
							if (formattingOne != undefined) {
								write(formattingOne);
							}
							for (let i = 0; i < rightSpace; i++) {
								if (col >= width - MARGIN_HORIZONTAL) break;
								if (rightItem.content[i] == "\t") {
									write("\u001B[0m");
									const spaceRemaining = width - MARGIN_HORIZONTAL - col;
									const padding =
										spaceRemaining - (rightItem.content.split("\t")[1]?.length ?? 0);
									if (padding > 0) {
										for (let j = 0; j < padding; j++) {
											write(" ");
											col++;
										}
									}
									if (formattingTwo != undefined) {
										write(formattingTwo);
									}
								} else {
									write(rightItem.content[i] ?? " ");
									col++;
								}
							}
						} else {
							const formattingOne = rightItem.formatting?.[0];
							if (formattingOne != undefined) {
								write(formattingOne);
							}
							if (rightItem.center) {
								const padding = Math.floor((rightSpace - rightItem.content.length) / 2);
								for (let i = 0; i < padding; i++) {
									write(" ");
									col++;
								}
							}
							if (rightItem.wrap) {
								let newline = false;
								for (let i = 0; i < rightSpace; i++) {
									if (col >= width - MARGIN_HORIZONTAL) break;
									const char = rightItem.content[i + rightWrapIndex];
									if (char == "\n") {
										newline = true;
										rightWrapIndex += i + 1;
										break;
									}
									write(char ?? " ");
									col++;
								}
								if (!newline) {
									rightWrapIndex += rightSpace;
								}
							} else {
								for (let i = 0; i < rightSpace; i++) {
									if (col >= width - MARGIN_HORIZONTAL) break;
									write(rightItem.content[i] ?? " ");
									col++;
								}
							}
						}
						write("\u001B[0m");
					}
				}
				write("\n");
			}
		}
		process.stdout.write(stdout);
	}

	static get clearScreenText() {
		return "\u001B[2J\u001B[3J\u001B[0;0f";
	}

	static clearScreen() {
		process.stdout.write(Display.clearScreenText);
	}
}
