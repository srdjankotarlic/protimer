# Two timers on two displays

Available in ProTimer 2.4.0. All previous controls and the shared two-timer view remain available.

The regression suite exercises two actual Electron output windows, independent opening/closing/fullscreen/sizing, clock preservation, shared blackout, persisted settings, combined-layout restoration and Serbian/English layouts at 820/1120 pixels. Display routing and unplug/retarget races are also covered with a simulated three-display setup. Always test your actual televisions and connections before a live show.

Both televisions must be connected to the same computer and configured as **extended displays**, not mirrored displays. ProTimer lists the displays reported by the operating system; a mirrored HDMI splitter cannot provide two independent pictures.

1. In **Two timers**, enable **Show second timer**.
2. Set **Display** to **On two separate screens**.
3. Select the first TV in the top **Timer 1 to** selector and click **Send to screen**.
4. In the Two timers panel, select the second TV under **Timer 2** and click **Send Timer 2**.
5. Use each output's own fullscreen and close buttons. Closing a window does not stop either timer. Sending it again shows the same countdown, not a restarted timer.

No audience window opens at application startup, even when separate mode is saved. Selecting separate mode also does not open a window. Connecting an additional display does not move an existing separate output; disconnecting a target closes its output instead of intentionally moving it to another audience display. Reconnect and explicitly send it again.

## Existing controls

- Main transport and rundown still control Timer 1. Timer 2 retains its independent duration/start/pause/reset. Start/Pause/Reset both still work.
- **Together on one screen** restores the existing left/right or top/bottom split. Timer values and independent digit layouts are preserved.
- Under **Output window and digits**, choose **Window → Timer 1 / Timer 2** to apply an exact resolution to that output. The **Adjust digits** selector continues to select the timer whose scale and position you are editing.
- Frameless mouse movement/resizing and fullscreen from Control remain available. Grid still positions each open output in the selected grid cell of its own display. Grid, colors, transparency, warnings, speaker message and blackout are shared settings.
- Text, text-only mode, rundown NOW/NEXT and audience QR remain on the first output. A QR does not replace the second timer.
- OBS/browser links, phone control and Backstage are unchanged. Viewer links keep the combined timer view; this feature routes the two local desktop windows, not new network streams.

## Kratko uputstvo (SR)

U **Dva tajmera** uključi drugi tajmer, pa izaberi **Prikaz → Na dva odvojena ekrana**. Tajmer 1 pošalji na prvi televizor gornjim komandama. U istom odeljku izaberi drugi televizor i klikni **Pošalji Tajmer 2**. Svaki ekran ima svoje dugme za pun ekran i zatvaranje. Zatvaranje prozora ne prekida odbrojavanje.

Opcija **Zajedno na jednom ekranu** čuva prethodni prikaz sa podelom levo/desno ili gore/dole. U odeljku za veličinu prozora izaberi koji prozor podešavaš; za skalu i položaj cifara koristi postojeći izbor Tajmer 1 / Tajmer 2. Boje, upozorenja, poruka i BLACKOUT važe za oba ekrana. Tekst, NOW/NEXT i QR ostaju na prvom ekranu. OBS, telefon i ostale postojeće funkcije nisu uklonjeni.

Televizori moraju biti podešeni kao **prošireni**, ne preslikani ekrani. Ako koristiš običan HDMI splitter koji duplira istu sliku, računar neće videti dva nezavisna izlaza.
