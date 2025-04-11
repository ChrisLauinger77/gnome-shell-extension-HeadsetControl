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
import { PopupAnimation } from "resource:///org/gnome/shell/ui/boxpointer.js";

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const capabilities = {
    battery: false,
    chatmix: false,
    sidetone: false,
    led: false,
    inactivetime: false,
    voice: false,
    rotatemute: false,
    equalizer: false,
    equalizerpreset: false,
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
    cmdEqualizer: "",
    cmdEqualizerPreset: "",
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
        console.log(_("HeadsetControl") + " " + strText);
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
        console.error(err, "HeadsetControl");
        return "N/A";
    }
}

const HeadsetControlMenuToggle = GObject.registerClass(
    class HeadsetControlMenuToggle extends QuickSettings.QuickMenuToggle {
        constructor(Me) {
            const { _settings } = Me;
            super({
                title: _("HeadsetControl"),
                iconName: "audio-headset-symbolic",
                toggleMode: true,
            });
            this._settings = _settings;
            this._valueBattery = "";
            this._valueBattery_num = 0;
            this._valueChatMix = "";
            this._valueHeadsetname = "";

            this.menu.setHeader(
                "audio-headset-symbolic",
                _("HeadsetControl"),
                ""
            );

            _settings.bind(
                "show-systemindicator",
                this,
                "checked",
                Gio.SettingsBindFlags.DEFAULT
            );

            this._buildMenu();
            this._addSettingsAction(Me);

            //remember style
            this._originalStyle = this.get_style();
        }

        _buildMenu() {
            if (capabilities.battery) {
                this._valueBattery = _("Charge") + ": ???";
            }
            if (capabilities.chatmix) {
                this._valueChatMix = _("Chat-Mix") + ": ???";
            }

            const menuItems = [
                {
                    capability: "sidetone",
                    label: _("Sidetone"),
                    method: this._addSidetoneMenu,
                },
                {
                    capability: "led",
                    label: _("LED"),
                    method: this._addLEDMenu,
                },
                {
                    capability: "inactivetime",
                    label: _("Inactive time"),
                    method: this._addInactivetimeMenu,
                },
                {
                    capability: "voice",
                    label: _("Voice Prompts"),
                    method: this._addVoiceMenu,
                },
                {
                    capability: "rotatemute",
                    label: _("Rotate to Mute"),
                    method: this._addRotateMuteMenu,
                },
                {
                    capability: "equalizer",
                    label: _("Equalizer Setting"),
                    method: this._addEqualizerSettingMenu,
                },
                {
                    capability: "equalizerpreset",
                    label: _("Equalizer Preset"),
                    method: this._addEqualizerPresetMenu,
                },
            ];

            menuItems.forEach((item) => {
                if (capabilities[item.capability]) {
                    const popupMenuExpander =
                        new PopupMenu.PopupSubMenuMenuItem(item.label);
                    item.method.call(this, popupMenuExpander);
                    this.menu.addMenuItem(popupMenuExpander);
                }
            });
        }

        refreshMenu(Me) {
            this.menu.removeAll();
            this._buildMenu();
            this._addSettingsAction(Me);
        }

        _addSettingsAction(Me) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const settingsItem = this.menu.addAction(_("Settings"), () =>
                Me._openPreferences()
            );
            settingsItem.visible = Main.sessionMode.allowSettings;
            this.menu._settingsActions[Me.uuid] = settingsItem;
        }

        updateBatteryStatus(strStatus, strBattery, lngBattery) {
            if (capabilities.battery) {
                this._valueBattery_num = lngBattery;
                if (this._valueBattery_num < 0) {
                    this._valueBattery = _("Disconnected");
                    return;
                }
                if (strStatus === "BATTERY_CHARGING") {
                    this._valueBattery = _("Charging...");
                } else {
                    this._valueBattery = _("Charge") + ": " + strBattery;
                }
            }
        }

        updateHeadsetName(strHeadsetname) {
            this._valueHeadsetname = strHeadsetname;
        }

        updateChatMixStatus(strChatMix) {
            if (capabilities.chatmix) {
                this._valueChatMix = _("Chat-Mix") + ": " + strChatMix;
            }
        }

        setMenuTitle() {
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
                this.set({
                    subtitle: this._valueHeadsetname,
                });
            } else if (capabilities.chatmix) {
                this.set({
                    title: this._valueChatMix,
                });
                this.set({
                    subtitle: this._valueHeadsetname,
                });
            }
        }

        setMenuSetHeader() {
            if (capabilities.battery && capabilities.chatmix) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueBattery,
                    this._valueChatMix
                );
                _logoutput("setMenuSetHeader: Battery and Chatmix");
            } else if (capabilities.battery) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueBattery,
                    this._valueHeadsetname
                );
                _logoutput("setMenuSetHeader: Battery");
            } else if (capabilities.chatmix) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueChatMix,
                    this._valueHeadsetname
                );
                _logoutput("setMenuSetHeader: Chatmix");
            } else {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    _("HeadsetControl"),
                    this._valueHeadsetname
                );
                _logoutput("setMenuSetHeader: Headsetname");
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
            let arraySidetone = this._settings.get_strv("sidetone-values");
            const sidetoneValues = [
                [_("Off"), arraySidetone[0]],
                [_("Low"), arraySidetone[1]],
                [_("Medium"), arraySidetone[2]],
                [_("High"), arraySidetone[3]],
                [_("Maximum"), arraySidetone[4]],
            ].filter(([, value]) => value !== "-1");
            sidetoneValues.forEach((item) =>
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdSidetone + " " + item[1]
                )
            );
            this.menu.addMenuItem(popupMenuExpander);
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
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
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
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
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
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
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addInactivetimeMenu(popupMenuExpander) {
            const inacitetimeValues = [
                [_("Off"), "0"],
                [_("05 minutes"), "05"],
                [_("15 minutes"), "15"],
                [_("30 minutes"), "30"],
                [_("45 minutes"), "45"],
                [_("60 minutes"), "60"],
                [_("75 minutes"), "75"],
                [_("90 minutes"), "90"],
            ];
            inacitetimeValues.forEach((item) =>
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdInacitetime + " " + item[1]
                )
            );
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addEqualizerSettingMenu(popupMenuExpander) {
            let arrayEqualizerSetting = this._settings.get_strv(
                "option-equalizer-settings"
            );

            const equalizerSettingValues = [
                [_("Setting 1"), arrayEqualizerSetting[0]],
                [_("Setting 2"), arrayEqualizerSetting[1]],
                [_("Setting 3"), arrayEqualizerSetting[2]],
                [_("Setting 4"), arrayEqualizerSetting[3]],
            ];
            equalizerSettingValues.forEach((item) => {
                if (item[1].includes(":")) {
                    let itemarray = [];
                    itemarray = item[1].split(":");
                    item[0] = itemarray[0];
                    item[1] = itemarray[1];
                }
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdEqualizer + " " + item[1]
                );
            });
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addEqualizerPresetMenu(popupMenuExpander) {
            let arrayEqualizerPreset = this._settings.get_strv(
                "equalizer-preset-names"
            );
            const equalizerPresetValues = [
                [_(arrayEqualizerPreset[0]), "0"],
                [_(arrayEqualizerPreset[1]), "1"],
                [_(arrayEqualizerPreset[2]), "2"],
                [_(arrayEqualizerPreset[3]), "3"],
            ];
            equalizerPresetValues.forEach((item) =>
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdEqualizerPreset + " " + item[1]
                )
            );
            popupMenuExpander.menu.box.style_class =
                "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _getColorHEXValue(strSettingsColor) {
            let strcolor = this._settings.get_string(strSettingsColor);
            _logoutput(
                "_getColorHEXValue-strSettingsColor: " + strSettingsColor
            );
            _logoutput("_getColorHEXValue-strcolor: " + strcolor);
            let arrColor = strcolor
                .replace("rgb(", "")
                .replace(")", "")
                .split(",");
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

            if (!usecolors || strvalueBattery === "N/A") {
                this._menuButton.set_style(this._originalStyle);
                return false;
            }
            _logoutput("_changeColor: " + valueBattery_num);
            if (valueBattery_num >= 51) {
                this._menuButton.set_style("color: " + colorG + ";");
                _logoutput("_changeColor: " + colorG);
            } else if (valueBattery_num >= 26) {
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
        constructor(Me) {
            const { _settings } = Me;
            super();
            if (_settings.get_boolean("show-systemindicator")) {
                // Create the icon for the indicator
                this._indicator = this._addIndicator();
                this._indicator.icon_name = "audio-headset-symbolic";
            }

            // Create the toggle menu and associate it with the indicator, being
            // sure to destroy it along with the indicator
            this._HeadSetControlMenuToggle = new HeadsetControlMenuToggle(Me);
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

        // Helper function to construct commands
        const buildCommand = (executable, option) => `${executable} ${option}`;

        // Cache the executable path
        const cmdExecutable = this._settings.get_string(
            "headsetcontrol-executable"
        );

        // Define headset control commands using the helper function
        headsetcontrolCommands.cmdCapabilities = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-capabilities")
        );
        headsetcontrolCommands.cmdBattery = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-battery")
        );
        headsetcontrolCommands.cmdChatMix = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-chatmix")
        );
        headsetcontrolCommands.cmdSidetone = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-sidetone")
        );
        headsetcontrolCommands.cmdLED = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-led")
        );
        headsetcontrolCommands.cmdVoice = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-voice")
        );
        headsetcontrolCommands.cmdRotateMute = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-rotate-mute")
        );
        headsetcontrolCommands.cmdInacitetime = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-inactive-time")
        );
        headsetcontrolCommands.cmdOutputFormat = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-output-format")
        );
        headsetcontrolCommands.cmdEqualizer = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-equalizer")
        );
        headsetcontrolCommands.cmdEqualizerPreset = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-equalizer-preset")
        );
    }

    _getHeadSetControlValue(stroutput, valuetosearch) {
        let strValue = "N/A";

        if (stroutput.includes(valuetosearch)) {
            strValue = stroutput.split(":")[1].toString().trim();
            if (strValue.startsWith("Status")) {
                strValue = stroutput.split(":")[2].toString().trim();
                if (strValue.startsWith("BATTERY_AVAILABLE")) {
                    strValue = stroutput.split(":")[3].toString().trim();
                } else {
                    strValue = "N/A";
                }
            }
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
            console.error(err, "HeadsetControl");
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
        capabilities.equalizer = value;
        capabilities.equalizerpreset = value;
    }

    _processOutput(output, updateIndicator) {
        if (output) {
            this._JSONoutputSupported = true;
            _logoutput("device_count:" + " " + output.device_count);
            if (output.device_count > 0) {
                _logoutput(
                    "devices(0).status:" + " " + output.devices[0].status
                );
                // if we cannot get the capabilities, set all to true
                if (!output.devices[0].status.includes("success")) {
                    this._setAllCapabilities(true);
                    return false;
                }
                if (this._needCapabilitiesRefresh) {
                    capabilities.sidetone =
                        output.devices[0].capabilities.includes("CAP_SIDETONE");
                    _logoutput(
                        "capabilities.sidetone: " + capabilities.sidetone
                    );
                    capabilities.battery =
                        output.devices[0].capabilities.includes(
                            "CAP_BATTERY_STATUS"
                        );
                    _logoutput("capabilities.battery: " + capabilities.battery);
                    capabilities.led =
                        output.devices[0].capabilities.includes("CAP_LIGHTS");
                    _logoutput("capabilities.led: " + capabilities.led);
                    capabilities.inactivetime =
                        output.devices[0].capabilities.includes(
                            "CAP_INACTIVE_TIME"
                        );
                    _logoutput(
                        "capabilities.inactivetime: " +
                            capabilities.inactivetime
                    );
                    capabilities.chatmix =
                        output.devices[0].capabilities.includes(
                            "CAP_CHATMIX_STATUS"
                        );
                    _logoutput("capabilities.chatmix: " + capabilities.chatmix);
                    capabilities.voice =
                        output.devices[0].capabilities.includes(
                            "CAP_VOICE_PROMPTS"
                        );
                    _logoutput("capabilities.voice: " + capabilities.voice);
                    capabilities.rotatemute =
                        output.devices[0].capabilities.includes(
                            "CAP_ROTATE_TO_MUTE"
                        );
                    _logoutput(
                        "capabilities.rotatemute: " + capabilities.rotatemute
                    );
                    capabilities.equalizer =
                        output.devices[0].capabilities.includes(
                            "CAP_EQUALIZER"
                        );
                    _logoutput(
                        "capabilities.equalizer: " + capabilities.equalizer
                    );
                    capabilities.equalizerpreset =
                        output.devices[0].capabilities.includes(
                            "CAP_EQUALIZER_PRESET"
                        );
                    _logoutput(
                        "capabilities.equalizerpreset: " +
                            capabilities.equalizerpreset
                    );
                }
                this._needCapabilitiesRefresh = false;
            }
            let headsetname = output.devices[0].device;
            _logoutput(headsetname);
            if (updateIndicator) {
                this._HeadsetControlIndicator._HeadSetControlMenuToggle.updateHeadsetName(
                    headsetname
                );
                this._HeadsetControlIndicator._HeadSetControlMenuToggle.updateBatteryStatus(
                    output.devices[0].battery.status,
                    output.devices[0].battery.level + "%",
                    output.devices[0].battery.level
                );
                this._HeadsetControlIndicator._HeadSetControlMenuToggle.updateChatMixStatus(
                    output.devices[0].chatmix
                );
                this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuSetHeader();
                this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuTitle();
            }
        }
        return true;
    }

    async _refreshJSON_async() {
        try {
            const flags = Gio.SubprocessFlags.STDOUT_PIPE;
            const [, argv] = GLib.shell_parse_argv(
                headsetcontrolCommands.cmdOutputFormat
            );

            const proc = new Gio.Subprocess({ argv, flags });
            proc.init(null);

            const stdout = await new Promise((resolve, reject) => {
                // eslint-disable-next-line no-shadow
                proc.communicate_async(null, null, (proc, res) => {
                    try {
                        // eslint-disable-next-line no-shadow
                        const [, stdout] = proc.communicate_finish(res);
                        resolve(stdout);
                    } catch (err) {
                        _logoutput(`Error executing command: ${err.message}`);
                        reject(err);
                    }
                });
            });

            if (!stdout) {
                throw new Error("No output received from command");
            }

            const output = this._readJSONOutputFormat(stdout);

            if (!output) {
                throw new Error("Failed to parse JSON output");
            }

            this._processOutput(output, true);
            _logoutput("JSON refresh completed successfully");
        } catch (error) {
            console.error("HeadsetControl: _refreshJSON_async error:", error);
            _logoutput(`JSON refresh failed: ${error.message}`);
            this._JSONoutputSupported = false;
            // Fallback to non-JSON method
            this._refreshCapabilities();
            if (capabilities.battery) {
                this._refreshBatteryStatus();
            }
            if (capabilities.chatmix) {
                this._refreshChatMixStatus();
            }
        } finally {
            this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuSetHeader();
            this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuTitle();
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
            return;
        }
        if (strOutput.includes("* sidetone")) {
            capabilities.sidetone = true;
        }
        _logoutput("capabilities.sidetone: " + capabilities.sidetone);
        if (strOutput.includes("* battery")) {
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
        if (strOutput.includes("* equalizer")) {
            capabilities.equalizer = true;
        }
        _logoutput("capabilities.equalizer: " + capabilities.equalizer);
        if (strOutput.includes("* equalizer preset")) {
            capabilities.equalizerpreset = true;
        }
        _logoutput(
            "capabilities.equalizerpreset: " + capabilities.equalizerpreset
        );
        this._needCapabilitiesRefresh = false; // when headset was connected
    }

    _refreshBatteryStatus() {
        let strOutput = this._invokecmd(headsetcontrolCommands.cmdBattery);

        if (!strOutput) {
            return false;
        }
        let strBattery = this._getHeadSetControlValue(strOutput, "Battery");
        this._HeadsetControlIndicator._HeadSetControlMenuToggle.updateBatteryStatus(
            "N/A",
            strBattery,
            strBattery.replace("%", "")
        );
        return true;
    }

    _refreshChatMixStatus() {
        let strOutput = this._invokecmd(headsetcontrolCommands.cmdChatMix);

        if (!strOutput) {
            return false;
        }
        let strChatMix = this._getHeadSetControlValue(strOutput, "Chat"); //ChatMix or Chat-Mix
        this._HeadsetControlIndicator._HeadSetControlMenuToggle.updateChatMixStatus(
            strChatMix
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
        this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuSetHeader();
        this._HeadsetControlIndicator._HeadSetControlMenuToggle.setMenuTitle();
    }

    onParamChanged() {
        this.disable();
        this.enable();
    }

    onParamChangedMenu() {
        if (capabilities.sidetone) {
            this._HeadsetControlIndicator._HeadSetControlMenuToggle.refreshMenu(
                this
            );
        }
    }

    _openPreferences() {
        this.openPreferences();
        QuickSettingsMenu.menu.close(PopupAnimation.FADE);
    }

    enable() {
        this._settings = this.getSettings();
        this._initCmd();

        if (!this._refreshJSONall(false)) {
            this._refreshCapabilities();
        }

        this._HeadsetControlIndicator = new HeadsetControlIndicator(this);

        // add Signals to array
        this._SignalsArray = [];
        this._SignalsArray.push(
            QuickSettingsMenu.menu.connect(
                "open-state-changed",
                this._refresh.bind(this)
            )
        );
        const settingsToMonitor = [
            { key: "headsetcontrol-executable", callback: "_initCmd" },
            { key: "use-notifications", callback: "_initCmd" },
            { key: "use-logging", callback: "_initCmd" },
            { key: "show-systemindicator", callback: "onParamChanged" },
            { key: "sidetone-values", callback: "onParamChangedMenu" },
            {
                key: "option-equalizer-settings",
                callback: "onParamChangedMenu",
            },
            { key: "option-equalizer-preset", callback: "onParamChangedMenu" },
            { key: "use-colors", callback: "_initCmd" },
        ];

        settingsToMonitor.forEach((setting) => {
            this._SignalsArray.push(
                this._settings.connect(
                    `changed::${setting.key}`,
                    this[setting.callback].bind(this)
                )
            );
        });
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
