# gnome-shell-extension-HeadsetControl

Gnome Shell Extension to visualize headset status from HeadsetControl (https://github.com/Sapd/HeadsetControl) command line tool.

Supported capabilities can also be controlled like ChatMix, Sidetone, Equalizer etc.

# GNOME43+

![Screenshot](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/blob/main/screenshot_4x.png)

![Notification](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/blob/main/screenshot_notify.png)

# GNOME 42

![Screenshot](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/blob/main/screenshot_42.png)

Inspired by https://github.com/centic9/headset-charge-indicator/

# Building HeadsetControl

Follow the instructions at https://github.com/Sapd/HeadsetControl/ for building the binary and note down the path to it.

You can test the helper application manually via headsetcontrol -b, this should print the current battery level to the console if your headset is supported.

Make sure you have gnome-icon-theme package installed.

# 1 click install from E.G.O:

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg" height="125">](https://extensions.gnome.org/extension/5823/headsetcontrol)

### Download latest release

1. Download the zip file from the [release page](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/releases)
2. The md5 and sig files can be used to verify the integrity of the zip file
3. Unzip and run headsetcontrol.sh from the zip

### Install from source

Use the `main` branch.

```bash
git clone https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl.git
cd gnome-shell-extension-HeadsetControl.git
./headsetcontrol.sh install
```

Now restart gnome-shell.

# Contributing

Pull requests are welcome.

To update the translation files run
`./headsetcontrol.sh translate` in the extensions directory after your code changes are finished. This will update the files in po folder.
Then poedit (https://poedit.net/download) can be used to translate the strings. poedit can also be used to create new localization files.

# Debugging

Logging can be enabled in settings.
Afterwards open a console and type:

journalctl -f -o cat

You will see now the output in the console when you try to show the quicksettings.

Fedora has a package for "headsetcontrol" which seems to be outdated.
(see [#14](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/issues/14))

Using the github version until Fedora updates the package is recommended.

# ✨️ Contributors

[![Contributors](https://contrib.rocks/image?repo=ChrisLauinger77/gnome-shell-extension-HeadsetControl)](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/graphs/contributors)
