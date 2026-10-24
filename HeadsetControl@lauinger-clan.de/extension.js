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
import * as Slider from "resource:///org/gnome/shell/ui/slider.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

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
    volumelimiter: false,
    btwhenpoweredon: false,
    noisefilter: false,
    micmuteledbrightness: false,
    microphonevolume: false,
    anc: false,
    ancstartupmode: false,
    ancbuttonmodes: false,
    parametricequalizer: false,
    headsetvolume: false,
    btcallvolume: false,
};
// How the legacy capability listing names each capability, a string matches anywhere in it
const legacyCapabilityPatterns = {
    sidetone: "* sidetone",
    battery: "* battery",
    led: "* lights",
    inactivetime: "* inactive time",
    chatmix: "* chatmix",
    voice: "* voice prompts",
    rotatemute: "* rotate to mute",
    equalizer: "* equalizer",
    equalizerpreset: "* equalizer preset",
    volumelimiter: "* volume limiter",
    btwhenpoweredon: "* bluetooth when powered on",
    noisefilter: "* microphone noise filter",
    micmuteledbrightness: "* microphone mute led brightness",
    microphonevolume: "* microphone volume",
    // The other ANC capabilities start with "* anc" too
    anc: /^\s*\* anc$/m,
    ancstartupmode: "* anc startup mode",
    ancbuttonmodes: "* anc button modes",
    parametricequalizer: "* parametric equalizer",
    headsetvolume: "* headset volume",
    btcallvolume: "* bluetooth call volume",
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
    cmdVolumeLimiter: "",
    cmdBtWhenPoweredOn: "",
    cmdNoiseFilter: "",
    cmdMicMuteLedBrightness: "",
    cmdMicrophoneVolume: "",
    cmdAnc: "",
    cmdAncStartupMode: "",
    cmdAncButtonModes: "",
    cmdParametricEqualizer: "",
    cmdHeadsetVolume: "",
    cmdBtCallVolume: "",
};
// Scrolling and the arrow keys move a slider in small steps, apply once they pause
const sliderApplyDelayMs = 500;
const parametricEqualizerFilterTypes = ["lowshelf", "lowpass", "peaking", "highpass", "highshelf", "notch"];

function resetRuntimeState() {
    for (const capability in capabilities) {
        capabilities[capability] = false;
    }
    for (const command in headsetcontrolCommands) {
        headsetcontrolCommands[command] = "";
    }
}

// headsetcontrol skips a band it cannot parse and resets the equalizer when no band is left,
// so a typo would clear all bands. Returns the first malformed band, or null when all are fine.
// Device ranges are left to headsetcontrol, which reports them as a failed action.
function findInvalidParametricEqualizerBand(strBands) {
    if (strBands === "reset") {
        return null;
    }
    const bands = strBands
        .split(";")
        .map((band) => band.trim())
        .filter(Boolean);
    if (bands.length === 0) {
        return strBands;
    }
    for (const band of bands) {
        // FREQ,GAIN,Q,TYPE separated by commas or spaces
        const fields = band.split(/[ ,]+/).filter(Boolean);
        const numbersValid = fields.slice(0, 3).every((field) => Number.isFinite(Number(field)));
        if (fields.length !== 4 || !numbersValid || !parametricEqualizerFilterTypes.includes(fields[3])) {
            return band;
        }
    }
    return null;
}

async function invokeCmd(cmd, logger, testMode = 0, cancellable = null, subprocesses = null) {
    let proc = null;
    try {
        const flags = Gio.SubprocessFlags.STDOUT_PIPE;
        const [, argv] = GLib.shell_parse_argv(cmd);
        if (testMode > 0) {
            argv.push("--test-device", testMode.toString());
        }
        proc = new Gio.Subprocess({ argv, flags });
        proc.init(null);
        subprocesses?.add(proc);
        const stdout = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, cancellable, (subprocess, res) => {
                try {
                    const [, stdoutFinish] = subprocess.communicate_utf8_finish(res);
                    resolve(stdoutFinish);
                } catch (err) {
                    if (!cancellable?.is_cancelled()) {
                        logger.error(`Error executing command: ${err.message}`);
                    }
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
        if (!cancellable?.is_cancelled()) {
            logger.error(err);
        }
        return null;
    } finally {
        if (proc !== null) {
            subprocesses?.delete(proc);
        }
    }
}

function addNotification(title, body, isTransient, id = "battery_low") {
    const source = MessageTray.getSystemSource();
    const notification = new MessageTray.Notification({
        source,
        title: title,
        body: body,
        isTransient: isTransient,
    });
    notification.iconName = "audio-headset-symbolic";
    notification.urgency = MessageTray.Urgency.HIGH;
    notification.headset_warning_id = id;
    source.addNotification(notification);
}

function removeNotification(id = "battery_low") {
    const source = MessageTray.getSystemSource();
    const targets = source.notifications.filter((notification) => notification.headset_warning_id === id);
    targets.forEach((notification) => notification.destroy());
}

const HeadsetControlMenuToggle = GObject.registerClass(
    // The matching class name is intentional for GObject registration.
    // eslint-disable-next-line no-shadow
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
            this._valueSidetone = _("Sidetone");
            this._valueMicrophone = "";
            this._sidetoneMenuItem = null;
            this._sliders = new Map();
            this._valueHeadsetname = _("HeadsetControl");
            this._deviceId = "";
            this._jsonOutput = false;
            this._testMode = extension._testMode;
            this._cancellable = extension._cancellable;
            this._subprocesses = extension._subprocesses;
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

        destroy() {
            // Pending slider changes are dropped, their GLib timeouts removed
            this.clearSliders();
            super.destroy();
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
            this._sidetoneMenuItem = null;
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
                    capability: "headsetvolume",
                    label: _("Headset Volume"),
                    method: this._addHeadsetVolumeMenu,
                },
                {
                    capability: "anc",
                    label: _("Noise Cancelling"),
                    method: this._addAncMenu,
                },
                {
                    capability: "ancstartupmode",
                    label: _("Noise Cancelling at Power On"),
                    method: this._addAncStartupModeMenu,
                },
                {
                    capability: "ancbuttonmodes",
                    label: _("Noise Cancelling Button"),
                    method: this._addAncButtonModesMenu,
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
                {
                    capability: "parametricequalizer",
                    label: _("Parametric Equalizer"),
                    method: this._addParametricEqualizerMenu,
                },
                {
                    capability: "volumelimiter",
                    label: _("Volume Limiter"),
                    method: this._addVolumeLimiterMenu,
                },
                {
                    capability: "btwhenpoweredon",
                    label: _("Bluetooth When Powered On"),
                    method: this._addBtWhenPoweredOnMenu,
                },
                {
                    capability: "btcallvolume",
                    label: _("Bluetooth Call Volume"),
                    method: this._addBtCallVolumeMenu,
                },
                {
                    capability: "noisefilter",
                    label: _("Microphone Noise Filter"),
                    method: this._addNoiseFilterMenu,
                },
                {
                    capability: "micmuteledbrightness",
                    label: _("Mic Mute LED Brightness"),
                    method: this._addMicMuteLedBrightnessMenu,
                },
                {
                    capability: "microphonevolume",
                    label: _("Microphone Volume"),
                    method: this._addMicrophoneVolumeMenu,
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
            // A change that waits for its timeout is dropped with its slider
            this.clearSliders();
            this.menu.removeAll();
            this._buildMenu();
            this._addSettingsAction(extension);
        }

        _addSettingsAction(extension) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const settingsItem = this.menu.addAction(_("Settings"), () => {
                extension.openPreferences();
                Main.panel.closeQuickSettings();
            });
            settingsItem.visible = Main.sessionMode.allowSettings;
            this.menu._settingsActions[extension.uuid] = settingsItem;
        }

        updateBatteryStatus(strStatus, strBattery, lngBattery, timeToEmptyHours) {
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
                    // Append time-to-empty in hours if available
                    const hoursSuffix =
                        typeof timeToEmptyHours === "number" && Number.isFinite(timeToEmptyHours)
                            ? ` (${timeToEmptyHours}h)`
                            : "";
                    this._valueBattery = strBattery + " " + _("Charge") + hoursSuffix;
                }
            }
        }

        set testMode(value) {
            this._testMode = value;
        }

        set deviceId(value) {
            this._deviceId = value;
        }

        set jsonOutput(value) {
            this._jsonOutput = value;
        }

        get valueBatteryNum() {
            return this._valueBatteryNum;
        }

        updateHeadsetName(strHeadsetname) {
            this._valueHeadsetname = strHeadsetname;
        }

        updateChatMixStatus(strChatMix) {
            if (capabilities.chatmix) {
                // The JSON status has no chatmix when reading it failed
                this._valueChatMix = _("Chat-Mix") + ": " + (strChatMix ?? "???");
            }
        }

        updateSidetoneStatus(sidetone) {
            // Only headsets with CAP_SIDETONE_STATUS report it, and the name is optional.
            // Names like "Low" or "Medium" reuse the menu translations.
            let strSidetone = "";
            if (sidetone?.name) {
                strSidetone = _(sidetone.name);
            } else if (Number.isFinite(sidetone?.level)) {
                strSidetone = sidetone.level.toString();
            }
            this._valueSidetone = strSidetone ? _("Sidetone") + ": " + strSidetone : _("Sidetone");
            if (this._sidetoneMenuItem) {
                this._sidetoneMenuItem.label.text = this._valueSidetone;
            }
        }

        updateMicrophoneStatus(device) {
            // Only headsets with the microphone status capabilities report these, as 1 or 0
            // in headsetcontrol 4.2. The normal state (attached, unmuted) shows nothing.
            if (device?.mic_attached !== undefined && !device.mic_attached) {
                this._valueMicrophone = _("Mic detached");
            } else if (device?.mic_muted) {
                this._valueMicrophone = _("Mic muted");
            } else {
                this._valueMicrophone = "";
            }
        }

        _addMicrophoneStatus(strSubtitle) {
            return this._valueMicrophone ? `${strSubtitle} · ${this._valueMicrophone}` : strSubtitle;
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

        _getMenuIconName() {
            let iconName = "audio-headset-symbolic";
            if (capabilities.battery) {
                if (this._valueBatteryStatus === "BATTERY_CHARGING") {
                    iconName = "battery-charging-symbolic";
                }
                if (this._valueBatteryStatus === "BATTERY_AVAILABLE") {
                    const thresholdMedium = 50;
                    const thresholdLow = 25;
                    const thresholdCritical = 10;
                    if (this._valueBatteryNum > thresholdMedium) {
                        iconName = "battery-full-symbolic";
                    } else if (this._valueBatteryNum > thresholdLow) {
                        iconName = "battery-good-symbolic";
                    } else if (this._valueBatteryNum > thresholdCritical) {
                        iconName = "battery-low-symbolic";
                    } else {
                        iconName = "battery-caution-symbolic";
                    }
                }
                const iconTheme = new St.IconTheme();
                if (iconTheme.has_icon(iconName)) {
                    return iconName;
                } else {
                    iconName = "audio-headset-symbolic";
                }
            }
            return iconName; // fallback to default icon if specific battery icon is not available
        }

        setMenuHeader() {
            const iconName = this._getMenuIconName();
            this._logOutput("setMenuHeader iconName: " + iconName);
            if (capabilities.battery && capabilities.chatmix) {
                this.menu.setHeader(
                    iconName,
                    this._valueHeadsetname,
                    this._addMicrophoneStatus(this._valueBattery + " " + this._valueChatMix)
                );
                this._logOutput("setMenuHeader: Battery and Chatmix");
            } else if (capabilities.battery) {
                this.menu.setHeader(iconName, this._valueHeadsetname, this._addMicrophoneStatus(this._valueBattery));
                this._logOutput("setMenuHeader: Battery");
            } else if (capabilities.chatmix) {
                this.menu.setHeader(iconName, this._valueHeadsetname, this._addMicrophoneStatus(this._valueChatMix));
                this._logOutput("setMenuHeader: Chatmix");
            } else {
                this.menu.setHeader(iconName, _("HeadsetControl"), this._addMicrophoneStatus(this._valueHeadsetname));
                this._logOutput("setMenuHeader: Headsetname");
            }
            this._changeColor(this._valueBattery, this._valueBatteryNum);
        }

        async _invokeCmd(cmd) {
            this._logOutput("_invokeCmd: " + cmd);
            const retval = await invokeCmd(cmd, this._logger, this._testMode, this._cancellable, this._subprocesses);
            this._logOutput("_invokeCmd retval: " + retval);
            return retval;
        }

        // Resolves to false when the action failed or was cancelled
        async _invokeAction(strAction, cmd) {
            if (!this._jsonOutput) {
                // The legacy output only shows a failure when headsetcontrol did not start (null)
                // or printed nothing on stdout (undefined), as it does for rejected arguments
                const strOutput = await this._invokeCmd(cmd);
                if (this._cancellable.is_cancelled()) {
                    return false;
                }
                if (typeof strOutput !== "string") {
                    this._showActionFailed(strAction, _("No valid response from headsetcontrol"));
                    return false;
                }
                return true;
            }
            // Without -d the CLI refuses to change anything while several headsets are connected
            const deviceOption = this._deviceId ? ` -d ${this._deviceId}` : "";
            const outputFormat = this._settings.get_string("option-output-format");
            const strOutput = await this._invokeCmd(`${cmd}${deviceOption} ${outputFormat}`);
            if (this._cancellable.is_cancelled()) {
                return false;
            }
            return this._reportActionResult(strAction, strOutput);
        }

        _reportActionResult(strAction, strOutput) {
            let output = null;
            try {
                output = JSON.parse(strOutput);
            } catch (err) {
                this._logger.error(`Could not parse action result: ${err.message}`);
            }
            let errorMessage = null;
            if (!output) {
                errorMessage = _("No valid response from headsetcontrol");
            } else {
                // The CLI reports no actions when the selected headset is not connected
                const actions = output.actions ?? [];
                const failedAction = actions.find((action) => action.status !== "success");
                if (actions.length === 0) {
                    errorMessage = _("No supported headset found");
                } else if (failedAction) {
                    errorMessage = failedAction.error_message || _("Unknown error");
                }
            }
            if (errorMessage) {
                this._showActionFailed(strAction, errorMessage);
                return false;
            }
            removeNotification("action_failed");
            this._logOutput(`${strAction} succeeded`);
            return true;
        }

        _showActionFailed(strAction, errorMessage) {
            removeNotification("action_failed");
            this._logOutput(`${strAction} failed: ${errorMessage}`);
            addNotification(strAction, _("Failed") + ": " + errorMessage, true, "action_failed");
        }

        _addPopupMenuItem(popupMenuExpander, strLabel, strValue) {
            const submenu = new PopupMenu.PopupMenuItem(_(strLabel));
            const strAction = `${popupMenuExpander.label.text}: ${submenu.label.text}`;
            submenu.connect("activate", this._invokeAction.bind(this, strAction, strValue));
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
            // Show the status only now, the action names above use the plain label
            this._sidetoneMenuItem = popupMenuExpander;
            this._sidetoneMenuItem.label.text = this._valueSidetone;
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
        }

        _addInactivetimeMenu(popupMenuExpander) {
            const arrayInactiveTime = this._settings.get_strv("inactivetime-values");
            const inacitetimeValues = [
                [_("Off"), arrayInactiveTime[0]],
                [arrayInactiveTime[1] + _(" Minute"), arrayInactiveTime[1]],
                [arrayInactiveTime[2] + _(" Minutes"), arrayInactiveTime[2]],
                [arrayInactiveTime[3] + _(" Minutes"), arrayInactiveTime[3]],
                [arrayInactiveTime[4] + _(" Minutes"), arrayInactiveTime[4]],
                [arrayInactiveTime[5] + _(" Minutes"), arrayInactiveTime[5]],
                [arrayInactiveTime[6] + _(" Minutes"), arrayInactiveTime[6]],
                [arrayInactiveTime[7] + _(" Minutes"), arrayInactiveTime[7]],
                [arrayInactiveTime[8] + _(" Minutes"), arrayInactiveTime[8]],
                [arrayInactiveTime[9] + _(" Minutes"), arrayInactiveTime[9]],
                [arrayInactiveTime[10] + _(" Minutes"), arrayInactiveTime[10]],
            ].filter(([, value]) => value !== "-1");

            for (const item of inacitetimeValues) {
                this._addPopupMenuItem(
                    popupMenuExpander,
                    item[0],
                    headsetcontrolCommands.cmdInacitetime + " " + item[1]
                );
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
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
                    const itemarray = item[1].split(":");
                    item[0] = itemarray[0];
                    item[1] = itemarray[1];
                }
                this._addPopupMenuItem(popupMenuExpander, item[0], headsetcontrolCommands.cmdEqualizer + " " + item[1]);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
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
        }

        _addParametricEqualizerMenu(popupMenuExpander) {
            const arrayParametricEqualizer = this._settings.get_strv("option-parametric-equalizer-settings");
            for (const setting of arrayParametricEqualizer) {
                // "Name:bands", the bands contain no colon. An unnamed setting shows its bands.
                const separator = setting.indexOf(":");
                const strBands = setting.slice(separator + 1).trim();
                const strName = setting.slice(0, Math.max(separator, 0)).trim() || strBands;
                if (!strBands) {
                    continue; // headsetcontrol would reset all bands
                }
                const invalidBand = findInvalidParametricEqualizerBand(strBands);
                if (invalidBand === null) {
                    this._addPopupMenuItem(
                        popupMenuExpander,
                        strName,
                        `${headsetcontrolCommands.cmdParametricEqualizer} ${GLib.shell_quote(strBands)}`
                    );
                    continue;
                }
                // Keep the entry, so the user learns why it does nothing
                const submenu = new PopupMenu.PopupMenuItem(strName);
                const strAction = `${popupMenuExpander.label.text}: ${strName}`;
                submenu.connect("activate", () => {
                    this._showActionFailed(strAction, _("Invalid band") + ` "${invalidBand}"`);
                });
                popupMenuExpander.menu.addMenuItem(submenu);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
        }

        _addValuesMenu(popupMenuExpander, cmd, values) {
            for (const item of values) {
                this._addPopupMenuItem(popupMenuExpander, item[0], cmd + " " + item[1]);
            }
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";
        }

        _addVolumeLimiterMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdVolumeLimiter, [
                [_("Off"), "0"],
                [_("On"), "1"],
            ]);
        }

        _addBtWhenPoweredOnMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdBtWhenPoweredOn, [
                [_("Off"), "0"],
                [_("On"), "1"],
            ]);
        }

        _addNoiseFilterMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdNoiseFilter, [
                [_("Off"), "0"],
                [_("Low"), "1"],
                [_("High"), "2"],
            ]);
        }

        _addMicMuteLedBrightnessMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdMicMuteLedBrightness, [
                [_("Off"), "0"],
                [_("Low"), "1"],
                [_("Medium"), "2"],
                [_("High"), "3"],
            ]);
        }

        _addMicrophoneVolumeMenu(popupMenuExpander) {
            this._addSliderMenu(
                popupMenuExpander,
                headsetcontrolCommands.cmdMicrophoneVolume,
                "microphone-volume-value",
                128
            );
        }

        _addHeadsetVolumeMenu(popupMenuExpander) {
            this._addSliderMenu(
                popupMenuExpander,
                headsetcontrolCommands.cmdHeadsetVolume,
                "headset-volume-value",
                128
            );
        }

        _addBtCallVolumeMenu(popupMenuExpander) {
            this._addSliderMenu(popupMenuExpander, headsetcontrolCommands.cmdBtCallVolume, "bt-call-volume-value", 100);
        }

        // headsetcontrol 4.2 cannot read these values back, so the slider starts at the last value
        // set, stored in settingKey (-1 while unknown). The submenu label shows it as a percentage.
        _addSliderMenu(popupMenuExpander, cmd, settingKey, maxValue) {
            const strLabel = popupMenuExpander.label.text;
            const slider = new Slider.Slider(0);
            slider.accessible_name = strLabel;
            // Without focus on the row, the arrow keys reach the slider
            const sliderItem = new PopupMenu.PopupBaseMenuItem({ activate: false, can_focus: false });
            sliderItem.add_child(slider);
            popupMenuExpander.menu.addMenuItem(sliderItem);
            popupMenuExpander.menu.box.style_class = "PopupSubMenuMenuItemStyle";

            const sliderState = {
                strLabel,
                cmd,
                settingKey,
                maxValue,
                popupMenuExpander,
                slider,
                value: -1,
                dragging: false,
                timeoutId: 0,
                applying: false,
                reapply: false,
            };
            sliderState.changedId = slider.connect("notify::value", this._onSliderChanged.bind(this, sliderState));
            slider.connect("drag-begin", () => {
                sliderState.dragging = true;
            });
            slider.connect("drag-end", () => {
                sliderState.dragging = false;
                this._applySlider(sliderState);
            });
            this._sliders.set(settingKey, sliderState);
            this._setSliderValue(sliderState, this._settings.get_int(settingKey));
        }

        _getSliderValue(sliderState) {
            return Math.round(sliderState.slider.value * sliderState.maxValue);
        }

        _updateSliderLabel(sliderState, value) {
            const percent = Math.round((value / sliderState.maxValue) * 100);
            sliderState.popupMenuExpander.label.text =
                value < 0 ? sliderState.strLabel : `${sliderState.strLabel}: ${percent}%`;
        }

        _setSliderValue(sliderState, value) {
            sliderState.value = value;
            sliderState.slider.block_signal_handler(sliderState.changedId);
            sliderState.slider.value = value < 0 ? 0.5 : value / sliderState.maxValue;
            sliderState.slider.unblock_signal_handler(sliderState.changedId);
            this._updateSliderLabel(sliderState, value);
        }

        _onSliderChanged(sliderState) {
            this._updateSliderLabel(sliderState, this._getSliderValue(sliderState));
            if (sliderState.dragging) {
                return; // applied on drag-end
            }
            this._removeSliderTimeout(sliderState);
            sliderState.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, sliderApplyDelayMs, () => {
                sliderState.timeoutId = 0;
                this._applySlider(sliderState);
                return GLib.SOURCE_REMOVE;
            });
        }

        _removeSliderTimeout(sliderState) {
            if (sliderState.timeoutId) {
                GLib.Source.remove(sliderState.timeoutId);
                sliderState.timeoutId = 0;
            }
        }

        _isSliderIdle(sliderState) {
            return !sliderState.dragging && !sliderState.timeoutId && !sliderState.applying;
        }

        // One command per slider at a time. A change made while it runs is applied once it ends,
        // so the last position wins and is compared with the value the headset actually got.
        async _applySlider(sliderState) {
            this._removeSliderTimeout(sliderState);
            if (sliderState.applying) {
                sliderState.reapply = true;
                return;
            }
            sliderState.reapply = false;
            const value = this._getSliderValue(sliderState);
            if (value === sliderState.value) {
                return;
            }
            sliderState.applying = true;
            const succeeded = await this._invokeAction(sliderState.strLabel, `${sliderState.cmd} ${value}`);
            sliderState.applying = false;
            if (this._cancellable.is_cancelled()) {
                return; // the extension was disabled, a waiting change is dropped
            }
            if (succeeded) {
                sliderState.value = value;
                this._settings.set_int(sliderState.settingKey, value);
            }
            const currentState = this._sliders.get(sliderState.settingKey);
            if (currentState !== sliderState) {
                // The menu was rebuilt meanwhile, a waiting change is dropped with the old slider
                if (succeeded && currentState && this._isSliderIdle(currentState)) {
                    this._setSliderValue(currentState, value);
                }
                return;
            }
            if (!this._isSliderIdle(sliderState)) {
                return; // applied on drag-end or after the timeout
            }
            if (sliderState.reapply) {
                this._applySlider(sliderState);
            } else {
                // After a failure the slider goes back to the value the headset still has
                this._setSliderValue(sliderState, sliderState.value);
            }
        }

        clearSliders() {
            for (const sliderState of this._sliders.values()) {
                this._removeSliderTimeout(sliderState);
            }
            this._sliders.clear();
        }

        updateHeadsetVolume(headsetVolume) {
            // Only reported by headsetcontrol after 4.2.0, for headsets that can read it back
            const level = headsetVolume?.level;
            if (!Number.isInteger(level) || level < 0) {
                return;
            }
            if (this._settings.get_int("headset-volume-value") !== level) {
                this._settings.set_int("headset-volume-value", level);
            }
            const sliderState = this._sliders.get("headset-volume-value");
            if (sliderState && this._isSliderIdle(sliderState)) {
                this._setSliderValue(sliderState, level);
            }
        }

        _addAncMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdAnc, [
                [_("Off"), "0"],
                [_("Noise cancelling"), "1"],
                [_("Ambient sound"), "2"],
            ]);
        }

        _addAncStartupModeMenu(popupMenuExpander) {
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdAncStartupMode, [
                [_("Off"), "0"],
                [_("Noise cancelling"), "1"],
                [_("Ambient sound"), "2"],
                [_("Same as at power off"), "3"],
            ]);
        }

        _addAncButtonModesMenu(popupMenuExpander) {
            // The button cycles through the chosen modes, so a single mode is left out
            this._addValuesMenu(popupMenuExpander, headsetcontrolCommands.cmdAncButtonModes, [
                [_("Off / Noise cancelling"), "off,anc"],
                [_("Off / Ambient sound"), "off,ambient"],
                [_("Noise cancelling / Ambient sound"), "anc,ambient"],
                [_("Off / Noise cancelling / Ambient sound"), "off,anc,ambient"],
            ]);
        }

        get menuButtonStyle() {
            return this._menuButton.get_style();
        }

        get valueBatteryStatus() {
            return this._valueBatteryStatus;
        }

        _changeColor(strvalueBattery, valueBatteryNum) {
            const colorLow = this._settings.get_string("color-batterylow");
            const colorMedium = this._settings.get_string("color-batterymedium");
            const colorHigh = this._settings.get_string("color-batteryhigh");

            if (!this._settings.get_boolean("use-colors") || strvalueBattery === "N/A") {
                this._menuButton.set_style(this._originalStyle);
                return false;
            }
            this._logOutput("_changeColor valueBatteryNum: " + valueBatteryNum);
            const thresholdMedium = 50;
            const thresholdLow = 25;
            if (valueBatteryNum > thresholdMedium) {
                this._menuButton.set_style("color: " + colorHigh + ";");
                this._logOutput("_changeColor: " + colorHigh);
            } else if (valueBatteryNum > thresholdLow) {
                this._menuButton.set_style("color: " + colorMedium + ";");
                this._logOutput("_changeColor: " + colorMedium);
            } else {
                this._menuButton.set_style("color: " + colorLow + ";");
                this._logOutput("_changeColor: " + colorLow);
            }
            return true;
        }
    }
);

const HeadsetControlIndicator = GObject.registerClass(
    // The matching class name is intentional for GObject registration.
    // eslint-disable-next-line no-shadow
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
                const batteryNum = this._headsetControlMenuToggle.valueBatteryNum;
                if (batteryNum < 0) {
                    this._indicatorLabel.set_text("N/A");
                    return;
                }
                // Add "+" if charging
                const isCharging = this._headsetControlMenuToggle.valueBatteryStatus === "BATTERY_CHARGING";
                // \u26A1 is the flash, \uFE0E forces the monochrome text representation
                const lightning = "\u26A1\uFE0E";
                this._indicatorLabel.set_text(`${isCharging ? lightning : ""}${batteryNum}%`);
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
        const retval = await invokeCmd(cmd, this.getLogger(), this._testMode, this._cancellable, this._subprocesses);
        this._logOutput("_invokeCmd retval: " + retval);
        return retval;
    }

    _isCancelled(cancellable) {
        return cancellable !== this._cancellable || cancellable.is_cancelled();
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
        headsetcontrolCommands.cmdVolumeLimiter = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-volume-limiter")
        );
        headsetcontrolCommands.cmdBtWhenPoweredOn = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-bt-when-powered-on")
        );
        headsetcontrolCommands.cmdNoiseFilter = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-noise-filter")
        );
        headsetcontrolCommands.cmdMicMuteLedBrightness = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-microphone-mute-led-brightness")
        );
        headsetcontrolCommands.cmdMicrophoneVolume = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-microphone-volume")
        );
        headsetcontrolCommands.cmdAnc = buildCommand(cmdExecutable, this._settings.get_string("option-anc"));
        headsetcontrolCommands.cmdAncStartupMode = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-anc-startup-mode")
        );
        headsetcontrolCommands.cmdAncButtonModes = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-anc-button-modes")
        );
        headsetcontrolCommands.cmdParametricEqualizer = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-parametric-equalizer")
        );
        headsetcontrolCommands.cmdHeadsetVolume = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-headset-volume")
        );
        headsetcontrolCommands.cmdBtCallVolume = buildCommand(
            cmdExecutable,
            this._settings.get_string("option-bt-call-volume")
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
        capabilities.volumelimiter = value;
        capabilities.btwhenpoweredon = value;
        capabilities.noisefilter = value;
        capabilities.micmuteledbrightness = value;
        capabilities.microphonevolume = value;
        capabilities.anc = value;
        capabilities.ancstartupmode = value;
        capabilities.ancbuttonmodes = value;
        capabilities.parametricequalizer = value;
        capabilities.headsetvolume = value;
        capabilities.btcallvolume = value;
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
        capabilities.volumelimiter = device.capabilities.includes("CAP_VOLUME_LIMITER");
        capabilities.btwhenpoweredon = device.capabilities.includes("CAP_BT_WHEN_POWERED_ON");
        capabilities.noisefilter = device.capabilities.includes("CAP_NOISE_FILTER");
        capabilities.micmuteledbrightness = device.capabilities.includes("CAP_MICROPHONE_MUTE_LED_BRIGHTNESS");
        capabilities.microphonevolume = device.capabilities.includes("CAP_MICROPHONE_VOLUME");
        capabilities.anc = device.capabilities.includes("CAP_ANC");
        capabilities.ancstartupmode = device.capabilities.includes("CAP_ANC_STARTUP_MODE");
        capabilities.ancbuttonmodes = device.capabilities.includes("CAP_ANC_BUTTON_MODES");
        capabilities.parametricequalizer = device.capabilities.includes("CAP_PARAMETRIC_EQUALIZER");
        capabilities.headsetvolume = device.capabilities.includes("CAP_HEADSET_VOLUME");
        capabilities.btcallvolume = device.capabilities.includes("CAP_BT_CALL_VOLUME");
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

    _supportsDeviceSelection(apiVersion) {
        // -d is available since API 1.3 (HeadsetControl 3.1)
        const [major, minor] = String(apiVersion).split(".").map(Number);
        return major > 1 || (major === 1 && minor >= 3);
    }

    _updateDevice(output) {
        const device = output.devices[0];
        const deviceId = `${device.id_vendor}:${device.id_product}`;
        if (this._deviceId !== deviceId) {
            this._deviceId = deviceId;
            this._logOutput("device changed: " + deviceId);
            this._needCapabilitiesRefresh = true;
        }
        const isValidId = /^0x[0-9a-f]{1,4}:0x[0-9a-f]{1,4}$/i.test(deviceId);
        this._headsetControlIndicator.headsetControlMenuToggle.deviceId =
            isValidId && this._supportsDeviceSelection(output.api_version) ? deviceId : "";
    }

    _processOutput(output, updateIndicator) {
        if (!output) {
            this._devicecount = 0;
            return false;
        }
        this._JSONoutputSupported = true;
        this._headsetControlIndicator.headsetControlMenuToggle.jsonOutput = true;
        const device_count = output.device_count;
        this._logOutput("device_count:" + " " + device_count);
        if (this._devicecount !== device_count) {
            this._devicecount = device_count;
            this._logOutput("device_count changed: " + device_count);
            this._needCapabilitiesRefresh = true;
        }
        if (device_count > 0) {
            this._updateDevice(output);
            if (!this._isDeviceStatusSuccess(output.devices[0])) {
                this._setAllCapabilities(true); // if we cannot get the capabilities, set all to true
                this._headsetControlIndicator.headsetControlMenuToggle.updateSidetoneStatus(null);
                this._headsetControlIndicator.headsetControlMenuToggle.updateMicrophoneStatus(null);
                return false;
            }
            if (this._needCapabilitiesRefresh) {
                this._refreshCapabilitiesJSON(output.devices[0]);
            }
            const headsetname = output.devices[0].device;
            this._logOutput(headsetname);
            this._hasEqualizerPresetSupport(output.devices[0]);
            // The Quick Settings menu exists even when the indicator is hidden
            if (this._needCapabilitiesRefresh) {
                this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
            }
            if (updateIndicator) {
                this._headsetControlIndicator.headsetControlMenuToggle.updateHeadsetName(headsetname);
                // battery is missing for headsets without battery capability
                const battery = output.devices[0].battery ?? {};
                let timeToEmptyHours = null;
                if ("time_to_empty_min" in battery) {
                    // input is minutes; convert to whole hours
                    timeToEmptyHours = Math.floor(battery.time_to_empty_min / 60);
                }
                this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
                    battery.status,
                    battery.level + "%",
                    battery.level,
                    timeToEmptyHours
                );
                this._headsetControlIndicator.headsetControlMenuToggle.updateChatMixStatus(output.devices[0].chatmix);
                this._headsetControlIndicator.headsetControlMenuToggle.updateSidetoneStatus(output.devices[0].sidetone);
                this._headsetControlIndicator.headsetControlMenuToggle.updateMicrophoneStatus(output.devices[0]);
                this._headsetControlIndicator.headsetControlMenuToggle.updateHeadsetVolume(
                    output.devices[0].headset_volume
                );
                this._headsetControlIndicator.updateUIElements();
            }
            this._needCapabilitiesRefresh = false;
        } else {
            // Without a headset there is no current sidetone level or microphone state
            this._headsetControlIndicator.headsetControlMenuToggle.updateSidetoneStatus(null);
            this._headsetControlIndicator.headsetControlMenuToggle.updateMicrophoneStatus(null);
        }
        return true;
    }

    async _refreshJSON() {
        const cancellable = this._cancellable;
        try {
            const stdout = await this._invokeCmd(headsetcontrolCommands.cmdOutputFormat);
            if (this._isCancelled(cancellable)) {
                return;
            }
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
            if (!this._isCancelled(cancellable)) {
                this._headsetControlIndicator.headsetControlMenuToggle.jsonOutput = false;
                // The legacy output has no sidetone level or microphone state
                this._headsetControlIndicator.headsetControlMenuToggle.updateSidetoneStatus(null);
                this._headsetControlIndicator.headsetControlMenuToggle.updateMicrophoneStatus(null);
            }
            // Fallback to non-JSON method
            await this._refreshCapabilities();
            if (this._isCancelled(cancellable)) {
                return;
            }
            if (capabilities.battery) {
                await this._refreshBatteryStatus();
                if (this._isCancelled(cancellable)) {
                    return;
                }
            }
            if (capabilities.chatmix) {
                await this._refreshChatMixStatus();
            }
        } finally {
            if (!this._isCancelled(cancellable)) {
                this._headsetControlIndicator.updateUIElements();
                this._changeIndicatorVisibility();
                this._notifyLowBattery(
                    this._headsetControlIndicator.headsetControlMenuToggle.valueBatteryStatus,
                    this._headsetControlIndicator.valueBatteryNum
                );
            }
        }
    }

    async _refreshJSONupdate(updateIndicator) {
        const cancellable = this._cancellable;
        this._JSONoutputSupported = false;
        const strOutput = await this._readJSONOutputFormat("");
        if (this._isCancelled(cancellable)) {
            return false;
        }
        return this._processOutput(strOutput, updateIndicator);
    }

    async _refreshCapabilities() {
        const cancellable = this._cancellable;
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdCapabilities);
        if (this._isCancelled(cancellable)) {
            return;
        }

        // if we cannot get the capabilities, set all to true
        if (!strOutput || strOutput.includes("No supported headset found")) {
            this._setAllCapabilities(true);
            return;
        }
        // Only what this output lists, so a capability that is gone loses its submenu
        this._setAllCapabilities(false);
        for (const [capability, pattern] of Object.entries(legacyCapabilityPatterns)) {
            capabilities[capability] =
                pattern instanceof RegExp ? pattern.test(strOutput) : strOutput.includes(pattern);
            this._logOutput(`capabilities.${capability}: ${capabilities[capability]}`);
        }
        if (capabilities.battery && this._showIndicator) {
            this._headsetControlIndicator.setLabelVisible(capabilities.battery);
        }
        this._needCapabilitiesRefresh = false; // when headset was connected
        this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
    }

    async _refreshBatteryStatus() {
        const cancellable = this._cancellable;
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdBattery);
        if (this._isCancelled(cancellable)) {
            return false;
        }

        if (!strOutput) {
            return false;
        }
        const strBattery = this._getHeadSetControlValue(strOutput, "Battery");
        this._headsetControlIndicator.headsetControlMenuToggle.updateBatteryStatus(
            "N/A",
            strBattery,
            strBattery.replace("%", ""),
            null
        );
        return true;
    }

    async _refreshChatMixStatus() {
        const cancellable = this._cancellable;
        const strOutput = await this._invokeCmd(headsetcontrolCommands.cmdChatMix);
        if (this._isCancelled(cancellable)) {
            return false;
        }

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
        const cancellable = this._cancellable;
        this._logOutput("_refreshIndicator - " + _("Refreshing..."));
        if (this._JSONoutputSupported) {
            await this._refreshJSON();
            return;
        }
        if (capabilities.battery) {
            await this._refreshBatteryStatus();
            if (this._isCancelled(cancellable)) {
                return;
            }
            this._headsetControlIndicator.updateUIElements();
            this._changeIndicatorVisibility();
            this._notifyLowBattery(
                this._headsetControlIndicator.headsetControlMenuToggle.valueBatteryStatus,
                this._headsetControlIndicator.valueBatteryNum
            );
        }
    }

    async _refresh() {
        const cancellable = this._cancellable;
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
            if (this._isCancelled(cancellable)) {
                return;
            }
        }
        if (capabilities.battery) {
            await this._refreshBatteryStatus();
            if (this._isCancelled(cancellable)) {
                return;
            }
        }
        if (capabilities.chatmix) {
            await this._refreshChatMixStatus();
            if (this._isCancelled(cancellable)) {
                return;
            }
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
        this._lowBatteryThreshold = this._settings.get_int("low-battery-threshold");
        this._useLogging = this._settings.get_boolean("use-logging");
        this._headsetControlIndicator.headsetControlMenuToggle.updateUseLogging(this._useLogging);
    }

    _onParamChangedMenu() {
        this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
    }

    _onParamChangedCommand() {
        this._initCmd();
        // Menu items keep the command they were built with
        this._headsetControlIndicator.headsetControlMenuToggle.refreshMenu(this);
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

    _onParamChangedTestMode() {
        this._testMode = this._settings.get_int("test-mode");
        this._headsetControlIndicator.headsetControlMenuToggle.testMode = this._testMode;
        // Test profiles share one device id but differ in capabilities
        this._needCapabilitiesRefresh = true;
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
        const cancellable = this._cancellable;
        this._logOutput("_updateBinaryCapabilities - calling _refreshJSONupdate");
        const ret = await this._refreshJSONupdate(this._showIndicator);
        if (this._isCancelled(cancellable)) {
            return;
        }
        if (!ret) {
            await this._refreshCapabilities();
            if (this._isCancelled(cancellable)) {
                return;
            }
        }
        await this._refreshIndicator();
    }

    _notifyLowBattery(strStatus, valueBatteryNum) {
        if (!this._notificationLowBattery) {
            return;
        }
        this._logOutput("_notifyLowBattery - strStatus: " + strStatus + " valueBatteryNum: " + valueBatteryNum);
        if (strStatus === "BATTERY_AVAILABLE" && valueBatteryNum <= this._lowBatteryThreshold) {
            if (!this._batteryLowNotified) {
                this._batteryLowNotified = true;
                addNotification(
                    _("HeadsetControl"),
                    _("Battery low! Please charge your headset."),
                    false,
                    "battery_low"
                );
            }
        } else if (strStatus === "BATTERY_CHARGING" || valueBatteryNum > this._lowBatteryThreshold) {
            this._batteryLowNotified = false;
            removeNotification("battery_low");
        }
    }

    enable() {
        resetRuntimeState();
        this._devicecount = 0;
        this._deviceId = "";
        this._visible = false;
        this._refreshIndicatorRunning = false;
        this._batteryLowNotified = false;
        this._needCapabilitiesRefresh = true;
        this._JSONoutputSupported = true;
        this._settings = this.getSettings();
        this._cancellable = new Gio.Cancellable();
        this._subprocesses = new Set();

        this._testMode = 0;
        this._settings.set_int("test-mode", 0); // make sure test mode is off when extension is enabled
        this._notificationLowBattery = this._settings.get_boolean("notification-low-battery");
        this._lowBatteryThreshold = this._settings.get_int("low-battery-threshold");
        this._useLogging = this._settings.get_boolean("use-logging");
        this._useColors = this._settings.get_boolean("use-colors");
        this._showIndicator = this._settings.get_boolean("show-systemindicator");
        this._hideWhenDisconnectedSystemindicator = this._settings.get_boolean("hidewhendisconnected-systemindicator");
        this._refreshIntervalSystemindicator = this._settings.get_int("refreshinterval-systemindicator");

        this._headsetControlIndicator = new HeadsetControlIndicator(this);
        this._initCmd();
        this._updateBinaryCapabilities();
        this._refreshIntervalSignal = null;
        this._refreshIntervalHandler(false);
        this._changeIndicatorVisibility();
        // add Signals to array
        this._settingSignals = [];
        const settingsToMonitor = [
            {
                key: "headsetcontrol-executable",
                callback: this._onParamChangedCommand.bind(this),
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
            { key: "option-sidetone", callback: this._onParamChangedCommand.bind(this) },
            {
                key: "option-led",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-inactive-time",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-voice",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-rotate-mute",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-output-format",
                callback: this._initCmd.bind(this),
            },
            {
                key: "option-equalizer",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-equalizer-preset",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-volume-limiter",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-bt-when-powered-on",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-noise-filter",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-microphone-mute-led-brightness",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-microphone-volume",
                callback: this._onParamChangedCommand.bind(this),
            },
            { key: "option-anc", callback: this._onParamChangedCommand.bind(this) },
            {
                key: "option-anc-startup-mode",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-anc-button-modes",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-parametric-equalizer",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-headset-volume",
                callback: this._onParamChangedCommand.bind(this),
            },
            {
                key: "option-bt-call-volume",
                callback: this._onParamChangedCommand.bind(this),
            },
            { key: "notification-low-battery", callback: this._onParamChangedLogNot.bind(this) },
            { key: "low-battery-threshold", callback: this._onParamChangedLogNot.bind(this) },
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
                key: "option-parametric-equalizer-settings",
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
            {
                key: "test-mode",
                callback: this._onParamChangedTestMode.bind(this),
            },
        ];
        for (const setting of settingsToMonitor) {
            this._settingSignals.push(this._settings.connect(`changed::${setting.key}`, setting.callback));
        }
        this._quicksettingSignal = QuickSettingsMenu.menu.connect("open-state-changed", this._refresh.bind(this));
    }

    disable() {
        this._cancellable.cancel();
        for (const subprocess of this._subprocesses) {
            subprocess.force_exit();
        }
        this._subprocesses.clear();
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
        this._deviceId = null;
        this._showIndicator = null;
        this._hideWhenDisconnectedSystemindicator = null;
        this._refreshIndicatorRunning = null;
        this._testMode = null;
        this._batteryLowNotified = null;
        this._refreshIntervalSystemindicator = null;
        this._notificationLowBattery = null;
        this._lowBatteryThreshold = null;
        this._useLogging = null;
        this._useColors = null;
        this._cancellable = null;
        this._subprocesses = null;
        resetRuntimeState();
    }
}
