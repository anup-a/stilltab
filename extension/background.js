// The toolbar button (and its shortcut, Alt+Shift+N) toggles the side panel.
// One panel per window, so it stays alive while you switch tabs.

const openWindows = new Set()

// The panel connects a port while it is open; that tells us whether to open or close.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return
  let windowId
  port.onMessage.addListener((msg) => {
    if (msg.windowId) { windowId = msg.windowId; openWindows.add(windowId) }
  })
  port.onDisconnect.addListener(() => openWindows.delete(windowId))
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
})

chrome.action.onClicked.addListener((tab) => {
  const windowId = tab.windowId
  if (openWindows.has(windowId) && chrome.sidePanel.close) {
    chrome.sidePanel.close({ windowId })
  } else {
    chrome.sidePanel.open({ windowId }) // must stay synchronous: needs the click's user gesture
  }
})
