import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

/*
the next lines are only here to be caugth by translation
this is is not packed with the extension or installed - only purpose is to catch the strings and
add them to po file by "xgettext --from-code=UTF-8 --output=locale/Shortcuts.pot src/*.js src/schemas/*.xml"
*/
const strFix1 = _("Default");
const strFix2 = _("Preset 1");
const strFix3 = _("Preset 2");
const strFix4 = _("Preset 3");

console.log(strFix1 + strFix2 + strFix3 + strFix4)