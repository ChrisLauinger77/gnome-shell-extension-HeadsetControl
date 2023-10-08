#!/bin/bash

reffile=HeadsetControl.pot

xgettext --from-code=UTF-8 --output=po/"$reffile" HeadsetControl\@lauinger-clan.de/*.js HeadsetControl\@lauinger-clan.de/schemas/*.xml

cd po

for pofile in *.po
	do
		echo "Updating: $pofile"
		msgmerge -U "$pofile" "$reffile"
	done

rm *.po~
echo "Done."

