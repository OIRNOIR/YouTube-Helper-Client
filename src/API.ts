import type { Video } from "./types/Video.ts";

export interface FetchFeedOptions {
	page?: number;
	limit?: number;
	unread?: boolean;
	type?: string[];
	search?: string;
}

export interface MarkReadOptions {
	read?: string[];
	unread?: string[];
}

export class API {
	private hostname: string;
	private auth: string;

	constructor(hostname: string, auth: string) {
		this.hostname = hostname;
		this.auth = auth;
	}

	async fetchFeed(options?: FetchFeedOptions): Promise<Video[]> {
		const url = new URL(`https://${this.hostname}/api/feed`);
		const query = url.searchParams;
		if (options?.limit != undefined) {
			query.set("limit", options.limit.toString());
		}
		if (options?.page != undefined) {
			query.set("page", options.page.toString());
		}
		if (options?.type != undefined && options.type.length > 0) {
			query.set("type", options.type.join(","));
		}
		if (options?.unread != undefined) {
			query.set("unread", String(options.unread));
		}
		if (options?.search != undefined) {
			query.set("search", options.search);
		}
		const res = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Authorization: this.auth,
				"User-Agent": "YouTubeHelper Client (oirnoir.dev)"
			}
		});
		if (!res.ok) {
			throw new Error(`Non-OK status code on fetching feed ${res.status}`);
		}
		const text = await res.text();
		const json = JSON.parse(text) as { success: boolean; documents: Video[] };
		if (json.success == true) return json.documents;
		throw new Error("Action not successful");
	}

	async markRead(options: MarkReadOptions): Promise<{ modifiedCount: number }> {
		if (
			(options.read == undefined || options.read.length == 0) &&
			(options.unread == undefined || options.unread.length == 0)
		) {
			throw new Error("Mark read/unread request would have been useless!");
		}
		const res = await fetch(`https://${this.hostname}/api/read`, {
			method: "PATCH",
			headers: {
				Authorization: this.auth,
				"User-Agent": "YouTubeHelper Client (oirnoir.dev)",
				"Content-Type": "application/json"
			},
			body: JSON.stringify(options)
		});
		if (!res.ok) {
			throw new Error(`Non-OK status code on fetching feed ${res.status}`);
		}
		const text = await res.text();
		const json = JSON.parse(text) as { modifiedCount: number };
		return json;
	}
}
