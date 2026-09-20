# Two timers on two displays

Available in ProTimer 2.4.0. All previous controls and the shared two-timer view remain available.

**Unreleased improvement:** the instructions below include independent Grid placement and a linked **Adjust screen** selector. In the published 2.4.0 build, Grid is still shared by both outputs.

The regression suite exercises two actual Electron output windows, independent opening/closing/fullscreen/sizing, clock preservation, shared blackout, persisted settings, combined-layout restoration and Serbian/English layouts at 820/1120 pixels. Display routing and unplug/retarget races are also covered with a simulated three-display setup. Always test your actual televisions and connections before a live show.

Both televisions must be connected to the same computer and configured as **extended displays**, not mirrored displays. ProTimer lists the displays reported by the operating system; a mirrored HDMI splitter cannot provide two independent pictures.

1. In **Two timers**, enable **Show second timer**.
2. Set **Display** to **On two separate screens**.
3. Select the first TV in the top **Timer 1 to** selector and click **Send to screen**.
4. In the Two timers panel, select the second TV under **Timer 2** and click **Send Timer 2**.
5. Use each output's own fullscreen and close buttons. Closing a window does not stop either timer. Sending it again shows the same countdown, not a restarted timer.

## Position each timer independently

For example, send Timer 1 to **HP** and Timer 2 to **Philips**, then:

1. In **Output window and digits → Adjust screen**, select **Timer 1**. Width/height, digit scale and left/right/up/down now edit Timer 1 only.
2. In **Grid**, choose a grid size and a cell for that timer. The cell is relative to its own display, not the whole extended desktop.
3. Select **Timer 2** in either **Adjust screen** selector. Both selectors follow the same selection. Choose a different grid, cell, resolution or digit layout; Timer 1 stays unchanged.
4. To position a window freely, turn off its Grid and drag/resize that frameless window with the mouse. **Apply size** also turns off Grid, but only for the selected timer. Fullscreen remains controlled by each output's own **⛶** button in Control; **F** still controls the first output.

The context line names the timer being edited and, when open, its actual display. Selecting an editing target does not move, open or start a timer. Each timer keeps its own Grid on/off state, grid size and cell, exact output size and digit layout when switching modes or restarting. Existing saved 2.4.0 Grid settings are copied to Timer 2 once during migration; subsequent changes are independent.

With **Together on one screen**, there is one window and one Grid, but each timer retains its own digit scale/position. The second window's Grid is kept for the next use of separate mode. With **Show second timer** off, all additional target selectors and Timer 2 controls disappear; the familiar single-timer controls remain.

No audience window opens at application startup, even when separate mode is saved. Selecting separate mode also does not open a window. Connecting an additional display does not move an existing separate output; disconnecting a target closes its output instead of intentionally moving it to another audience display. Reconnect and explicitly send it again.

## Existing controls

- Main transport and rundown still control Timer 1. Timer 2 retains its independent duration/start/pause/reset. Start/Pause/Reset both still work.
- **Together on one screen** restores the existing left/right or top/bottom split. Timer values and independent digit layouts are preserved.
- Under **Output window and digits**, choose **Adjust screen → Timer 1 / Timer 2** to edit that output's exact resolution and digit layout. In combined mode, **Adjust digits** selects the timer within the shared window.
- Frameless mouse movement/resizing and fullscreen from Control remain available. Each separate output has its own Grid placement. Colors, transparency, warnings, speaker message and blackout remain shared settings.
- Text, text-only mode, rundown NOW/NEXT and audience QR remain on the first output. A QR does not replace the second timer.
- OBS/browser links, phone control and Backstage are unchanged. Viewer links keep the combined timer view; this feature routes the two local desktop windows, not new network streams.

## Kratko uputstvo (SR)

U **Dva tajmera** uključi drugi tajmer, pa izaberi **Prikaz → Na dva odvojena ekrana**. Tajmer 1 pošalji na prvi televizor gornjim komandama. U istom odeljku izaberi drugi televizor i klikni **Pošalji Tajmer 2**. Svaki ekran ima svoje dugme za pun ekran i zatvaranje. Zatvaranje prozora ne prekida odbrojavanje.

U **Podesi ekran** izaberi **Tajmer 1** ili **Tajmer 2**. Isti izbor važi za rezoluciju prozora, skalu/položaj cifara i Grid. Svaki tajmer može imati drugi Grid (3×3, 5×5, 7×7 ili 9×9), drugu kockicu i zasebno uključenu/isključenu poziciju. Primena veličine isključuje Grid samo izabranog tajmera. Kada je Grid isključen, njegov prozor slobodno pomeraš i povećavaš mišem. Podešavanja se čuvaju, ali ekrani se ne otvaraju sami pri pokretanju.

Opcija **Zajedno na jednom ekranu** čuva prethodni prikaz sa podelom levo/desno ili gore/dole i jednim zajedničkim Gridom. Kada isključiš drugi tajmer, njegovi dodatni izbori se sakrivaju, a podešavanja ostaju sačuvana. Boje, upozorenja, poruka i BLACKOUT važe za oba ekrana. Tekst, NOW/NEXT i QR ostaju na prvom ekranu. OBS, telefon i ostale postojeće funkcije nisu uklonjeni.

Televizori moraju biti podešeni kao **prošireni**, ne preslikani ekrani. Ako koristiš običan HDMI splitter koji duplira istu sliku, računar neće videti dva nezavisna izlaza.
