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
): Promise<null | "sponsor" | "selfpromo"> {
	const hash = await getSHA256Hash(videoId);
	const res = await fetch(
		`https://sponsor.ajay.app/api/skipSegments/${hash.slice(0, 4)}?categories=[%22sponsor%22,%22selfpromo%22]&actionType=full`
	);
	const text = await res.text();
	const json = JSON.parse(text) as {
		videoID: string;
		segments: { category: "sponsor" | "selfpromo"; votes: number }[];
	}[];
	const thisVideo = json.find((v) => v.videoID == videoId);
	return (
		thisVideo?.segments.sort((a, b) => b.votes - a.votes).at(0)?.category ?? null
	);
}
