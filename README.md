# ⏱️ ProTimer

**A free, open-source stage timer for live production.** Big, clear countdown on any screen — stage, projector, OBS, or a phone in your hand. Runs on **macOS and Windows**, with a **Serbian / English** interface.

![ProTimer control window](docs/screenshot-control.png)

---

## ✨ Features

- 🟢 **Countdown, stopwatch & clock** — plus "count down to an exact time" (e.g. end the block at 2:30 PM)
- 🎨 **Clean output screen** — just the time; you pick the background and digit colors
- 🔴 **Color warnings** — white → yellow → red as the end approaches; counts past zero into the negative with a flash
- 🖥️ **Any screen** — send the output to a second monitor / projector in fullscreen with one click
- 📺 **OBS / NDI / vMix** — built-in network output; add it as a Browser Source (transparent background for overlays)
- 📱 **Phone remote** — start the timer and send messages to the speaker from your hand, over Wi-Fi
- 💬 **Messages to the speaker** + ✍️ **on-screen text** ("BREAK", "WELCOME")
- 🗒️ **Cue list** — a run of segments with durations, GO button for the next one
- 🌍 **Serbian / English** interface, ⌨️ keyboard shortcuts, ⚡ low latency (no lag, no drift)

---

## ⬇️ Download & install

Grab the latest build from the **[Releases page](../../releases/latest)**:

| System | File | How |
|---|---|---|
| 🍎 **macOS** (Apple Silicon) | `ProTimer-*-arm64.dmg` | Open → drag to Applications. First launch: **right-click → Open**. |
| 🪟 **Windows** | `ProTimer Setup *.exe` | Run the installer. SmartScreen: **More info → Run anyway**. |
| 🪟 **Windows** (no install) | `ProTimer-*-portable.exe` | Just double-click — nothing gets installed. |

> The app isn't paid-signed (that costs money), hence the "right-click → Open" / "Run anyway" the first time. It's completely safe — the source is right here, open.

---

## 🚀 Quick start (30 seconds)

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

### 🎨 Colors & text
- **Colors**: pick the background and digit color. "Warning colors" turn yellow/red near the end (you can turn them off).
- **On-screen text**: type a message (e.g. `BREAK`) — it sits above the time, or enable **"Text only"** to replace the time entirely.
- **Message to speaker**: a short line at the bottom of the screen, with an optional flash.

### 🗒️ Cue list
Add program segments (name + duration) on the right. Click a cue to load it, **GO** (`N`) starts the next one. Optional auto-advance.

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

You need [Node.js](https://nodejs.org).

```bash
git clone https://github.com/srdjankotarlic/protimer.git
cd protimer
npm install
npm start            # run the app

npm run smoke        # automated test (windows + network + remote)
npm run dist:mac     # build the macOS .dmg
npm run dist:win     # build the Windows installer + portable
```

Clean stack, no runtime dependencies: **Electron** + plain HTML/CSS/JS + a Node `http` server (SSE). All the logic lives in `controller.html` (control), `output.html` (screen/OBS), `remote.html` (phone), and `main.js` (windows + server).

---

## 📄 License

[MIT](LICENSE) — free to use, modify and share. If it helps your show, a ⭐ on the repo means a lot.

Built by [Srdjan Kotarlic](https://github.com/srdjankotarlic) for live production.
