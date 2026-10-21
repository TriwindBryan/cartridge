# Testing Cartridge on a Mac

Thanks for helping! This takes about 20–30 minutes. Cartridge has only been tested on Windows so far, so anything odd you notice is useful.

## 1. Install it

1. Download **Cartridge-1.45.0-arm64.dmg** (for M1/M2/M3/M4 Macs) from the link you were sent.
2. Open the .dmg and drag **Cartridge** into **Applications**.
3. Open Cartridge from Applications. macOS will say it can't verify the developer (Cartridge isn't registered with Apple yet). Click **Done**, then go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Cartridge. Confirm with your password. You only do this once.

## 2. Check these, and note what happens

- [x] **All text shows as letters, not boxes** (fixed in 1.30, confirmed).
- [ ] Games without a Mac build (zelda3, most recomps) say **No Mac build yet** instead of Install.

- [ ] Cartridge opens within a few seconds and looks right (logo, games, covers loading).
- [ ] **Cmd+Q** quits; the menu bar shows Cartridge, Edit, View and Window menus.
- [ ] **Settings → Controller**: connect a controller (Xbox, PlayStation, Switch Pro or 8BitDo), press a button, and check the buttons light up. Then on the Games screen: D-pad moves, A selects, the View/Share/Minus button opens the side panel.
- [ ] **ROMs**: click **ROM Folder** and pick a folder with a few ROMs. They should appear under My ROMs with covers.
- [ ] **Install a game that has a Mac build.** Good ones to try: **Ship of Harkinian**, **2 Ship 2 Harkinian**, **Starship**, **SpaghettiKart**, **Ghostship**, **sm64coopdx**. Games without a Mac build say "No Mac build yet"; that's expected.
- [ ] **Play it.** Does the game start? Does it find the ROM by itself, or ask you for it? (Cartridge copies the ROM next to the game and also puts its location on the clipboard; if the game asks, press Cmd+V in its file box.)
- [ ] **Quit the game.** Cartridge should come back to the front, and the game's play time should go up.
- [ ] Optional: **Add to Steam** (if you use Steam on this Mac). Steam closes for a moment, then the game should be in your Steam library.

## 3. Send back

- Anything that didn't work, with a screenshot if you can.
- **The log file**: in Cartridge, click the version badge next to the logo → **Open the log file**. (It lives at `~/Library/Application Support/Cartridge/cartridge.log`.)
- For each game you tried: did it start, and did it find the ROM on its own or ask for it?

## If text still shows as boxes

Please try these and say which one fixes it (each one narrows the cause down):

1. From the source folder, `npm start` (runs Cartridge without packaging it). Text OK here?
2. In Terminal: `/Applications/Cartridge.app/Contents/MacOS/Cartridge --no-sandbox`. Text OK here?
3. In Terminal: `codesign --verify --deep --strict --verbose=2 /Applications/Cartridge.app` and send the output.
4. A screenshot showing which text is OK and which is boxes.
