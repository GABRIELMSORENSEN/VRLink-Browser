# VRLink Browser — Temporary Video Sharing

## Goal
Preserve the existing Electron browser, ad-block toggle, and media discovery. Add an **opt-in** flow for locally owned or otherwise authorized videos to be served temporarily to VRChat players.

## Architecture
1. Select a local MP4 file (or a downloadable source that explicitly permits downloading and redistribution). Never bypass DRM, authentication, access controls, or hotlink restrictions.
2. Store temporary media only under a dedicated application-managed directory, not the user's Downloads folder.
3. Serve the media with `Content-Type`, `Content-Length`, `Accept-Ranges`, `206 Partial Content`, and safe `HEAD`/`GET` handling. Validate codec/container support separately.
4. Keep the HTTP origin on loopback; expose only the media endpoint through a deliberately configured HTTPS tunnel or authorized hosting service. Avoid exposing the Electron browser or its session cookies.
5. Use unguessable expiring access tokens, bandwidth/concurrency limits, and a visible Stop Sharing control. Do not relay cookies or authorization headers to public clients.
6. Stop the server and tunnel and remove application-owned temporary media on graceful exit. On next launch, clean abandoned files after crashes.

## Acceptance tests
- Original browser navigation, ad blocking, and video detection still work.
- Local MP4 serves correct byte ranges, seek, and content headers.
- A second device can fetch the public HTTPS URL without browser credentials.
- Stop Sharing invalidates the URL; closing the app deletes only application-owned temporary files.
- Crash-recovery cleanup works; no user files are removed.
- No claim of compatibility until tested in a VRChat world with AVPro and Allow Untrusted URLs configured.

## Release
Build Windows EXE through the existing Electron packaging configuration and validate on Windows before publishing a release. This branch is development work; it is **not** a tested executable.
