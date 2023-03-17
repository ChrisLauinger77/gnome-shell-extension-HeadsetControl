/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const _ = ExtensionUtils.gettext;

const HeadsetControlIndicator = GObject.registerClass(
  class HeadsetControlIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("HeadsetControl"));

      this.add_child(
        new St.Icon({
          icon_name: "audio-headset",
          style_class: "system-status-icon",
        })
      );

      let item = new PopupMenu.PopupMenuItem(_("Refresh"));
      item.connect("activate", () => {
        Main.notify(_("Refreshing..."));
      });
      this.menu.addMenuItem(item);
      // Add an entry-point for more settings
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const settingsItem = this.menu.addAction(_("Settings"), () =>
        ExtensionUtils.openPrefs()
      );
      // Ensure the settings are unavailable when the screen is locked
      settingsItem.visible = Main.sessionMode.allowSettings;
      this.menu._settingsActions[Me.uuid] = settingsItem;
    }
  }
);

class HeadsetControl {
  constructor(uuid) {
    this._uuid = uuid;
  }

  enable() {
    this._HeadsetControlIndicator = new HeadsetControlIndicator();
    Main.panel.addToStatusArea(this._uuid, this._HeadsetControlIndicator);
  }

  disable() {
    this._HeadsetControlIndicator.destroy();
    this._HeadsetControlIndicator = null;
  }
}

function init(meta) {
  ExtensionUtils.initTranslations("HeadsetControl");
  return new HeadsetControl(meta.uuid);
}
