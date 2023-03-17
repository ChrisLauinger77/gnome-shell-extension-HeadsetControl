#!/bin/bash

glib-compile-schemas HeadsetControl\@lauinger-clan.de/schemas/

cd HeadsetControl\@lauinger-clan.de
gnome-extensions pack --podir=../po/ --out-dir=../ --extra-source=../LICENSE
cd ..
mv HeadsetControl@lauinger-clan.de.shell-extension.zip HeadsetControl@lauinger-clan.de.zip
gnome-extensions install HeadsetControl\@lauinger-clan.de.zip --force
gnome-extensions enable HeadsetControl\@lauinger-clan.de
