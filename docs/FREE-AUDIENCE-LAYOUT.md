# Free audience layout / Slobodan raspored

## English

1. Open **Output window & layout** in Control and switch on **Free layout**.
2. Choose **Timer 1**, **Timer 2** (when enabled), **Title**, **Message**, **NOW / NEXT**, or **Progress bar** under **Element**.
3. Use the shared **X**, **Y** and **Size** sliders, or enter exact values in the numeric fields. X and Y refer to the entire output: 0 is the center, and −100 / +100 is the relevant edge. An element can cross the old divider; only the outer edge can clip it. **Reset position and size** resets just the selected element.

The background, including the existing transparency setting, is separate from the movable foreground. The layout follows the desktop audience window and the view-only browser/OBS source. Title, message, NOW/NEXT and progress still use their existing visibility controls. BLACKOUT can use a full black screen or hide foreground content while keeping the background/transparency. Choose the behavior in Colors → BLACKOUT. Control and the phone remote are not redesigned.

The option is for one audience canvas, with one or two timers; two independently routed physical outputs keep their existing per-window placement controls. Free positions are saved separately from the standard left/right and top/bottom layouts. Turning off Free layout restores the prior split and its settings; no countdown is restarted.

For a countdown over a clock: turn on **Show second timer**, choose **Clock** in the **Timer 2** section, then position each timer with **Free layout**. Both timer sections have their own Start/Pause, Reset, Countdown/Stopwatch/Clock mode, duration, presets, End at and at-zero options. The ± adjustments work in countdown mode. Warning thresholds and colors are shared and grouped together; BLACKOUT still affects both outputs.

## Srpski

1. U kontroli otvori **Izlazni prozor i raspored** i uključi **Slobodan raspored**.
2. Pod **Element** izaberi tajmer, naslov, poruku, SADA / SLEDI ili traku napretka.
3. Klizačima ili upisom broja podesi X, Y i veličinu. Nula je centar celog izlaza, a −100 i +100 su ivice. Prelazak preko sredine više ne seče element. **Vrati položaj i veličinu** vraća samo izabrani element.

Pozadina je odvojena od sadržaja koji pomeraš. Raspored važi i za browser prikaz / OBS. Dva odvojena fizička izlaza zadržavaju postojeća podešavanja. Isključi opciju za povratak na prethodnu podelu; slobodan raspored ostaje sačuvan. Odbrojavanje, BLACKOUT i QR nisu vezani za pomeranje elemenata.

Za odbrojavanje iznad sata: uključi **Prikaži drugi tajmer**, izaberi **Sat** u sekciji **Tajmer 2**, pa podesi oba položaja kroz **Slobodan raspored**. Oba tajmera imaju svoj Start/Pauzu, Reset, režim, trajanje, presete, „Kraj u” i opcije za nulu. Dugmad ± rade u odbrojavanju. Pragovi i boje upozorenja su zajedno i važe za oba tajmera; BLACKOUT je zajednički.

## Visibility and BLACKOUT in 2.5.3

Checking **Show second timer** reveals both timers. Stream Deck LIVE T1, LIVE T2 and LIVE T1+T2 select the current session's audience view. Reopening ProTimer starts with the enabled timers visible and the audience windows closed until sent.

In **Colors → BLACKOUT**, select **Black screen** (the default) or **Hide content · keep background**. The latter hides both timers, title, message, NOW/NEXT, progress and QR. With transparency on, the audience overlay is fully transparent, allowing your underlying presentation or OBS scene to remain visible. With a solid background, that color stays visible. BLACKOUT leaves both timer engines running. Press BLACKOUT again, BLACK OFF or a LIVE send command to restore the picture.

**Srpski.** Uključivanje opcije **Prikaži drugi tajmer** otkriva oba tajmera. LIVE T1/T2 bira prikaz u tekućoj sesiji. U **Boje → BLACKOUT** izaberi **Crn ekran** ili **Sakrij sadržaj · zadrži pozadinu**. Druga opcija skriva sve elemente za publiku uz očuvanu boju ili providnost. Odbrojavanje nastavlja. Ponovni pritisak BLACKOUT, BLACK OFF ili LIVE slanje vraća sliku.
