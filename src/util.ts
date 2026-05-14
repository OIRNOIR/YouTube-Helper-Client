import { type ExecException, type ExecOptions, exec } from "node:child_process";

export function execAsync(
	command: string,
	settings?: ExecOptions
): Promise<{
	error: ExecException | null;
	stdout: string;
	stderr: string;
}> {
	return new Promise((resolve) => {
		exec(command, settings, (error, stdout, stderr) => {
			resolve({ error, stdout: stdout as string, stderr: stderr as string });
		});
	});
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
	if (years != 0) {
		return `${years} Year${years == 1 ? "" : "s"}`;
	}
	if (weeks != 0) {
		return `${weeks} Week${weeks == 1 ? "" : "s"}`;
	}
	if (days != 0) {
		return `${days} Day${days == 1 ? "" : "s"}`;
	}
	if (hours != 0) {
		return `${hours} Hour${hours == 1 ? "" : "s"}`;
	}
	if (minutes != 0) {
		return `${minutes} Minute${minutes == 1 ? "" : "s"}`;
	}
	return `${seconds} Second${seconds == 1 ? "" : "s"}`;
}

/**
 * Converts a timestamp to a short string relative to now
 */
export function timestampToRelativeString(timestamp: number): string {
	const difference = timestamp - Date.now();
	// Positive difference = in future
	if (difference == 0) return "Just Now";
	const rawString = msToMostSignificantWord(Math.abs(difference));
	return difference > 0 ? `In ${rawString}` : `${rawString} Ago`;
}

export type ToStringAble = unknown & { toString: () => string };
