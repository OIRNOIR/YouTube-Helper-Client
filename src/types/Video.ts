export interface Video {
	videoId: string;
	platform: "YouTube";
	type: "video" | "short" | "stream";
	title: string;
	description: string | null;
	duration: number | null;
	displayName: string;
	username: string;
	channelId: string;
	timestampMS: number;
	date: string;
	isCurrentlyLive: boolean;
	unread: boolean;
	sponsorBlockStatus: null | "sponsor" | "selfpromo" | "exclusive_access";
	url: string;
	availability:
		| "private"
		| "premium_only"
		| "subscriber_only"
		| "needs_auth"
		| "unlisted"
		| "public"
		| "upcoming_stream"
		| "processing";
}
