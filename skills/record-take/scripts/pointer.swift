import CoreGraphics
import Foundation

let frameRate = 120.0
let clickHold = 0.06
let keyGap = 0.01
var isButtonDown = false
let isNaturalScrolling = UserDefaults.standard.object(forKey: "com.apple.swipescrolldirection") as? Bool ?? true

func easeInOutCubic(_ t: Double) -> Double {
  t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
}

func currentLocation() -> CGPoint {
  CGEvent(source: nil)?.location ?? .zero
}

func animate(duration: Double, frame: (Double) -> Void) {
  if duration <= 0 {
    frame(1)
    return
  }
  let start = Date()
  let step = 1 / frameRate
  var next = step
  while true {
    let elapsed = Date().timeIntervalSince(start)
    let progress = min(elapsed / duration, 1)
    frame(easeInOutCubic(progress))
    if progress >= 1 { return }
    let wait = next - Date().timeIntervalSince(start)
    if wait > 0 { Thread.sleep(forTimeInterval: wait) }
    next += step
  }
}

func move(to target: CGPoint, duration: Double) {
  let origin = currentLocation()
  animate(duration: duration) { eased in
    let point = CGPoint(
      x: origin.x + (target.x - origin.x) * eased,
      y: origin.y + (target.y - origin.y) * eased
    )
    let type: CGEventType = isButtonDown ? .leftMouseDragged : .mouseMoved
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?
      .post(tap: .cghidEventTap)
  }
}

func post(_ type: CGEventType, button: CGMouseButton) {
  CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: currentLocation(), mouseButton: button)?
    .post(tap: .cghidEventTap)
}

func click() {
  post(.leftMouseDown, button: .left)
  Thread.sleep(forTimeInterval: clickHold)
  post(.leftMouseUp, button: .left)
}

let doubleClickGap = 0.08

func doubleClick() {
  click()
  Thread.sleep(forTimeInterval: doubleClickGap)
  click()
}

func rightClick() {
  post(.rightMouseDown, button: .right)
  Thread.sleep(forTimeInterval: clickHold)
  post(.rightMouseUp, button: .right)
}

func scroll(by distance: Double, duration: Double) {
  var sent = 0.0
  animate(duration: duration) { eased in
    let delta = (distance * eased - sent).rounded(.towardZero)
    if delta == 0 { return }
    sent += delta
    CGEvent(
      scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: Int32(isNaturalScrolling ? delta : -delta), wheel2: 0, wheel3: 0
    )?.post(tap: .cghidEventTap)
  }
}

func type(_ text: String, delay: Double) {
  for character in text {
    let units = Array(String(character).utf16)
    for isDown in [true, false] {
      let event = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: isDown)
      event?.keyboardSetUnicodeString(stringLength: units.count, unicodeString: units)
      event?.flags = []
      event?.post(tap: .cghidEventTap)
      Thread.sleep(forTimeInterval: keyGap)
    }
    Thread.sleep(forTimeInterval: delay)
  }
}

func press(_ keyCode: CGKeyCode, flags: CGEventFlags) {
  for isDown in [true, false] {
    let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: isDown)
    event?.flags = flags
    event?.post(tap: .cghidEventTap)
    Thread.sleep(forTimeInterval: keyGap)
  }
}

func windows(of owner: String) -> String {
  let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
  return list.compactMap { window -> String? in
    let name = window[kCGWindowOwnerName as String] as? String ?? ""
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    guard name == owner, layer > 0 else { return nil }
    let bounds = window[kCGWindowBounds as String] as? [String: Double] ?? [:]
    let values = ["X", "Y", "Width", "Height"].map { String(Int(bounds[$0] ?? 0)) }
    return "\(layer):" + values.joined(separator: ",")
  }.joined(separator: " ")
}

func run(_ line: String) throws -> String {
  let data = Data(line.utf8)
  guard let command = try JSONSerialization.jsonObject(with: data) as? [String: Any],
    let name = command["command"] as? String
  else { throw NSError(domain: "pointer", code: 1) }
  let duration = (command["duration"] as? Double ?? 0) / 1000

  switch name {
  case "move":
    let x = command["x"] as? Double ?? 0
    let y = command["y"] as? Double ?? 0
    move(to: CGPoint(x: x, y: y), duration: duration)
  case "click":
    click()
  case "doubleClick":
    doubleClick()
  case "rightClick":
    rightClick()
  case "down":
    post(.leftMouseDown, button: .left)
    isButtonDown = true
  case "up":
    post(.leftMouseUp, button: .left)
    isButtonDown = false
  case "scroll":
    scroll(by: command["distance"] as? Double ?? 0, duration: duration)
  case "type":
    type(command["text"] as? String ?? "", delay: (command["delay"] as? Double ?? 0) / 1000)
  case "key":
    let flags = CGEventFlags(rawValue: UInt64(command["flags"] as? Int ?? 0))
    press(CGKeyCode(command["code"] as? Int ?? 0), flags: flags)
  case "windows":
    return windows(of: command["owner"] as? String ?? "")
  default:
    throw NSError(domain: "pointer", code: 2)
  }
  return ""
}

setvbuf(stdout, nil, _IOLBF, 0)

while let line = readLine() {
  do {
    print("ok \(try run(line))")
  } catch {
    print("error \(line)")
  }
}
