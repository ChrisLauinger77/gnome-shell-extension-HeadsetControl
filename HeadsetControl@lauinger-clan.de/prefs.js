"use strict";

import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class AdwPrefs extends ExtensionPreferences {
    changeOption(option, text) {
        this.getSettings().set_string(option, text);
    }

    _onBtnClicked(btn, filechooser) {
        const parent = btn.get_root();
        filechooser.set_transient_for(parent);

        const allFileFilter = new Gtk.FileFilter();
        filechooser.set_filter(allFileFilter);
        allFileFilter.add_pattern("*");

        filechooser.title = _("Select headsetcontrol executable");

        filechooser.show();
    }

    _updateExecutable(valueExecutable) {
        valueExecutable.set_text(this.getSettings().get_string("headsetcontrol-executable"));
    }

    _onFileChooserResponse(native, response) {
        if (response !== Gtk.ResponseType.ACCEPT) {
            return;
        }
        const fileURI = native.get_file().get_uri().replace("file://", "");

        this.changeOption("headsetcontrol-executable", fileURI);
    }

    addOptionRow(exprow, title, tooltip, option) {
        const adwrow = new Adw.EntryRow({ title: _(title) });
        adwrow.set_tooltip_text(_(tooltip));
        exprow.add_row(adwrow);
        adwrow.set_text(_(this.getSettings().get_string(option)));
        return adwrow;
    }

    addEqualizerRow(exprow, title, tooltip, value) {
        const adwrow = new Adw.EntryRow({ title: _(title) });
        adwrow.set_tooltip_text(_(tooltip));
        exprow.add_row(adwrow);
        adwrow.set_text(_(value));
        return adwrow;
    }

    addSpinRow(exprow, title, subtitle, tooltip, values, value) {
        let [min, max, step, climbrate] = values;
        const adwrow = Adw.SpinRow.new_with_range(min, max, step);

        adwrow.set_title(title);
        adwrow.set_subtitle(subtitle);
        adwrow.set_tooltip_text(tooltip);
        adwrow.set_value(value);
        adwrow.set_numeric(true);
        adwrow.set_digits(0);
        adwrow.set_climb_rate(climbrate);
        exprow.add_row(adwrow);
        return adwrow;
    }

    applyChanges(valueExecutable, options) {
        this.changeOption("headsetcontrol-executable", valueExecutable.get_text());
        this.changeOption("option-output-format", options.opt_oformat.get_text());
        this.changeOption("option-capabilities", options.opt_capa.get_text());
        this.changeOption("option-battery", options.opt_bat.get_text());
        this.changeOption("option-chatmix", options.opt_chm.get_text());
        this.changeOption("option-sidetone", options.opt_sto.get_text());
        this.changeOption("option-led", options.opt_led.get_text());
        this.changeOption("option-inactive-time", options.opt_iat.get_text());
        this.changeOption("option-voice", options.opt_voice.get_text());
        this.changeOption("option-rotate-mute", options.opt_rot.get_text());
        this.changeOption("option-equalizer", options.opt_equalizer.get_text());
        this.changeOption("option-equalizer-preset", options.opt_equalizer_preset.get_text());
    }

    _onColorChanged(color_setting_button, strSetting) {
        this.getSettings().set_string(strSetting, color_setting_button.get_rgba().to_string());
    }

    _onEQvaluechanged(adwrow, index, option) {
        let arrayEQsettings = this.getSettings().get_strv(option);
        arrayEQsettings[index] = adwrow.get_text();
        this.getSettings().set_strv(option, arrayEQsettings);
    }

    _onSTvaluechanged(adwrow, index) {
        let arraySidetone = this.getSettings().get_strv("sidetone-values");
        arraySidetone[index] = adwrow.get_value().toString();
        this.getSettings().set_strv("sidetone-values", arraySidetone);
    }

    _onRIvaluechanged(adwrow) {
        const value = adwrow.get_value();
        this.getSettings().set_int("refreshinterval-systemindicator", value);
    }

    _onQSToggleValuechanged(_settings, cmb) {
        _settings.set_int("quicksettings-toggle", cmb.get_selected());
    }

    fillPreferencesWindow(window) {
        window.search_enabled = true;
        window._settings = this.getSettings();
        let adwrow;
        const page1 = Adw.PreferencesPage.new();
        page1.set_title(_("HeadsetControl"));
        page1.set_name("headsetcontrol_page1");
        page1.set_icon_name("audio-headset-symbolic");

        // group1
        const group1 = Adw.PreferencesGroup.new();
        group1.set_title(_("Global"));
        group1.set_name("headsetcontrol_global");
        page1.add(group1);
        const valueExecutable = new Adw.EntryRow({ title: _("Command:") });
        valueExecutable.set_tooltip_text(_("File and path of headsetcontrol executable"));
        group1.add(valueExecutable);

        valueExecutable.set_text(window._settings.get_string("headsetcontrol-executable"));
        window._settings.connect(
            "changed::headsetcontrol-executable",
            this._updateExecutable.bind(this, valueExecutable)
        );
        const buttonExecutable = new Gtk.Button({
            label: _("..."),
            valign: Gtk.Align.CENTER,
        });
        buttonExecutable.set_tooltip_text(_("Usually located in '/usr/bin' OR '/usr/local/bin'"));
        valueExecutable.add_suffix(buttonExecutable);
        valueExecutable.activatable_widget = buttonExecutable;

        const _filechooser = new Gtk.FileChooserNative({
            title: _("Select headsetcontrol executable"),
            modal: true,
            action: Gtk.FileChooserAction.OPEN,
        });
        buttonExecutable.connect("clicked", this._onBtnClicked.bind(this, buttonExecutable, _filechooser));
        _filechooser.connect("response", this._onFileChooserResponse.bind(this));

        // group2
        const group2 = Adw.PreferencesGroup.new();
        group2.set_title(_("HeadsetControl parameters"));
        group2.set_name("headsetcontrol_parameters");
        page1.add(group2);
        const expRow1 = Adw.ExpanderRow.new();
        expRow1.set_title(_("HeadsetControl Version Option output format"));
        expRow1.set_subtitle(_("Used starting with HeadsetControl tool version newer then 2.7.0"));
        expRow1.set_expanded(true);
        group2.add(expRow1);
        const opt_oformat = this.addOptionRow(
            expRow1,
            _("Output format"),
            _("Parameter to ask for all data in new output format"),
            "option-output-format"
        );
        const expRow2 = Adw.ExpanderRow.new();
        expRow2.set_title(_("HeadsetControl Version Legacy"));
        expRow2.set_subtitle(_("Used until HeadsetControl tool version 2.7.0"));
        expRow2.set_expanded(false);
        group2.add(expRow2);
        const opt_capa = this.addOptionRow(
            expRow2,
            _("Capabilities"),
            _("Parameter to ask for capabilities"),
            "option-capabilities"
        );
        const opt_bat = this.addOptionRow(expRow2, _("Battery"), _("Parameter to ask for battery"), "option-battery");
        const opt_chm = this.addOptionRow(expRow2, _("Chat-Mix"), _("Parameter to ask for chat-mix"), "option-chatmix");
        const expRow3 = Adw.ExpanderRow.new();
        expRow3.set_title(_("HeadsetControl Common"));
        expRow3.set_subtitle(_("Used in all HeadsetControl tool versions"));
        expRow3.set_expanded(true);
        group2.add(expRow3);
        const opt_sto = this.addOptionRow(
            expRow3,
            _("Sidetone"),
            _("Parameter to ask for sidetone"),
            "option-sidetone"
        );
        const opt_led = this.addOptionRow(
            expRow3,
            _("LED"),
            _("Passed to headsetcontrol to set for led"),
            "option-led"
        );
        const opt_iat = this.addOptionRow(
            expRow3,
            _("Inactive time"),
            _("Parameter to ask for inactive time"),
            "option-inactive-time"
        );
        const opt_voice = this.addOptionRow(
            expRow3,
            _("Voice Prompts"),
            _("Passed to headsetcontrol to set for voice prompts"),
            "option-voice"
        );
        const opt_rot = this.addOptionRow(
            expRow3,
            _("Rotate to Mute"),
            _("Parameter to ask for rotate to mute"),
            "option-rotate-mute"
        );
        const opt_equalizer = this.addOptionRow(
            expRow3,
            _("Equalizer"),
            _("Passed to headsetcontrol to set the equalizer setting"),
            "option-equalizer"
        );
        const opt_equalizer_preset = this.addOptionRow(
            expRow3,
            _("Equalizer Preset"),
            _("Passed to headsetcontrol to set the equalizer preset"),
            "option-equalizer-preset"
        );

        adwrow = new Adw.ActionRow({ title: "" });
        group2.add(adwrow);
        const buttonApply = new Gtk.Button({
            label: _("Apply"),
            css_classes: ["suggested-action"],
            valign: Gtk.Align.CENTER,
        });
        buttonApply.connect(
            "clicked",
            this.applyChanges.bind(this, valueExecutable, {
                opt_oformat,
                opt_capa,
                opt_bat,
                opt_chm,
                opt_sto,
                opt_led,
                opt_iat,
                opt_voice,
                opt_rot,
                opt_equalizer,
                opt_equalizer_preset,
            })
        );
        adwrow.add_suffix(buttonApply);
        adwrow.activatable_widget = buttonApply;

        window.set_default_size(675, 735);
        window.add(page1);
        //page2
        const page2 = Adw.PreferencesPage.new();
        page2.set_title(_("Customization"));
        page2.set_name("headsetcontrol_page2");
        page2.set_icon_name("preferences-system-symbolic");

        // groupC1
        const groupC1 = Adw.PreferencesGroup.new();
        groupC1.set_title(_("Options"));
        groupC1.set_name("headsetcontrol_options");
        page2.add(groupC1);
        // quicksettings-toggle
        adwrow = new Adw.ComboRow({ title: _("Quicksettings toggle") });
        adwrow.set_tooltip_text(_("Usage of quicksettings toggle"));

        let stringlist = new Gtk.StringList();
        stringlist.append(_("Show SystemIndicator"));
        stringlist.append(_("Use notifications"));
        stringlist.append(_("Use logging"));
        stringlist.append(_("Use colors"));
        adwrow.set_model(stringlist);

        groupC1.add(adwrow);
        adwrow.set_selected(window._settings.get_int("quicksettings-toggle"));
        adwrow.connect("notify", this._onQSToggleValuechanged.bind(this, window._settings, adwrow));
        //show systemindicator
        let adwexprow = new Adw.ExpanderRow({
            title: _("Show SystemIndicator"),
        });
        adwexprow.set_tooltip_text(_("Toggle to show systemindicator"));
        groupC1.add(adwexprow);
        window._settings.bind("show-systemindicator", adwexprow, "active", Gio.SettingsBindFlags.DEFAULT);
        const toggleshowsystemindicator = new Gtk.Switch({
            active: window._settings.get_boolean("show-systemindicator"),
            valign: Gtk.Align.CENTER,
        });
        window._settings.bind(
            "show-systemindicator",
            toggleshowsystemindicator,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );
        adwexprow.add_suffix(toggleshowsystemindicator);
        adwexprow.set_expanded(toggleshowsystemindicator.get_active());
        adwexprow.activatable_widget = toggleshowsystemindicator;
        toggleshowsystemindicator.bind_property("active", adwexprow, "expanded", GObject.BindingFlags.DEFAULT);
        // hide when disconnected
        adwrow = new Adw.SwitchRow({
            title: _("Hide when disconnected"),
            subtitle: _("Hide the systemindicator when no headset is connected"),
        });
        adwrow.set_tooltip_text(
            _("Will be delayed by refresh interval - can be enforced by toggling the quicksettings")
        );
        adwexprow.add_row(adwrow);
        window._settings.bind("hidewhendisconnected-systemindicator", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        // refresh interval
        let adwrowSR = this.addSpinRow(
            adwexprow,
            _("Refresh interval (minutes)"),
            _("Refresh the systemindicator every X minutes"),
            _("0 to disable"),
            [0, 60, 1, 10],
            this.getSettings().get_int("refreshinterval-systemindicator")
        );
        adwrowSR.connect("changed", this._onRIvaluechanged.bind(this, adwrowSR));
        //use notifications
        adwrow = new Adw.SwitchRow({ title: _("Use notifications") });
        adwrow.set_tooltip_text(_("Enable / disable notifications"));
        groupC1.add(adwrow);
        window._settings.bind("use-notifications", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        //use logging
        adwrow = new Adw.SwitchRow({ title: _("Use logging") });
        adwrow.set_tooltip_text(_("Enable / disable log outputs"));
        groupC1.add(adwrow);
        window._settings.bind("use-logging", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        // groupC2
        const groupC2 = Adw.PreferencesGroup.new();
        groupC2.set_title(_("Colors"));
        groupC2.set_name("headsetcontrol_colors");
        page2.add(groupC2);
        //use colors
        adwexprow = new Adw.ExpanderRow({ title: _("Use colors") });
        adwexprow.set_tooltip_text(_("Enable / disable text colors"));
        groupC2.add(adwexprow);
        const toggleusecolors = new Gtk.Switch({
            active: window._settings.get_boolean("use-colors"),
            valign: Gtk.Align.CENTER,
        });
        window._settings.bind("use-colors", toggleusecolors, "active", Gio.SettingsBindFlags.DEFAULT);
        adwexprow.add_suffix(toggleusecolors);
        adwexprow.set_expanded(toggleusecolors.get_active());
        adwexprow.activatable_widget = toggleusecolors;
        toggleusecolors.bind_property("active", adwexprow, "expanded", GObject.BindingFlags.DEFAULT);
        // color high charge
        const mycolor = new Gdk.RGBA();
        adwrow = new Adw.ActionRow({
            title: _("Color battery charge high"),
        });
        adwrow.set_tooltip_text(_("The text color for battery charge 100% to 50%"));
        adwexprow.add_row(adwrow);
        const colorbatteryhigh = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
        });

        mycolor.parse(window._settings.get_string("color-batteryhigh"));
        colorbatteryhigh.set_rgba(mycolor);
        colorbatteryhigh.connect("color-set", this._onColorChanged.bind(this, colorbatteryhigh, "color-batteryhigh"));
        adwrow.add_suffix(colorbatteryhigh);
        adwrow.activatable_widget = colorbatteryhigh;
        // color medium charge
        adwrow = new Adw.ActionRow({
            title: _("Color battery charge medium"),
        });
        adwrow.set_tooltip_text(_("The text color for battery charge 49% to 25%"));
        adwexprow.add_row(adwrow);
        const colorbatterymedium = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
        });

        mycolor.parse(window._settings.get_string("color-batterymedium"));
        colorbatterymedium.set_rgba(mycolor);
        colorbatterymedium.connect(
            "color-set",
            this._onColorChanged.bind(this, colorbatterymedium, "color-batterymedium")
        );
        adwrow.add_suffix(colorbatterymedium);
        adwrow.activatable_widget = colorbatterymedium;
        // color low charge
        adwrow = new Adw.ActionRow({
            title: _("Color battery charge low"),
        });
        adwrow.set_tooltip_text(_("The text color for battery charge 24% to 0%"));
        adwexprow.add_row(adwrow);
        const colorbatterylow = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
        });

        mycolor.parse(window._settings.get_string("color-batterylow"));
        colorbatterylow.set_rgba(mycolor);
        colorbatterylow.connect("color-set", this._onColorChanged.bind(this, colorbatterylow, "color-batterylow"));
        adwrow.add_suffix(colorbatterylow);
        adwrow.activatable_widget = colorbatterylow;
        // groupC3
        const groupC3 = Adw.PreferencesGroup.new();
        groupC3.set_title(_("Equalizer"));
        groupC3.set_name("headsetcontrol_equalizer");
        page2.add(groupC3);
        //equalizer
        const adwexprowEQ = new Adw.ExpanderRow({
            title: _("Equalizer settings"),
        });
        adwexprowEQ.set_tooltip_text(_("Equalizer options (equalizer might not be supported by your headset)"));
        let arrayEQsettings = window._settings.get_strv("option-equalizer-settings");
        groupC3.add(adwexprowEQ);
        const equalizerLabels = [_("Setting 1"), _("Setting 2"), _("Setting 3"), _("Setting 4")];
        for (const [index, label] of equalizerLabels.entries()) {
            if (arrayEQsettings[index] !== -1) {
                let adwrowEQ = this.addEqualizerRow(
                    adwexprowEQ,
                    label,
                    _("Passed to headsetcontrol as parameter to equalizer option (when supported)"),
                    arrayEQsettings[index]
                );
                adwrowEQ.connect(
                    "changed",
                    this._onEQvaluechanged.bind(this, adwrowEQ, index, "option-equalizer-settings")
                );
            }
        }
        //equalizer preset
        const adwexprowEQP = new Adw.ExpanderRow({
            title: _("Equalizer presets"),
        });
        adwexprowEQP.set_tooltip_text(
            _("Names of the equalizer presets (equalizer preset might not be supported by your headset)")
        );
        const arrayEQPnames = window._settings.get_strv("equalizer-preset-names");
        groupC3.add(adwexprowEQP);
        const equalizerPresetLabels =
            !arrayEQPnames || arrayEQPnames.length === 0
                ? [_("Default"), _("Preset 1"), _("Preset 2"), _("Preset 3")]
                : arrayEQPnames;
        for (const [index, label] of equalizerPresetLabels.entries()) {
            if (arrayEQPnames[index] !== -1) {
                let adwrowEQP = this.addEqualizerRow(
                    adwexprowEQP,
                    label,
                    _("Shown in equalizer preset menu (when supported)"),
                    arrayEQPnames[index]
                );
                adwrowEQP.connect(
                    "changed",
                    this._onEQvaluechanged.bind(this, adwrowEQP, index, "equalizer-preset-names")
                );
            }
        }
        // groupC4
        const groupC4 = Adw.PreferencesGroup.new();
        groupC4.set_title(_("Sidetone"));
        groupC4.set_name("headsetcontrol_sidetone");
        page2.add(groupC4);
        //sidetone
        const adwexprowST = new Adw.ExpanderRow({
            title: _("Values for sidetone"),
        });
        adwexprowST.set_tooltip_text(_("Off Low Medium High Maximum (-1 disable)"));
        let arraySidetone = window._settings.get_strv("sidetone-values");
        groupC4.add(adwexprowST);
        const sidetoneLabels = [
            _("Value for Off"),
            _("Value for Low"),
            _("Value for Medium"),
            _("Value for High"),
            _("Value for Maximum"),
        ];

        for (const [index, label] of sidetoneLabels.entries()) {
            if (arraySidetone[index] !== -1) {
                adwrowSR = this.addSpinRow(
                    adwexprowST,
                    label,
                    _("Input for headsetcontrol sidetone command"),
                    _("-1 to disable"),
                    [-1, 128, 1, 1],
                    arraySidetone[index]
                );
                adwrowSR.connect("changed", this._onSTvaluechanged.bind(this, adwrowSR, index));
            }
        }
        window.add(page2);
    }
}
