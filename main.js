const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    frame: false,
    transparent: false,
    backgroundColor: '#0B1220',
    webPreferences: {
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:generateReport', async (event, payload) => {
  try {
    const outDir = app.getPath('documents'); // save to Documents by default
    const stamp = new Date().toISOString().slice(0,16).replace('T','_').replace(':','');
    const outPath = path.join(outDir, `CryptoTrend_Report_${stamp}.md`);
    fs.writeFileSync(outPath, payload.markdown, { encoding: 'utf-8' });
    await shell.openPath(outPath);
    return { ok: true, path: outPath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('app:close', () => { BrowserWindow.getAllWindows().forEach(w => w.close()); });
ipcMain.handle('app:minimize', () => { BrowserWindow.getAllWindows().forEach(w => w.minimize()); });
ipcMain.handle('app:maxrestore', () => {
  BrowserWindow.getAllWindows().forEach(w => { if (w.isMaximized()) w.restore(); else w.maximize(); });
});
