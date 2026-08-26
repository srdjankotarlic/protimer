<p align="center">
  <img src="build/icon.png" width="112" alt="ProTimer stage timer icon">
</p>

<h1 align="center">ProTimer</h1>

<p align="center">
  <strong>A free stage timer and speaker countdown for live events, conferences, presentations and OBS.</strong><br>
  Send a clear timer to a projector, confidence monitor, browser source or phone from one local app.
</p>

<p align="center">
  <a href="https://github.com/srdjankotarlic/protimer/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/srdjankotarlic/protimer/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/srdjankotarlic/protimer/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/srdjankotarlic/protimer?label=stable"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-2f81f7"></a>
  <img alt="macOS Apple Silicon" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111827">
  <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-2563eb">
</p>

<p align="center">
  <a href="https://srdjankotarlic.github.io/protimer/"><strong>Product page</strong></a>
  ·
  <a href="#download-and-install"><strong>Download</strong></a>
  ·
  <a href="#quick-start-30-seconds"><strong>Quick start</strong></a>
</p>

![ProTimer stage screen counting down with warning colors and NOW / NEXT](docs/demo.gif)

## Download and install

> **Download one recommended installer for your computer.** GitHub's automatic `Source code` ZIP and TAR.GZ files are for developers and will not install ProTimer.

| Your computer | Recommended download | Install |
|---|---|---|
| Apple Silicon Mac (M1 or newer) | **[Download the macOS DMG](https://github.com/srdjankotarlic/protimer/releases/download/v2.0.1/ProTimer-2.0.1-arm64.dmg)** | Open the DMG and drag **ProTimer** to Applications. |
| Windows 10/11 x64 | **[Download the Windows installer](https://github.com/srdjankotarlic/protimer/releases/download/v2.0.1/ProTimer-Setup-2.0.1.exe)** | Run Setup and follow the installer. |

Need a Windows build that does not install? Use the [portable EXE](https://github.com/srdjankotarlic/protimer/releases/download/v2.0.1/ProTimer-2.0.1-portable.exe). Most Windows users should choose Setup.

<details>
<summary><strong>First-launch security warning</strong></summary>

The current downloads are not Apple-notarized or Windows Authenticode-signed.

- On macOS, confirm the DMG came from this repository. If Gatekeeper blocks the app, use **System Settings -> Privacy & Security -> Open Anyway**.
- On Windows, SmartScreen may show **Unknown publisher**. Continue only for the installer downloaded from this repository.

</details>

## What ProTimer does

- **Countdown, stopwatch and clock** with warning colors, overtime and an exact end-time mode.
- **Dedicated stage output** for a projector, second display or confidence monitor.
- **Transparent OBS browser-source timer** for livestream and recording overlays.
- **Phone remote and QR access** over the local production network.
- **Simple event rundown** with NOW, NEXT, planned times and over/under status.
- **Backstage view** for crew, green room, stage manager or lobby display.
- **Stream Deck and automation control** through Bitfocus Companion, HTTP and OSC.
- **CSV import and export**, speaker messages, grid placement and a compact output window.
- **English and Serbian interface**, no account, no subscription and no watermark.

ProTimer is designed for small and medium live events that need reliable speaker timing without a complex show-control system.

## ProTimer or ProTimer Studio?

- Choose **ProTimer** when you primarily need a fast countdown, OBS overlay, phone remote and a simple rundown.
- Choose **[ProTimer Studio](https://github.com/srdjankotarlic/protimer-studio)** when you also need a NEXT/LIVE/GO workflow, lower thirds, screen content and several independently configured outputs.

The **control window** keeps timer transport, display output, rundown and network links in one place:

![ProTimer control window](docs/screenshot-control.png)

The **Backstage view** shows NOW, NEXT, the schedule and over/under status on any browser:

![ProTimer backstage view](docs/screenshot-backstage.png)

---

## Quick start (30 seconds)

1. Open ProTimer — you immediately get **two windows**: *Control* (for you) and *Screen* (clean time).
2. Type a duration (e.g. `5:00`) or click the `5m` button, then **START** (or `Space`).
3. Drag the *Screen* window onto your projector — or pick a monitor at the top and click **"Send to screen"** for fullscreen.
4. Done. Use the `±` buttons to add/remove time live while the timer runs.

---

## 📖 How to use

### Timer modes
- **Countdown** — the main mode. Enter a duration (`10` = minutes, `10:30` = MM:SS, `1:00:00` = HH:MM:SS).
- **Stopwatch** — counts up from zero.
- **Clock** — shows the current time of day.
- **"End at"** — enter a time (e.g. 20:30) and it counts down to that moment.

### Send to any screen
At the top, pick a monitor and click **"Send to screen"** — on a second monitor it goes fullscreen automatically. Plug in a projector mid-show? The output jumps to it. On the output window, double-click = fullscreen, `Esc` = back.

### 📺 OBS / NDI / streaming
The **"Network → OBS · Phone"** panel shows a URL (e.g. `http://192.168.1.50:7878`).
1. In OBS, add a **Browser Source** and paste that URL.
2. Enable **"Transparent background"** in ProTimer → the timer becomes a clean overlay over your video.
3. For **NDI**: run that browser source through OBS and enable OBS NDI output (DistroAV plugin).

Open the same URL on any computer/TV on the network as a confidence monitor.

### 📱 Phone remote
The same panel has a **Remote** URL (`…:7878/remote`). Open it in your phone's browser (same Wi-Fi). You get big buttons: Start/Pause, Reset, ±time, GO next, blackout, quick durations, and messages to the speaker. *(The main ProTimer must stay open on the computer.)*

### 🎛️ Stream Deck / Companion / HTTP API
Every command is a simple **HTTP GET** — the network panel shows a ready-made **API** URL (with your session token) to copy:

```
http://<ip>:7878/cmd?type=start&t=<token>
```

Available `type` values: `start` (toggles start/pause), `reset`, `go` (next cue), `blackout`, `adjust&value=<seconds>` (e.g. `-60`), `setDuration&value=<ms>`, `mode&value=countdown|countup|clock`, `message&value=<text>`, `clearMessage`, `text&value=<text>`, `clearText`.

**Stream Deck via [Bitfocus Companion](https://bitfocus.io/companion):** two options:
1. **Dedicated module** — [companion-module-protimer](https://github.com/srdjankotarlic/companion-module-protimer): nice actions, live feedbacks (running = green, blackout = red) and a `$(protimer:time)` variable for the button face. Install via Companion's developer-modules path (registry submission pending).
2. **Zero-install** — add a **Generic HTTP** connection, create a button with an *HTTP GET* action, and paste the API URL (change `type` per button).

Works from `curl`, Keyboard Maestro, or any automation too. The token changes on every app launch (security), so re-copy the URL after restarting ProTimer.

### 🎚️ OSC (QLab / TouchOSC / Companion OSC)
ProTimer listens for OSC on **UDP port 7879**. Addresses mirror the HTTP API:

```
/protimer/start          /protimer/reset         /protimer/go
/protimer/blackout       /protimer/adjust 60     /protimer/setDuration 600000
/protimer/message "WRAP UP"                      /protimer/clearMessage
```

Arguments: int/float/string (first argument = `value`). OSC has no token — it's LAN-trusted like QLab/Ontime, so keep the machine on a network you control.

### 🎨 Colors & text
- **Colors**: pick the background and digit color. "Warning colors" turn yellow/red near the end (you can turn them off).
- **Transparent background**: makes the screen see-through — for OBS overlays, and the desktop output window itself becomes a frameless floating overlay you can drag onto anything.
- **On-screen text**: type a message (e.g. `BREAK`) — it sits above the time, or enable **"Text only"** to replace the time entirely.
- **Message to speaker**: a short line at the bottom of the screen, with an optional flash.

### 🗒️ Rundown
Build your run on the right: each item has a **name, duration, an optional note and a color**. Set a **Start** time for the show and ProTimer fills in the **planned clock times** for every item. Click an item to load it; **GO** (`N`) jumps to and starts the next one. Optional auto-advance. The **Over / Under** badge shows whether you'll finish ahead or behind your planned end.

Turn on **"NOW / NEXT on screen"** to show the current and next item under the timer on the stage screen.

### 🔗 Share with others
Next to every link in the network panel there's a **QR** button — show it and people scan it with their phone to watch the timer (same Wi-Fi). Need someone **off your network** (a remote client, another venue)? Click **Share online** and ProTimer creates a public, view-only `https://` link through a [Cloudflare Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). The public link is beta and has no uptime guarantee; for a live show, LAN + QR remains the dependable path.

The public viewer receives the timer and rundown state, including cue names and notes, and can open the `/backstage` path. Do not include sensitive notes when sharing online. The command token is not included in the public viewer link. Click **Stop sharing** when the remote viewer is finished.

### 🎭 Backstage view (crew & guests)
The network panel has a **Backstage** URL. Open it on any screen, laptop or phone and everyone sees the same picture: the **current item** with its live timer, **what's next**, the **full schedule** with clock times, and the **planned vs projected finish** with the over/under indicator. Ideal for a green room, a stage manager, or a lobby screen.

### 🌍 Language
Switch between **SR / EN** with the toggle next to the logo, top-left. The choice is remembered and also applies to the phone remote.

### ⌨️ Shortcuts
| Key | Action | | Key | Action |
|---|---|---|---|---|
| `Space` | Start / pause | | `B` | Blackout |
| `R` | Reset | | `F` | Fullscreen |
| `N` | Next cue | | `M` | Message (Enter sends) |
| `↑` / `↓` | ± 1 minute | | `C` | Clear message |
| `←` / `→` | ± 10 seconds | | `Esc` | Exit fullscreen |

---

## 🛠️ For developers (run from source)

You need [Node.js](https://nodejs.org) 20 LTS or newer.

```bash
git clone https://github.com/srdjankotarlic/protimer.git
cd protimer
npm install
npm start            # run the app

npm run smoke        # automated test (windows + network + remote)
npm run dist:mac     # build the macOS .dmg
npm run dist:win     # build the Windows installer + portable
```

Clean stack, almost no dependencies: **Electron** + plain HTML/CSS/JS + a Node `http` server. LAN viewers use SSE; public HTTPS viewers use reliable versioned long-polling because Cloudflare Quick Tunnels do not support SSE. Browser clocks synchronise to the ProTimer host, preventing phone-clock drift. `qrcode`, a bundled and verified official `cloudflared` binary and a `localtunnel` fallback provide the share features. All the logic lives in `controller.html` (control), `output.html` (screen/OBS), `backstage.html` (crew schedule), `remote.html` (phone), and `main.js` (windows + server).

---

## 🗺️ Roadmap

Ideas on the list (feedback very welcome — open an issue to vote or suggest):

- [ ] Signed / notarized builds (no “unidentified developer” warning)
- [x] ~~Import a rundown from Excel / Google Sheets / CSV~~ — done (import, paste and export)
- [ ] Groups/blocks in the rundown (e.g. *Morning Sessions*, *Lunch*)
- [x] ~~HTTP control API~~ — done (works with Companion's Generic HTTP module + Stream Deck)
- [x] ~~Native OSC + dedicated Bitfocus Companion module~~ — done ([module repo](https://github.com/srdjankotarlic/companion-module-protimer); official registry submission pending)
- [ ] More languages
- [ ] Multiple independent timers

## ⚠️ Known limitations

Being honest about where it's at:

- **Unsigned builds.** macOS shows “unidentified developer” (right-click → Open) and Windows shows SmartScreen (More info → Run anyway) on first launch. Code signing is on the roadmap.
- **Network sharing needs the same Wi-Fi** — unless you use the optional **Share online** link, which is **beta**. It uses a Cloudflare Quick Tunnel (or a labelled fallback), passes viewer traffic through that provider and has no uptime guarantee. The public viewer can see timer/rundown data, including cue names and notes. For shows, LAN + QR is the dependable and private path.
- **Remote control is link-based.** Anyone with the exact `…/remote?t=…` link can control the timer — share it deliberately.
- **OSC has no authentication** (UDP, LAN-trusted — same model as QLab/Ontime). Anyone on your network can send OSC commands; use it on networks you control.
- **Single operator** — no real-time multi-user collaboration (see Ontime/StageTimer if you need that).
- **Builds:** macOS (Apple Silicon) and Windows (x64). No Intel-mac or Linux builds yet.

## 🤝 Contributing

Issues and pull requests are welcome — bug reports, feature ideas, translations, docs.

1. Open an [issue](../../issues) (there are templates for bugs and features).
2. For code: fork, `npm install`, make your change, run `npm run smoke`, open a PR.
3. Keep it simple — the whole point of ProTimer is that it stays small and obvious.

If you use ProTimer on a show, a ⭐ or a quick note about what worked (or didn't) genuinely helps.

---

## 👤 Author

**ProTimer** is created and maintained by **Srdjan Kotarlic** — built from real live-production needs.

- GitHub: [@srdjankotarlic](https://github.com/srdjankotarlic)
- LinkedIn: [Srdjan Kotarlic](https://www.linkedin.com/in/srdjan-kotarlic-82904012b/)

If it helps your show, a ⭐ on the repo means a lot. Issues and ideas are welcome.

## 📄 License

© 2026 Srdjan Kotarlic. Released under the [MIT License](LICENSE) — free to use, modify and share, with attribution. Bundled third-party components retain their own licenses; see [Third-party notices](licenses/THIRD_PARTY_NOTICES.md).
