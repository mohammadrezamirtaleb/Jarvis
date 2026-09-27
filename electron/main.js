/**
 * J.A.R.V.I.S. Mark-86 Native Windows 11 Desktop Master Process
 * Spawns Python sidecar server, configures Mica/Acrylic native frameless window,
 * manages Windows system tray, global summoning shortcuts, and IPC bridge.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, Notification, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');

// Enforce single instance lock to prevent duplicate apps / loops
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let pythonProcess = null;
let isAppLoaded = false;
let isPollingBackend = false;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// Function to check if backend server is already reachable
function checkBackend(callback) {
  const req = http.get(`${BACKEND_URL}/api/status`, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });
  req.on('error', () => callback(false));
  req.setTimeout(1000, () => {
    req.destroy();
    callback(false);
  });
}

// Spawn Python FastAPI sidecar
function startPythonBackend() {
  checkBackend((isRunning) => {
    if (isRunning) {
      console.log('>>> [DESKTOP]: Python backend is already active on port 8000.');
      return;
    }

    console.log('>>> [DESKTOP]: Spawning Python backend sidecar...');
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
    const serverScript = path.join(__dirname, '..', 'server.py');

    pythonProcess = spawn(pythonExe, [serverScript], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[PYTHON]: ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[PYTHON LOG]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`>>> [DESKTOP]: Python backend exited with code ${code}`);
      pythonProcess = null;
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    frame: false, // Frameless for custom Windows 11 Fluent Mica Titlebar
    transparent: false,
    backgroundColor: '#0c1017',
    backgroundMaterial: 'mica', // Windows 11 Native Mica material
    title: 'J.A.R.V.I.S. Mark-86 Desktop',
    icon: path.join(__dirname, '..', 'assets', 'banner.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Single-flight deterministic app loader (no race conditions / loops)
  function pollAndLoadBackend(maxAttempts = 50) {
    if (isAppLoaded || isPollingBackend) return;
    isPollingBackend = true;
    let attempts = 0;

    const interval = setInterval(() => {
      if (isAppLoaded) {
        clearInterval(interval);
        isPollingBackend = false;
        return;
      }

      attempts++;
      checkBackend((ready) => {
        if (ready && !isAppLoaded && mainWindow) {
          isAppLoaded = true;
          isPollingBackend = false;
          clearInterval(interval);
          console.log('>>> [DESKTOP]: Backend connected successfully. Loading HUD...');
          mainWindow.loadURL(BACKEND_URL);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          isPollingBackend = false;
          if (!isAppLoaded && mainWindow) {
            console.error('>>> [DESKTOP]: Backend connection timed out.');
            mainWindow.loadURL(`data:text/html,<body style="background:#0c1017;color:#fff;font-family:Segoe UI,sans-serif;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh"><h2 style="color:#ff3366">J.A.R.V.I.S. Sidecar Connection Failed</h2><p style="color:#8fa8c2">Could not connect to http://127.0.0.1:8000 within 25 seconds.</p><button onclick="window.location.reload()" style="background:#00f0ff;color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer">RETRY CONNECTION</button></body>`);
          }
        }
      });
    }, 500);
  }

  pollAndLoadBackend();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'banner.png');
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '⚡ J.A.R.V.I.S. Mark-86',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '💬 Open Assistant (Ctrl+Shift+J)',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: '⚡ Run Diagnostics Sweep',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.executeJavaScript("window.runStarkProtocol && window.runStarkProtocol('diagnostics')");
          }
        }
      },
      {
        label: '📊 Quick System Vitals',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.executeJavaScript("window.switchNav && window.switchNav('telemetry')");
          }
        }
      },
      { type: 'separator' },
      {
        label: '❌ Terminate J.A.R.V.I.S.',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('J.A.R.V.I.S. Mark-86 (Windows 11 Native)');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch (e) {
    console.warn('Tray creation skipped:', e.message);
  }
}

// Setup IPC Window Handlers
function setupIPC() {
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('window:setAlwaysOnTop', (event, flag) => {
    if (mainWindow) mainWindow.setAlwaysOnTop(flag);
    return flag;
  });

  ipcMain.handle('app:getSystemInfo', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      appVersion: '86.0.0'
    };
  });

  ipcMain.handle('app:notify', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({
        title: title || 'J.A.R.V.I.S. Mark-86',
        body: body || '',
        icon: path.join(__dirname, '..', 'assets', 'banner.png')
      }).show();
    }
  });
}

// Handle second instance activation
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Lifecycle Events
app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
  createTray();
  setupIPC();

  // Register Global Hotkey (Ctrl+Shift+J) to summon Jarvis
  globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.minimize();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function killPythonProcess() {
  if (pythonProcess) {
    console.log('>>> [DESKTOP]: Shutting down Python backend process tree...');
    if (process.platform === 'win32' && pythonProcess.pid) {
      exec(`taskkill /pid ${pythonProcess.pid} /T /F`, () => {});
    } else {
      pythonProcess.kill('SIGTERM');
    }
    pythonProcess = null;
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  killPythonProcess();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
