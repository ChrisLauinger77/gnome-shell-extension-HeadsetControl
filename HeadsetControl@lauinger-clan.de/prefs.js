"use strict";

import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
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

    _applyChanges(valueExecutable, options) {
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
        const arrayEQsettings = this.getSettings().get_strv(option);
        arrayEQsettings[index] = adwrow.get_text();
        this.getSettings().set_strv(option, arrayEQsettings);
    }

    _onSTvaluechanged(adwrow, index) {
        const arraySidetone = this.getSettings().get_strv("sidetone-values");
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
        const builder = Gtk.Builder.new();
        builder.add_from_file(this.path + "/ui/prefs.ui");
        const page1 = builder.get_object("HeadsetControl_page_headsetcontrol");
        const page2 = builder.get_object("HeadsetControl_page_customization");

        const valueExecutable = builder.get_object("HeadsetControl_row_command");
        valueExecutable.set_text(window._settings.get_string("headsetcontrol-executable"));
        window._settings.connect(
            "changed::headsetcontrol-executable",
            this._updateExecutable.bind(this, valueExecutable)
        );
        const buttonExecutable = builder.get_object("HeadsetControl_row_commandselect");

        const _filechooser = new Gtk.FileChooserNative({
            title: _("Select headsetcontrol executable"),
            modal: true,
            action: Gtk.FileChooserAction.OPEN,
        });
        buttonExecutable.connect("activated", this._onBtnClicked.bind(this, buttonExecutable, _filechooser));
        _filechooser.connect("response", this._onFileChooserResponse.bind(this));

        const opt_oformat = builder.get_object("HeadsetControl_row_outputformat_new2");
        opt_oformat.set_text(_(this.getSettings().get_string("option-output-format")));
        const opt_capa = builder.get_object("HeadsetControl_row_outputformat_old2");
        opt_capa.set_text(_(this.getSettings().get_string("option-capabilities")));
        const opt_bat = builder.get_object("HeadsetControl_row_outputformat_old3");
        opt_bat.set_text(_(this.getSettings().get_string("option-battery")));
        const opt_chm = builder.get_object("HeadsetControl_row_outputformat_old4");
        opt_chm.set_text(_(this.getSettings().get_string("option-chatmix")));
        const opt_sto = builder.get_object("HeadsetControl_row_common2");
        opt_sto.set_text(_(this.getSettings().get_string("option-sidetone")));
        const opt_led = builder.get_object("HeadsetControl_row_common3");
        opt_led.set_text(_(this.getSettings().get_string("option-led")));
        const opt_iat = builder.get_object("HeadsetControl_row_common4");
        opt_iat.set_text(_(this.getSettings().get_string("option-inactive-time")));
        const opt_voice = builder.get_object("HeadsetControl_row_common5");
        opt_voice.set_text(_(this.getSettings().get_string("option-voice")));
        const opt_rot = builder.get_object("HeadsetControl_row_common6");
        opt_rot.set_text(_(this.getSettings().get_string("option-rotate-mute")));
        const opt_equalizer = builder.get_object("HeadsetControl_row_common7");
        opt_equalizer.set_text(_(this.getSettings().get_string("option-equalizer")));
        const opt_equalizer_preset = builder.get_object("HeadsetControl_row_common8");
        opt_equalizer_preset.set_text(_(this.getSettings().get_string("option-equalizer-preset")));
        const buttonApply = builder.get_object("HeadsetControl_row_apply");
        buttonApply.connect(
            "activated",
            this._applyChanges.bind(this, valueExecutable, {
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

        window.set_default_size(675, 735);
        window.add(page1);
        // quicksettings toggle
        adwrow = builder.get_object("HeadsetControl_row_qstoggle");
        adwrow.set_selected(window._settings.get_int("quicksettings-toggle"));
        adwrow.connect("notify", this._onQSToggleValuechanged.bind(this, window._settings, adwrow));
        //show systemindicator
        let adwexprow = builder.get_object("HeadsetControl_row_showindicator1");
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
        adwrow = builder.get_object("HeadsetControl_row_showindicator2");
        window._settings.bind("hidewhendisconnected-systemindicator", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        // refresh interval
        adwrow = builder.get_object("HeadsetControl_row_showindicator3");
        adwrow.set_value(this.getSettings().get_int("refreshinterval-systemindicator"));
        adwrow.connect("changed", this._onRIvaluechanged.bind(this, adwrow));
        // notification for low battery
        adwrow = builder.get_object("HeadsetControl_row_notifications");
        window._settings.bind("notification-low-battery", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        //use logging
        adwrow = builder.get_object("HeadsetControl_row_logging");
        window._settings.bind("use-logging", adwrow, "active", Gio.SettingsBindFlags.DEFAULT);
        //use colors
        adwexprow = builder.get_object("HeadsetControl_row_colors");
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
        adwrow = builder.get_object("HeadsetControl_row_colorhigh");
        const colorbatteryhigh = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
        });

        mycolor.parse(window._settings.get_string("color-batteryhigh"));
        colorbatteryhigh.set_rgba(mycolor);
        colorbatteryhigh.connect("color-set", this._onColorChanged.bind(this, colorbatteryhigh, "color-batteryhigh"));
        adwrow.add_suffix(colorbatteryhigh);
        adwrow.activatable_widget = colorbatteryhigh;
        // color medium charge
        adwrow = builder.get_object("HeadsetControl_row_colormedium");
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
        adwrow = builder.get_object("HeadsetControl_row_colorlow");
        adwexprow.add_row(adwrow);
        const colorbatterylow = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
        });
        mycolor.parse(window._settings.get_string("color-batterylow"));
        colorbatterylow.set_rgba(mycolor);
        colorbatterylow.connect("color-set", this._onColorChanged.bind(this, colorbatterylow, "color-batterylow"));
        adwrow.add_suffix(colorbatterylow);
        adwrow.activatable_widget = colorbatterylow;
        //equalizer
        const arrayEQsettings = window._settings.get_strv("option-equalizer-settings");
        for (const [index, value] of arrayEQsettings.entries()) {
            if (index >= 4) break;
            const adwrowEQ = builder.get_object("HeadsetControl_row_equalizersetting" + (index + 1));
            if (!adwrowEQ) continue; // Prevent TypeError
            adwrowEQ.set_text(_(value));
            adwrowEQ.connect(
                "changed",
                this._onEQvaluechanged.bind(this, adwrowEQ, index, "option-equalizer-settings")
            );
        }
        //equalizer preset
        const arrayEQPnames = window._settings.get_strv("equalizer-preset-names");
        const equalizerPresetLabels =
            !arrayEQPnames || arrayEQPnames.length === 0
                ? [_("Default"), _("Preset 1"), _("Preset 2"), _("Preset 3")]
                : arrayEQPnames;
        for (const [index, value] of equalizerPresetLabels.entries()) {
            if (index >= 4) break;
            const adwrowEQP = builder.get_object("HeadsetControl_row_equalizerpreset" + (index + 1));
            if (!adwrowEQP) continue; // Prevent TypeError
            adwrowEQP.set_text(_(value));
            adwrowEQP.connect("changed", this._onEQvaluechanged.bind(this, adwrowEQP, index, "equalizer-preset-names"));
        }
        //sidetone
        const sidetoneLabels = [
            _("Value for Off"),
            _("Value for Low"),
            _("Value for Medium"),
            _("Value for High"),
            _("Value for Maximum"),
        ];
        for (const [index] of sidetoneLabels.entries()) {
            adwrow = builder.get_object("HeadsetControl_row_sidetone" + (index + 1));
            if (!adwrow) continue; // Prevent TypeError
            adwrow.connect("changed", this._onSTvaluechanged.bind(this, adwrow, index));
        }
        window.add(page2);
    }
}
