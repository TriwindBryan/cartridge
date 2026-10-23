# Fulton roadmap

Ideas that have been discussed but not built yet. Current version: 1.29.

## Emulator support (planned, not started)

Decided on October 18, 2026: not now, keep for later.

**Goal:** a Play button for every game you have, not just the ones with a PC port. A port always wins when one exists; an emulator is the fallback.

**Why it fits:** most of what's needed already exists in Fulton:
- downloading, installing and updating apps from GitHub releases
- recognising games for 80+ consoles and arcade boards
- covers, Add to Steam, controller support and save backups

The new parts would be:
- an emulator catalog: which emulator handles which console, its GitHub repo and Windows download, its exe, and the command-line options to open a game in full screen
- a launch step that hands your game file to the emulator

**Phase 1 (would be 1.14):** one well-known emulator per big system, installed the first time it's needed.

| System | Emulator |
|---|---|
| PS1 | DuckStation |
| PS2 | PCSX2 |
| GameCube / Wii | Dolphin |
| PSP | PPSSPP |
| Wii U | Cemu |
| 3DS | Azahar |
| DS | melonDS |
| Dreamcast | Flycast |
| PS3 | RPCS3 |
| Xbox | xemu |
| Xbox 360 | Xenia |
| Arcade | MAME or FinalBurn Neo |

Check each one's current download location before building. Some publish on their own website rather than GitHub releases.

**Phase 2:**
- RetroArch for the older cartridge systems (NES, SNES, Genesis, Game Boy and so on). Its cores come from RetroArch's own download server, not GitHub, so this needs extra download code.
- Choose your emulator per game or per console.
- Switch, once its emulators settle. They've been in flux since Ryujinx shut down in 2024, so check what's current first.

**Things to handle:**
- **Files from your own console:** PS1/PS2 BIOS, PS3 firmware, Switch keys. Fulton would say what's missing and where it goes, but never download them.
- **Emulator settings:** graphics and controller setup stay inside each emulator. Fulton only starts games full screen.
- **Identity:** Fulton becomes a general game frontend (like LaunchBox or Playnite) that favours ports. Keep ports first in the interface.

## Other platforms: Mac (in testing from 1.29), Steam Deck / Linux (planned)

Mac started October 18, 2026 (1.29), built on GitHub Actions. **Confirmed working on an M1 Max as of Beta 0.0015 (October 21, 2026); Fulton is now the go-forward product on Windows and Mac.** Later: Apple Developer ID ($99/year) to sign and notarize. Steam Deck / Linux next.

**What carries over unchanged:** ROM checking, covers, the catalog, the interface, backups, controller support. Electron runs on all three.

**What changes in Fulton itself:**
- Picking the right download from each GitHub release (Linux AppImage/tarball, Mac .dmg/.app zip/universal build) instead of the Windows .exe
- Unpacking and launching the native way (AppImage / `open` an .app) instead of running an .exe
- Add to Steam: same idea, different Steam folders on Linux and Mac
- Packaging: AppImage for Linux, .dmg and .icns icon for Mac, instead of the .msi, .bat files and .ico
- The catalog needs to say which ports have a Linux or Mac build; games without one are hidden or marked on that platform

**Steam Deck / Linux first, because:**
- most of these ports already publish Linux builds
- no yearly fee and no Apple notarization
- the Steam Deck is popular with retro fans, and Fulton's controller support and Add to Steam already suit it (Game Mode)

**Mac, after that:**
- Fewer ports have Mac builds (Harbour Masters ports and sm64coopdx do; check every catalog game first), so the Mac library starts smaller
- Apple blocks unsigned apps more strictly than Windows SmartScreen. Doing it properly needs the Apple Developer Program (about $99/year) and notarizing each release. Downloaded ports can hit the same blocks, so Fulton has to handle that too
- Needs testing on a real Mac, on both Apple Silicon and Intel. GitHub's free Mac build machines can make the .dmg once the code is on GitHub

**Rough size:** a couple of solid sessions of work, plus testing on each platform.

## Other ideas mentioned

- Update all, or automatic updates, for ports (and emulators later)
- Favourites and your own collections ("Zelda", "Couch co-op")
- TV mode: full screen, controller only
- GitLab releases (for example Link's Awakening DX HD)
- Mods and texture packs
- Menu sounds, screenshots and trailers
- Desktop shortcuts
- Play stats
- Self-update: download and run the new installer from inside Fulton (1.19 only tells you a new version is out)

## Launch status

- **October 18, 2026:** Fulton 1.28 released on GitHub (TriwindBryan/fulton) and announced on Ko-fi (ko-fi.com/triwind). Soft launch: friends and Ko-fi first, wider sharing (Reddit, port Discords) after the first week's feedback.
- Next: turn on GitHub Issues, collect logs from early users, fix what comes in, then the itch.io page and wider posts.

## Launch and money (decided October 18, 2026)

- Free app with donations on Ko-fi (ko-fi.com/triwind). No ads.
- Maybe later: an optional $4.99 Supporter Pack with extra themes, a supporter badge and your name in the credits. No features locked.
- Downloads: GitHub Releases (also powers the update check), plus an itch.io page with pay-what-you-want.
- To do before launch: create the GitHub repo and set `repo` in package.json, publish the first release with the .msi, make the itch.io page, add a Ko-fi cover image.


## Ideas for later (October 21, 2026)
1. Support: a "Report a problem" button (one zip with the log, Check my setup results and version), one-click Fulton updates, "Update all" for games.
2. **Linux and Steam Deck: planned next** (Find more already records which ports have Linux downloads, so a Linux filter is one line to add). Also mods and texture packs for Harbour Masters ports, and a TV / couch mode.
3. Trust and reach: Windows code signing (Microsoft Trusted Signing, about $10/month), an itch.io page.
