# Cartridge roadmap

Ideas that have been discussed but not built yet. Current version: 1.29.

## Emulator support (planned, not started)

Decided on October 18, 2026: not now, keep for later.

**Goal:** a Play button for every game you have, not just the ones with a PC port. A port always wins when one exists; an emulator is the fallback.

**Why it fits:** most of what's needed already exists in Cartridge:
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
- **Files from your own console:** PS1/PS2 BIOS, PS3 firmware, Switch keys. Cartridge would say what's missing and where it goes, but never download them.
- **Emulator settings:** graphics and controller setup stay inside each emulator. Cartridge only starts games full screen.
- **Identity:** Cartridge becomes a general game frontend (like LaunchBox or Playnite) that favours ports. Keep ports first in the interface.

## Other platforms: Mac (in testing from 1.29), Steam Deck / Linux (planned)

Mac started October 18, 2026 (1.29): built on GitHub Actions, being tested on an M1 Max. Still to learn from testing: how each Mac port wants its ROM, and which catalog ports have Mac builds. Later: Apple Developer ID ($99/year) to sign and notarize. Steam Deck / Linux next.

**What carries over unchanged:** ROM checking, covers, the catalog, the interface, backups, controller support. Electron runs on all three.

**What changes in Cartridge itself:**
- Picking the right download from each GitHub release (Linux AppImage/tarball, Mac .dmg/.app zip/universal build) instead of the Windows .exe
- Unpacking and launching the native way (AppImage / `open` an .app) instead of running an .exe
- Add to Steam: same idea, different Steam folders on Linux and Mac
- Packaging: AppImage for Linux, .dmg and .icns icon for Mac, instead of the .msi, .bat files and .ico
- The catalog needs to say which ports have a Linux or Mac build; games without one are hidden or marked on that platform

**Steam Deck / Linux first, because:**
- most of these ports already publish Linux builds
- no yearly fee and no Apple notarization
- the Steam Deck is popular with retro fans, and Cartridge's controller support and Add to Steam already suit it (Game Mode)

**Mac, after that:**
- Fewer ports have Mac builds (Harbour Masters ports and sm64coopdx do; check every catalog game first), so the Mac library starts smaller
- Apple blocks unsigned apps more strictly than Windows SmartScreen. Doing it properly needs the Apple Developer Program (about $99/year) and notarizing each release. Downloaded ports can hit the same blocks, so Cartridge has to handle that too
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
- Self-update: download and run the new installer from inside Cartridge (1.19 only tells you a new version is out)

## Launch status

- **October 18, 2026:** Cartridge 1.28 released on GitHub (TriwindBryan/cartridge) and announced on Ko-fi (ko-fi.com/triwind). Soft launch: friends and Ko-fi first, wider sharing (Reddit, port Discords) after the first week's feedback.
- Next: turn on GitHub Issues, collect logs from early users, fix what comes in, then the itch.io page and wider posts.

## Launch and money (decided October 18, 2026)

- Free app with donations on Ko-fi (ko-fi.com/triwind). No ads.
- Maybe later: an optional $4.99 Supporter Pack with extra themes, a supporter badge and your name in the credits. No features locked.
- Downloads: GitHub Releases (also powers the update check), plus an itch.io page with pay-what-you-want.
- To do before launch: create the GitHub repo and set `repo` in package.json, publish the first release with the .msi, make the itch.io page, add a Ko-fi cover image.
