const { Gio, Adw, Gtk } = imports.gi;
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
    this._settings.set_string(option, text.text);
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
    this.changeOption("headsetcontrol-executable", valueExecutable);
    this.changeOption("option-capabilities", opt_capa);
    this.changeOption("option-battery", opt_bat);
    this.changeOption("option-chatmix", opt_chm);
    this.changeOption("option-sidetone", opt_sto);
    this.changeOption("option-led", opt_led);
    this.changeOption("option-inactive-time", opt_iat);
  }

  fillPreferencesWindow() {
    let adwrow;
    this._page1 = Adw.PreferencesPage.new();
    this._page1.set_title(_("HeadsetControl"));
    this._page1.set_name("headsetcontrol_page");
    this._page1.set_icon_name("preferences-system-symbolic");

    // group1
    let group1 = Adw.PreferencesGroup.new();
    group1.set_title(_("Global"));
    group1.set_name("headsetcontrol_global");
    this._page1.add(group1);
    adwrow = new Adw.ActionRow({ title: _("HeadsetControl executable") });
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
      _("Chatmix"),
      _("parameter to ask for chatmix"),
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

    this._window.set_default_size(675, 800);
    this._window.add(this._page1);
  }
}
