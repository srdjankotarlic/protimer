<p align="center">
  <img src="docs/icon.png" width="96" alt="ProTimer ikonica">
</p>

<h1 align="center">ProTimer</h1>

<p align="center"><strong>Besplatan stage timer za događaje uživo, konferencije, prezentacije i OBS.</strong><br>Nema naloga, pretplate, vodenog žiga ni vremenskog ograničenja.</p>

<p align="center">
  <a href="README.md"><strong>English</strong></a> ·
  <a href="https://srdjankotarlic.github.io/protimer/"><strong>Stranica proizvoda</strong></a> ·
  <a href="https://alternativeto.net/software/protimer/about/"><strong>AlternativeTo</strong></a> ·
  <a href="https://github.com/srdjankotarlic/protimer/discussions"><strong>Zajednica</strong></a> ·
  <a href="#preuzimanje"><strong>Preuzimanje</strong></a> ·
  <a href="#pokretanje-za-60-sekundi"><strong>Brzi početak</strong></a>
</p>

![ProTimer — besplatan stage timer za događaje uživo, OBS, telefone i rundown](docs/og-banner.jpg)

## Preuzimanje

Izaberi samo jedan instalacioni fajl. GitHubovi automatski **Source code** ZIP i TAR.GZ fajlovi nisu aplikacija.

| Računar | Preporučeni fajl |
|---|---|
| Apple Silicon Mac (M1 ili noviji) | **[Preuzmi macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-arm64.dmg)** |
| Windows 10/11 x64 | **[Preuzmi Windows Setup](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-Setup-2.2.1.exe)** |

Za Windows bez instalacije postoji i [portable EXE](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-portable.exe). Za većinu korisnika je bolji Setup.

Svaki instalacioni fajl možeš da proveriš pomoću [ProTimer 2.2.1 SHA-256 checksum liste](https://github.com/srdjankotarlic/protimer/releases/download/v2.2.1/ProTimer-2.2.1-SHA256SUMS.txt).

> Aplikacija još nije digitalno potpisana. Na Windowsu izaberi **More info → Run anyway** samo za fajl preuzet sa ovog repozitorijuma. Na macOS-u, ako je blokirana, otvori **System Settings → Privacy & Security → Open Anyway**.

## Najvažnije u verziji 2.2

- **2.2.1 · Pokretanje samo Kontrole:** izlazni prozor se više ne otvara sam. Ti biraš monitor i klikneš **Pošalji na ekran** kada želiš.
- Unesi tačnu širinu i visinu izlaznog prozora ili izaberi HD / Full HD.
- Povećaj/smanji cifre i pomeri ih levo/desno i gore/dole. Pregled u kontroli ostaje centriran.
- Prikaži **dva nezavisna tajmera**, jedan pored drugog ili jedan iznad drugog, sa zasebnim vremenima i kontrolama.
- Za telefon izaberi mrežnu adresu, klikni **Proveri lokalnu adresu** i skeniraj novi **Daljinski** QR. Kontrola prikazuje greške i ponovo uspostavlja vezu.
- Online deljenje sada čeka da nova adresa bude spremna pre prve provere, kako prerana DNS greška ne bi blokirala povezivanje.

Postojeći rundown, boje, tekst, Grid, pragovi, poruke i Backstage ostaju dostupni. **Online deljenje je i dalje eksperimentalna usluga treće strane** — za nastup obezbedi lokalnu kontrolu i probaj telefon na stvarnoj mreži.

[Uputstvo za nove kontrole i povezivanje telefona](docs/OUTPUT-AND-PHONE-CONTROL.md#kratko-uputstvo-sr) · [Sve izmene u 2.2.1](docs/RELEASE-NOTES-2.2.1.md)

## Pokretanje za 60 sekundi

1. Otvori ProTimer. Otvara se samo **Kontrola**, bez automatskog prikazivanja izlaznog prozora publici.
2. Otvori **Trajanje**, upiši sate/minute/sekunde ili izaberi brzu vrednost, pa pritisni **START**.
3. Kada si spreman, izaberi monitor i klikni **Pošalji na ekran**. Zatim pomeraj/povećavaj Ekran mišem ili uključi prikaz preko celog ekrana iz Kontrole.
4. Za publiku na telefonima izaberi **QR** za Tajmer ili Backstage (samo za praćenje), pa **Prikaži QR publici**.

![ProTimer ekran sa odbrojavanjem](docs/demo.gif)

Kompletno uputstvo je u [engleskom README vodiču](README.md#how-to-use). Za pomoć koristi [Support](SUPPORT.md), postavi pitanje u [GitHub Discussions](https://github.com/srdjankotarlic/protimer/discussions) ili otvori precizan [GitHub issue](https://github.com/srdjankotarlic/protimer/issues/new/choose).

ProTimer je otvorenog koda pod [MIT licencom](LICENSE).
