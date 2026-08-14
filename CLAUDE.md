# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small, static, dependency-free web app that browses a curated set of YouTube channels and plays their videos, built directly on the YouTube Data API v3. No framework, no bundler, no package manager — just HTML, vanilla JS, and CSS served as static files.

## Running it

There is no build step. Serve the directory over HTTP (fetch + YouTube embeds behave best this way):

```
python3 -m http.server 8000
```

Then open http://localhost:8000. There is no test suite, linter, or formatter configured.

## Configuration

- **Channels shown on the home page** are defined in `config.js` as the `CHANNELS` array (`{ id, name }`, where `id` is the `UC...` channel ID, not an `@handle`).
- **Videos on the standalone video-list page** are defined in `config.js` as the `VIDEOS` array (`{ id, title }`, where `id` is the `watch?v=` video ID). That page renders thumbnails directly from `i.ytimg.com` and makes one `videos.list` call per load to fetch durations.
- **The YouTube Data API key** is hardcoded as `API_KEY` at the top of `common.js`. To use a different key, edit it there. It is client-side, so it is exposed to anyone who loads the page.

## Architecture

Every page is a standalone HTML file with an inline `<script>` that depends on shared files loaded first:
- `common.js` — `ytFetch(endpoint, params)` (the only way the app talks to the YouTube API), plus `qs()`, `formatDate()`, `el()`, `formatDuration()`, `fetchVideoDurations()`, `attachDurations()`, `attachBack()` helpers.
- `config.js` — the `CHANNELS` array, consumed by `index.html`'s channel grid. (`channel.html` also loads it but does not currently reference it.)

`ytFetch` builds the `googleapis.com/youtube/v3/<endpoint>` URL, injects `API_KEY`, drops empty params, and throws the API's own error message on non-2xx.

### Navigation / routing

There is no router. Pages link to each other with URL query params parsed by `qs()`:
- `index.html` → `channel.html?id=<channelId>` and `videos.html`
- `videos.html` → `watch.html?v=<videoId>` (curated via the `VIDEOS` array)
- `channel.html` → `watch.html?v=<videoId>&channel=<channelId>` and `playlist.html?list=<playlistId>&channel=<channelId>`
- `playlist.html` → `watch.html?v=<videoId>&list=<playlistId>&channel=<channelId>`
- `watch.html` embeds `youtube.com/embed/<v>?autoplay=1`, appending `&list=<list>` when present, and computes its back-link from whichever context params it received.

### Pagination pattern

YouTube's list endpoints return `nextPageToken` but no usable `prevPageToken`, so each list view keeps its own `{ current, prev: [], next }` token state plus a page counter. "Next" pushes the current token onto the `prev` stack and loads `next`; "Prev" pops and loads that token. This exact pattern is duplicated independently in `channel.html` (twice — once for the videos tab, once for the playlists tab) and `playlist.html`. `maxResults` is hardcoded to 50 everywhere.

### Duration badges

Video cards render a `.thumb` wrapper around the thumbnail and carry `data-video-id`. After the list renders, each page calls `fetchVideoDurations(ids)` (`videos.list`, `part: contentDetails`, 50 IDs per call) and patches `.duration` badges onto the already-rendered cards via `attachDurations()`. `formatDuration()` converts ISO 8601 (`PT1H2M3S`) to `1:02:03`; live streams (`PT0S`) get no badge.

### Back navigation / state preservation

Back links use `attachBack()` from `common.js`: when the referrer is a same-origin page, clicking calls `history.back()` so the browser's bfcache restores the previous page exactly (scroll position + all in-memory state); otherwise the link follows its `href`.

As a fallback for when bfcache is unavailable (e.g. fresh load after eviction), each list page saves its state to `sessionStorage` when a card is clicked, and restores it on a fresh load whose referrer is `watch.html` (`channel.html` also restores when returning from `playlist.html`):

- `channel.html` — both tabs' pagination token stacks + page numbers, search mode/query, active tab, scrollY.
- `playlist.html` / `videos.html` — their token stack / page number and scrollY.

On a bfcache restore (`pageshow` with `persisted: true`), the saved fallback state is cleared because the live page state is already intact.

### channel.html specifics

The channel page lists "latest videos" by resolving the channel's hidden uploads playlist (`contentDetails.relatedPlaylists.uploads`) via `playlistItems`, rather than calling `search`. In-channel search (`search` endpoint, `type: video`, `order: date`) is a separate mode that swaps the data source while reusing the same grid + pagination controls.
