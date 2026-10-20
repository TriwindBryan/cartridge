// Runs before anything is drawn: tag the page with the operating system, so the styles can pick fonts that exist there.
// (On a Mac the bundled fonts come first; see styles.css.)
'use strict';
document.documentElement.classList.add(/Mac/i.test(navigator.platform || navigator.userAgent) ? 'os-mac' : /Linux/i.test(navigator.platform || '') ? 'os-linux' : 'os-win');
