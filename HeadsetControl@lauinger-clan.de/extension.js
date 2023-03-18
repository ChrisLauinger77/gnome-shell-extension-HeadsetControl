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

const { GObject, St, GLib, Clutter } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = ExtensionUtils.gettext;

const g_schema = "org.gnome.shell.extensions.HeadsetControl";
const colorR = "#ff0000";
const colorY = "#ffff00";
const colorG = "#00ff00";

const HeadsetControlIndicator = GObject.registerClass(
  class HeadsetControlIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("HeadsetControl"));
      let icon = new St.Icon({
        icon_name: "audio-headset",
        style_class: "system-status-icon",
      });
      this.add_child(icon);

      let item = new PopupMenu.PopupMenuItem(_("Refresh"));
      item.connect("activate", this.refresh.bind(this));
      this.menu.addMenuItem(item);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      //entry for charge
      this._entryCharge = new PopupMenu.PopupMenuItem(_("Charge") + ": ???");
      this.menu.addMenuItem(this._entryCharge);
      //entry for chat mix
      this._entryChatMix = new PopupMenu.PopupMenuItem(_("Chat-Mix") + ": ???");
      this.menu.addMenuItem(this._entryChatMix);
      // sidetone LED inactive time
      this._addSidetoneMenu();
      this._addLEDMenu();
      this._addInactivetimeMenu();
      // Add an entry-point for more settings
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const settingsItem = this.menu.addAction(_("Settings"), () =>
        ExtensionUtils.openPrefs()
      );
      // Ensure the settings are unavailable when the screen is locked
      settingsItem.visible = Main.sessionMode.allowSettings;
      this.menu._settingsActions[Me.uuid] = settingsItem;
      this._originalStyle = this.get_style();
    }

    _notify(strText) {
      Main.notify(_("HeadsetControl"), strText);
      log(strText);
    }

    _addSidetoneMenu() {
      let popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem("Sidetone");
      let submenu;
      //off
      submenu = new PopupMenu.PopupMenuItem(_("off"));
      submenu.connect("activate", this._invokecmd.bind(this, "<Sidetone> 0"));
      popupMenuExpander.menu.addMenuItem(submenu);
      //low
      submenu = new PopupMenu.PopupMenuItem(_("low"));
      submenu.connect("activate", this._invokecmd.bind(this, "<Sidetone> 32"));
      popupMenuExpander.menu.addMenuItem(submenu);
      //low
      submenu = new PopupMenu.PopupMenuItem(_("medium"));
      submenu.connect("activate", this._invokecmd.bind(this, "<Sidetone> 64"));
      popupMenuExpander.menu.addMenuItem(submenu);
      //low
      submenu = new PopupMenu.PopupMenuItem(_("high"));
      submenu.connect("activate", this._invokecmd.bind(this, "<Sidetone> 96"));
      popupMenuExpander.menu.addMenuItem(submenu);
      //max
      submenu = new PopupMenu.PopupMenuItem(_("max"));
      submenu.connect("activate", this._invokecmd.bind(this, "<Sidetone> 128"));

      popupMenuExpander.menu.addMenuItem(submenu);
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addLEDMenu() {
      let popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem("LED");
      let submenu;
      //off
      submenu = new PopupMenu.PopupMenuItem(_("off"));
      submenu.connect("activate", this._invokecmd.bind(this, "<LED> 0"));
      popupMenuExpander.menu.addMenuItem(submenu);
      //on
      submenu = new PopupMenu.PopupMenuItem(_("on"));
      submenu.connect("activate", this._invokecmd.bind(this, "<LED> 1"));
      popupMenuExpander.menu.addMenuItem(submenu);

      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addInactivetimeMenu() {
      let popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(
        "Inactive time"
      );
      let submenu;
      //off
      submenu = new PopupMenu.PopupMenuItem(_("off"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 0")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      // 5min
      submenu = new PopupMenu.PopupMenuItem(_("5 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 5")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      //15 min
      submenu = new PopupMenu.PopupMenuItem(_("15 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 15")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      //30 min
      submenu = new PopupMenu.PopupMenuItem(_("30 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 30")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      //45 min
      submenu = new PopupMenu.PopupMenuItem(_("45 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 45")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      //60 min
      submenu = new PopupMenu.PopupMenuItem(_("60 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 60")
      );
      popupMenuExpander.menu.addMenuItem(submenu);
      //90 min
      submenu = new PopupMenu.PopupMenuItem(_("90 min"));
      submenu.connect(
        "activate",
        this._invokecmd.bind(this, "<InactiveTime> 90")
      );
      popupMenuExpander.menu.addMenuItem(submenu);

      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    initCmd(settings) {
      let cmdExecutable = settings.get_string("headsetcontrol-executable");
      this._cmdCapabilities =
        cmdExecutable + " " + settings.get_string("option-capabilities");
      this._cmdBattery =
        cmdExecutable + " " + settings.get_string("option-battery");
      this._cmdChatMix =
        cmdExecutable + " " + settings.get_string("option-chatmix");
      this._cmdSidetone =
        cmdExecutable + " " + settings.get_string("option-sidetone");
      this._cmdLED = cmdExecutable + " " + settings.get_string("option-led");
      this._cmdInacitetime =
        cmdExecutable + " " + settings.get_string("option-inactive-time");
    }

    _invokecmd(cmd) {
      cmd = cmd
        .replace("<Sidetone>", this._cmdSidetone)
        .replace("<LED>", this._cmdLED)
        .replace("<InactiveTime>", this._cmdInacitetime);

      this._notify(_("Command: ") + cmd);
      try {
        let output = GLib.spawn_command_line_sync(cmd)[1];
        let strOutput = imports.byteArray
          .toString(output)
          .replace("\n", "###")
          .replace("Success!", "###");
        strOutput = strOutput.split("###")[1];
        return strOutput;
      } catch (err) {
        // could not execute the command
        logError(err, "HeadsetControl");
        return "N/A";
      }
    }

    _getHeadSetControlValue(stroutput, valuetosearch) {
      let strValue = "N/A";

      if (stroutput.includes(valuetosearch)) {
        strValue = stroutput.split(":")[1].toString().trim();
      }
      return strValue.toString().trim();
    }

    _changeIconColor(strBattery) {
      if (strBattery == "N/A") {
        this.set_style(this._originalStyle);
        return false;
      }
      let valueBattery = strBattery.replace("%", "").trim();
      if (valueBattery >= 50) {
        this.set_style("color: " + colorG + ";");
        this._entryCharge.set_style("color: " + colorG + ";");
      } else if (valueBattery >= 25) {
        this.set_style("color: " + colorY + ";");
        this._entryCharge.set_style("color: " + colorY + ";");
      } else {
        this.set_style("color: " + colorR + ";");
        this._entryCharge.set_style("color: " + colorR + ";");
      }
      return true;
    }

    _refreshBatteryStatus() {
      let strOutput = this._invokecmd(this._cmdBattery);

      if (!strOutput) {
        return false;
      }
      let strBattery = this._getHeadSetControlValue(strOutput, "Battery");
      this._entryCharge.label.text = _("Charge") + ": " + strBattery;
      this._changeIconColor(strBattery);
    }

    _refreshChatMixStatus() {
      let strOutput = this._invokecmd(this._cmdChatMix);

      if (!strOutput) {
        return false;
      }
      this._entryChatMix.label.text =
        _("Chat-Mix") +
        ": " +
        this._getHeadSetControlValue(strOutput, "Chat-Mix");
    }

    refresh() {
      this._notify(_("Refreshing..."));
      this._refreshBatteryStatus();
      this._refreshChatMixStatus();
      return true;
    }
  }
);

class HeadsetControl {
  constructor(uuid) {
    this._uuid = uuid;
  }

  enable() {
    this._settings = ExtensionUtils.getSettings(g_schema);
    this._HeadsetControlIndicator = new HeadsetControlIndicator();
    Main.panel.addToStatusArea(this._uuid, this._HeadsetControlIndicator);
    this._HeadsetControlIndicator.initCmd(this._settings);
    this._HeadsetControlIndicator.refresh();
  }

  disable() {
    this._settings = null;
    this._HeadsetControlIndicator.destroy();
    this._HeadsetControlIndicator = null;
  }
}

function init(meta) {
  ExtensionUtils.initTranslations("HeadsetControl");
  return new HeadsetControl(meta.uuid, g_schema);
}
