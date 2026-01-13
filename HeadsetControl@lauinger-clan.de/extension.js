"use strict";

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
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

async function invokeCmd(cmd, logger) {
    const flags = Gio.SubprocessFlags.STDOUT_PIPE;
    const [, argv] = GLib.shell_parse_argv(cmd);
    const proc = new Gio.Subprocess({ argv, flags });
    proc.init(null);
    try {
        const stdout = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, null, (subprocess, res) => {
                try {
                    const [, stdoutFinish] = subprocess.communicate_utf8_finish(res);
                    resolve(stdoutFinish);
                } catch (err) {
                    logger.error(`Error executing command: ${err.message}`);
                    reject(err);
                }
            });
        });
        if (cmd.includes("-o json")) {
            return stdout.trim();
        } else {
            const strOutput = stdout.replace("\n", "###").replace("Success!", "###");
            return strOutput.split("###")[1];
        }
    } catch (err) {
        // could not execute the command
        logger.error(err);
        return "N/A";
    }
}

const HeadsetControlMenuToggle = GObject.registerClass(
    class HeadsetControlMenuToggle extends QuickSettings.QuickMenuToggle {
        constructor(extension) {
            const { _settings } = extension;
            super({
                title: _("HeadsetControl"),
                iconName: "audio-headset-symbolic",
                toggleMode: true,
            });
            this._logger = extension.getLogger();
            this._useLogging = extension._useLogging;
            this._settings = _settings;
            this._valueBatteryStatus = "";
            this._valueBattery = "";
            this._valueBatteryNum = -1;
            this._valueChatMix = "";
            this._valueHeadsetname = _("HeadsetControl");
            //remember style
            this._originalStyle = this.get_style();
            this.menu.setHeader("audio-headset-symbolic", _("HeadsetControl"), "");
            this.setMenuHeader();
            this.setMenuTitle();

            const quicksettingstoggle = this._settings.get_int("quicksettings-toggle");
            let quicksettingstogglekey;
            switch (quicksettingstoggle) {
                case 1:
                    quicksettingstogglekey = "notification-low-battery";
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
            this._settings.bind(quicksettingstogglekey, this, "checked", Gio.SettingsBindFlags.DEFAULT);

            this._buildMenu();
            this._addSettingsAction(extension);
        }

        updateUseLogging(value) {
            this._useLogging = value;
        }

        _logOutput(strText) {
            if (this._useLogging) {
                this._logger.log(strText);
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

            for (const item of menuItems) {
                if (capabilities[item.capability]) {
                    const popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(item.label);
                    item.method.call(this, popupMenuExpander);
                    this.menu.addMenuItem(popupMenuExpander);
                }
            }
        }

        refreshMenu(extension) {
            this.menu.removeAll();
            this._buildMenu();
            this._addSettingsAction(extension);
        }

        _addSettingsAction(extension) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const settingsItem = this.menu.addAction(_("Settings"), () => {
                extension.openPreferences();
                QuickSettingsMenu.menu.close(PopupAnimation.FADE);
            });
            settingsItem.visible = Main.sessionMode.allowSettings;
            this.menu._settingsActions[extension.uuid] = settingsItem;
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
                this.menu.setHeader("audio-headset-symbolic", this._valueHeadsetname, this._valueBattery);
                this._logOutput("setMenuHeader: Battery");
            } else if (capabilities.chatmix) {
                this.menu.setHeader("audio-headset-symbolic", this._valueHeadsetname, this._valueChatMix);
                this._logOutput("setMenuHeader: Chatmix");
            } else {
                this.menu.setHeader("audio-headset-symbolic", _("HeadsetControl"), this._valueHeadsetname);
                this._logOutput("setMenuHeader: Headsetname");
            }
            this._changeColor(this._valueBattery, this._valueBatteryNum);
        }

        async _invokeCmd(cmd) {
            this._logOutput("_invokeCmd: " + cmd);
            const retval = await invokeCmd(cmd, this._logger);
            this._logOutput("_invokeCmd retval: " + retval);
            return retval;
        }

        _addPopupMenuItem(popupMenuExpander, strLabel, strValue) {
            const submenu = new PopupMenu.PopupMenuItem(_(strLabel));
            submenu.connect("activate", this._invokeCmd.bind(this, strValue));
            popupMenuExpander.menu.addMenuItem(submenu);
        }

        _addSidetoneMenu(popupMenuExpander) {
            const arraySidetone = this._settings.get_strv("sidetone-values");
            const sidetoneValues = [
                [_("Off"), arraySidetone[0]],
                [_("Low"), arraySidetone[1]],
                [_("Medium"), arraySidetone[2]],
                [_("High"), arraySidetone[3]],
                [_("Maximum"), arraySidetone[4]],
            ].filter(([, value]) => value !== "-1");
            for (const item of sidetoneValues) {
                this._addPopupMenuItem(popupMenuExpander, item[0], headsetcontrolCommands.cmdSidetone + " " + item[1]);
            }
            this.menu.addMenuItem(popupMenuExpander);
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
        }

        _addLEDMenu(popupMenuExpander) {
            const LEDvalues = [
                [_("Off"), "0"],
                [_("On"), "1"],
            ];
            for (const item of LEDvalues) {
                this._addPopupMenuItem(popupMenuExpander, item[0], headsetcontrolCommands.cmdLED + " " + item[1]);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addVoiceMenu(popupMenuExpander) {
            const voiceValues = [
                [_("Off"), "0"],
                [_("On"), "1"],
            ];
            for (const item of voiceValues) {
                this._addPopupMenuItem(popupMenuExpander, item[0], headsetcontrolCommands.cmdVoice + " " + item[1]);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addRotateMuteMenu(popupMenuExpander) {
            const rotateMuteValues = [
                [_("Off"), "0"],
                [_("On"), "1"],
            ];
            for (const item of rotateMuteValues) {
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdRotateMute + " " + item[1]
                );
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
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
            for (const item of inacitetimeValues) {
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdInacitetime + " " + item[1]
                );
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addEqualizerSettingMenu(popupMenuExpander) {
            const arrayEqualizerSetting = this._settings.get_strv("option-equalizer-settings");

            const equalizerSettingValues = [
                [_("Setting 1"), arrayEqualizerSetting[0]],
                [_("Setting 2"), arrayEqualizerSetting[1]],
                [_("Setting 3"), arrayEqualizerSetting[2]],
                [_("Setting 4"), arrayEqualizerSetting[3]],
            ];
            for (const item of equalizerSettingValues) {
                if (item[1].includes(":")) {
                    let itemarray = [];
                    itemarray = item[1].split(":");
                    item[0] = itemarray[0];
                    item[1] = itemarray[1];
                }
                this._addPopupMenuItem(popupMenuExpander, item[0], headsetcontrolCommands.cmdEqualizer + " " + item[1]);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        _addEqualizerPresetMenu(popupMenuExpander) {
            const arrayEqualizerPreset = this._settings.get_strv("equalizer-preset-names");
            for (let index = 0; index < arrayEqualizerPreset.length; index++) {
                const item = arrayEqualizerPreset[index];
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item,
                    headsetcontrolCommands.cmdEqualizerPreset + " " + index.toString()
                );
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
            this.menu.addMenuItem(popupMenuExpander);
        }

        get menuButtonStyle() {
            return this._menuButton.get_style();
        }

        get valueBatteryStatus() {
            return this._valueBatteryStatus;
        }

        _changeColor(strvalueBattery, valueBattery_num) {
            const colorR = this._settings.get_string("color-batterylow");
            const colorY = this._settings.get_string("color-batterymedium");
            const colorG = this._settings.get_string("color-batteryhigh");

            if (!this._settings.get_boolean("use-colors") || strvalueBattery === "N/A") {
                this._menuButton.set_style(this._originalStyle);
                return false;
            }
            this._logOutput("_changeColor valueBattery_num: " + valueBattery_num);
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
        constructor(extension) {
            const { _settings } = extension;
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
            this._indicator.visible = _settings.get_boolean("show-systemindicator");
            this._indicatorLabel.visible = false;

            // Create the toggle menu and associate it with the indicator, being
            // sure to destroy it along with the indicator
            this._headsetControlMenuToggle = new HeadsetControlMenuToggle(extension);
            this.quickSettingsItems.push(this._headsetControlMenuToggle);

            this.connect("destroy", () => {
                for (const item of this.quickSettingsItems) {
                    item.destroy();
                }
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
                this._indicatorLabel.set_style(this._headsetControlMenuToggle.menuButtonStyle);
                const battery_num = this._headsetControlMenuToggle.valueBatteryNum;
                if (battery_num < 0) {
                    this._indicatorLabel.set_text("N/A");
                    return;
                }
                // Add "+" if charging
                const isCharging = this._headsetControlMenuToggle.valueBatteryStatus === "BATTERY_CHARGING";
                this._indicatorLabel.set_text(`${isCharging ? "+" : ""}${battery_num}%`);
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
            this.getLogger().log(strText);
        }
    }

    async _invokeCmd(cmd) {
        this._logOutput("_invokeCmd: " + cmd);
        const retval = await invokeCmd(cmd, this.getLogger());
        this._logOutput("_invokeCmd retval: " + retval);
        return retval;
    }

    _initCmd() {
        // Helper function to construct commands
        const buildCommand = (executable, option) => `${executable} ${option}`;

        // Cache the executable path
        const cmdExecutable = this._settings.get_string("headsetcontrol-executable");

        // Define headset control commands using the helper function
        headsetcontrolCommands.cmdCapabilities = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-capabilities")
        );
        headsetcontrolCommands.cmdBattery = buildCommand(cmdExecutable, this._settings.get_string("option-battery"));
        headsetcontrolCommands.cmdChatMix = buildCommand(cmdExecutable, this._settings.get_string("option-chatmix"));
        headsetcontrolCommands.cmdSidetone = buildCommand(cmdExecutable, this._settings.get_string("option-sidetone"));
        headsetcontrolCommands.cmdLED = buildCommand(cmdExecutable, this._settings.get_string("option-led"));
        headsetcontrolCommands.cmdVoice = buildCommand(cmdExecutable, this._settings.get_string("option-voice"));
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
        if (!this._JSONoutputSupported) {
            this._updateBinaryCapabilities();
        }
    }

    _getHeadSetControlValue(stroutput, valuetosearch) {
        let strValue = "N/A";
        switch (valuetosearch) {
            case "Battery":
                if (stroutput.includes("BATTERY_AVAILABLE") || stroutput.includes("BATTERY_CHARGING")) {
                    strValue = stroutput.split(":").at(-1);
                }
                break;
            case "Chat":
                strValue = stroutput.split(":").at(-1);
                break;
        }
        return strValue.toString().trim();
    }

    async _readJSONOutputFormat(strOutput) {
        if (!strOutput) {
            strOutput = await this._invokeCmd(headsetcontrolCommands.cmdOutputFormat);
            this._logOutput("_readJSONOutputFormat: calling _invokeCmd");
        }
        try {
            return JSON.parse(strOutput);
        } catch (err) {
            // could not parse JSON
            this.getLogger().error(err);
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

    _refreshCapabilitiesJSON(device) {
        capabilities.sidetone = device.capabilities.includes("CAP_SIDETONE");
        capabilities.battery = device.capabilities.includes("CAP_BATTERY_STATUS");
        if (this._showIndicator) {
            this._headsetControlIndicator.setLabelVisible(capabilities.battery);
        }
        capabilities.led = device.capabilities.includes("CAP_LIGHTS");
        capabilities.inactivetime = device.capabilities.includes("CAP_INACTIVE_TIME");
        capabilities.chatmix = device.capabilities.includes("CAP_CHATMIX_STATUS");
        capabilities.voice = device.capabilities.includes("CAP_VOICE_PROMPTS");
        capabilities.rotatemute = device.capabilities.includes("CAP_ROTATE_TO_MUTE");
        capabilities.equalizer = device.capabilities.includes("CAP_EQUALIZER");
        capabilities.equalizerpreset = device.capabilities.includes("CAP_EQUALIZER_PRESET");
        for (const cap in capabilities) {
            this._logOutput(`${cap}: ${capabilities[cap]}`);
        }
    }

    _isDeviceStatusSuccess(device) {
        this._logOutput("device.status:" + " " + device.status);
        return (
            typeof device.status === "string" &&
            (device.status.includes("success") || device.status.includes("partial"))
        );
    }

    _hasEqualizerPresetSupport(device) {
        if ("equalizer_presets_count" in device) {
            this._logOutput("equalizer_presets_count: " + device.equalizer_presets_count);
            if (device.equalizer_presets_count > 0) {
                if (Object.hasOwn(device, "equalizer_presets")) {
                    // Get preset names from the keys of the equalizer_presets object
                    const presetNames = Object.keys(device.equalizer_presets);
                    this._logOutput("equalizer preset names: " + presetNames.join(", "));
                    this._settings.set_strv("equalizer-preset-names", presetNames);
                }
            }
        }
    }

    _processOutput(output, updateIndicator) {
        if (!output) {
            this._devicecount = 0;
            return false;
        }
        this._JSONoutputSupported = true;
        const device_count = output.device_count;
        this._logOutput("device_count:" + " " + device_count);
        if (this._devicecount !== device_count) {
            this._devicecount = device_count;
            this._logOutput("device_count changed: " + device_count);
            this._needCapabilitiesRefresh = true;
        }
        if (device_count > 0) {
            if (!this._isDeviceStatusSuccess(output.devices[0])) {
                this._setAllCapabilities(true); // if we cannot get the capabilities, set all to true
                return false;
            }
            if (this._needCapabilitiesRefresh) {
                this._refreshCapabilitiesJSON(output.devices[0]);
            }
            const headsetname = output.devices[0].device;
            this._logOutput(headsetname);
            this._hasEqualizerPresetSupport(output.devices[0]);
            if (updateIndicator) {
                if (this._needCapabilitiesRefresh) {
                    this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
                }
                this._headsetControlIndicator.headsetControlMenuToggle.updateHeadsetName(headsetname);
                this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
                    output.devices[0].battery.status,
                    output.devices[0].battery.level + "%",
                    output.devices[0].battery.level
                );
                this._headsetControlIndicator.headsetControlMenuToggle.updateChatMixStatus(output.devices[0].chatmix);
                this._headsetControlIndicator.updateUIElements();
            }
            this._needCapabilitiesRefresh = false;
        }
        return true;
    }

    async _refreshJSON() {
        try {
            const stdout = await this._invokeCmd(headsetcontrolCommands.cmdOutputFormat);
            if (!stdout || stdout === "N/A") {
                throw new Error("No output received from command");
            }
            const output = await this._readJSONOutputFormat(stdout);
            if (!output) {
                throw new Error("Failed to parse JSON output");
            }
            this._processOutput(output, true);
            this._logOutput("JSON refresh completed successfully");
        } catch (error) {
            this.getLogger().error("_refreshJSON error:", error);
            this._logOutput(`JSON refresh failed: ${error.message}`);
            this._JSONoutputSupported = false;
            // Fallback to non-JSON method
            await this._refreshCapabilities();
            if (capabilities.battery) {
                await this._refreshBatteryStatus();
            }
            if (capabilities.chatmix) {
                await this._refreshChatMixStatus();
            }
        } finally {
            this._headsetControlIndicator.updateUIElements();
            this._changeIndicatorVisibility();
            this._notifyLowBattery(
                this._headsetControlIndicator.headsetControlMenuToggle.valueBatteryStatus,
                this._headsetControlIndicator.valueBatteryNum
            );
        }
    }

    async _refreshJSONupdate(updateIndicator) {
        this._JSONoutputSupported = false;
        const strOutput = await this._readJSONOutputFormat("");
        return this._processOutput(strOutput, updateIndicator);
    }

    async _refreshCapabilities() {
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdCapabilities);

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
                this._headsetControlIndicator.setLabelVisible(capabilities.battery);
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
        this._logOutput("capabilities.inactivetime: " + capabilities.inactivetime);
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
        this._logOutput("capabilities.equalizerpreset: " + capabilities.equalizerpreset);
        this._needCapabilitiesRefresh = false; // when headset was connected
    }

    async _refreshBatteryStatus() {
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdBattery);

        if (!strOutput) {
            return false;
        }
        const strBattery = this._getHeadSetControlValue(strOutput, "Battery");
        this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
            "N/A",
            strBattery,
            strBattery.replace("%", "")
        );
        return true;
    }

    async _refreshChatMixStatus() {
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdChatMix);

        if (!strOutput) {
            return false;
        }
        const strChatMix = this._getHeadSetControlValue(strOutput, "Chat"); //ChatMix or Chat-Mix
        this._headsetControlIndicator.headsetControlMenuToggle.updateChatMixStatus(strChatMix);
        return true;
    }

    _changeIndicatorVisibility() {
        if (!this._showIndicator) {
            this._logOutput("_changeIndicatorVisibility - showIndicator is false - hide indicator");
            this._headsetControlIndicator.setIconVisible(false);
            this._headsetControlIndicator.setLabelVisible(false);
            return;
        }
        if (
            this._hideWhenDisconnectedSystemindicator &&
            (this._devicecount === 0 || this._headsetControlIndicator.valueBatteryNum < 0)
        ) {
            this._logOutput("_changeIndicatorVisibility - headset not connected - hide indicator");
            this._headsetControlIndicator.setIconVisible(false);
            this._headsetControlIndicator.setLabelVisible(false);
        } else {
            this._logOutput("_changeIndicatorVisibility - headset connected - show indicator");
            this._headsetControlIndicator.setIconVisible(this._showIndicator);
            this._headsetControlIndicator.setLabelVisible(capabilities.battery && this._showIndicator);
        }
    }

    async _refreshIndicator() {
        this._logOutput("_refreshIndicator - " + _("Refreshing..."));
        if (this._JSONoutputSupported) {
            await this._refreshJSON();
            return;
        }
        if (capabilities.battery) {
            await this._refreshBatteryStatus();
            this._headsetControlIndicator.updateUIElements();
            this._changeIndicatorVisibility();
            this._notifyLowBattery(
                this._headsetControlIndicator.headsetControlMenuToggle.valueBatteryStatus,
                this._headsetControlIndicator.valueBatteryNum
            );
        }
    }

    async _refresh() {
        if (this._refreshIndicatorRunning) {
            this._logOutput(_("Quicksettings open - refresh indicator running..."));
            return;
        }
        this._visible = !this._visible;
        if (!this._visible) {
            this._logOutput(_("Quicksettings not open - do nothing..."));
            return;
        }
        this._logOutput(_("Refreshing..."));

        if (this._JSONoutputSupported) {
            await this._refreshJSON();
            return;
        }
        if (this._needCapabilitiesRefresh) {
            await this._refreshCapabilities();
        }
        if (capabilities.battery) {
            await this._refreshBatteryStatus();
        }
        if (capabilities.chatmix) {
            await this._refreshChatMixStatus();
        }
        this._headsetControlIndicator.updateUIElements();
        this._changeIndicatorVisibility();
        this._notifyLowBattery(
            this._headsetControlIndicator.headsetControlMenuToggle.valueBatteryStatus,
            this._headsetControlIndicator.valueBatteryNum
        );
    }

    _onParamChanged() {
        this.disable();
        this.enable();
    }

    _onParamChangedLogNot() {
        this._notificationLowBattery = this._settings.get_boolean("notification-low-battery");
        this._useLogging = this._settings.get_boolean("use-logging");
        this._headsetControlIndicator.headsetControlMenuToggle.updateUseLogging(this._useLogging);
    }

    _onParamChangedMenu() {
        if (capabilities.sidetone) {
            this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
        }
    }

    _onParamChangedIndicator() {
        this._showIndicator = this._settings.get_boolean("show-systemindicator");
        this._hideWhenDisconnectedSystemindicator = this._settings.get_boolean("hidewhendisconnected-systemindicator");
        this._refreshIntervalSystemindicator = this._settings.get_int("refreshinterval-systemindicator");
        this._headsetControlIndicator.updateLabel();
        this._refreshIntervalHandler(true);
        if (!this._showIndicator) {
            this._changeIndicatorVisibility();
        }
    }

    _onParamChangedColors() {
        this._useColors = this._settings.get_boolean("use-colors");
        if (!this._refreshIndicatorRunning) {
            (async () => {
                await this._refreshIndicator();
            })();
        }
    }

    _calculateRefreshInterval(refreshIntervalmin) {
        const refreshIntervalms = refreshIntervalmin * 60 * 1000; // Convert minutes to milliseconds
        this._logOutput("_CalculateRefreshInterval: " + refreshIntervalms);
        return refreshIntervalms;
    }

    _refreshIntervalHandler(doRefreshIndicator) {
        if (this._refreshIntervalSignal !== null) {
            GLib.Source.remove(this._refreshIntervalSignal);
            this._refreshIntervalSignal = null;
        }

        if (this._showIndicator && this._refreshIntervalSystemindicator > 0) {
            this._refreshIndicatorRunning = true;
            if (doRefreshIndicator) {
                (async () => {
                    await this._refreshIndicator();
                })();
            }
            this._refreshIndicatorRunning = false;
            this._refreshIntervalSignal = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._calculateRefreshInterval(this._refreshIntervalSystemindicator),
                this._refreshIntervalHandler.bind(this, true)
            );
            return GLib.SOURCE_CONTINUE;
        } else {
            return GLib.SOURCE_REMOVE;
        }
    }

    async _updateBinaryCapabilities() {
        this._logOutput("_updateBinaryCapabilities - calling _refreshJSONupdate");
        const ret = await this._refreshJSONupdate(this._showIndicator);
        if (!ret) {
            await this._refreshCapabilities();
        }
        await this._refreshIndicator();
    }

    _addNotification() {
        const source = MessageTray.getSystemSource();
        const notification = new MessageTray.Notification({
            source,
            title: _("HeadsetControl"),
            body: _("Battery low! Please charge your headset."),
            isTransient: false,
        });
        notification.iconName = "audio-headset-symbolic";
        notification.urgency = MessageTray.Urgency.HIGH;
        notification.headset_warning_id = "battery_low";
        source.addNotification(notification);
    }

    _removeNotification() {
        const source = MessageTray.getSystemSource();
        const targets = source.notifications.filter(
            (notification) => notification.headset_warning_id === "battery_low"
        );
        targets.forEach((notification) => notification.destroy());
    }

    _notifyLowBattery(strStatus, valueBatteryNum) {
        if (!this._notificationLowBattery) {
            return;
        }
        this._logOutput("_notifyLowBattery - strStatus: " + strStatus + " valueBatteryNum: " + valueBatteryNum);
        const threshold = 25;
        if (strStatus === "BATTERY_AVAILABLE" && valueBatteryNum <= threshold) {
            if (!this._batteryLowNotified) {
                this._batteryLowNotified = true;
                this._addNotification();
            }
        } else if (strStatus === "BATTERY_CHARGING" || valueBatteryNum > threshold) {
            this._batteryLowNotified = false;
            this._removeNotification();
        }
    }

    enable() {
        this._devicecount = 0;
        this._visible = false;
        this._refreshIndicatorRunning = false;
        this._batteryLowNotified = false;
        this._settings = this.getSettings();

        this._headsetControlIndicator = new HeadsetControlIndicator(this);
        this._initCmd();
        this._notificationLowBattery = this._settings.get_boolean("notification-low-battery");
        this._useLogging = this._settings.get_boolean("use-logging");
        this._useColors = this._settings.get_boolean("use-colors");
        this._showIndicator = this._settings.get_boolean("show-systemindicator");
        this._hideWhenDisconnectedSystemindicator = this._settings.get_boolean("hidewhendisconnected-systemindicator");
        this._refreshIntervalSystemindicator = this._settings.get_int("refreshinterval-systemindicator");
        this._updateBinaryCapabilities();
        this._refreshIntervalSignal = null;
        this._refreshIntervalHandler(false);
        this._changeIndicatorVisibility();
        // add Signals to array
        this._settingSignals = [];
        const settingsToMonitor = [
            {
                key: "headsetcontrol-executable",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-capabilities",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-battery",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-chatmix",
                callback: this._initCmd.bind(this),
            },
            { key: "option-sidetone", callback: this._initCmd.bind(this) },
            {
                key: "option-led",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-inactive-time",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-voice",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-rotatemute",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-output-format",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-equalizer",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-equalizerpreset",
                callback: this._initCmd.bind(this),
            },
            { key: "notification-low-battery", callback: this._onParamChangedLogNot.bind(this) },
            { key: "use-logging", callback: this._onParamChangedLogNot.bind(this) },
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
        for (const setting of settingsToMonitor) {
            this._settingSignals.push(this._settings.connect(`changed::${setting.key}`, setting.callback));
        }
        this._quicksettingSignal = QuickSettingsMenu.menu.connect("open-state-changed", this._refresh.bind(this));
    }

    disable() {
        if (this._refreshIntervalSignal !== null) {
            GLib.Source.remove(this._refreshIntervalSignal);
        }
        this._refreshIntervalSignal = null;
        if (this._quicksettingSignal !== null) QuickSettingsMenu.menu.disconnect(this._quicksettingSignal);
        this._quicksettingSignal = null;
        // remove setting Signals
        if (this._settingSignals) {
            for (const signal of this._settingSignals) {
                this._settings.disconnect(signal);
            }
        }
        this._settingSignals = null;
        this._settings = null;
        this._headsetControlIndicator.destroy();
        this._headsetControlIndicator = null;
        this._visible = null;
        this._devicecount = null;
        this._showIndicator = null;
        this._hideWhenDisconnectedSystemindicator = null;
        this._refreshIndicatorRunning = null;
        this._batteryLowNotified = null;
        this._refreshIntervalSystemindicator = null;
        this._notificationLowBattery = null;
        this._useLogging = null;
        this._useColors = null;
    }
}
