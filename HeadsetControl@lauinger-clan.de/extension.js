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
import St from "gi://St";
import Clutter from "gi://Clutter";

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

const rgbToHex = (r, g, b) =>
    "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

function invokeCmd(cmd) {
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
            this._useLogging = Me._useLogging;
            this._settings = _settings;
            this._valueBatteryStatus = "";
            this._valueBattery = "";
            this._valueBatteryNum = -1;
            this._valueChatMix = "";
            this._valueHeadsetname = _("HeadsetControl");
            //remember style
            this._originalStyle = this.get_style();
            this.menu.setHeader(
                "audio-headset-symbolic",
                _("HeadsetControl"),
                ""
            );
            this.setMenuHeader();
            this.setMenuTitle();

            let quicksettingstoggle = _settings.get_int("quicksettings-toggle");
            let quicksettingstogglekey;
            switch (quicksettingstoggle) {
                case 1:
                    quicksettingstogglekey = "use-notifications";
                    break;
                case 2:
                    quicksettingstogglekey = "use-logging";
                    break;
                case 3:
                    quicksettingstogglekey = "use-colors";
                    break;
                default:
                    quicksettingstogglekey = "show-systemindicator";
            }
            _settings.bind(
                quicksettingstogglekey,
                this,
                "checked",
                Gio.SettingsBindFlags.DEFAULT
            );

            this._buildMenu();
            this._addSettingsAction(Me);
        }

        updateUseLogging(value) {
            this._useLogging = value;
        }

        _logOutput(strText) {
            if (this._useLogging) {
                console.log(_("HeadsetControl") + " " + strText);
            }
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
                this._valueBatteryNum = lngBattery;
                this._valueBatteryStatus = strStatus;
                if (this._valueBatteryNum < 0) {
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

        get valueBatteryNum() {
            return this._valueBatteryNum;
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
                    subtitle: this._valueChatMix,
                });
            } else if (capabilities.battery) {
                this.set({
                    title: this._valueHeadsetname,
                    subtitle: this._valueBattery,
                });
            } else if (capabilities.chatmix) {
                this.set({
                    title: this._valueHeadsetname,
                    subtitle: this._valueChatMix,
                });
            }
        }

        setMenuHeader() {
            if (capabilities.battery && capabilities.chatmix) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueHeadsetname,
                    this._valueBattery + " " + this._valueChatMix
                );
                this._logOutput("setMenuHeader: Battery and Chatmix");
            } else if (capabilities.battery) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueHeadsetname,
                    this._valueBattery
                );
                this._logOutput("setMenuHeader: Battery");
            } else if (capabilities.chatmix) {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    this._valueHeadsetname,
                    this._valueChatMix
                );
                this._logOutput("setMenuHeader: Chatmix");
            } else {
                this.menu.setHeader(
                    "audio-headset-symbolic",
                    _("HeadsetControl"),
                    this._valueHeadsetname
                );
                this._logOutput("setMenuHeader: Headsetname");
            }
            this._changeColor(this._valueBattery, this._valueBatteryNum);
        }

        _invokeCmd(cmd) {
            this._logOutput("_invokeCmd: " + cmd);
            const retval = invokeCmd(cmd);
            this._logOutput("_invokeCmd retval: " + retval);
            return retval;
        }

        _addPopupMenuItem(popupMenuExpander, strLabel, strValue) {
            let submenu;
            submenu = new PopupMenu.PopupMenuItem(_(strLabel));
            submenu.connect("activate", this._invokeCmd.bind(this, strValue));
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
            const strcolor = this._settings.get_string(strSettingsColor);
            this._logOutput(
                "_getColorHEXValue-strSettingsColor: " + strSettingsColor
            );
            this._logOutput("_getColorHEXValue-strcolor: " + strcolor);
            const arrColor = strcolor
                .replace("rgb(", "")
                .replace(")", "")
                .split(",");
            const color = rgbToHex(
                parseInt(arrColor[0]),
                parseInt(arrColor[1]),
                parseInt(arrColor[2])
            );
            return color;
        }

        get menuButtonStyle() {
            return this._menuButton.get_style();
        }

        get valueBatteryStatus() {
            return this._valueBatteryStatus;
        }

        _changeColor(strvalueBattery, valueBattery_num) {
            let colorR = this._getColorHEXValue("color-batterylow");
            let colorY = this._getColorHEXValue("color-batterymedium");
            let colorG = this._getColorHEXValue("color-batteryhigh");

            if (
                !this._settings.get_boolean("use-colors") ||
                strvalueBattery === "N/A"
            ) {
                this._menuButton.set_style(this._originalStyle);
                return false;
            }
            this._logOutput("_changeColor: " + valueBattery_num);
            if (valueBattery_num >= 51) {
                this._menuButton.set_style("color: " + colorG + ";");
                this._logOutput("_changeColor: " + colorG);
            } else if (valueBattery_num >= 26) {
                this._menuButton.set_style("color: " + colorY + ";");
                this._logOutput("_changeColor: " + colorY);
            } else {
                this._menuButton.set_style("color: " + colorR + ";");
                this._logOutput("_changeColor: " + colorR);
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

            // Create the icon for the indicator
            this._indicator = this._addIndicator();
            this._indicatorLabel = new St.Label({
                text: "N/A",
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._indicatorLabel);
            this._indicator.icon_name = "audio-headset-symbolic";
            this._indicator.visible = _settings.get_boolean(
                "show-systemindicator"
            );
            this._indicatorLabel.visible = false;

            // Create the toggle menu and associate it with the indicator, being
            // sure to destroy it along with the indicator
            this._headsetControlMenuToggle = new HeadsetControlMenuToggle(Me);
            this.quickSettingsItems.push(this._headsetControlMenuToggle);

            this.connect("destroy", () => {
                this.quickSettingsItems.forEach((item) => item.destroy());
            });

            // Add the indicator to the panel and the toggle to the menu
            QuickSettingsMenu._indicators.insert_child_at_index(this, 0);
            QuickSettingsMenu.addExternalIndicator(this);
        }

        get headsetControlMenuToggle() {
            return this._headsetControlMenuToggle;
        }

        setIconVisible(visible) {
            this._indicator.visible = visible;
        }

        setLabelVisible(visible) {
            this._indicatorLabel.visible = visible;
        }

        updateLabel() {
            if (this._indicatorLabel) {
                this._indicatorLabel.set_style(
                    this._headsetControlMenuToggle.menuButtonStyle
                );
                const battery_num =
                    this._headsetControlMenuToggle.valueBatteryNum;
                if (battery_num < 0) {
                    this._indicatorLabel.set_text("N/A");
                    return;
                }
                // Add "+" if charging
                const isCharging =
                    this._headsetControlMenuToggle.valueBatteryStatus ===
                    "BATTERY_CHARGING";
                this._indicatorLabel.set_text(
                    `${isCharging ? "+" : ""}${battery_num}%`
                );
            }
        }

        updateUIElements() {
            this._headsetControlMenuToggle.setMenuHeader();
            this._headsetControlMenuToggle.setMenuTitle();
            this.updateLabel();
        }

        get valueBatteryNum() {
            return this._headsetControlMenuToggle.valueBatteryNum;
        }
    }
);

export default class HeadsetControl extends Extension {
    _needCapabilitiesRefresh = true;
    _JSONoutputSupported = true;
    _visible = false;

    _logOutput(strText) {
        if (this._useLogging) {
            console.log(_("HeadsetControl") + " " + strText);
        }
    }

    _invokeCmd(cmd) {
        this._logOutput("_invokeCmd: " + cmd);
        const retval = invokeCmd(cmd);
        this._logOutput("_invokeCmd return: " + retval);
        return retval;
    }

    _notify(strText) {
        if (this._useNotifications) {
            Main.notify(_("HeadsetControl"), strText);
        }
    }

    _initCmd() {
        this._useNotifications =
            this._settings.get_boolean("use-notifications");
        this._useLogging = this._settings.get_boolean("use-logging");
        this._headsetControlIndicator.headsetControlMenuToggle.updateUseLogging(
            this._useLogging
        );
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
        switch (valuetosearch) {
            case "Battery":
                if (
                    stroutput.includes("BATTERY_AVAILABLE") ||
                    stroutput.includes("BATTERY_CHARGING")
                ) {
                    strValue = stroutput.split(":").at(-1);
                }
                break;
            case "Chat":
                strValue = stroutput.split(":").at(-1);
                break;
        }
        return strValue.toString().trim();
    }

    _readJSONOutputFormat(strOutput) {
        if (!strOutput) {
            strOutput = this._invokeCmd(headsetcontrolCommands.cmdOutputFormat);
            this._logOutput("_readJSONOutputFormat: calling _invokeCmd");
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
            let device_count = output.device_count;
            this._logOutput("device_count:" + " " + device_count);
            if (this._devicecount !== device_count) {
                this._devicecount = device_count;
                this._logOutput("device_count changed: " + device_count);
                this._needCapabilitiesRefresh = true;
            }
            if (device_count > 0) {
                this._logOutput(
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
                    this._logOutput(
                        "capabilities.sidetone: " + capabilities.sidetone
                    );
                    capabilities.battery =
                        output.devices[0].capabilities.includes(
                            "CAP_BATTERY_STATUS"
                        );
                    if (this._showIndicator) {
                        this._headsetControlIndicator.setLabelVisible(
                            capabilities.battery
                        );
                    }
                    this._logOutput(
                        "capabilities.battery: " + capabilities.battery
                    );
                    capabilities.led =
                        output.devices[0].capabilities.includes("CAP_LIGHTS");
                    this._logOutput("capabilities.led: " + capabilities.led);
                    capabilities.inactivetime =
                        output.devices[0].capabilities.includes(
                            "CAP_INACTIVE_TIME"
                        );
                    this._logOutput(
                        "capabilities.inactivetime: " +
                            capabilities.inactivetime
                    );
                    capabilities.chatmix =
                        output.devices[0].capabilities.includes(
                            "CAP_CHATMIX_STATUS"
                        );
                    this._logOutput(
                        "capabilities.chatmix: " + capabilities.chatmix
                    );
                    capabilities.voice =
                        output.devices[0].capabilities.includes(
                            "CAP_VOICE_PROMPTS"
                        );
                    this._logOutput(
                        "capabilities.voice: " + capabilities.voice
                    );
                    capabilities.rotatemute =
                        output.devices[0].capabilities.includes(
                            "CAP_ROTATE_TO_MUTE"
                        );
                    this._logOutput(
                        "capabilities.rotatemute: " + capabilities.rotatemute
                    );
                    capabilities.equalizer =
                        output.devices[0].capabilities.includes(
                            "CAP_EQUALIZER"
                        );
                    this._logOutput(
                        "capabilities.equalizer: " + capabilities.equalizer
                    );
                    capabilities.equalizerpreset =
                        output.devices[0].capabilities.includes(
                            "CAP_EQUALIZER_PRESET"
                        );
                    this._logOutput(
                        "capabilities.equalizerpreset: " +
                            capabilities.equalizerpreset
                    );
                }

                let headsetname = output.devices[0].device;
                this._logOutput(headsetname);
                if (updateIndicator) {
                    if (this._needCapabilitiesRefresh) {
                        this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(
                            this
                        );
                    }
                    this._headsetControlIndicator.headsetControlMenuToggle.updateHeadsetName(
                        headsetname
                    );

                    this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
                        output.devices[0].battery.status,
                        output.devices[0].battery.level + "%",
                        output.devices[0].battery.level
                    );
                    this._headsetControlIndicator.headsetControlMenuToggle.updateChatMixStatus(
                        output.devices[0].chatmix
                    );
                    this._headsetControlIndicator.updateUIElements();
                }
                this._needCapabilitiesRefresh = false;
            }
            return true;
        } else {
            this._devicecount = 0;
            return false;
        }
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
                proc.communicate_async(null, null, (subprocess, res) => {
                    try {
                        const [, stdoutFinish] =
                            subprocess.communicate_finish(res);
                        resolve(stdoutFinish);
                    } catch (err) {
                        this._logOutput(
                            `Error executing command: ${err.message}`
                        );
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
            this._logOutput("JSON refresh completed successfully");
        } catch (error) {
            console.error("HeadsetControl: _refreshJSON_async error:", error);
            this._logOutput(`JSON refresh failed: ${error.message}`);
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
            this._headsetControlIndicator.updateUIElements();
            this._changeIndicatorVisibility();
        }
    }

    _refreshJSONall(updateIndicator) {
        this._JSONoutputSupported = false;
        let strOutput = this._readJSONOutputFormat("");
        return this._processOutput(strOutput, updateIndicator);
    }

    _refreshCapabilities() {
        let strOutput = this._invokeCmd(headsetcontrolCommands.cmdCapabilities);

        // if we cannot get the capabilities, set all to true
        if (!strOutput || strOutput.includes("No supported headset found")) {
            this._setAllCapabilities(true);
            return;
        }
        if (strOutput.includes("* sidetone")) {
            capabilities.sidetone = true;
        }
        this._logOutput("capabilities.sidetone: " + capabilities.sidetone);
        if (strOutput.includes("* battery")) {
            capabilities.battery = true;
            if (this._showIndicator) {
                this._headsetControlIndicator.setLabelVisible(
                    capabilities.battery
                );
            }
        }
        this._logOutput("capabilities.battery: " + capabilities.battery);
        if (strOutput.includes("* lights")) {
            capabilities.led = true;
        }
        this._logOutput("capabilities.led: " + capabilities.led);
        if (strOutput.includes("* inactive time")) {
            capabilities.inactivetime = true;
        }
        this._logOutput(
            "capabilities.inactivetime: " + capabilities.inactivetime
        );
        if (strOutput.includes("* chatmix")) {
            capabilities.chatmix = true;
        }
        this._logOutput("capabilities.chatmix: " + capabilities.chatmix);
        if (strOutput.includes("* voice prompts")) {
            capabilities.voice = true;
        }
        this._logOutput("capabilities.voice: " + capabilities.voice);
        if (strOutput.includes("* rotate to mute")) {
            capabilities.rotatemute = true;
        }
        this._logOutput("capabilities.rotatemute: " + capabilities.rotatemute);
        if (strOutput.includes("* equalizer")) {
            capabilities.equalizer = true;
        }
        this._logOutput("capabilities.equalizer: " + capabilities.equalizer);
        if (strOutput.includes("* equalizer preset")) {
            capabilities.equalizerpreset = true;
        }
        this._logOutput(
            "capabilities.equalizerpreset: " + capabilities.equalizerpreset
        );
        this._needCapabilitiesRefresh = false; // when headset was connected
    }

    _refreshBatteryStatus() {
        let strOutput = this._invokeCmd(headsetcontrolCommands.cmdBattery);

        if (!strOutput) {
            return false;
        }
        let strBattery = this._getHeadSetControlValue(strOutput, "Battery");
        this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
            "N/A",
            strBattery,
            strBattery.replace("%", "")
        );
        return true;
    }

    _refreshChatMixStatus() {
        let strOutput = this._invokeCmd(headsetcontrolCommands.cmdChatMix);

        if (!strOutput) {
            return false;
        }
        let strChatMix = this._getHeadSetControlValue(strOutput, "Chat"); //ChatMix or Chat-Mix
        this._headsetControlIndicator.headsetControlMenuToggle.updateChatMixStatus(
            strChatMix
        );
        return true;
    }

    _changeIndicatorVisibility() {
        if (!this._showIndicator) {
            this._logOutput(
                "_changeIndicatorVisibility - showIndicator is false - hide indicator"
            );
            this._headsetControlIndicator.setIconVisible(false);
            this._headsetControlIndicator.setLabelVisible(false);
            return;
        }
        if (
            this._hideWhenDisconnectedSystemindicator &&
            (this._devicecount === 0 ||
                this._headsetControlIndicator.valueBatteryNum < 0)
        ) {
            this._logOutput(
                "_changeIndicatorVisibility - headset not connected - hide indicator"
            );
            this._headsetControlIndicator.setIconVisible(false);
            this._headsetControlIndicator.setLabelVisible(false);
        } else {
            this._logOutput(
                "_changeIndicatorVisibility - headset connected - show indicator"
            );
            this._headsetControlIndicator.setIconVisible(this._showIndicator);
            this._headsetControlIndicator.setLabelVisible(
                capabilities.battery && this._showIndicator
            );
        }
    }

    _refreshIndicator() {
        this._notify("_refreshIndicator - " + _("Refreshing..."));
        this._logOutput("_refreshIndicator - " + _("Refreshing..."));
        if (this._JSONoutputSupported) {
            this._refreshJSON_async();
            return;
        }
        if (capabilities.battery) {
            this._refreshBatteryStatus();
            this._headsetControlIndicator.updateUIElements();
            this._changeIndicatorVisibility();
        }
    }

    _refresh() {
        if (this._refreshIndicatorRunning) {
            this._logOutput(
                _("Quicksettings open - refresh indicator running...")
            );
            return;
        }
        this._visible = !this._visible;
        if (!this._visible) {
            this._logOutput(_("Quicksettings not open - do nothing..."));
            return;
        }
        this._notify(_("Refreshing..."));
        this._logOutput(_("Refreshing..."));

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
        this._headsetControlIndicator.updateUIElements();
        this._changeIndicatorVisibility();
    }

    _onParamChanged() {
        this.disable();
        this.enable();
    }

    _onParamChangedMenu() {
        if (capabilities.sidetone) {
            this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(
                this
            );
        }
    }

    _onParamChangedIndicator() {
        this._showIndicator = this._settings.get_boolean(
            "show-systemindicator"
        );
        this._hideWhenDisconnectedSystemindicator = this._settings.get_boolean(
            "hidewhendisconnected-systemindicator"
        );
        this._refreshIntervalSystemindicator = this._settings.get_int(
            "refreshinterval-systemindicator"
        );
        this._headsetControlIndicator.updateLabel();
        this._refreshIntervalHandler();
        if (!this._showIndicator) {
            this._changeIndicatorVisibility();
        }
    }

    _onParamChangedColors() {
        this._useColors = this._settings.get_boolean("use-colors");
        if (!this._refreshIndicatorRunning) this._refreshIndicator();
    }

    _calculateRefreshInterval(refreshIntervalmin) {
        let refreshIntervalms = refreshIntervalmin * 60 * 1000; // Convert minutes to milliseconds
        this._logOutput("_CalculateRefreshInterval: " + refreshIntervalms);
        return refreshIntervalms;
    }

    _refreshIntervalHandler() {
        if (this._refreshIntervalSignal !== null) {
            GLib.Source.remove(this._refreshIntervalSignal);
            this._refreshIntervalSignal = null;
        }

        if (this._showIndicator && this._refreshIntervalSystemindicator > 0) {
            this._refreshIndicatorRunning = true;
            this._refreshIndicator();
            this._refreshIndicatorRunning = false;
            this._refreshIntervalSignal = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._calculateRefreshInterval(
                    this._refreshIntervalSystemindicator
                ),
                this._refreshIntervalHandler.bind(this)
            );
            return GLib.SOURCE_CONTINUE;
        } else {
            return GLib.SOURCE_REMOVE;
        }
    }

    _openPreferences() {
        this.openPreferences();
        QuickSettingsMenu.menu.close(PopupAnimation.FADE);
    }

    enable() {
        this._devicecount = 0;
        this._visible = false;
        this._refreshIndicatorRunning = false;
        this._settings = this.getSettings();

        this._useLogging = this._settings.get_boolean("use-logging");
        this._headsetControlIndicator = new HeadsetControlIndicator(this);
        this._initCmd();
        this._useColors = this._settings.get_boolean("use-colors");
        this._showIndicator = this._settings.get_boolean(
            "show-systemindicator"
        );
        this._hideWhenDisconnectedSystemindicator = this._settings.get_boolean(
            "hidewhendisconnected-systemindicator"
        );
        this._refreshIntervalSystemindicator = this._settings.get_int(
            "refreshinterval-systemindicator"
        );
        if (!this._refreshJSONall(this._showIndicator)) {
            this._refreshCapabilities();
        }
        this._refreshIntervalSignal = null;
        this._refreshIntervalHandler();
        this._changeIndicatorVisibility();
        // add Signals to array
        this._settingSignals = [];
        const settingsToMonitor = [
            {
                key: "headsetcontrol-executable",
                callback: this._initCmd.bind(this),
            },
            { key: "use-notifications", callback: this._initCmd.bind(this) },
            { key: "use-logging", callback: this._initCmd.bind(this) },
            {
                key: "show-systemindicator",
                callback: this._onParamChangedIndicator.bind(this),
            },
            {
                key: "hidewhendisconnected-systemindicator",
                callback: this._onParamChangedIndicator.bind(this),
            },
            {
                key: "refreshinterval-systemindicator",
                callback: this._onParamChangedIndicator.bind(this),
            },
            {
                key: "sidetone-values",
                callback: this._onParamChangedMenu.bind(this),
            },
            {
                key: "option-equalizer-settings",
                callback: this._onParamChangedMenu.bind(this),
            },
            {
                key: "option-equalizer-preset",
                callback: this._onParamChangedMenu.bind(this),
            },
            {
                key: "use-colors",
                callback: this._onParamChangedColors.bind(this),
            },
            {
                key: "quicksettings-toggle",
                callback: this._onParamChanged.bind(this),
            },
        ];
        settingsToMonitor.forEach((setting) => {
            this._settingSignals.push(
                this._settings.connect(
                    `changed::${setting.key}`,
                    setting.callback
                )
            );
        });
        this._quicksettingSignal = QuickSettingsMenu.menu.connect(
            "open-state-changed",
            this._refresh.bind(this)
        );
    }

    disable() {
        if (this._refreshIntervalSignal !== null)
            GLib.Source.remove(this._refreshIntervalSignal);
        this._refreshIntervalSignal = null;
        if (this._quicksettingSignal !== null) {
            QuickSettingsMenu.menu.disconnect(this._quicksettingSignal);
        }
        this._quicksettingSignal = null;
        // remove setting Signals
        this._settingSignals.forEach(function (signal) {
            this._settings.disconnect(signal);
        }, this);
        this._settingSignals = null;
        this._settings = null;
        this._headsetControlIndicator.destroy();
        this._headsetControlIndicator = null;
        this._visible = null;
        this._devicecount = null;
        this._showIndicator = null;
        this._hideWhenDisconnectedSystemindicator = null;
        this._refreshIndicatorRunning = null;
        this._refreshIntervalSystemindicator = null;
        this._useNotifications = null;
        this._useLogging = null;
        this._useColors = null;
    }
}
