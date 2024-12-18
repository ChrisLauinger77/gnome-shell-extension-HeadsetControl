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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const capabilities = {
  battery: false,
  chatmix: false,
  sidetone: false,
  led: false,
  inactivetime: false,
  voice: false,
  rotatemute: false,
};
const headsetcontrolCommands = {
  cmdCapabilities: "",
  cmdBattery: "",
  cmdChatMix: "",
  cmdSidetone: "",
  cmdLED: "",
  cmdInacitetime: "",
  cmdVoice: "",
  cmdRotateMute: "",
  cmdOutputFormat: "",
};

const _rgbToHex = (r, g, b) =>
  "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

let usenotifications;
let uselogging;
let usecolors;

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
    if (cmd.includes("-o json")) {
      strOutput = output;
    }
    _logoutput(strOutput);
    return strOutput;
  } catch (err) {
    // could not execute the command
    logError(err, "HeadsetControl");
    return "N/A";
  }
}

const HeadsetControlMenuToggle = GObject.registerClass(
  class HeadsetControlMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(settings, Me) {
      this._settings = settings;
      this._valueBattery = "";
      this._valueBattery_num = 0;
      this._valueChatMix = "";
      super._init({
        title: _("HeadsetControl"),
        iconName: "audio-headset-symbolic",
        toggleMode: true,
      });

      // This function is unique to this class. It adds a nice header with an
      // icon, title and optional subtitle. It's recommended you do so for
      // consistency with other menus.
      this.menu.setHeader("audio-headset-symbolic", _("HeadsetControl"), "");

      settings.bind(
        "show-systemindicator",
        this,
        "checked",
        Gio.SettingsBindFlags.DEFAULT
      );
      //entry for charge
      if (capabilities.battery) {
        this._valueBattery = _("Charge") + ": ???";
      }
      //entry for chat mix
      if (capabilities.chatmix) {
        this._valueChatMix = _("Chat-Mix") + ": ???";
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
      // voice prompts rotate-to-mute
      if (capabilities.voice) {
        popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(
          _("Voice Prompts")
        );
        this._addVoiceMenu(popupMenuExpander);
      }
      if (capabilities.rotatemute) {
        popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(
          _("Rotate to Mute")
        );
        this._addRotateMuteMenu(popupMenuExpander);
      }
      // Add an entry-point for more settings
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const settingsItem = this.menu.addAction(_("Settings"), () =>
        Me._openPreferences()
      );

      // Ensure the settings are unavailable when the screen is locked
      settingsItem.visible = Main.sessionMode.allowSettings;
      this.menu._settingsActions[Me.uuid] = settingsItem;
      //remember style
      this._originalStyle = this.get_style();
    }

    _setValueBattery(strBattery, lngBattery) {
      this._valueBattery = strBattery;
      this._valueBattery_num = lngBattery;
    }

    _setValueChatMix(strChatMix) {
      this._valueChatMix = strChatMix;
    }

    _setMenuTitle() {
      if (capabilities.battery && capabilities.chatmix) {
        this.set({
          title: this._valueBattery,
        });
        this.set({
          subtitle: this._valueChatMix,
        });
      } else if (capabilities.battery) {
        this.set({
          title: this._valueBattery,
        });
      } else if (capabilities.chatmix) {
        this.set({
          title: this._valueChatMix,
        });
      }
    }

    _setMenuSetHeader() {
      if (capabilities.battery && capabilities.chatmix) {
        this.menu.setHeader(
          "audio-headset-symbolic",
          this._valueBattery,
          this._valueChatMix
        );
        _logoutput(
          "_setMenuSetHeader:" + this._valueBattery + " / " + this._valueChatMix
        );
      } else if (capabilities.battery) {
        this.menu.setHeader("audio-headset-symbolic", this._valueBattery, "");
        _logoutput("_setMenuSetHeader:" + this._valueBattery);
      } else if (capabilities.chatmix) {
        this.menu.setHeader("audio-headset-symbolic", this._valueChatMix, "");
        _logoutput("_setMenuSetHeader:" + this._valueChatMix);
      } else {
        this.menu.setHeader("audio-headset-symbolic", _("HeadsetControl"), "");
      }
      this._changeColor(this._valueBattery, this._valueBattery_num);
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
      const sidetoneValues = [
        [_("Off"), "0"],
        [_("low"), "32"],
        [_("medium"), "64"],
        [_("high"), "96"],
        [_("max"), "128"],
      ];
      sidetoneValues.forEach((item) =>
        this._addPopupMenuItem(
          popupMenuExpander,
          item[0],
          headsetcontrolCommands.cmdSidetone + " " + item[1]
        )
      );
      this.menu.addMenuItem(popupMenuExpander);
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
    }

    _addLEDMenu(popupMenuExpander) {
      const LEDvalues = [
        [_("Off"), "0"],
        [_("On"), "1"],
      ];
      LEDvalues.forEach((item) =>
        this._addPopupMenuItem(
          popupMenuExpander,
          item[0],
          headsetcontrolCommands.cmdLED + " " + item[1]
        )
      );
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addVoiceMenu(popupMenuExpander) {
      const voiceValues = [
        [_("Off"), "0"],
        [_("On"), "1"],
      ];
      voiceValues.forEach((item) =>
        this._addPopupMenuItem(
          popupMenuExpander,
          item[0],
          headsetcontrolCommands.cmdVoice + " " + item[1]
        )
      );
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addRotateMuteMenu(popupMenuExpander) {
      const rotateMuteValues = [
        [_("Off"), "0"],
        [_("On"), "1"],
      ];
      rotateMuteValues.forEach((item) =>
        this._addPopupMenuItem(
          popupMenuExpander,
          item[0],
          headsetcontrolCommands.cmdRotateMute + " " + item[1]
        )
      );
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _addInactivetimeMenu(popupMenuExpander) {
      const inacitetimeValues = [
        [_("Off"), "0"],
        [_("05 min"), "05"],
        [_("15 min"), "15"],
        [_("30 min"), "30"],
        [_("45 min"), "45"],
        [_("60 min"), "60"],
        [_("75 min"), "75"],
        [_("90 min"), "90"],
      ];
      inacitetimeValues.forEach((item) =>
        this._addPopupMenuItem(
          popupMenuExpander,
          item[0],
          headsetcontrolCommands.cmdInacitetime + " " + item[1]
        )
      );
      popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
      this.menu.addMenuItem(popupMenuExpander);
    }

    _getColorHEXValue(strSettingsColor) {
      let strcolor = this._settings.get_string(strSettingsColor);
      _logoutput("_getColorHEXValue-strSettingsColor: " + strSettingsColor);
      _logoutput("_getColorHEXValue-strcolor: " + strcolor);
      let arrColor = strcolor.replace("rgb(", "").replace(")", "").split(",");
      let color = _rgbToHex(
        parseInt(arrColor[0]),
        parseInt(arrColor[1]),
        parseInt(arrColor[2])
      );
      return color;
    }

    _changeColor(strvalueBattery, valueBattery_num) {
      let colorR = this._getColorHEXValue("color-batterylow");
      let colorY = this._getColorHEXValue("color-batterymedium");
      let colorG = this._getColorHEXValue("color-batteryhigh");

      if (!usecolors || strvalueBattery == "N/A") {
        this._menuButton.set_style(this._originalStyle);
        return false;
      }
      _logoutput("_changeColor: " + valueBattery_num);
      if (valueBattery_num >= 50) {
        this._menuButton.set_style("color: " + colorG + ";");
        _logoutput("_changeColor: " + colorG);
      } else if (valueBattery_num >= 25) {
        this._menuButton.set_style("color: " + colorY + ";");
        _logoutput("_changeColor: " + colorY);
      } else {
        this._menuButton.set_style("color: " + colorR + ";");
        _logoutput("_changeColor: " + colorR);
      }
      return true;
    }
  }
);

const HeadsetControlIndicator = GObject.registerClass(
  class HeadsetControlIndicator extends QuickSettings.SystemIndicator {
    _init(settings, Me) {
      super._init();
      if (settings.get_boolean("show-systemindicator")) {
        // Create the icon for the indicator
        this._indicator = this._addIndicator();
        this._indicator.icon_name = "audio-headset-symbolic";
      }

      // Create the toggle menu and associate it with the indicator, being
      // sure to destroy it along with the indicator
      this._HeadSetControlMenuToggle = new HeadsetControlMenuToggle(
        settings,
        Me
      );
      this.quickSettingsItems.push(this._HeadSetControlMenuToggle);

      this.connect("destroy", () => {
        this.quickSettingsItems.forEach((item) => item.destroy());
      });

      // Add the indicator to the panel and the toggle to the menu
      QuickSettingsMenu._indicators.add_child(this);
      QuickSettingsMenu.addExternalIndicator(this);
    }
  }
);

export default class HeadsetControl extends Extension {
  _needCapabilitiesRefresh = true;
  _JSONoutputSupported = true;
  _visible = false;

  _invokecmd(cmd) {
    return _invokecmd(cmd);
  }

  _initCmd() {
    usenotifications = this._settings.get_boolean("use-notifications");
    uselogging = this._settings.get_boolean("use-logging");
    usecolors = this._settings.get_boolean("use-colors");
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
    headsetcontrolCommands.cmdVoice =
      cmdExecutable + " " + this._settings.get_string("option-voice");
    headsetcontrolCommands.cmdRotateMute =
      cmdExecutable + " " + this._settings.get_string("option-rotate-mute");
    headsetcontrolCommands.cmdInacitetime =
      cmdExecutable + " " + this._settings.get_string("option-inactive-time");
    headsetcontrolCommands.cmdOutputFormat =
      cmdExecutable + " " + this._settings.get_string("option-output-format");
  }

  _getHeadSetControlValue(stroutput, valuetosearch) {
    let strValue = "N/A";

    if (stroutput.includes(valuetosearch)) {
      strValue = stroutput.split(":")[1].toString().trim();
    }
    return strValue.toString().trim();
  }

  _readJSONOutputFormat(strOutput) {
    if (!strOutput) {
      strOutput = this._invokecmd(headsetcontrolCommands.cmdOutputFormat);
      _logoutput("_readJSONOutputFormat: calling _invokecmd");
    }
    try {
      return JSON.parse(new TextDecoder().decode(strOutput));
    } catch (err) {
      // could not parse JSON
      logError(err, "HeadsetControl");
      return "";
    }
  }

  _setAllCapabilities(value) {
    capabilities.sidetone = value;
    capabilities.battery = value;
    capabilities.led = value;
    capabilities.inactivetime = value;
    capabilities.chatmix = value;
    capabilities.voice = value;
    capabilities.rotatemute = value;
  }

  _processOutput(output, updateIndicator) {
    if (output) {
      this._JSONoutputSupported = true;
      _logoutput("device_count:" + " " + output.device_count);
      if (output.device_count > 0) {
        _logoutput("devices(0).status:" + " " + output.devices[0].status);
        // if we cannot get the capabilities, set all to true
        if (!output.devices[0].status.includes("success")) {
          this._setAllCapabilities(true);
          return false;
        }
        if (this._needCapabilitiesRefresh) {
          capabilities.sidetone =
            output.devices[0].capabilities.includes("CAP_SIDETONE");
          _logoutput("capabilities.sidetone: " + capabilities.sidetone);
          capabilities.battery =
            output.devices[0].capabilities.includes("CAP_BATTERY_STATUS");
          _logoutput("capabilities.battery: " + capabilities.battery);
          capabilities.led =
            output.devices[0].capabilities.includes("CAP_LIGHTS");
          _logoutput("capabilities.led: " + capabilities.led);
          capabilities.inactivetime =
            output.devices[0].capabilities.includes("CAP_INACTIVE_TIME");
          _logoutput("capabilities.inactivetime: " + capabilities.inactivetime);
          capabilities.chatmix =
            output.devices[0].capabilities.includes("CAP_CHATMIX_STATUS");
          _logoutput("capabilities.chatmix: " + capabilities.chatmix);
          capabilities.voice =
            output.devices[0].capabilities.includes("CAP_VOICE_PROMPTS");
          _logoutput("capabilities.voice: " + capabilities.voice);
          capabilities.rotatemute =
            output.devices[0].capabilities.includes("CAP_ROTATE_TO_MUTE");
          _logoutput("capabilities.rotatemute: " + capabilities.rotatemute);
        }
        this._needCapabilitiesRefresh = false;
      }
      if (updateIndicator) {
        this._HeadsetControlIndicator._HeadSetControlMenuToggle._setValueBattery(
          _("Charge") + ": " + output.devices[0].battery.level + "%",
          output.devices[0].battery.level
        );
        this._HeadsetControlIndicator._HeadSetControlMenuToggle._setValueChatMix(
          _("Chat-Mix") + ": " + output.devices[0].chatmix
        );
        this._HeadsetControlIndicator._HeadSetControlMenuToggle._setMenuSetHeader();
        this._HeadsetControlIndicator._HeadSetControlMenuToggle._setMenuTitle();
      }

      return true;
    }
  }

  async _refreshJSON_async() {
    try {
      let flags = Gio.SubprocessFlags.STDOUT_PIPE;
      const [, argv] = GLib.shell_parse_argv(
        headsetcontrolCommands.cmdOutputFormat
      );
      let proc = new Gio.Subprocess({ argv, flags });
      proc.init(null);

      let stdout = await new Promise((resolve, reject) => {
        proc.communicate_async(null, null, (proc, res) => {
          try {
            let [, stdout] = proc.communicate_finish(res);
            resolve(stdout);
          } catch (err) {
            // could not execute the command
            logError(err, "HeadsetControl");
            reject(e);
          }
        });
      });
      let output = this._readJSONOutputFormat(stdout);
      this._processOutput(output, true);
    } catch (e) {
      logerror(e);
    }
  }

  _refreshJSONall(updateIndicator) {
    this._JSONoutputSupported = false;
    let strOutput = this._readJSONOutputFormat("");
    return this._processOutput(strOutput, updateIndicator);
  }

  _refreshCapabilities() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdCapabilities);

    // if we cannot get the capabilities, set all to true
    if (!strOutput || strOutput.includes("No supported headset found")) {
      this._setAllCapabilities(true);
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
    if (strOutput.includes("* voice prompts")) {
      capabilities.voice = true;
    }
    _logoutput("capabilities.voice: " + capabilities.voice);
    if (strOutput.includes("* rotate to mute")) {
      capabilities.rotatemute = true;
    }
    _logoutput("capabilities.rotatemute: " + capabilities.rotatemute);
    this._needCapabilitiesRefresh = false; // when headset was connected
  }

  _refreshBatteryStatus() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdBattery);

    if (!strOutput) {
      return false;
    }
    let strBattery = this._getHeadSetControlValue(strOutput, "Battery");
    this._HeadsetControlIndicator._HeadSetControlMenuToggle._setValueBattery(
      _("Charge") + ": " + strBattery,
      strBattery.replace("%", "")
    );
    return true;
  }

  _refreshChatMixStatus() {
    let strOutput = this._invokecmd(headsetcontrolCommands.cmdChatMix);

    if (!strOutput) {
      return false;
    }
    let strChatMix = this._getHeadSetControlValue(strOutput, "Chat-Mix");
    this._HeadsetControlIndicator._HeadSetControlMenuToggle._setValueChatMix(
      _("Chat-Mix") + ": " + strChatMix
    );
    return true;
  }

  _refresh() {
    this._visible = !this._visible;
    if (!this._visible) {
      _logoutput(_("Quicksettings not open - do nothing..."));
      return;
    }
    _notify(_("Refreshing..."));
    _logoutput(_("Refreshing..."));

    if (this._JSONoutputSupported) {
      this._refreshJSON_async();
      return;
    }
    if (this._needCapabilitiesRefresh) {
      this._refreshCapabilities();
    }
    if (capabilities.battery) {
      this._refreshBatteryStatus();
    }
    if (capabilities.chatmix) {
      this._refreshChatMixStatus();
    }
    this._HeadsetControlIndicator._HeadSetControlMenuToggle._setMenuSetHeader();
    this._HeadsetControlIndicator._HeadSetControlMenuToggle._setMenuTitle();
  }

  onParamChanged() {
    this.disable();
    this.enable();
  }

  _openPreferences() {
    this.openPreferences();
  }

  enable() {
    this._settings = this.getSettings();
    this._initCmd();

    if (!this._refreshJSONall(false)) {
      this._refreshCapabilities();
    }

    this._HeadsetControlIndicator = new HeadsetControlIndicator(
      this._settings,
      this
    );

    // add Signals to array
    this._SignalsArray = new Array();
    this._SignalsArray.push(
      QuickSettingsMenu.menu.connect(
        "open-state-changed",
        this._refresh.bind(this)
      )
    );
    this._SignalsArray.push(
      this._settings.connect(
        "changed::headsetcontrol-executable",
        this._initCmd.bind(this)
      )
    );
    this._SignalsArray.push(
      this._settings.connect(
        "changed::use-notifications",
        this._initCmd.bind(this)
      )
    );
    this._SignalsArray.push(
      this._settings.connect("changed::use-logging", this._initCmd.bind(this))
    );
    this._SignalsArray.push(
      this._settings.connect(
        "changed::show-systemindicator",
        this.onParamChanged.bind(this)
      )
    );
    this._SignalsArray.push(
      this._settings.connect("changed::use-colors", this._initCmd.bind(this))
    );
  }

  disable() {
    // remove setting Signals
    this._SignalsArray.forEach(function (signal) {
      this._settings.disconnect(signal);
    }, this);
    this._SignalsArray = null;
    this._settings = null;
    this._HeadsetControlIndicator.destroy();
    this._HeadsetControlIndicator = null;
    usenotifications = null;
    uselogging = null;
    usecolors = null;
  }
}
