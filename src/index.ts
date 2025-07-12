import fs from "node:fs";
import path from "node:path";
import clipboard from "clipboardy";
import { API } from "./API.ts";
import Display from "./Display.ts";
import type { ConfigFile } from "./types/ConfigFile.ts";
import type { Video } from "./types/Video.ts";
import { execAsync, getFullVideoSponsorBlockSegments } from "./util.ts";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const config = JSON.parse(
	fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf-8")
) as ConfigFile;

const display = new Display();
const api = new API(config.apiHostname, config.apiToken);

let normalData: Video[] = [];
let normalPage = 1;
let filterData: Video[];
let filterPage = 0;
let hardTypeFilters: string[] | null = null;
let hardUnreadFilter = false;

let data = normalData;
let page = 1;

let endReached = false;

let sponsorBlockCacheIndex = 0;
const sponsorBlockCache = new Map<
	string,
	null | "sponsor" | "selfpromo" | "exclusive_access"
>();

let filterUnread = false;
const filterTypes = {
	video: true,
	short: true,
	stream: true
};

const SPONSOR_BLOCK_CACHE_BUFFER = 10;

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

async function cacheSponsorBlockData(targetIndex: number) {
	for (let i = 0; i <= targetIndex; i++) {
		const item = data[i];
		if (item != null) {
			await sbGet(item.videoId);
			if (i > sponsorBlockCacheIndex) sponsorBlockCacheIndex = i;
		}
	}
}

async function sbGet(
	videoId: string
): Promise<null | "sponsor" | "selfpromo" | "exclusive_access"> {
	if (sponsorBlockCache.has(videoId)) {
		return sponsorBlockCache.get(videoId) ?? null;
	}
	const segment = await getFullVideoSponsorBlockSegments(videoId);
	sponsorBlockCache.set(videoId, segment);
	return segment;
}

function refreshKeyLabels() {
	display.populateKeyLabels([
		"[ f Filter ]",
		"[ d Download ]",
		"[ o MPV ]",
		"[ c Copy Link ]",
		"[ m Mark ]",
		"[ r Refresh ]",
		"[ gg Top ]",
		"[ q Quit ]"
	]);
}

let currentInteractionChar = "";

function clearInteractionChar(write = false) {
	if (currentInteractionChar != "") {
		currentInteractionChar = "";
		refreshKeyLabels();
		if (write) display.writeFrame();
	}
}

async function scrollToSelectedIndex() {
	const foundDataIndex = data.findIndex(
		(d) => d.videoId == display.left[display.selectedIndex]?.videoId
	);
	const video = foundDataIndex == -1 ? null : (data[foundDataIndex] ?? null);
	const sbData = video != null ? await sbGet(video.videoId) : null;
	display.populateVideoInformation(video, sbData);
	display.writeFrame();
	if (foundDataIndex + SPONSOR_BLOCK_CACHE_BUFFER > sponsorBlockCacheIndex) {
		await cacheSponsorBlockData(foundDataIndex + SPONSOR_BLOCK_CACHE_BUFFER);
	}
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
		sponsorBlockCacheIndex = 0;
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
		sponsorBlockCacheIndex = 0;
	}
}

async function main() {
	refreshKeyLabels();

	display.writeFrame();

	normalData = await api.fetchFeed();
	data = normalData;

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
		display.writeFrame();
	});

	populateVideoList();
	display.populateVideoInformation(data[0] ?? null, null);

	display.writeFrame();

	async function upKey() {
		if (display.selectedIndex > 0) {
			display.selectedIndex--;
			await scrollToSelectedIndex();
		}
	}

	async function downKey() {
		if (display.selectedIndex < display.left.length - 1) {
			display.selectedIndex++;
			await scrollToSelectedIndex();
		}
	}

	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding("utf8");

	process.stdin.on("data", async (key) => {
		const keyString = key.toString();
		switch (keyString) {
			case "\u0003":
			case "q": {
				// ctrl-c
				Display.clearScreen();
				return process.exit();
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
						await scrollToSelectedIndex();
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
						display.writeFrame();
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
						await scrollToSelectedIndex();
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
						await scrollToSelectedIndex();
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
						await scrollToSelectedIndex();
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
						await scrollToSelectedIndex();
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
						await scrollToSelectedIndex();
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
						await scrollToSelectedIndex();
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
							const sbData = await sbGet(currentlySelectedOldData.videoId);
							display.populateVideoInformation(currentlySelectedOldData, sbData);
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

						sponsorBlockCacheIndex = 0;

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
						display.writeFrame();
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
						display.writeFrame();
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
						display.writeFrame();
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
						display.writeFrame();
						break;
					}
					case "f": {
						// Filter unread
						clearInteractionChar();
						endReached = false;
						filterUnread = !filterUnread;
						updateHardFilters();
						populateVideoList();
						await scrollToSelectedIndex();
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
						await downKey();
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
						await upKey();
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
							await upKey();
							break;
						}
						case 66: {
							// Down
							await downKey();
							break;
						}
					}
				}
			}
		}
	});

	process.stdout.on("resize", () => {
		display.writeFrame();
	});

	const currentSponsorBlockInfo =
		data[0] != undefined ? await sbGet(data[0].videoId) : null;
	if (display.selectedIndex == 0) {
		display.populateVideoInformation(data[0] ?? null, currentSponsorBlockInfo);
		display.writeFrame();
	}

	if (data[0] != undefined) {
		await cacheSponsorBlockData(SPONSOR_BLOCK_CACHE_BUFFER);
	}
}

void main();
