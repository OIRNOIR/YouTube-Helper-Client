import { type ExecException, type ExecOptions, exec } from "node:child_process";
import { subtle as subtleCrypto } from "node:crypto";

export async function execAsync(
	command: string,
	settings?: ExecOptions
): Promise<{
	error: ExecException | null;
	stdout: string | Buffer<ArrayBufferLike>;
	stderr: string | Buffer<ArrayBufferLike>;
}> {
	return new Promise((resolve) => {
		exec(command, settings, (error, stdout, stderr) => {
			resolve({ error, stdout, stderr });
		});
	});
}

export async function getSHA256Hash(input: string) {
	const textAsBuffer = new TextEncoder().encode(input);
	const hashBuffer = await subtleCrypto.digest("SHA-256", textAsBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hash = hashArray
		.map((item) => item.toString(16).padStart(2, "0"))
		.join("");
	return hash;
}

export async function getFullVideoSponsorBlockSegments(
	videoId: string
): Promise<null | "sponsor" | "selfpromo" | "exclusive_access"> {
	const hash = await getSHA256Hash(videoId);
	const res = await fetch(
		`https://sponsor.ajay.app/api/skipSegments/${hash.slice(0, 4)}?categories=["sponsor","selfpromo","exclusive_access"]&actionType=full`
	);
	const text = await res.text();
	const json = JSON.parse(text) as {
		videoID: string;
		segments: {
			category: "sponsor" | "selfpromo" | "exclusive_access";
			votes: number;
		}[];
	}[];
	const thisVideo = json.find((v) => v.videoID == videoId);
	return (
		thisVideo?.segments.sort((a, b) => b.votes - a.votes).at(0)?.category ?? null
	);
}

/**
 * Converts a quantity of ms to a shorter human-readable format
 */
export function msToShort(ms: number): string {
	const seconds = Math.trunc((ms / 1000) % 60);
	const minutes = Math.trunc((ms / 60000) % 60);
	const hours = Math.trunc((ms / 3600000) % 24);
	const days = Math.trunc((ms / 86400000) % 7);
	const weeks = Math.trunc((ms / 604800000) % 52);
	const years = Math.trunc(ms / 31449600000);
	let twoDigitMin = String(minutes);
	while (twoDigitMin.length < 2) {
		twoDigitMin = `0${twoDigitMin}`;
	}
	let twoDigitSec = String(seconds);
	while (twoDigitSec.length < 2) {
		twoDigitSec = `0${twoDigitSec}`;
	}
	if (years > 0) {
		return `${years}y${weeks}w${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (weeks > 0) {
		return `${weeks}w${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (days > 0) {
		return `${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (hours > 0) {
		return `${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (minutes > 0) {
		return `${minutes}:${twoDigitSec}`;
	}
	return `${seconds}s`;
}

/**
 * Converts a quantity of ms to a shorter human-readable format
 */
export function msToMostSignificantWord(ms: number): string {
	const seconds = Math.trunc((ms / 1000) % 60);
	const minutes = Math.trunc((ms / 60000) % 60);
	const hours = Math.trunc((ms / 3600000) % 24);
	const days = Math.trunc((ms / 86400000) % 7);
	const weeks = Math.trunc((ms / 604800000) % 52);
	const years = Math.trunc(ms / 31449600000);
	if (years > 0) {
		return `${years} Years`;
	}
	if (weeks > 0) {
		return `${weeks} Weeks`;
	}
	if (days > 0) {
		return `${days} Days`;
	}
	if (hours > 0) {
		return `${hours} Hours`;
	}
	if (minutes > 0) {
		return `${minutes} Minutes`;
	}
	return `${seconds} Seconds`;
}
