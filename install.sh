#!/bin/bash

# glib-compile-schemas HeadsetControl\@lauinger-clan.de/schemas/

cd HeadsetControl\@lauinger-clan.de
gnome-extensions pack --podir=../po/ --out-dir=../ --extra-source=../LICENSE --force
cd ..

case "$1" in
  zip|pack)
    echo "Extension zip created ..."
    ;;
  install)
    gnome-extensions install HeadsetControl\@lauinger-clan.de.shell-extension.zip --force
    gnome-extensions enable HeadsetControl\@lauinger-clan.de
    ;;
  upload)
    gnome-extensions upload HeadsetControl\@lauinger-clan.de.shell-extension.zip
    ;;
  *)
    echo "Usage: $0 {zip|pack|install|upload}"
    exit 1
    ;;
esac