# Output layout, two timers and phone control

These controls are available in ProTimer 2.2.0 for macOS Apple Silicon and Windows x64.

## Control-only startup (2.2.1)

Opening ProTimer opens **Control only**, even with saved Grid, transparency, output-size or dual-timer preferences. Choose a monitor and click **Send to screen** when ready. Closing the output leaves it closed until an explicit output action. **Apply size** and **Show QR to audience** can also open it. Phone/OBS/browser viewing is independent of this desktop window and remains available.

## Exact output size

In **OUTPUT WINDOW & DIGITS**, enter Width and Height, then **Apply size**. Full HD and HD presets fill and apply 1920 × 1080 and 1280 × 720. The current output size is reported below the inputs.

Dimensions are **logical content pixels**, the same coordinate space used by web/OBS layouts. A Retina or Windows-scaled display may render several physical pixels per logical pixel. Fullscreen follows the selected monitor’s native desktop size instead of the window-size fields.

Applying a size leaves fullscreen and turns off Grid and Compact sizing. You can still drag and resize the frameless window with the mouse. Fullscreen is controlled with **F** or the fullscreen button in Control.

## Digit scale and position

Use **Digit size (%)** to resize the text without resizing the output window. Use **Left/right** and **Up/down** to position it; 0 is centered. Offsets are percentages of the timer pane, so the composition adapts to a phone or a differently sized OBS source. Numeric inputs allow 0.1% positioning steps. **Center · 100%** resets the selected timer.

The operator’s timer preview remains large and centered. Only the audience/OBS/browser output is transformed. Large scale or offsets can intentionally move digits beyond the visible area; use Reset to recover them.

## Two independent timers

Enable **Show second timer** and choose **Left/right** (vertical divider) or **Top/bottom** (horizontal divider). Click the Timer 2 duration to enter hours, minutes and seconds.

- Main START, keyboard shortcuts and rundown still control Timer 1.
- Timer 2 has separate Start/Pause and Reset controls.
- Start both, Pause both and Reset both operate the pair.
- Select Timer 1 or Timer 2 in the digit-layout selector to adjust each independently.
- Turning off Timer 2 pauses it. Saved durations/layouts survive relaunch; running timers never resume automatically.

Compact automatic window sizing is unavailable in dual mode. Blackout and audience QR cover the whole output; speaker messages and NOW/NEXT remain shared overlays.

## Phone control before a show

1. Start ProTimer on the computer and keep it awake.
2. Connect the phone and computer to the same private network. Select the appropriate computer address in **NETWORK → OBS · PHONE** if there are multiple adapters.
   Use **Check local address** to confirm the server responds at that address on the computer. A successful check does not prove the phone can reach it: a firewall or Wi-Fi client isolation can still block another device.
3. Scan the **Remote** QR — not the audience **Screen** QR. Open it in Safari/Chrome and wait for the green live indicator. Test Start and Pause before the show.
4. Allow ProTimer in the computer’s local-network permissions/firewall. Avoid guest Wi-Fi with client isolation; check whether a VPN is routing local traffic elsewhere. Do not disable the firewall globally.
5. If direct local access is unavailable, enable **Share online** and scan **Private online control**. Both devices need internet. Keep this token-bearing link private; anyone who has it can control the show. Only audience/view-only QR codes can be put on the output.

The remote verifies control permission before enabling buttons. Invalid or old links show instructions to scan a new QR. Transient failures reconnect automatically; **Reconnect** requests fresh state immediately. Commands that fail show a warning and are not silently retried, since repeating a toggle/adjustment could alter the show twice.

Scan a **new** control QR after restarting ProTimer. Online URLs are temporary and stop working when sharing stops or the app closes. ProTimer cannot override a venue’s network isolation, firewall or lack of internet. Rehearse on the actual show network; a local connection generally has less latency than an internet tunnel.

If **Share online** fails while local control works, the network may block temporary tunnel hostnames through its DNS policy. ProTimer does not change or bypass that policy. Ask the network administrator to permit the service, or test on an approved network. Do not rely on online sharing as the only control path for a show.

Online startup deliberately waits at least 15 seconds after a Quick Tunnel registers before checking its hostname, to avoid caching a premature “domain not found” response. The link is shown only after both connectivity checks succeed; you can cancel startup at any time.

## Kratko uputstvo (SR)

- **Pokretanje od 2.2.1:** otvara se samo Kontrola. Izaberi monitor i klikni **Pošalji na ekran** kada si spreman. Primeni veličinu i Prikaži QR publici takođe mogu otvoriti izlaz; OBS/telefon rade nezavisno od desktop prozora.
- **IZLAZNI PROZOR I CIFRE:** unesi širinu i visinu, pa Primeni veličinu. To su logički pikseli sadržaja; Retina/Windows skaliranje može razlikovati fizičku rezoluciju.
- **Veličina cifara / Levo–desno / Gore–dole:** menjaju samo izlaz. Pregled u kontroli ostaje centriran.
- **DVA TAJMERA:** uključi drugi tajmer, unesi mu trajanje i izaberi podelu. Svaki ima zasebne kontrole; postoje i komande za oba zajedno.
- **Telefon:** izaberi ispravnu mrežu, klikni **Proveri lokalnu adresu** i skeniraj Daljinski QR. Provera potvrđuje odgovor na računaru, ne pristup sa telefona. Na Mac-u proveri System Settings → Privacy & Security → Local Network → ProTimer. Ako venue Wi-Fi blokira lokalne uređaje, uključi Deli online i koristi **Privatnu online kontrolu** uz internet na oba uređaja. Taj link ne deli publici.
- Posle restarta aplikacije skeniraj novi QR. Pre nastupa obavezno probaj Start/Pauzu preko stvarne mreže na lokaciji.
