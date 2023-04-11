const { Gio, Adw, Gtk, Gdk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain("HeadsetControl");
const _ = Gettext.gettext;
const g_schema = "org.gnome.shell.extensions.HeadsetControl";

function init() {
  ExtensionUtils.initTranslations("HeadsetControl");
}

// used starting with GNOME 42

function fillPreferencesWindow(window) {
  let adwprefs = new AdwPrefs(g_schema, window);

  return adwprefs.fillPreferencesWindow();
}

class AdwPrefs {
  constructor(schema, window) {
    this._settings = ExtensionUtils.getSettings(schema);
    this._window = window;
    this.filechoosertarget = null;
  }

  changeOption(option, text) {
    this._settings.set_string(option, text);
  }

  _onBtnClicked(btn) {
    let parent = btn.get_root();
    this._filechooser.set_transient_for(parent);

    let allFileFilter = new Gtk.FileFilter();
    this._filechooser.set_filter(allFileFilter);
    allFileFilter.add_pattern("*");

    this._filechooser.title = _("Select headsetcontrol executable");

    this._filechooser.show();
  }

  _onFileChooserResponse(native, response) {
    if (response !== Gtk.ResponseType.ACCEPT) {
      return;
    }
    let fileURI = native.get_file().get_uri().replace("file://", "");

    this.filechoosertarget.text = fileURI;
    this.changeOption("headsetcontrol-executable", fileURI);
  }

  addOptionRow(group, title, tooltip, option) {
    let adwrow = new Adw.ActionRow({ title: _(title) });
    adwrow.set_tooltip_text(_(tooltip));
    group.add(adwrow);
    let valueOption = new Gtk.Entry({
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });
    valueOption.set_text(_(this._settings.get_string(option)));
    adwrow.add_suffix(valueOption);
    return valueOption;
  }

  applyChanges(
    valueExecutable,
    opt_capa,
    opt_bat,
    opt_chm,
    opt_sto,
    opt_led,
    opt_iat
  ) {
    this.changeOption("headsetcontrol-executable", valueExecutable.text);
    this.changeOption("option-capabilities", opt_capa.text);
    this.changeOption("option-battery", opt_bat.text);
    this.changeOption("option-chatmix", opt_chm.text);
    this.changeOption("option-sidetone", opt_sto.text);
    this.changeOption("option-led", opt_led.text);
    this.changeOption("option-inactive-time", opt_iat.text);
  }

  _onColorChanged(color_setting_button, strSetting) {
    this._settings.set_string(
      strSetting,
      color_setting_button.get_rgba().to_string()
    );
  }

  fillPreferencesWindow() {
    let adwrow;
    this._page1 = Adw.PreferencesPage.new();
    this._page1.set_title(_("HeadsetControl"));
    this._page1.set_name("headsetcontrol_page1");
    this._page1.set_icon_name("audio-headset");

    // group1
    let group1 = Adw.PreferencesGroup.new();
    group1.set_title(_("Global"));
    group1.set_name("headsetcontrol_global");
    this._page1.add(group1);
    adwrow = new Adw.ActionRow({ title: _("Command:") });
    adwrow.set_tooltip_text(_("file and path of headsetcontrol executable"));
    group1.add(adwrow);
    let valueExecutable = new Gtk.Entry({
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });

    valueExecutable.set_text(
      _(this._settings.get_string("headsetcontrol-executable"))
    );
    let buttonExecutable = new Gtk.Button({
      label: _("..."),
      valign: Gtk.Align.CENTER,
    });
    buttonExecutable.set_tooltip_text(
      _("Usually located in '/usr/bin' OR '/usr/local/bin'")
    );
    buttonExecutable.connect(
      "clicked",
      this._onBtnClicked.bind(this, buttonExecutable)
    );
    this.filechoosertarget = valueExecutable;
    adwrow.add_suffix(valueExecutable);
    adwrow.add_suffix(buttonExecutable);
    adwrow.activatable_widget = buttonExecutable;

    this._filechooser = new Gtk.FileChooserNative({
      title: _("Select headsetcontrol executable"),
      modal: true,
      action: Gtk.FileChooserAction.OPEN,
    });
    this._filechooser.connect(
      "response",
      this._onFileChooserResponse.bind(this)
    );

    // group2
    let group2 = Adw.PreferencesGroup.new();
    group2.set_title(_("HeadsetControl parameters"));
    group2.set_name("headsetcontrol_parameters");
    this._page1.add(group2);

    let opt_capa = this.addOptionRow(
      group2,
      _("Capabilities"),
      _("parameter to ask for capabilities"),
      "option-capabilities"
    );
    let opt_bat = this.addOptionRow(
      group2,
      _("Battery"),
      _("parameter to ask for battery"),
      "option-battery"
    );
    let opt_chm = this.addOptionRow(
      group2,
      _("Chat-Mix"),
      _("parameter to ask for chat-mix"),
      "option-chatmix"
    );
    let opt_sto = this.addOptionRow(
      group2,
      _("Sidetone"),
      _("parameter to ask for sidetone"),
      "option-sidetone"
    );
    let opt_led = this.addOptionRow(
      group2,
      _("LED"),
      _("passed to headsetcontrol to set for led"),
      "option-led"
    );
    let opt_iat = this.addOptionRow(
      group2,
      _("Inactive time"),
      _("parameter to ask for inactive time"),
      "option-inactive-time"
    );

    adwrow = new Adw.ActionRow({ title: "" });
    group2.add(adwrow);
    let buttonApply = new Gtk.Button({
      label: _("Apply"),
      valign: Gtk.Align.CENTER,
    });
    buttonApply.connect(
      "clicked",
      this.applyChanges.bind(
        this,
        valueExecutable,
        opt_capa,
        opt_bat,
        opt_chm,
        opt_sto,
        opt_led,
        opt_iat
      )
    );
    adwrow.add_suffix(buttonApply);
    adwrow.activatable_widget = buttonApply;

    this._window.set_default_size(675, 630);
    this._window.add(this._page1);
    //page2
    this._page2 = Adw.PreferencesPage.new();
    this._page2.set_title(_("Customization"));
    this._page2.set_name("headsetcontrol_page1");
    this._page2.set_icon_name("preferences-system-symbolic");

    // groupC1
    let groupC1 = Adw.PreferencesGroup.new();
    groupC1.set_title(_("Options"));
    groupC1.set_name("headsetcontrol_options");
    this._page2.add(groupC1);
    //show systemindicator
    adwrow = new Adw.ActionRow({ title: _("Show SystemIndicator") });
    adwrow.set_tooltip_text(_("Toggle to show systemindicator"));
    groupC1.add(adwrow);
    let togglesystemindicator = new Gtk.Switch({
      active: this._settings.get_boolean("show-systemindicator"),
      valign: Gtk.Align.CENTER,
    });
    this._settings.bind(
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
      active: this._settings.get_boolean("use-notifications"),
      valign: Gtk.Align.CENTER,
    });
    this._settings.bind(
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
      active: this._settings.get_boolean("use-logging"),
      valign: Gtk.Align.CENTER,
    });
    this._settings.bind(
      "use-logging",
      toggleuselogging,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwrow.add_suffix(toggleuselogging);
    adwrow.activatable_widget = toggleuselogging;
    //use colors
    adwrow = new Adw.ActionRow({ title: _("Use colors") });
    adwrow.set_tooltip_text(_("enable / disable text colors"));
    groupC1.add(adwrow);
    let toggleusecolors = new Gtk.Switch({
      active: this._settings.get_boolean("use-colors"),
      valign: Gtk.Align.CENTER,
    });
    this._settings.bind(
      "use-colors",
      toggleusecolors,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    adwrow.add_suffix(toggleusecolors);
    adwrow.activatable_widget = toggleusecolors;
    // groupC2
    let groupC2 = Adw.PreferencesGroup.new();
    groupC2.set_title(_("Colors"));
    groupC2.set_name("headsetcontrol_colors");
    this._page2.add(groupC2);
    // color high charge
    let mycolor = new Gdk.RGBA();
    adwrow = new Adw.ActionRow({
      title: _("Color battery charge high"),
    });
    adwrow.set_tooltip_text(_("The text color for battery charge 100% to 50%"));
    groupC2.add(adwrow);
    let colorbatteryhigh = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
    });

    mycolor.parse(this._settings.get_string("color-batteryhigh"));
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
    groupC2.add(adwrow);
    let colorbatterymedium = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
    });

    mycolor.parse(this._settings.get_string("color-batterymedium"));
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
    groupC2.add(adwrow);
    let colorbatterylow = new Gtk.ColorButton({
      valign: Gtk.Align.CENTER,
    });

    mycolor.parse(this._settings.get_string("color-batterylow"));
    colorbatterylow.set_rgba(mycolor);
    colorbatterylow.connect(
      "color-set",
      this._onColorChanged.bind(this, colorbatterylow, "color-batterylow")
    );
    adwrow.add_suffix(colorbatterylow);
    adwrow.activatable_widget = colorbatterylow;
    this._window.add(this._page2);
  }
}
