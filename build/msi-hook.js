// electron-builder "msiProjectCreated" hook: patches the generated WiX project before it is compiled.
//
// Why: if Cartridge is open while the .msi installs or upgrades it, Windows can't replace the files in use,
// so it schedules them for the next restart and asks the user to reboot. People hate that.
// Fix: close Cartridge before Windows checks for files in use, and never ask for a restart.
'use strict';
const fs = require('fs');

const PATCH = `
    <!-- Cartridge: close the app first so its files aren't in use, and never prompt for a restart -->
    <Property Id="REBOOT" Value="ReallySuppress"/>
    <CustomAction Id="CloseCartridge" Directory="TARGETDIR" ExeCommand='"[System64Folder]taskkill.exe" /F /IM "Cartridge.exe"' Execute="immediate" Return="ignore"/>`;
const STEP = '<Custom Action="CloseCartridge" Before="InstallValidate"/>';

function patch(xml) {
  if (xml.includes('Id="CloseCartridge"')) return xml; // already patched
  let out = xml.replace(/(<MajorUpgrade\b[^>]*\/>)/, `$1${PATCH}`);
  if (out === xml) throw new Error('msi-hook: <MajorUpgrade> not found in the WiX project');
  // add the step to the existing InstallExecuteSequence, or create one
  if (/<InstallExecuteSequence>/.test(out)) out = out.replace('<InstallExecuteSequence>', `<InstallExecuteSequence>\n      ${STEP}`);
  else out = out.replace(PATCH, `${PATCH}\n    <InstallExecuteSequence>\n      ${STEP}\n    </InstallExecuteSequence>`);
  return out;
}

async function hook(projectFile) {
  const xml = fs.readFileSync(projectFile, 'utf8');
  fs.writeFileSync(projectFile, patch(xml));
}

module.exports = hook;
module.exports.default = hook;
module.exports.patch = patch;
