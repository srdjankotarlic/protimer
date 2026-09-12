# Rundown and connection panels

Included in ProTimer 2.3.0. The familiar two-column Control layout and all previous timer/output settings remain available, with clearer labels and a calmer dark finish.

## Rundown

- **Start rundown** starts the first item when no item is loaded. Once an item is active, the same button becomes **Pause / Resume**. It does not restart the show on every click.
- **Next (N)** immediately starts the next item. **Previous**, **From first**, **Load**, **Run** and **Reset item** request confirmation before replacing a running timer.
- Clicking a row only **selects** it. The blue selection is independent of the green current item. Use the selected-item toolbar to load, run, edit, duplicate or delete it.
- **Load** prepares an item without starting it. **Run** starts the selected item. Neither merely selecting nor editing a row changes the live countdown.
- Editing the active item's name, note or color updates the rundown immediately. A changed duration takes effect when that item is loaded again; the live deadline stays unchanged.
- Active running items cannot be deleted. Pause first. **Undo delete** restores the most recently deleted item. Moving, duplicating and restoring rows preserve the active item's identity.
- **Schedule** contains the planned start, **Now**, **Clear**, total duration and planned finish. The ahead/behind indicator starts after the rundown actually runs, not after a row is selected.
- **Add** opens the name, hours/minutes/seconds, note and color editor. Rows keep a fixed readable height and the list scrolls. **Show current** brings the active row back into view.
- Auto-advance and NOW/NEXT on the output remain available. CSV/import buttons are not restored; existing spreadsheet paste still works.

## Connect & share

Click a section heading to expand its controls. Phone control starts expanded; the other local roles, online sharing, integrations and troubleshooting stay compact until needed.

| Section | Purpose | Who should get the link? |
| --- | --- | --- |
| Phone control | Start/pause, time adjustment, messages and other timer commands | Operator only; contains a control key |
| Timer · audience / OBS | View-only timer; paste into OBS Browser Source | Audience / viewing devices |
| Backstage · crew | Current/next item, notes and schedule; no control buttons | Crew; check notes before sharing |
| Online timer / Online control | Equivalent views through a temporary internet tunnel | Public viewer vs private operator link, clearly separated |
| Companion / Stream Deck / OSC | Computer address, actual HTTP/OSC ports, HTTP command example | Trusted control systems only |

**Local check** verifies that this computer can reach its own server on the selected address. It does not prove a phone can reach it. The connection count includes open views/OBS and is not a count of physical phones.

Copy buttons report success only after clipboard confirmation. On failure, the URL can still be selected and copied manually. Copying the HTTP command does not execute it; opening that URL does toggle Start/Pause.

**Show QR** opens a labeled, closeable QR next to its section. Only view-only Timer/Backstage QR codes offer **Show QR to audience**. That explicit action opens the output on the monitor selected in Control. **Hide QR from screen** restores the timer. Changing the local address or stopping online sharing removes affected obsolete audience QR codes.

Online sharing uses an experimental third-party service and requires internet on both devices. Public links also expose the rundown and notes; do not use confidential data. The public viewer link does not include the private control key. Stop sharing when finished. Scan a new private QR after an app restart or network change.

OSC is unauthenticated: use a trusted local network. Its port is displayed dynamically, not assumed to be 7879. `adjust` takes seconds; `setDuration` takes milliseconds.

## Kratko uputstvo (SR)

- **Rundown:** Start → Pauza → Nastavi. Klik na stavku je samo izbor, ne prekida tajmer. Izabranu stavku možeš pripremiti, pokrenuti, urediti, duplirati ili obrisati. Aktivnu prvo pauziraj pre brisanja; poslednje brisanje možeš vratiti.
- **Raspored:** otvori planirani početak, ukupno trajanje i planirani kraj. Sledeća (`N`) odmah prelazi dalje; reset i zamena aktivnog tajmera traže potvrdu dok radi.
- **Povezivanje i deljenje:** klikni naziv odeljka. Kontrola telefonom je privatna; Tajmer / OBS i Backstage služe za praćenje. QR za kontrolu ne prikazuje se publici.
- **Proveri lokalni server:** rezultat potvrđuje odgovor na računaru, ne pristup telefona. Na samom telefonu obavezno probaj Start/Pauzu pre nastupa.
- **Online:** odvojeni su javni tajmer i privatna kontrola. Potreban je internet. Usluga je eksperimentalna, a javno deljenje otkriva i rundown/beleške.
- **Companion / OSC:** koristi stvarne portove prikazane u aplikaciji. Privatna HTTP komanda sadrži ključ; njeno otvaranje pokreće/pauzira tajmer, kopiranje ne.
- **Bez automatskog izlaza:** pokretanje aplikacije i korišćenje rundown-a/mrežnog panela ne otvaraju izlazni prozor. Otvaraš ga eksplicitno iz Kontrole.
