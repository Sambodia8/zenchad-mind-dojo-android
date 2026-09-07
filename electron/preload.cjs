const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zenchadDesktopSync", {
  getStatus: () => ipcRenderer.invoke("zenchad:status"),
  exportNow: (json) => ipcRenderer.invoke("zenchad:export", json),
  importNow: () => ipcRenderer.invoke("zenchad:import"),
  onRemoteUpdate: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("zenchad:remote-update", listener);
    return () => ipcRenderer.removeListener("zenchad:remote-update", listener);
  }
});
