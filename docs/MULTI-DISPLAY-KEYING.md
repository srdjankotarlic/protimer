# Multiple audience displays and HDMI keying

[Srpski](#srpski)

## Route timers independently

1. Connect your screens or the switcher's HDMI input and use **Extend** in Windows or **Extended display** in macOS. Each destination needs to appear as a separate display in the operating system. A mirrored output or HDMI splitter shows the same signal on every screen it feeds.
2. Open **Control → Route to multiple displays**. Enable Timer 2 or Timer 3 as needed. Choose one timer, any pair or all three on each row. You can send Timer 3 to a confidence monitor, 1 + 3 to the stage and all three to the director.
3. Pick **Fullscreen** or **Window / Grid** and press **Send** on one row or **Send all assigned**. For a group, select side by side or stacked on that row, or inherit the Control setting. Free layout uses the configured positions. Window / Grid uses the corresponding timer's placement and the target display's work area.
4. Press **Close** on a row to take that display off air. Assignments are saved. Startup and reconnection leave the output closed until you send it. Close an existing standard ProTimer output before sending a routed output to that same display. If a saved display is missing, use the row buttons for connected displays or remove the old assignment before sending all.

Routing projects the same live clocks. Sending or closing a routed output leaves their deadlines intact. The routing table works directly from Control and uses its own assignments. The standard output, OBS viewer and native Stream Deck retain their existing controls.

## Overlay just the digits with a Roland or ATEM

Connect a dedicated computer display output to the switcher. Match the HDMI format and frame rate supported by the chain. Put your presentation or camera feed on the switcher's background bus. In ProTimer select the switcher display, choose **Fullscreen**, then select a keying background and send:

| ProTimer background | Roland V-160HD | ATEM |
| --- | --- | --- |
| **Luma · black** | Choose **DSK 1 or 2 → SELF KEY → luminance (black)**. Select the computer HDMI input as DSK source, preview and adjust LEVEL/GAIN. | In ATEM Software Control, choose **Downstream Keyer** and select the computer HDMI as both Fill Source and Key Source. Use the non-premultiplied controls and adjust Clip/Gain in preview. |
| **Chroma · green** or **Chroma · blue** | Set the DSK to **SELF KEY → chroma** and sample the background from the computer input. | On a compatible upstream keyer, choose **Chroma** and the computer HDMI as Fill Source. Sample the background and refine the key in preview. |

Put the key on program after confirming the digits are clean. The signal contains white digits over a solid color. The switcher generates the matte from luminance or color. Preview the final composition on hardware, since keyer controls, available sources and edge quality depend on the model and signal path. BLACKOUT keeps the key color and hides the digits so the source keys out. For alpha in OBS, keep using its transparent Browser Source option.

[Roland V-160HD keying](https://support.roland.com/hc/en-us/articles/4403317549339-V-160HD-What-kind-of-key-composites-can-I-make-on-this-unit) · [ATEM Mini manual, “Keying using ATEM Mini”](https://documents.blackmagicdesign.com/UserManuals/ATEM_Mini_Manual.pdf)

## Srpski

### Pošalji tajmere na više ekrana

1. Poveži ekrane ili HDMI ulaz svičera i u sistemu izaberi **Proširi ekran**. Svaka destinacija mora da se pojavi kao poseban ekran. HDMI razdelnik šalje istu sliku na sve priključene ekrane.
2. U **Kontrola → Raspodela na više ekrana** za svaki red izaberi jedan tajmer, bilo koja dva ili sva tri. Uključi Tajmer 2 ili 3 po potrebi. Na primer, pošalji Tajmer 3 na monitor za govornike, 1 + 3 na binu i sva tri u režiju.
3. Izaberi **Pun ekran** ili **Prozor / Grid**. Klikni **Pošalji** na pojedinačnom redu ili **Pošalji sve dodeljene**. Podelu za više tajmera biraj na tom redu ili koristi podelu iz Kontrole. Slobodan raspored koristi podešene položaje. Prozor koristi podešavanja odgovarajućeg tajmera.
4. Zatvori pojedinačni izlaz dugmetom **Zatvori**. Dodela se pamti i ponovo se šalje ručno posle pokretanja ili ponovnog priključenja ekrana. Ako je na istom ekranu otvoren običan izlaz ProTimera, prvo ga zatvori. Ako spremljeni ekran nije povezan, šalji pojedinačno ili ukloni njegovu dodelu.

Raspodela radi iz same Kontrole. Slanje i zatvaranje izlaza ne prekidaju odbrojavanje. Običan izlaz, OBS i Stream Deck zadržavaju svoje komande.

### Samo cifre preko prezentacije ili kamere

Uključi HDMI svičera kao prošireni ekran računara. U ProTimeru na tom redu izaberi **Pun ekran → Luma · crna** i klikni **Pošalji**. Prezentaciju ili kameru postavi kao pozadinu na svičeru.

- **Roland V-160HD** — na DSK 1 ili 2 izaberi **SELF KEY**, zatim **luminance black** i HDMI sa tajmerom kao izvor. Uključi Preview, podesi **LEVEL/GAIN**, pa pusti DSK u program.
- **ATEM** — u **ATEM Software Control → Downstream Keyer** izaberi isti HDMI za **Fill Source** i **Key Source**. Isključi **Pre Multiplied Key** ako je uključen i podesi **Clip/Gain** u pregledu.
- Ako koristiš **Chroma**, u ProTimeru izaberi zelenu ili plavu. Na Rolandu koristi DSK Chroma, a na odgovarajućem ATEM-u Upstream Key → Chroma. Uzorkuj boju pozadine sa HDMI izvora i proveri ivice cifara u pregledu.

ProTimer šalje bele cifre na ravnoj pozadini. Svičer uklanja pozadinu. **BLACKOUT** sakriva cifre i zadržava boju za keying. Za transparentan Browser Source u OBS-u i dalje koristi opciju **Providna pozadina (OBS)**.

[Roland V-160HD](https://support.roland.com/hc/en-us/articles/4403317549339-V-160HD-What-kind-of-key-composites-can-I-make-on-this-unit) · [ATEM Mini priručnik](https://documents.blackmagicdesign.com/UserManuals/ATEM_Mini_Manual.pdf)
