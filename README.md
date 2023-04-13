# gnome-shell-extension-HeadsetControl

Gnome Shell Extension to visualize headset status from HeadsetControl (https://github.com/Sapd/HeadsetControl) command line tool

# GNOME43+

![Screenshot](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/blob/main/screenshot_4x.png)

# GNOME 42

![Screenshot](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/blob/main/screenshot_42.png)

Inspired by https://github.com/centic9/headset-charge-indicator/

# Building HeadsetControl

Follow the instructions at https://github.com/Sapd/HeadsetControl/ for building the binary and note down the path to it.

You can test the helper application manually via headsetcontrol -b, this should print the current battery level to the console if your headset is supported.

Make sure you have gnome-icon-theme package installed.

# 1 click install from E.G.O:

[<img src="https://www.lauinger-clan.de/pics/get-it-on-ego.png" height="125">](https://extensions.gnome.org/extension/5823/headsetcontrol)

### Download latest release

1. Download the zip file from the [release page](https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl/releases)
2. The md5 and sig files can be used to verify the integrity of the zip file
3. Unzip and run install.sh from the zip

### Install from source

Use the `main` branch.

```bash
git clone https://github.com/ChrisLauinger77/gnome-shell-extension-HeadsetControl.git
cd gnome-shell-extension-HeadsetControl.git
./install.sh
```

Now restart gnome-shell.

# Development

Pull requests are welcome.

To update the translation files run
`./update-translation-po-files.sh` in the extensions directory after your code changes are finished. This will update the files in po folder.
Then poedit (https://poedit.net/download) can be used to translate the strings. poedit can also be used to create new localization files.
