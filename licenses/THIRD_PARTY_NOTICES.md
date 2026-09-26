# Third-party notices

ProTimer release packages include **cloudflared 2026.8.2** by Cloudflare, Inc. to create an optional, account-free public HTTPS tunnel when the operator clicks **Share online**.

- Source: https://github.com/cloudflare/cloudflared/tree/2026.8.2
- Release: https://github.com/cloudflare/cloudflared/releases/tag/2026.8.2
- License: Apache License 2.0; see `cloudflared-LICENSE.txt` in this directory.

Cloudflare Quick Tunnel traffic passes through Cloudflare's network. Quick Tunnels have no uptime guarantee and ProTimer continues to label online sharing as beta; the LAN/QR link remains the recommended production path.

## Optional native Stream Deck plugin (development preview)

The bundled plugin uses Elgato's `@elgato/streamdeck` SDK 3.0.0, `@elgato/schemas`, `@elgato/utils`, Zod and ws under their MIT licenses. The official plugin build copies the complete installed license texts into the `.streamDeckPlugin` package. The Stream Deck application and its bundled Node runtime are supplied separately by Elgato. ProTimer's default manual bell is synthesized locally and contains no third-party recording.
