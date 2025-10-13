# YouTube Helper Client

This is an official TUI implementation of a client for the [YouTube Helper server](https://github.com/OIRNOIR/YouTube-Helper-Server).

<img width="1554" height="1054" alt="A view of the YouTube Helper TUI" src="https://github.com/user-attachments/assets/d35599af-aeb0-41bd-8cd7-9c22f8310f9f" />

This is a simple self-hosted client/server setup for YouTube subscriptions.

This project started in July 2025 because I got tired of using YouTube's official UI.
To make this client useful, you need a matching server with your subscriptions setup.

---

## Installation: Linux and macOS

This assumes you have a basic understanding of the CLI and already have a server setup.

1. Clone this repository into a directory somewhere on your local machine, then cd to it in a terminal.

2. Install dependencies:
    - [Bun](https://bun.sh/)
    - [yt-dlp](https://github.com/yt-dlp/yt-dlp/)
    - [FFmpeg](https://ffmpeg.org/)
    - aria2 (Available on [Homebrew](https://brew.sh) for macOS and most Linux package managers)

3. Install Bun packages:
    - `bun install`

4. Create config file
    - `cp config.json.example config.json`
    - Edit `config.json`
    - Replace `INSERT_AUTHORIZATION_TOKEN_HERE` with the auth token you set for your server
    - Replace `INSERT_HOSTNAME_HERE` with the hostname your server is listening on

## Running

Start the client with:

```bash
bun run ./src/index.ts
```

If you wish to set an alias for this command (for instance, if you wish to alias the command `yt` to
running this program), you can add an alias to your .bashrc or equivalent:

```bash
alias yt="bun run /path/to/YouTube-Helper-Client/src/index.ts"
```

## Features

- Download videos: `d`
- Filter subscriptions: `f`
- Open in MPV (requires installing MPV media player): `o`
- Copy Link: `c`
- Mark Unread/Read: `m`
- Download Queue: `e`
    - Downloads can be retried
    - "Retry w/ cookie" uses the cookies from the browser specified in config.json, see yt-dlp documentation
- Search (Beta, searches through subscriptions): `/`
- Jump to top: `gg`
- Native SponsorBlock integration for full-video segments

## Contributing

Feel free to leave issues or pull requests. AI-generated contributions will not be accepted.
