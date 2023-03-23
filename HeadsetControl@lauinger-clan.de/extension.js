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
const capabilities = {
  battery: false,
  chatmix: false,
  sidetone: false,
  led: false,
  inactivetime: false,
};
const headsetcontrolCommands = {
  cmdCapabilities: "",
  cmdBattery: "",
  cmdChatMix: "",
  cmdSidetone: "",
  cmdLED: "",
  cmdInacitetime: "",
};

let usenotifications;
let uselogging;

function _notify(strText) {
  if (usenotifications) {
    Main.notify(_("HeadsetControl"), strText);
  }
}

function _logoutput(strText) {
  if (uselogging) {
    log(_("HeadsetControl") + " " + strText);
  }
}

function _invokecmd(cmd) {
  _notify(_("Command:") + " " + cmd);
  _logoutput(_("Command:") + " " + cmd);
  try {
    let output = GLib.spawn_command_line_sync(cmd)[1];
    let strOutput = imports.byteArray
      .toString(output)
      .replace("\n", "###")
      .replace("Success!", "###");
    strOutput = strOutput.split("###")[1];
    _logoutput(strOutput);
    return strOutput;
  } catch (err) {
    // could not execute the command
    logError(err, "HeadsetControl");
    return "N/A";
  }
}

const HeadsetControlIndicator = GObject.registerClass(
  class HeadsetControlIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("HeadsetControl"));
      let icon = new St.Icon({
        icon_name: "audio-headset",
        style_class: "system-status-icon",
      });
      this.add_child(icon);
      //entry for charge
      if (capabilities.battery) {
        this._entryCharge = new PopupMenu.PopupMenuItem(_("Charge") + ": ???");
        this.menu.addMenuItem(this._entryCharge);
      }
      //entry for chat mix
      if (capabilities.chatmix) {
        this._entryChatMix = new PopupMenu.PopupMenuItem(
          _("Chat-Mix") + ": ???"
        );
        this.menu.addMenuItem(this._entryChatMix);
      }
      let popupMenuExpander;
      // sidetone LED inactive time
      if (capabilities.sidetone) {
        popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(_("Sidetone"));
        this._addSidetoneMenu(popupMenuExpander);
      }
      if (capabilities.led) {
        popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(_("LED"));
        this._addLEDMenu(popupMenuExpander);
      }
      if (capabilities.inactivetime) {
        popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(
          _("Inactive time")
        );
        this._addInactivetimeMenu(popupMenuExpander);
      }
      // Add an entry-point for more settings
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const settingsItem = this.menu.addAction(_("Settings"), () =>
        ExtensionUtils.openPrefs()
      );
      // Ensure the settings are unavailable when the screen is locked
      settingsItem.visible = Main.sessionMode.allowSettings;
      this.menu._settingsActions[Me.uuid] = settingsItem;
    }

    _invokecmd(cmd) {
      return _invokecmd(cmd);
    }

    _addPopupMenuItem(popupMenuExpander, strLabel, strValue) {
      let submenu;
      submenu = new PopupMenu.PopupMenuItem(_(strLabel));
      submenu.connect("activate", this._invokecmd.bind(this, strValue));
      popupMenuExpander.menu.addMenuItem(submenu);
    }

    _addSidetoneMenu(popupMenuExpander) {
      this._addPopupMenuItem(
        popupMenuExpander,
        _("Off"),
        headsetcontrolCommands.cmdSidetone + " 0"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("low"),
        headsetcontrolCommands.cmdSidetone + " 32"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("medium"),
        headsetcontrolCommands.cmdSidetone + " 64"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("high"),
        headsetcontrolCommands.cmdSidetone + " 96"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("max"),
        headsetcontrolCommands.cmdSidetone + " 128"
      );
      this.menu.addMenuItem(popupMenuExpander);
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
    }

    _addLEDMenu(popupMenuExpander) {
      this._addPopupMenuItem(
        popupMenuExpander,
        _("Off"),
        headsetcontrolCommands.cmdLED + " " + "0"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("On"),
        headsetcontrolCommands.cmdLED + " " + "1"
      );

      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addInactivetimeMenu(popupMenuExpander) {
      this._addPopupMenuItem(
        popupMenuExpander,
        _("Off"),
        headsetcontrolCommands.cmdInacitetime + " 0"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("05 min"),
        headsetcontrolCommands.cmdInacitetime + " 05"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("15 min"),
        headsetcontrolCommands.cmdInacitetime + " 15"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("30 min"),
        headsetcontrolCommands.cmdInacitetime + " 30"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("45 min"),
        headsetcontrolCommands.cmdInacitetime + " 45"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("60 min"),
        headsetcontrolCommands.cmdInacitetime + " 60"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("75 min"),
        headsetcontrolCommands.cmdInacitetime + " 75"
      );
      this._addPopupMenuItem(
        popupMenuExpander,
        _("90 min"),
        headsetcontrolCommands.cmdInacitetime + " 90"
      );
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }
  }
);

class HeadsetControl {
  _needCapabilitiesRefresh = true;

  constructor(uuid) {
    this._uuid = uuid;
  }

  _invokecmd(cmd) {
    return _invokecmd(cmd);
  }

  _initCmd() {
    let cmdExecutable = this._settings.get_string("headsetcontrol-executable");
    headsetcontrolCommands.cmdCapabilities =
      cmdExecutable + " " + this._settings.get_string("option-capabilities");
    headsetcontrolCommands.cmdBattery =
      cmdExecutable + " " + this._settings.get_string("option-battery");
    headsetcontrolCommands.cmdChatMix =
      cmdExecutable + " " + this._settings.get_string("option-chatmix");
    headsetcontrolCommands.cmdSidetone =
      cmdExecutable + " " + this._settings.get_string("option-sidetone");
    headsetcontrolCommands.cmdLED =
      cmdExecutable + " " + this._settings.get_string("option-led");
    headsetcontrolCommands.cmdInacitetime =
      cmdExecutable + " " + this._settings.get_string("option-inactive-time");
  }

  _getHeadSetControlValue(stroutput, valuetosearch) {
    let strValue = "N/A";

    if (stroutput.includes(valuetosearch)) {
      strValue = stroutput.split(":")[1].toString().trim();
    }
    return strValue.toString().trim();
  }

  _changeColor(target, strBattery) {
    if (strBattery == "N/A") {
      return false;
    }
    let valueBattery = strBattery.replace("%", "").trim();
    if (valueBattery >= 50) {
      target._entryCharge.set_style("color: " + colorG + ";");
    } else if (valueBattery >= 25) {
      target._entryCharge.set_style("color: " + colorY + ";");
    } else {
      target._entryCharge.set_style("color: " + colorR + ";");
    }
    return true;
  }

  _refreshCapabilities() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdCapabilities);

    // if we cannot get the capabilities, set all to true
    if (!strOutput || strOutput.includes("No supported headset found")) {
      capabilities.sidetone = true;
      capabilities.battery = true;
      capabilities.led = true;
      capabilities.inactivetime = true;
      capabilities.chatmix = true;
      return false;
    }
    if (strOutput.includes("* sidetone")) {
      capabilities.sidetone = true;
    }
    _logoutput("capabilities.sidetone: " + capabilities.sidetone);
    if (strOutput.includes("* battery status")) {
      capabilities.battery = true;
    }
    _logoutput("capabilities.battery: " + capabilities.battery);
    if (strOutput.includes("* lights")) {
      capabilities.led = true;
    }
    _logoutput("capabilities.led: " + capabilities.led);
    if (strOutput.includes("* inactive time")) {
      capabilities.inactivetime = true;
    }
    _logoutput("capabilities.inactivetime: " + capabilities.inactivetime);
    if (strOutput.includes("* chatmix")) {
      capabilities.chatmix = true;
    }
    _logoutput("capabilities.chatmix: " + capabilities.chatmix);
    this._needCapabilitiesRefresh = false; // when headset was connected
  }

  _refreshBatteryStatus() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdBattery);

    if (!strOutput) {
      return false;
    }
    let strBattery = this._getHeadSetControlValue(strOutput, "Battery");
    this._HeadsetControlIndicator._entryCharge.label.text =
      _("Charge") + ": " + strBattery;
    this._changeColor(this._HeadsetControlIndicator, strBattery);
  }

  _refreshChatMixStatus() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdChatMix);

    if (!strOutput) {
      return false;
    }
    this._HeadsetControlIndicator._entryChatMix.label.text =
      _("Chat-Mix") +
      ": " +
      this._getHeadSetControlValue(strOutput, "Chat-Mix");
  }

  _refresh() {
    _notify(_("Refreshing..."));
    _logoutput(_("Refreshing..."));
    if (this._needCapabilitiesRefresh) {
      this._refreshCapabilities();
    }
    if (capabilities.battery) {
      this._refreshBatteryStatus();
    }
    if (capabilities.chatmix) {
      this._refreshChatMixStatus();
    }
    return true;
  }

  enable() {
    this._settings = ExtensionUtils.getSettings(g_schema);
    usenotifications = this._settings.get_boolean("use-notifications");
    uselogging = this._settings.get_boolean("use-logging");
    this._initCmd();
    this._refreshCapabilities();
    this._HeadsetControlIndicator = new HeadsetControlIndicator();
    Main.panel.addToStatusArea(this._uuid, this._HeadsetControlIndicator);
    this._HeadsetControlIndicator.connect(
      "button-press-event",
      this._refresh.bind(this)
    );
    // add setting Signals
    this._settingSignals = new Array();
    this._settingSignals.push(
      this._settings.connect(
        "changed::headsetcontrol-executable",
        this._initCmd.bind(this)
      )
    );
    this._settingSignals.push(
      this._settings.connect(
        "changed::use-notifications",
        this._initCmd.bind(this)
      )
    );
    this._settingSignals.push(
      this._settings.connect("changed::use-logging", this._initCmd.bind(this))
    );
  }

  disable() {
    // remove setting Signals
    this._settingSignals.forEach(function (signal) {
      this._settings.disconnect(signal);
    }, this);
    this._settingSignals = null;
    this._settings = null;
    this._HeadsetControlIndicator.destroy();
    this._HeadsetControlIndicator = null;
    usenotifications = null;
    uselogging = null;
  }
}

function init(meta) {
  ExtensionUtils.initTranslations("HeadsetControl");
  return new HeadsetControl(meta.uuid, g_schema);
}
