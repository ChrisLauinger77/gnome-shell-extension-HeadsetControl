import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class AdwPrefs extends ExtensionPreferences {
  changeOption(option, text) {
    this.getSettings().set_string(option, text);
  }

  _onBtnClicked(btn, filechooser) {
    let parent = btn.get_root();
    filechooser.set_transient_for(parent);

    let allFileFilter = new Gtk.FileFilter();
    filechooser.set_filter(allFileFilter);
    allFileFilter.add_pattern("*");

    filechooser.title = _("Select headsetcontrol executable");

    filechooser.show();
  }

  _updateExecutable(valueExecutable) {
    valueExecutable.set_text(
      this.getSettings().get_string("headsetcontrol-executable")
    );
  }

  _onFileChooserResponse(native, response) {
    if (response !== Gtk.ResponseType.ACCEPT) {
      return;
    }
    let fileURI = native.get_file().get_uri().replace("file://", "");

    this.changeOption("headsetcontrol-executable", fileURI);
  }

  addOptionRow(exprow, title, tooltip, option) {
    let adwrow = new Adw.ActionRow({ title: _(title) });
    adwrow.set_tooltip_text(_(tooltip));
    exprow.add_row(adwrow);
    let valueOption = new Gtk.Entry({
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });
    valueOption.set_text(_(this.getSettings().get_string(option)));
    adwrow.add_suffix(valueOption);
    return valueOption;
  }

  applyChanges(
    valueExecutable,
    opt_oformat,
    opt_capa,
    opt_bat,
    opt_chm,
    opt_sto,
    opt_led,
    opt_iat,
    opt_voice,
    opt_rot
  ) {
    this.changeOption("headsetcontrol-executable", valueExecutable.text);
    this.changeOption("option-output-format", opt_oformat.text);
    this.changeOption("option-capabilities", opt_capa.text);
    this.changeOption("option-battery", opt_bat.text);
    this.changeOption("option-chatmix", opt_chm.text);
    this.changeOption("option-sidetone", opt_sto.text);
    this.changeOption("option-led", opt_led.text);
    this.changeOption("option-inactive-time", opt_iat.text);
    this.changeOption("option-voice", opt_voice.text);
    this.changeOption("option-rotate-mute", opt_rot.text);
  }

  _onColorChanged(color_setting_button, strSetting) {
    this.getSettings().set_string(
      strSetting,
      color_setting_button.get_rgba().to_string()
    );
  }

  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    let adwrow;
    const page1 = Adw.PreferencesPage.new();
    page1.set_title(_("HeadsetControl"));
    page1.set_name("headsetcontrol_page1");
    page1.set_icon_name("audio-headset-symbolic");

    // group1
    let group1 = Adw.PreferencesGroup.new();
    group1.set_title(_("Global"));
    group1.set_name("headsetcontrol_global");
    page1.add(group1);
    adwrow = new Adw.ActionRow({ title: _("Command:") });
    adwrow.set_tooltip_text(_("file and path of headsetcontrol executable"));
    group1.add(adwrow);
    let valueExecutable = new Gtk.Entry({
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });

    valueExecutable.set_text(
      window._settings.get_string("headsetcontrol-executable")
    );
    window._settings.connect(
      "changed::headsetcontrol-executable",
      this._updateExecutable.bind(this, valueExecutable)
    );
    let buttonExecutable = new Gtk.Button({
      label: _("..."),
      valign: Gtk.Align.CENTER,
    });
    buttonExecutable.set_tooltip_text(
      _("Usually located in '/usr/bin' OR '/usr/local/bin'")
    );
    adwrow.add_suffix(valueExecutable);
    adwrow.add_suffix(buttonExecutable);
    adwrow.activatable_widget = buttonExecutable;

    let _filechooser = new Gtk.FileChooserNative({
      title: _("Select headsetcontrol executable"),
      modal: true,
      action: Gtk.FileChooserAction.OPEN,
    });
    buttonExecutable.connect(
      "clicked",
      this._onBtnClicked.bind(this, buttonExecutable, _filechooser)
    );
    _filechooser.connect("response", this._onFileChooserResponse.bind(this));

    // group2
    let group2 = Adw.PreferencesGroup.new();
    group2.set_title(_("HeadsetControl parameters"));
    group2.set_name("headsetcontrol_parameters");
    page1.add(group2);
    let expRow1 = Adw.ExpanderRow.new();
    expRow1.set_title(_("HeadsetControl Version Option output format"));
    expRow1.set_subtitle(
      _("used starting with HeadsetControl tool version newer then 2.7.0")
    );
    expRow1.set_expanded(true);
    group2.add(expRow1);
    let opt_oformat = this.addOptionRow(
      expRow1,
      _("Output format"),
      _("parameter to ask for all data in new output format"),
      "option-output-format"
    );
    let expRow2 = Adw.ExpanderRow.new();
    expRow2.set_title(_("HeadsetControl Version Legacy"));
    expRow2.set_subtitle(_("used until HeadsetControl tool version 2.7.0"));
    expRow2.set_expanded(false);
    group2.add(expRow2);
    let opt_capa = this.addOptionRow(
      expRow2,
      _("Capabilities"),
      _("parameter to ask for capabilities"),
      "option-capabilities"
    );
    let opt_bat = this.addOptionRow(
      expRow2,
      _("Battery"),
      _("parameter to ask for battery"),
      "option-battery"
    );
    let opt_chm = this.addOptionRow(
      expRow2,
      _("Chat-Mix"),
      _("parameter to ask for chat-mix"),
      "option-chatmix"
    );
    let opt_sto = this.addOptionRow(
      expRow2,
      _("Sidetone"),
      _("parameter to ask for sidetone"),
      "option-sidetone"
    );
    let opt_led = this.addOptionRow(
      expRow2,
      _("LED"),
      _("passed to headsetcontrol to set for led"),
      "option-led"
    );
    let opt_iat = this.addOptionRow(
      expRow2,
      _("Inactive time"),
      _("parameter to ask for inactive time"),
      "option-inactive-time"
    );
    let opt_voice = this.addOptionRow(
      expRow2,
      _("Voice Prompts"),
      _("passed to headsetcontrol to set for voice prompts"),
      "option-voice"
    );
    let opt_rot = this.addOptionRow(
      expRow2,
      _("Rotate to Mute"),
      _("passed to headsetcontrol to set for rotate to mute"),
      "option-rotate-mute"
    );

    adwrow = new Adw.ActionRow({ title: "" });
    group2.add(adwrow);
    let buttonApply = new Gtk.Button({
      label: _("Apply"),
      css_classes: ["suggested-action"],
      valign: Gtk.Align.CENTER,
    });
    buttonApply.connect(
      "clicked",
      this.applyChanges.bind(
        this,
        valueExecutable,
        opt_oformat,
        opt_capa,
        opt_bat,
        opt_chm,
        opt_sto,
        opt_led,
        opt_iat,
        opt_voice,
        opt_rot
      )
    );
    adwrow.add_suffix(buttonApply);
    adwrow.activatable_widget = buttonApply;

    window.set_default_size(675, 735);
    window.add(page1);
    //page2
    const page2 = Adw.PreferencesPage.new();
    page2.set_title(_("Customization"));
    page2.set_name("headsetcontrol_page1");
    page2.set_icon_name("preferences-system-symbolic");

    // groupC1
    let groupC1 = Adw.PreferencesGroup.new();
    groupC1.set_title(_("Options"));
    groupC1.set_name("headsetcontrol_options");
    page2.add(groupC1);
    //show systemindicator
    adwrow = new Adw.ActionRow({ title: _("Show SystemIndicator") });
    adwrow.set_tooltip_text(_("Toggle to show systemindicator"));
    groupC1.add(adwrow);
    let togglesystemindicator = new Gtk.Switch({
      active: window._settings.get_boolean("show-systemindicator"),
      valign: Gtk.Align.CENTER,
    });
    window._settings.bind(
      "show-systemindicator",
      togglesystemindicator,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwrow.add_suffix(togglesystemindicator);
    adwrow.activatable_widget = togglesystemindicator;
    //use notifications
    adwrow = new Adw.ActionRow({ title: _("Use notifications") });
    adwrow.set_tooltip_text(_("enable / disable notifications"));
    groupC1.add(adwrow);
    let toggleusenotifications = new Gtk.Switch({
      active: window._settings.get_boolean("use-notifications"),
      valign: Gtk.Align.CENTER,
    });
    window._settings.bind(
      "use-notifications",
      toggleusenotifications,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwrow.add_suffix(toggleusenotifications);
    adwrow.activatable_widget = toggleusenotifications;
    //use logging
    adwrow = new Adw.ActionRow({ title: _("Use logging") });
    adwrow.set_tooltip_text(_("enable / disable log outputs"));
    groupC1.add(adwrow);
    let toggleuselogging = new Gtk.Switch({
      active: window._settings.get_boolean("use-logging"),
      valign: Gtk.Align.CENTER,
    });
    window._settings.bind(
      "use-logging",
      toggleuselogging,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwrow.add_suffix(toggleuselogging);
    adwrow.activatable_widget = toggleuselogging;
    // groupC2
    let groupC2 = Adw.PreferencesGroup.new();
    groupC2.set_title(_("Colors"));
    groupC2.set_name("headsetcontrol_colors");
    page2.add(groupC2);
    //use colors
    let adwexprow = new Adw.ExpanderRow({ title: _("Use colors") });
    adwexprow.set_tooltip_text(_("enable / disable text colors"));
    groupC2.add(adwexprow);
    let toggleusecolors = new Gtk.Switch({
      active: window._settings.get_boolean("use-colors"),
      valign: Gtk.Align.CENTER,
    });
    window._settings.bind(
      "use-colors",
      toggleusecolors,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwexprow.add_suffix(toggleusecolors);
    adwexprow.set_expanded(toggleusecolors.get_active());
    adwexprow.activatable_widget = toggleusecolors;
    toggleusecolors.bind_property(
      "active",
      adwexprow,
      "expanded",
      GObject.BindingFlags.DEFAULT
    );
    // color high charge
    let mycolor = new Gdk.RGBA();
    adwrow = new Adw.ActionRow({
      title: _("Color battery charge high"),
    });
    adwrow.set_tooltip_text(_("The text color for battery charge 100% to 50%"));
    adwexprow.add_row(adwrow);
    let colorbatteryhigh = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
    });

    mycolor.parse(window._settings.get_string("color-batteryhigh"));
    colorbatteryhigh.set_rgba(mycolor);
    colorbatteryhigh.connect(
      "color-set",
      this._onColorChanged.bind(this, colorbatteryhigh, "color-batteryhigh")
    );
    adwrow.add_suffix(colorbatteryhigh);
    adwrow.activatable_widget = colorbatteryhigh;
    // color medium charge
    adwrow = new Adw.ActionRow({
      title: _("Color battery charge medium"),
    });
    adwrow.set_tooltip_text(_("The text color for battery charge 49% to 25%"));
    adwexprow.add_row(adwrow);
    let colorbatterymedium = new Gtk.ColorButton({
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
    let colorbatterylow = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
    });

    mycolor.parse(window._settings.get_string("color-batterylow"));
    colorbatterylow.set_rgba(mycolor);
    colorbatterylow.connect(
      "color-set",
      this._onColorChanged.bind(this, colorbatterylow, "color-batterylow")
    );
    adwrow.add_suffix(colorbatterylow);
    adwrow.activatable_widget = colorbatterylow;
    window.add(page2);
  }
}
