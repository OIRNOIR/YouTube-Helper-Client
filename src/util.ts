import { type ExecException, type ExecOptions, exec } from "node:child_process";

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
