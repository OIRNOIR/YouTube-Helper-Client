import fs from "node:fs";
import path from "node:path";
import clipboard from "clipboardy";
import { API } from "./API.ts";
import Display from "./Display.ts";
import Downloader from "./Downloader.ts";
import type { ConfigFile } from "./types/ConfigFile.ts";
import type { Video } from "./types/Video.ts";
import { execAsync } from "./util.ts";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const config = JSON.parse(
	fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf-8")
) as ConfigFile;

const display = new Display();
const api = new API(config.apiHostname, config.apiToken);
const downloader = new Downloader(
	config.downloadsDirectory,
	config.cookiesBrowser
);

let normalData: Video[] = [];
let normalPage = 1;
let filterData: Video[];
let filterPage = 0;
let hardTypeFilters: string[] | null = null;
let hardUnreadFilter = false;

let data = normalData;
let page = 1;

let endReached = false;

let filterUnread = false;
const filterTypes = {
	video: true,
	short: true,
	stream: true
};

function getFilteredData(dataInput?: Video[]) {
	let filtered = dataInput ?? data;
	if (filterUnread) filtered = filtered.filter((v) => v.unread == true);
	if (Object.values(filterTypes).some((i) => i == true)) {
		for (const entry of Object.entries(filterTypes)) {
			if (entry[1] == false) {
				filtered = filtered.filter((v) => v.type != entry[0]);
			}
		}
	}
	return filtered;
}

function populateVideoList() {
	display.populateVideoList(getFilteredData());
}

function refreshKeyLabels() {
	if (display.downloadQueueOpen) {
		display.populateKeyLabels([
			"[ r Retry Failed DL ]",
			"[ c Retry w/ Cookie ]",
			"[ l View Logs (messy) ]",
			"[ e Exit Queue ]",
			"[ gg Top ]",
			"[ q Quit ]"
		]);
	} else {
		display.populateKeyLabels([
			"[ f Filter ]",
			"[ d Download ]",
			"[ o MPV ]",
			"[ c Copy Link ]",
			"[ m Mark ]",
			"[ r Refresh ]",
			"[ e DL Queue ]",
			"[ gg Top ]",
			"[ q Quit ]"
		]);
	}
}

let currentInteractionChar = "";

function clearInteractionChar(write = false) {
	if (currentInteractionChar != "") {
		currentInteractionChar = "";
		refreshKeyLabels();
		if (write) display.writeFrame();
	}
}

function scrollToSelectedIndex() {
	const foundDataIndex = data.findIndex(
		(d) => d.videoId == display.left[display.selectedIndex]?.videoId
	);
	const video = foundDataIndex == -1 ? null : (data[foundDataIndex] ?? null);
	display.populateVideoInformation(video);
	display.writeFrame();
}

function updateHardFilters() {
	if (
		(Object.values(filterTypes).some((i) => i == true) &&
			Object.values(filterTypes).some((i) => i == false)) ||
		filterUnread == true
	) {
		if (hardTypeFilters == null && hardUnreadFilter == false) {
			normalData = data;
			normalPage = page;
		}
		if (
			Object.values(filterTypes).some((i) => i == true) &&
			Object.values(filterTypes).some((i) => i == false)
		) {
			hardTypeFilters = Object.entries(filterTypes)
				.filter((e) => e[1] == true)
				.map((e) => e[0]);
		} else {
			hardTypeFilters = null;
		}
		hardUnreadFilter = filterUnread;
		filterData = [];
		filterPage = 0;
		data = filterData;
		page = filterPage;
	} else if (
		(hardTypeFilters != null &&
			(Object.values(filterTypes).every((i) => i == true) ||
				Object.values(filterTypes).every((i) => i == false))) ||
		(hardUnreadFilter == true && filterUnread == false)
	) {
		// Disable hard type filters and return to regular data list
		hardTypeFilters = null;
		hardUnreadFilter = false;
		filterData = [];
		filterPage = 0;
		data = normalData;
		page = normalPage;
	}
}

function updateDownloaderBar() {
	display.downloadQueueError =
		downloader.queue.findIndex((v) => v.status == "error") != -1;
	display.downloadQueueCompleted = downloader.queueIndex;
	display.downloadQueueTotal = downloader.queue.length;
}

async function main() {
	refreshKeyLabels();

	display.writeFrame();

	normalData = await api.fetchFeed();
	data = normalData;

	downloader.on("progressUpdate", () => {
		updateDownloaderBar();
		display.writeFrame();
	});

	display.on("needsData", async () => {
		if (endReached) return;
		page++;
		const newFetch = await api.fetchFeed({
			page,
			type: hardTypeFilters == null ? undefined : hardTypeFilters,
			unread: hardUnreadFilter == true ? true : undefined
		});
		if (newFetch.length == 0) {
			endReached = true;
			return;
		}
		if (getFilteredData(newFetch).length == 0) {
			throw new Error("Something's not right");
		}
		for (const item of newFetch) {
			const existsIndex = data.findIndex((v) => v.videoId == item.videoId);
			if (existsIndex == -1) {
				data.push(item);
			} else {
				data[existsIndex] = item;
			}
		}
		populateVideoList();
		if (display.right.length == 0) {
			const selectedItem = data[0];
			if (selectedItem != undefined) {
				display.populateVideoInformation(selectedItem);
			}
		}
		display.writeFrame();
	});

	populateVideoList();
	display.populateVideoInformation(data[0] ?? null);

	display.writeFrame();

	function upKey() {
		if (display.downloadQueueOpen) {
			if (display.downloadQueueSelectedIndex > 0) {
				display.downloadQueueSelectedIndex--;
				display.writeFrame();
			}
		} else {
			if (display.selectedIndex > 0) {
				display.selectedIndex--;
				scrollToSelectedIndex();
			}
		}
	}

	function downKey() {
		if (display.downloadQueueOpen) {
			if (
				display.downloadQueueSelectedIndex <
				display.displayDownloadQueue.length - 1
			) {
				display.downloadQueueSelectedIndex++;
				display.writeFrame();
			}
		} else {
			if (display.selectedIndex < display.left.length - 1) {
				display.selectedIndex++;
				scrollToSelectedIndex();
			}
		}
	}

	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding("utf8");

	process.stdin.on("data", async (key) => {
		const keyString = key.toString();
		if (display.downloadQueueOpen) {
			switch (keyString) {
				case "\u0003":
				case "q": {
					// ctrl-c
					if (keyString == "\u0003" && currentInteractionChar != "q") {
						currentInteractionChar = "";
					}
					switch (currentInteractionChar) {
						case "q": {
							// Confirmation
							Display.clearScreen();
							return process.exit();
						}
						case "": {
							if (downloader.queue.length != downloader.queueIndex) {
								currentInteractionChar = "q";
								display.populateKeyLabels([
									"ARE YOU SURE? DOWNLOAD IN PROGRESS! Press again to confirm"
								]);
								display.writeFrame();
							} else {
								Display.clearScreen();
								return process.exit();
							}
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "g": {
					switch (currentInteractionChar) {
						case "": {
							currentInteractionChar = "g";
							display.populateKeyLabels(["[ gg Top ]"]);
							display.writeFrame();
							break;
						}
						case "g": {
							clearInteractionChar();
							display.downloadQueueSelectedIndex = 0;
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "e": {
					switch (currentInteractionChar) {
						case "l": {
							// Exit log view
							clearInteractionChar(true); // Includes writeFrame
							break;
						}
						case "": {
							// Close download queue
							display.downloadQueueOpen = false;
							refreshKeyLabels();
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "r": {
					switch (currentInteractionChar) {
						case "": {
							// Retry failed download
							const selectedData =
								display.displayDownloadQueue[display.downloadQueueSelectedIndex];
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							if (selectedData.status == "error") selectedData.status = "silenced";
							downloader.addItem(selectedData);
							updateDownloaderBar();
							display.populateKeyLabels(["Added to download queue"]);
							display.writeFrame();
							refreshKeyLabels();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "c": {
					switch (currentInteractionChar) {
						case "": {
							// Retry failed download with cookies
							const selectedData =
								display.displayDownloadQueue[display.downloadQueueSelectedIndex];
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							if (selectedData.status == "error") selectedData.status = "silenced";
							downloader.addItem(selectedData, true);
							updateDownloaderBar();
							display.populateKeyLabels(["Added to download queue"]);
							display.writeFrame();
							refreshKeyLabels();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "l": {
					switch (currentInteractionChar) {
						case "": {
							// Dump logs
							currentInteractionChar = "l";
							const selectedData =
								display.displayDownloadQueue[display.downloadQueueSelectedIndex];
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							if (selectedData.status == "error") selectedData.status = "silenced";
							updateDownloaderBar();
							Display.clearScreen();
							process.stdout.write(selectedData.stdout);
							process.stdout.write("\nPlease press e to exit.");
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "j": {
					switch (currentInteractionChar) {
						case "": {
							downKey();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "k": {
					switch (currentInteractionChar) {
						case "": {
							upKey();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				default: {
					clearInteractionChar(true);
					if (keyString.length == 3) {
						switch (keyString.charCodeAt(2)) {
							case 65: {
								// Up
								upKey();
								break;
							}
							case 66: {
								// Down
								downKey();
								break;
							}
						}
					}
				}
			}
		} else {
			switch (keyString) {
				case "\u0003":
				case "q": {
					// ctrl-c
					if (keyString == "\u0003" && currentInteractionChar != "q") {
						currentInteractionChar = "";
					}
					switch (currentInteractionChar) {
						case "q": {
							// Confirmation
							Display.clearScreen();
							return process.exit();
						}
						case "": {
							if (downloader.queue.length != downloader.queueIndex) {
								currentInteractionChar = "q";
								display.populateKeyLabels([
									"ARE YOU SURE? DOWNLOAD IN PROGRESS! Press again to confirm"
								]);
								display.writeFrame();
							} else {
								Display.clearScreen();
								return process.exit();
							}
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "g": {
					switch (currentInteractionChar) {
						case "": {
							currentInteractionChar = "g";
							display.populateKeyLabels(["[ gg Top ]"]);
							display.writeFrame();
							break;
						}
						case "g": {
							clearInteractionChar();
							display.selectedIndex = 0;
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "c": {
					switch (currentInteractionChar) {
						case "": {
							const selectedData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not copy that video link"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							clipboard.writeSync(`https://youtu.be/${selectedData.videoId}`);
							display.populateKeyLabels(["Copied!"]);
							display.writeFrame();
							refreshKeyLabels();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "o": {
					switch (currentInteractionChar) {
						case "": {
							const selectedData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not open that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							const command = `nohup mpv "https://youtu.be/${selectedData.videoId}" </dev/null &>/dev/null &`;
							await execAsync(command);
							if (selectedData.unread) {
								await api.markRead({ read: [selectedData.videoId] });
								selectedData.unread = false;
								populateVideoList();
								if (hardTypeFilters != null || hardUnreadFilter == true) {
									const n = normalData.find((d) => d.videoId == selectedData.videoId);
									if (n != undefined) n.unread = false;
								}
							}
							display.populateKeyLabels(["Opened!"]);
							scrollToSelectedIndex();
							refreshKeyLabels();
							break;
						}
						case "f": {
							// Filter (Only) Types
							currentInteractionChar = "fo";
							display.populateKeyLabels([
								"[ v Only Videos ]",
								"[ t Only sTreams ]",
								"[ s Only Shorts ]"
							]);
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "m": {
					switch (currentInteractionChar) {
						case "": {
							// Mark
							currentInteractionChar = "m";
							display.populateKeyLabels([
								"[ r Read ]",
								"[ u Unread ]",
								"[ ar All Read ]"
							]);
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "a": {
					switch (currentInteractionChar) {
						case "m": {
							// Mark All [Read]
							currentInteractionChar = "ma";
							display.populateKeyLabels(["[ r All Read ]"]);
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "f": {
					switch (currentInteractionChar) {
						case "": {
							// Filter
							currentInteractionChar = "f";
							// Eventually add platform filters here
							display.populateKeyLabels([
								`[ u ${filterUnread ? "Unfilter" : "Filter"} Unread ]`,
								"[ t Types ]",
								"[ o Only Types ]",
								"[ r Reset ]"
							]);
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "t": {
					switch (currentInteractionChar) {
						case "f": {
							// Filter Types
							currentInteractionChar = "ft";
							display.populateKeyLabels([
								`[ v ${filterTypes.video ? "Unfilter" : "Filter"} Videos ]`,
								`[ t ${filterTypes.stream ? "Unfilter" : "Filter"} sTreams ]`,
								`[ s ${filterTypes.short ? "Unfilter" : "Filter"} Shorts ]`
							]);
							display.writeFrame();
							break;
						}
						case "ft": {
							// Filter Streams
							clearInteractionChar();
							endReached = false;
							filterTypes.stream = !filterTypes.stream;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						case "fo": {
							// Filter Only Streams
							clearInteractionChar();
							endReached = false;
							for (const k of Object.keys(
								filterTypes
							) as (keyof typeof filterTypes)[]) {
								filterTypes[k] = false;
							}
							filterTypes.stream = true;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "v": {
					switch (currentInteractionChar) {
						case "ft": {
							// Filter Videos
							clearInteractionChar();
							endReached = false;
							filterTypes.video = !filterTypes.video;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						case "fo": {
							// Filter Only Videos
							clearInteractionChar();
							endReached = false;
							for (const k of Object.keys(
								filterTypes
							) as (keyof typeof filterTypes)[]) {
								filterTypes[k] = false;
							}
							filterTypes.video = true;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "s": {
					switch (currentInteractionChar) {
						case "ft": {
							// Filter Shorts
							clearInteractionChar();
							endReached = false;
							filterTypes.short = !filterTypes.short;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						case "fo": {
							// Filter Only Shorts
							clearInteractionChar();
							endReached = false;
							for (const k of Object.keys(
								filterTypes
							) as (keyof typeof filterTypes)[]) {
								filterTypes[k] = false;
							}
							filterTypes.short = true;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "r": {
					switch (currentInteractionChar) {
						case "": {
							// Refresh
							const currentlySelectedOldData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (currentlySelectedOldData != undefined) {
								display.populateVideoInformation(currentlySelectedOldData);
							}
							normalData = [];
							normalPage = 0;
							filterData = [];
							filterPage = 0;

							data =
								hardTypeFilters == null && hardUnreadFilter == false
									? normalData
									: filterData;
							page = 0;

							endReached = false;

							populateVideoList();
							display.writeFrame();
							break;
						}
						case "m": {
							// Mark Read
							clearInteractionChar();
							const selectedData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							if (selectedData.unread) {
								await api.markRead({ read: [selectedData.videoId] });
								selectedData.unread = false;
								populateVideoList();
								if (hardTypeFilters != null || hardUnreadFilter == true) {
									const n = normalData.find((d) => d.videoId == selectedData.videoId);
									if (n != undefined) n.unread = false;
								}
							}
							scrollToSelectedIndex();
							break;
						}
						case "ma": {
							// Mark All Read
							clearInteractionChar();
							const allUnread = data.filter((v) => v.unread == true);
							if (allUnread.length > 0) {
								await api.markRead({ read: allUnread.map((v) => v.videoId) });
								for (const u of allUnread) {
									u.unread = false;
									if (hardTypeFilters != null || hardUnreadFilter == true) {
										const n = normalData.find((d) => d.videoId == u.videoId);
										if (n != undefined) n.unread = false;
									}
								}
								populateVideoList();
							}
							scrollToSelectedIndex();
							break;
						}
						case "f": {
							// Reset filters
							clearInteractionChar();
							endReached = false;
							for (const k of Object.keys(
								filterTypes
							) as (keyof typeof filterTypes)[]) {
								filterTypes[k] = true;
							}
							filterUnread = false;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "u": {
					switch (currentInteractionChar) {
						case "m": {
							// Mark Unread
							clearInteractionChar();
							const selectedData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							if (!selectedData.unread) {
								await api.markRead({ unread: [selectedData.videoId] });
								selectedData.unread = true;
								if (hardTypeFilters != null || hardUnreadFilter == true) {
									const n = normalData.find((d) => d.videoId == selectedData.videoId);
									if (n != undefined) n.unread = true;
								}
								populateVideoList();
							}
							scrollToSelectedIndex();
							break;
						}
						case "f": {
							// Filter unread
							clearInteractionChar();
							endReached = false;
							filterUnread = !filterUnread;
							updateHardFilters();
							populateVideoList();
							scrollToSelectedIndex();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "j": {
					switch (currentInteractionChar) {
						case "": {
							downKey();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "k": {
					switch (currentInteractionChar) {
						case "": {
							upKey();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "d": {
					switch (currentInteractionChar) {
						case "": {
							// Download currently selected video
							const selectedData = data.find(
								(d) => d.videoId == display.left[display.selectedIndex]?.videoId
							);
							if (selectedData == undefined) {
								display.populateKeyLabels(["Could not find that video"]);
								display.writeFrame();
								refreshKeyLabels();
								break;
							}
							downloader.addItem(selectedData);
							if (selectedData.unread) {
								await api.markRead({ read: [selectedData.videoId] });
								selectedData.unread = false;
								populateVideoList();
								if (hardTypeFilters != null || hardUnreadFilter == true) {
									const n = normalData.find((d) => d.videoId == selectedData.videoId);
									if (n != undefined) n.unread = false;
								}
							}
							updateDownloaderBar();
							display.populateKeyLabels(["Added to download queue"]);
							scrollToSelectedIndex();
							refreshKeyLabels();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				case "e": {
					switch (currentInteractionChar) {
						case "": {
							// Open download queue
							display.downloadQueueOpen = true;
							display.displayDownloadQueue = downloader.queue;
							display.downloadQueueScrollOffset = 0;
							display.downloadQueueSelectedIndex = 0;
							refreshKeyLabels();
							display.writeFrame();
							break;
						}
						default: {
							clearInteractionChar(true);
						}
					}
					break;
				}
				default: {
					clearInteractionChar(true);
					if (keyString.length == 3) {
						switch (keyString.charCodeAt(2)) {
							case 65: {
								// Up
								upKey();
								break;
							}
							case 66: {
								// Down
								downKey();
								break;
							}
						}
					}
				}
			}
		}
	});

	process.stdout.on("resize", () => {
		display.writeFrame();
	});
}

void main();
