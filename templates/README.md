# ProTimer Templates

## Conference Rundown

[`conference-rundown.csv`](conference-rundown.csv) is a practical sample run of show.

1. Open the CSV in Excel, Numbers, or Google Sheets.
2. Edit the session names, durations, notes, and optional colors.
3. Copy the rows you want to import. The header can stay selected; ProTimer skips it because it has no valid duration.
4. In ProTimer, click an empty part of the Rundown card and paste.

Accepted column order:

```text
Name, Duration, Optional note, Optional #RRGGBB color
```

Accepted duration formats include minutes (`10`), `MM:SS` (`10:00`), and `HH:MM:SS` (`01:10:00`). Tab-separated rows copied directly from a spreadsheet work too.

## OBS Browser Source

Use [`OBS-BROWSER-SOURCE-CHECKLIST.md`](OBS-BROWSER-SOURCE-CHECKLIST.md) to set up and rehearse a transparent timer overlay, phone remote, and network connection.

## Bitfocus Companion

The dedicated [ProTimer Companion module](https://github.com/srdjankotarlic/companion-module-protimer) includes starter presets for transport, GO, time adjustment, blackout, and speaker messages. Generic HTTP remains available if you do not want to install a developer module.
