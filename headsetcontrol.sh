#!/bin/bash
# Script to pack, install, or upload the HeadsetControl GNOME Shell extension
extension="HeadsetControl@lauinger-clan.de"
extensionfile=$extension".shell-extension.zip"

echo "Running $0 for $extension with arguments: $@"

case "$1" in
  zip|pack)
    cd $extension
    gnome-extensions pack --podir=../po/ --out-dir=../ --extra-source=./lib --extra-source=./ui/ --extra-source=./icons/ --extra-source=../LICENSE --force
    cd ..
    echo "Extension zip created ..."
    ;;
  install)
    if [ ! -f $extensionfile ]; then
      $0 zip
    fi
    gnome-extensions install $extensionfile --force
    gnome-extensions enable $extension
    echo "Extension zip installed ..."
    ;;
  upload)
    if [ ! -f $extensionfile ]; then
      $0 zip
    fi
    gnome-extensions upload --user ChrisLauinger77 --password-file /mnt/2TB/dev/ego_password $extensionfile
    ;;
  *)
    echo "Usage: $0 {zip|pack|install|upload}"
    exit 1
    ;;
esac