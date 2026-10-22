# Cartridge changelog

From 1.34 Cartridge is shown as **Beta 0.0001** (next to the logo, in the window title, on About and in Settings). Behind that name the build number keeps counting (1.34, 1.35…), because installers and the update check need a number that always goes up. Release tags on GitHub use the build number (v1.34); release titles use the beta name.

## Beta 0.0018 (build 1.51) — October 21, 2026

**Find more: Windows / Mac labels instead of a filter**
- The Runs on: Windows · Mac buttons are gone for now. Each card still says **Windows**, **Mac**, both, or **No download yet**, and typing **mac** or **windows** in the filter box finds them.

## Beta 0.0017 (build 1.50) — October 21, 2026

**Fixed: Windows and Mac counts on Find more could differ between computers**
- Each computer checks the downloads itself, and when GitHub said "slow down" the check simply stopped, leaving the rest uncounted until Cartridge was restarted. One computer could show 172 Mac ports and another far fewer.
- Now, when GitHub asks to slow down, Cartridge waits a moment and carries on; anything that still fails gets a second try. Every time Find more opens, anything not checked yet is checked.
- Find more says when ports couldn't be checked ("12 ports couldn't be checked yet… Check again"), so the labels are never quietly incomplete. Two list entries for the same download are checked once.

## Beta 0.0016 (build 1.49) — October 21, 2026

**Find more: Runs on Windows / Mac**
- New **Runs on: Windows · Mac** filter on Find more, with counts. Pick Mac to see only ports that have a Mac download (or Windows for Windows ones); click it again to see every port.
- The check also notes which ports have Linux downloads, ready for Linux and Steam Deck support.
- Each card now says **Windows**, **Mac**, both, or **No download yet**, using the same rules as Install, so what the filter shows is what Install will find.
- Cartridge reads each port's latest release in the background the first time Find more opens (a minute or two for the whole list; you can browse meanwhile, and the filter fills in as it goes) and remembers it for 3 days. Without a GitHub token it reads github.com's release pages, which aren't limited to 60 checks an hour; with a token it uses the GitHub API. If GitHub is busy it stops and picks up the rest next time.

## Beta 0.0015 (build 1.48) — October 21, 2026

- **The "new ports" count on the Find more tab is now a small round badge** on the tab's corner (like an app's notification count), instead of a pill that wrapped onto two lines. Over 99 shows "99+"; hover for the full count.
- **A big batch isn't "new":** when a whole list's worth of ports appears at once (like the 138 from Recompendium joining), it counts as the starting point, not news. Only ports that trickle in afterwards get the NEW badge. A count left over from before is cleared automatically.

## Beta 0.0014 (build 1.47) — October 21, 2026

**Behind the selected game**
- The big blurred copy of the cover behind the selected game is gone by default. It clashed with the theme (a white-and-red cover turned the top of a blue screen into a red-gray smear) and repeated the box art right next to it.
- New default, **Color wash**: a soft glow in the cover's main color behind the box only, fading into your theme. Each game still feels a little different; the text stays easy to read. Gray covers just show the theme.
- **Settings → Colors → Behind the selected game**: Color wash, **Theme only** (nothing behind the game), or **Blurred cover** (the old look).

**Fixed (Mac): small icons still looked wrong**
- The 16 and 32 pixel icons (Finder's list view, the sidebar, small Dock sizes) were stored as PNG pictures, which some macOS versions draw garbled. They're now stored as raw ARGB, the way Apple's own tools write them. If Finder still shows the old icon after updating, it's macOS's icon cache: restarting the Mac (or Finder) refreshes it.

## Beta 0.0013 (build 1.46) — October 21, 2026

- **New default look: Cartridge Frost.** The icy blue theme (formerly "Arctic") is now the default, first in Settings → Colors: deep ocean-blue panels, glacier-blue accents, frosty white highlights and a pale-blue horizon over the grid floor. Anyone who hasn't picked a theme gets it; anyone who has keeps theirs. **Cartridge Red** is still there, one click away.
- The window opens straight in the new colors (no flash of red while it loads), and the highlighted tab, big buttons and score text now take their shading from the theme too.

## Beta 0.0012 (build 1.45) — October 20, 2026

- **★ Favorites button** on the Games tab, right after ROMs in the All · Decomp · Recomp · Remake · ROMs row. One click shows only your favorites, with their count; key 6 or LB/RB on a controller reach it too. It replaces the Favorites option in the Status menu. With no favorites yet, it explains how to add one.

## Beta 0.0011 (build 1.44) — October 20, 2026

**Fixed: ROM scans filled the C: drive**
- A full rescan unpacked every zipped ROM into a temporary folder on the C: drive at the same time, and only cleaned up at the end. With thousands of zips that filled the drive, the scan failed with "no space left on device", and the clean-up of old ROM copies kept failing with it. Each zip is now unpacked, checked and deleted before the next one, so a scan never needs more than one zip's worth of space.
- Before unpacking or installing anything, Cartridge checks there's enough free space. If not, it says so plainly ("Your C: drive is too full: this needs about 2 GB and there's 300 MB") instead of failing quietly.
- A scan that runs out of space stops cleanly and tries those files again next time (before, they could be skipped for good).
- At start-up, Cartridge warns you when the drive it uses has less than 5 GB free.

**Safer clean-up of old ROM copies**
- Deleting an old copy now deletes that one file (and a disc's listed tracks), never the folder it's in. Anything inside a watched ROM folder is never treated as a copy, even if it's inside Cartridge's own ROMs folder.
- Removing old copies first rescans your ROM folders, so every ROM that's there points at your own file before any copy is removed.

**Missing ROMs**
- ROMs whose file was moved, deleted or is on an unplugged drive are marked **File missing** in My ROMs, and no longer unlock games.
- A ROM that moved inside your watched folders is found again automatically. One deleted from a watched folder is taken off the list after the next scan. One from somewhere else (maybe an unplugged drive) stays, marked missing, until you remove it.
- **Remove missing from the list** (in My ROMs and in Check my setup) tidies the list. No files are ever deleted.

**Check my setup** (Help tab, first topic)
- One button checks for: a drive that's nearly full, leftover downloads, temporary files left by a closed scan, old ROM copies, a big pile of converted ROMs, ROM folders that can't be found, ROMs with a missing file, and installed games whose files are gone. Each comes with a plain explanation and, where possible, a fix button. Fixes only tidy Cartridge's own list and leftovers.

**Favorites and Recently played**
- **☆ Add to favorites** on any game's page. Favorites get a ★ on their cover and their own row on the Games tab.
- The "Continue playing" row is now called **Recently played**, at the top of the Games tab.

**New on Find more**
- Ports added to the lists since your last visit get a **NEW** badge. The Find more tab shows how many ("3 new"), and a **✦ New** chip shows just those. Nothing counts as new the very first time.

**See what's new before updating**
- **Update to …** now shows that version's release notes first, with **Update now** or **Not now**.

**Colors**
- **Settings → Colors**: eight themes (Cartridge Frost, Cartridge Red, Midnight Blue, Synthwave, Toxic Green, Sunset Orange, Pocket Green, Steel). The whole app changes straight away, including the sky and the grid floor.
- **Custom**: pick the main color, accent, highlight, links & grid, horizon glow and sky yourself, starting from any theme.

## Beta 0.0010 (build 1.43) — October 20, 2026

**Help, right where you need it**
- New **Help** tab (also on LT/RT with a controller): short, plain-language topics with steps and buttons that take you to the right screen. Getting started, ROMs and where to get them, installing and updating, Find more, games you build yourself, games that need your game files, Steam, save backups, controllers, Mac notes, and what to do when something goes wrong. Searchable; with a controller, left/right go through the topics.
- Small **?** buttons next to the confusing parts (Find more's labels, Add your copy, a game's "What you need") open the matching topic in a pop-up without leaving the screen.

**Find more says what each port takes**
- Each card has a label: **Download** (a release Cartridge can install), **Build it yourself** (no download: build it from the project's instructions, then Add your copy), and **Needs game files** (wants files from your own console or disc, not just a ROM; Switch, Wii U, PS3, PS4, Xbox and similar).
- New filter next to the type chips: **Any · Download · Build it yourself**.
- The labels come from the lists' own data (Recompendium tracks each project's latest release daily). The list is refreshed once on first start so the labels appear.
- A game added from Find more shows the same note on its page, under **What you need**, with a link to the right Help topic.

**No more dead end with Add your copy**
- **Use your own copy instead** is now on the page of any game added from Find more or GitHub, even after Cartridge installed its own download. Pick your .exe or .bat and Cartridge offers to swap: it backs up the saves, removes its download and uses your copy. You no longer have to uninstall first.
- Your own copy shows **Pick a different file** to change which file starts it.

## Beta 0.0009 (build 1.42) — October 20, 2026

**Add a copy you built yourself**
- Some ports have no download: you build them yourself with your own game (LAS Recomp, many new Switch and Wii U recomps). Their page now has **Add your copy** (also shown as "Already have it? Add your copy" under Install). Pick the game's .exe, or a .bat/.cmd file that starts it, and the game gets a normal **Play** button, play time, save backups and Add to Steam.
- A .bat file is the way to go for games that must start from their own folder or with options (LAS Recomp needs `build\lasrecomp.exe extracted`, run from its folder, with MSYS2's files on the PATH). Cartridge runs it hidden and waits for the game to close.
- Your own copy never gets update offers, and **Remove from Cartridge** only forgets it: your files are never deleted.

## Beta 0.0008 (build 1.41) — October 19, 2026

**Find more: a second, bigger list of ports**
- Switch, Wii U and many other ports were missing because the list Find more used (the Quiver community catalog) has none of them. Find more now also reads **Recompendium** (recompendium.com), a well-kept list of about 210 recomps and PC ports, and merges the two. New on the page: Switch (Link's Awakening, Hyrule Warriors: Definitive Edition), Wii U (The Wind Waker HD), PS4 (Bloodborne, God of War III, Uncharted, Shadow of the Colossus, Killzone Shadow Fall, P.T., The Order: 1886), PS3 (Drakengard 3, Disgaea D2, The Simpsons Arcade Game), Xbox One, Dreamcast (Sonic Adventure), 3DS (Ocarina of Time 3D) and dozens more N64, PS1, Xbox 360 and GameCube ports.
- Also listed: three newer ports found on the web that neither list has yet: New Super Mario Bros. U and Monster Hunter 3 Ultimate (Wii U), and Pokémon: Let's Go, Eevee! (Switch).
- A port on both lists shows once, keeping Quiver's download details and adding Recompendium's description, status and what files it needs.
- Each card shows how far along the port is (**Playable**, **Complete**, or **Early: expect bugs**). Hover over a card to read its description and what it needs.
- A port added from Recompendium brings its description, original developer, year and requirements onto its game page.
- If one list can't be reached, Find more still shows the other. The list is refreshed once a day; **Refresh list** gets it now.
- Recompendium's data is shared under CC BY-SA 4.0 and is credited on Find more and on About.
- Many of the newest ports, especially Switch, Wii U and PS4 ones, have no download yet, or are only for Windows. Those show **View source** instead of Install, as before.

## Beta 0.0007 (build 1.40) — October 19, 2026

- **Fixed (Mac): the small icon looked scrambled** in Finder's list view, the sidebar and for the installer disk. The build tool shrank one large picture into the Mac icon file and garbled the small sizes. Cartridge now ships its own Mac icon file (`build/icon.icns`) with every size drawn separately, from 16 to 1024 pixels, and the tiny sizes use the simpler cartridge so they stay clear. The installer disk uses the same icon.

## Beta 0.0006 (build 1.39) — October 19, 2026

**Wii U**
- Wii U was already supported (.wua, .wud, .wux, .rpx, and dumped game folders with code/content/meta, named from meta.xml). New: **NUS folders**, the encrypted format downloaded from Nintendo's servers (title.tmd + title.tik + 000000xx.app files), count as one game, named after the folder, with the title ID read from title.tmd.
- **.wuhb** homebrew bundles (Aroma) are recognised.

## Beta 0.0005 (build 1.38) — October 19, 2026

**Modern consoles**
- **PlayStation 4:** .pkg files (with the title ID read from the package) and dumped game folders. PS4 and Vita folders look alike (sce_sys/param.sfo + eboot.bin), so the title ID decides: CUSA… is PS4, PCSx… is Vita.
- **PlayStation 5:** dumped game folders with sce_sys/param.json; the game's name and title ID come from param.json.
- **Xbox One and Xbox Series X|S:** dumped game folders with MicrosoftGame.config (or appxmanifest.xml); the name comes from the config. Series games are told apart by a folder named "Xbox Series".
- **Nintendo Switch 2:** .nsp/.xci files in a folder named "Switch 2" (they use the same file types as the Switch).
- Box art for PS4 comes from libretro-thumbnails; the others use SteamGridDB if you've added a key.

**PS3 and Switch**
- Both were already supported (PS3: disc dumps with PS3_GAME, .iso, .pkg; Switch: .nsp .xci .nsz .xcz). New: **PS3 digital (PSN) game folders** as installed on the console (for example NPUB30910 with PARAM.SFO and USRDIR inside) are recognised too.
- Switch has no free cover library like the other consoles, so Switch covers come from SteamGridDB: add a free key in Settings → Cover art.

**Dreamcast**
- Dreamcast was already supported (.gdi, .cdi, .cue + .bin, .iso). **.chd files are now recognised by their contents** instead of only by their folder name: a CHD holding a GD-ROM is a Dreamcast game (or NAOMI/Atomiswave if the folder says so), and a CHD holding a DVD is a PS2-era disc.

## Beta 0.0004 (build 1.37) — October 19, 2026

- **New square app icon everywhere:** the glowing red cartridge on a rounded 90s-sunset tile with a neon grid floor. One design for the Mac app (Apple's standard rounded tile with its margin and shadow), the Windows app, installer and taskbar, and the About and welcome screens. Tiny Windows sizes use a simpler cartridge so it stays clear at 16 pixels. `build/icon-src/make_square.py` rebuilds all of them.

## Beta 0.0003 (build 1.36) — October 19, 2026

**3DS games**
- **Azahar's compressed 3DS formats** (.zcci, .zcxi, .z3dsx, .zcia, added to the Azahar emulator in 2025) are recognised.
- **Big zip and 7z files are no longer skipped.** Archives over 256 MB used to be passed over without a word, and most zipped 3DS (and Switch, Wii U, disc) games are bigger than that. Cartridge now lists what's inside without unpacking it, adds the games it finds by name, and only unpacks one if a game needs the file.
- **Cleaner names:** release numbers and words like "Decrypted" are removed from file names ("0337 - Mario Kart 7 (USA) Decrypted.3ds" → "Mario Kart 7"), so covers and matching work better.

## Beta 0.0002 (build 1.35) — October 19, 2026

**Xbox 360 games are recognised**
- **Fixed: "Couldn't tell which console this file is for" for Xbox 360 .iso files.** Cartridge looked for the disc's signature 64 KB past where it really is on XGD2 discs, the format most Xbox 360 games from about 2006 to 2011 use. Full dumps of XGD2 and XGD3 discs are now recognised.
- Trimmed .iso files (made with extract-xiso and similar tools) start the same way for Xbox 360 and the original Xbox. Cartridge now looks inside for the game file (default.xex for Xbox 360, default.xbe for the original Xbox) instead of guessing from the folder name.
- **Games on Demand and Xbox Live Arcade downloads** (files with no extension inside folders like 00007000 or 000D0000) are recognised, with the game's name and title ID read from the package.
- Like all disc games, they stay where they are; nothing is copied.

## Beta 0.0001 (build 1.34) — October 19, 2026

**Your ROMs are never copied any more**
- Older versions saved a cleaned-up copy of every cartridge ROM they checked into `Cartridge/ROMs`, which with a big collection used a lot of disk space (found on a Mac, but it happened on Windows too). Now Cartridge only remembers where each ROM is, including its place inside a zip, and leaves the file alone.
- A copy is made only when a game needs a different file (a .v64 or .n64 converted to .z64, a header removed, or a ROM unpacked from a zip), only for that game's ROM, and only when you install or play it. These go in `Cartridge/ROMs/Converted`. Removing a ROM from My ROMs deletes its converted copy too; your own file is never touched.
- **Space from older versions is given back.** The first time 1.34 starts, it rescans your watched ROM folders, points every ROM at your own file and deletes its old copy, then says how much space was freed. Copies whose original isn't in a watched folder are listed under **Settings → ROM copies**, with a button to remove them.

**Version name**
- Cartridge now shows **Beta 0.0001** instead of a version number; see the note at the top.
- The update message says "A new Cartridge is out!" with a **Download** button.

## 1.33 — October 19, 2026

- **Fixed (Mac): "Installed, but couldn't find the game's app".** The Harbour Masters ports (Ship of Harkinian, 2 Ship 2 Harkinian, Starship, SpaghettiKart, Ghostship) publish their Mac version as a zip with a disk image inside (for example SoH-Mac.zip → SoH.dmg → the app). Cartridge now opens that inner disk image (or a zipped app) automatically, so the game is ready to play straight after installing.
- **New filter: Status → "Works on this Mac"** ("Works on this PC" on Windows). It shows only games that have a download for this computer, plus anything already installed. On a Mac the Games screen starts with it selected, since most ports are Windows-only; choose **Any** or **Reset** to see everything.
- "READY TO GO!" badges and the **Ready to install** row leave out games that have no download for this computer.
- If an install fails, the message has an **Open folder** button that opens the game's folder.

## 1.32 — October 19, 2026

- **Fixed: couldn't scroll down on a laptop screen** (found on a MacBook). The big game banner at the top can fill most of a smaller window, and scrolling with the mouse or trackpad over it did nothing. Now scrolling anywhere, banner included, scrolls the games below, and the banner shrinks as usual once you're scrolling.
- On shorter windows (laptops, under about 1000 pixels tall) the banner is smaller: a smaller box and title, and the game description is left to the info panel. Under about 820 pixels the credits line is hidden too.

## 1.31 — October 19, 2026

- **Fixed (Mac): "Couldn't install zelda3".** zelda3 publishes a single download with no system in its name, and it's a Windows build. On a Mac (and Linux) Cartridge now only uses downloads whose name says they're for that system, or Mac disk images (.dmg). zelda3 and similar games now say "No Mac build yet" instead of downloading something that can't run.
- If a download still turns out to be a Windows build, Cartridge removes it and says so, instead of leaving a game that can't start.
- Cartridge re-checks every game's download when it's updated or moved to another computer, so an old choice can't stick around.
- Confirmed on an M1 Max: the bundled fonts from 1.30 fixed the question-mark boxes.

## 1.30 — October 19, 2026

- **Fixed: on a Mac most text showed as question-mark boxes** (found testing on an M1 Max with macOS Sequoia). The boxes mean the text's font couldn't be loaded. Cartridge now ships its own fonts inside the app, all under the SIL Open Font License: **Anton** (the logo and headings, like Impact), **Archivo Black** (buttons, like Arial Black) and **Inter** (everything else). On a Mac (and Linux) these are used first, so text no longer depends on reaching the system's fonts. Windows keeps Impact, Arial Black and Segoe UI, with the bundled fonts as a backup.
- The Steam artwork Cartridge draws uses the bundled font on a Mac too, and waits for it to load first.
- The About page credits the fonts.

## 1.29 — October 18, 2026

**Mac version (first test build)**
- Cartridge now runs on Macs, both Apple Silicon (M1 and newer) and Intel, as `Cartridge-1.29.0-arm64.dmg` and `-x64.dmg`.
- On a Mac it picks each port's Mac download (Apple Silicon or universal builds first; Intel builds run through Rosetta), unpacks .zip and .dmg files, finds the game's .app and starts it. Play time, save backups and "back to Cartridge when the game closes" work as on Windows.
- Games without a Mac build say "No Mac build yet" instead of offering a download that wouldn't run.
- A proper Mac menu bar (Cmd+Q, copy/paste, full screen), the Dock icon reopens the window, and Add to Steam works with Steam for Mac.
- Wording says Mac/macOS instead of Windows/PC where it matters.
- Cartridge's own update check offers Mac users the .dmg for their chip.

**Builds on GitHub**
- A GitHub workflow builds the Mac and Windows versions whenever a release is published and attaches them automatically, so releases no longer need building on your PC. **Actions → Build Cartridge → Run workflow** makes a test build.
- MAC-TESTING.md is a 20-minute checklist for testing on a Mac.

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
