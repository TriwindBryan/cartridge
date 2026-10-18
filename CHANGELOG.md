# Cartridge changelog

Version numbers count up from 1.13: the next release is 1.14, then 1.15, and so on. The version shows next to the logo, in the window title and at the bottom of Settings.

## 1.28 — October 18, 2026

**Controllers**
- **More controllers work.** Before, only controllers that report the standard (Xbox-style) layout worked fully. Now PlayStation and Switch Pro controllers connected in their own mode, 8BitDo, and generic USB/Bluetooth pads work too, using a layout for the brand or a general one. D-pads that report as a "hat" (common on these) now work, and the left stick always moves.
- **Settings → Controller** shows each connected controller, which layout it's using, and lights up buttons as you press them. **Set up buttons** walks through each button (press A… press B…) and remembers your setup for that controller; **Use the automatic layout** undoes it. On this page only B and the triggers navigate, so you can try buttons freely.
- **The info panel works with a controller.** ⧉ View opens it with the main button (Play / Install) highlighted in gold. Up/down moves between all its buttons and links (Load ROM, the ROM guide, Copy, Change cover, Add to Steam, save backups…), A presses, left/right changes dropdowns such as the ROM picker, the right stick scrolls, and B closes it. The highlight stays put when the panel refreshes.
- The right stick scrolls the Games screen too.
- Each controller is written to the log with its name and layout, to help with problem reports. If Steam turns a controller into a mouse, Settings explains how to fix it.

## 1.27 — October 18, 2026

**Much faster with big ROM libraries** (tested with 13,072 ROMs)
- Matching ROMs to games: each game is now only compared with ROMs for its own console, and cleaned-up ROM names are remembered instead of being worked out again on every update. An update went from about 240 ms to about 35 ms.
- Updates are bundled: when lots of things change at once (a scan, update checks, covers), the window gets one update instead of dozens.
- **My ROMs** shows the first 300 ROMs, with **Show 300 more**, and doesn't redraw the list when nothing on it changed.
- The Games screen's **ROMs** view shows 40 per console row (120 in Grid) with a **+N / Show more** card at the end. Arrow keys and controllers open the next batch automatically when you reach it.
- Covers are only looked up for ROMs that are on screen or about to be, instead of all at once.
- If sending the library to the window ever takes more than half a second, it's written to the log.

## 1.26 — October 18, 2026

- **Fixed: wrong Metacritic scores, like 144 for Vandal Hearts.** When Metacritic had no critic score for a game, one of the backup ways of reading the page carried on into unrelated data further down (another game's numbers) and never checked that a Metascore can't be over 100. It also guessed the platform from the site menu, which is how "DS" showed up. Cartridge now only reads the score from the game's own score data, rejects anything outside 0–100 (User Score 0–10), and only uses visible platform text when the page names exactly one platform. Scores saved by older versions are looked up again automatically.
- **The Legend of Zelda: A Link to the Past (zelda3) can now be installed.** snesrev publishes a ready-made Windows download (v0.3), so it's no longer listed as build-from-source. Load your USA ROM and Cartridge places it next to the game as `zelda3.sfc`. Super Metroid (sm) still has no download, so it stays as View source.

## 1.25 — October 18, 2026

- **Fixed: the Games screen jumped back and forth when scrolling a short list** (for example with Status set to "No ROM loaded"). Scrolling shrinks the big game banner at the top; on a short list that left nothing to scroll, so it sprang back and the banner grew again, over and over. The banner now shrinks once you're 60 pixels down and only grows back when you return to the very top.
- **Scroll past the last row:** the Games screen now has an empty row's worth of space below the last games, so you can scroll the bottom row up into the middle of the screen instead of stopping where the games end.

## 1.24 — October 18, 2026

**How do I get this ROM?**
- Every game's ROM slot has a **How do I get this ROM?** link, and the info panel's "What you need" section has a guide for that console on making a copy of a game you own ("dumping"). Examples: a USB cartridge reader for N64, SNES and Game Boy; CleanRip on a Wii for GameCube and Wii discs; a PC disc drive for PS1 and PS2. Each guide links to dumping.guide (a non-profit community wiki), the Dolphin guide, or the Wii U/3DS Hacks Guides.
- **Exact versions that work:** the info panel lists the exact releases each port accepts, straight from the No-Intro list, with each file's SHA-1 fingerprint and a Copy button. Disc games show the game IDs that work (for example GZ2 for GameCube, RZD for Wii).
- **Don't have the game?** A link finds the original cartridge or disc on eBay.

**Better ROM checking**
- Special re-releases (LodgeNet, GameCube, Switch Online, Virtual Console, Classic Mini, collections, demos, betas and prototypes) are no longer marked as a match when a port asks for a specific region. They hold different data, so the port would likely reject them. Cartridge now says "This is the LodgeNet release; the port expects the original USA release." Ports that accept any version (such as Ship of Harkinian) still take them.

## 1.23 — October 18, 2026

- **Cartridge's home is github.com/TriwindBryan/cartridge.** The update check now looks for new releases there, and the About page links to the source code.
- Added the MIT LICENSE file and LAUNCH.md: the steps and the text for publishing on GitHub, itch.io and Ko-fi.

## 1.22 — October 18, 2026

- **Clearer about when you need to load a ROM.** Most ports (all the recomps, sm64coopdx and others) ask for the ROM themselves when they start, so loading it in Cartridge is optional for them. Their ROM slot now says **ROM optional** ("The game asks for your ROM when it starts. Load it here to check it's the right version first."), the info panel says "Optional: the game asks for it", and installing says "Hit Play" instead of "Add its ROM to play".
- Games that do need the ROM loaded in Cartridge (the Harbour Masters ports and Perfect Dark, which never ask for it) still say **Insert ROM**.
- The Status filter's "Needs a ROM" is now "No ROM loaded".

## 1.21 — October 18, 2026

- **Fixed: the window could freeze (turn white) for a long time at startup.** While Cartridge checks your ROM folders for new games, the reading and fingerprinting of ROM files now happens on a separate thread, so the window always stays responsive, even with a slow, sleeping or network drive. A ROM folder that doesn't answer within 15 seconds is skipped for that start instead of holding things up.
- **Log file:** Cartridge writes what it did at startup, how long each step took, and anything that froze the window to `%APPDATA%\Cartridge\cartridge.log`. Open it from **About → Open the log file**. It's kept under 512 KB.

## 1.20 — October 18, 2026

- **No more "restart your system" prompt from the installer.** Windows asked for a restart when Cartridge was still open during an install or upgrade, because it couldn't replace files in use. The .msi now closes Cartridge first and never asks to restart. (Games you started from Cartridge aren't closed.)

## 1.19 — October 18, 2026

- **Support Cartridge:** a ♥ **Support** button at the top right opens Cartridge's Ko-fi page (ko-fi.com/triwind). Cartridge stays free, and supporting it doesn't unlock anything.
- **About & credits:** click the version badge next to the logo, or **About & credits** in Settings. It shows the version, a thank-you list of every team and person who decompiled or ported the games in the catalog (with links to their GitHub pages), the data Cartridge uses, and the legal notes.
- **Update check:** Cartridge checks GitHub for a newer version twice a day. When one is out, a gold **v1.xx is out** button appears in the header and a message offers the download. Turn it off in Settings, or click **Check now** on the About page. (This starts working once Cartridge's GitHub page and first release exist.)
- **Welcome note:** the first time Cartridge opens, a short note explains that it doesn't include any games, how to add your ROMs, that covers stay on your PC, and that it's free.
- **Metacritic scores are now off by default** for new installs, and the Metascore sort only appears when they're on. Turn them on in Settings. If you already had them on, nothing changes.
- The header fits on narrower windows: the search box shrinks first, then the Support button becomes just the heart.

## 1.18 — October 18, 2026

- **Windows installer (.msi):** double-click **Build Installer (MSI).bat** to make `Cartridge-1.18.0-Setup.msi`. It installs for you or for everyone on the PC, adds Start menu and desktop shortcuts, offers to start Cartridge when done, and uninstalls from Settings → Apps. New versions install over old ones and your library and settings are kept.

## 1.17 — October 18, 2026

- **New icon:** a red cartridge with a 90s sunset label, gold contacts and a yellow glow around it. Used for the window, the taskbar and the portable .exe, with a simplified version for the smallest sizes so it stays clear at 16 pixels.

## 1.16 — October 18, 2026

- **Fixed:** in Rows view the mouse wheel moved rows sideways, which made it hard to scroll down. The wheel now always scrolls up and down.
- Rows move sideways with new ‹ › arrows at each end (shown when you point at a row and there's more to see), Shift + wheel, a trackpad swipe, the arrow keys or a controller.

## 1.15 — October 18, 2026

- Layout, Sort, Console and Status are now dropdowns on their own line under All · Decomp · Recomp · Remake · ROMs, left to right, instead of inside a Filters menu. Dropdowns that are changed from their default turn gold; **Reset** puts them all back.

## 1.14 — October 18, 2026

**Slimmer filter bar**
- The filter bar is one slim row: All · Decomp · Recomp · Remake · ROMs on the left; **⚙ Filters** and **↻** (check for updates) on the right.
- **⚙ Filters** opens a small menu with Layout, Sort, Console and Status. A badge shows how many filters are on.
- Active filters show as tags under the bar; click **×** on a tag to remove it, or **Clear all**.
- The games move over when the info panel opens, so the bar and the games are never hidden behind it.

## 1.13 — October 17, 2026

The first numbered release. Everything Cartridge does so far:

**Games and ports**
- Curated catalog of 27 decomp, recomp and remake ports, plus 180+ more in **Find more** from the community catalog and a GitHub search.
- One-click download, install, update and launch from each project's official GitHub releases.
- **All · Decomps · Recomps · Remakes · My ROMs** buttons on the Games screen (keys 1–5, LB / RB on a controller). All shows every game together; My ROMs shows only your ROM files and discs as covers.
- Rows or grid layout, sorting, console and status filters, search.
- Info panel with history, credits, versions, release notes and big gold Metacritic critic and user scores.

**ROMs**
- Every major console from NES to Switch: Nintendo, Sega, Sony, Microsoft, NEC, SNK, Bandai, Atari, 3DO, ColecoVision, Intellivision, Vectrex and MSX.
- **New: arcade sets.** 7,813 MAME / FinalBurn Neo sets recognised by name, including Capcom CPS-1, CPS-2, CPS-3 and ZN, Neo Geo, Sega NAOMI, Atomiswave, System 16/18/24/32, Model 1/2/3 and ST-V, Namco, Konami, Taito F3, IGS PGM, Cave, Psikyo, Toaplan, Irem and Midway. Shows each game's title, year, maker, board and parent, and warns when the board's BIOS set is missing.
- No-Intro verification for cartridges; disc and modern formats identified by their contents, serials and folder names; PS3 / Vita / Wii U / Xbox game folders count as one game.
- Watched ROM folders, rescanned on every start; drag and drop; Load ROM per game.

**Cover art**
- Box art for every game, ROM and Find more entry from libretro-thumbnails, matched by exact name or by title with region preference; optional SteamGridDB key for Switch and anything else missing; your own picture for any game or ROM. Covers are saved locally.

**Extras**
- Add to Steam with generated artwork; automatic save backups with restore; custom background; full controller support.
