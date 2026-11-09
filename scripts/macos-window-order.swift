// Read-only test probe. Only reports native window metadata for explicitly
// supplied process IDs; never records window titles, content or other apps.
import Foundation
import CoreGraphics
import AppKit

if CommandLine.arguments.contains("--displays") {
    let result = NSScreen.screens.map { screen -> [String: Any] in
        return ["name": screen.localizedName,
                "id": screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] ?? 0,
                "x": screen.frame.origin.x, "y": screen.frame.origin.y,
                "width": screen.frame.width, "height": screen.frame.height]
    }
    print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
    exit(0)
}

let pids = Set(CommandLine.arguments.dropFirst().compactMap(Int.init))
guard !pids.isEmpty else { exit(2) }
let options: CGWindowListOption = CommandLine.arguments.contains("--all") ? [.optionAll, .excludeDesktopElements] : [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { exit(3) }
let result = windows.enumerated().compactMap { index, value -> [String: Any]? in
    guard let pid = value[kCGWindowOwnerPID as String] as? Int, pids.contains(pid) else { return nil }
    return ["order": index, "pid": pid,
            "id": value[kCGWindowNumber as String] ?? 0,
            "layer": value[kCGWindowLayer as String] ?? 0,
            "bounds": value[kCGWindowBounds as String] ?? [:],
            "onscreen": value[kCGWindowIsOnscreen as String] ?? false,
            "alpha": value[kCGWindowAlpha as String] ?? 0]
}
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
