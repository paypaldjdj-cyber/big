const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let flaskProcess;

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: "SmileCare Clinic Management System",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'frontend/dist/favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  // mainWindow.webContents.openDevTools();
  mainWindow.maximize();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  const isDev = !app.isPackaged;
  
  if (isDev) {
    flaskProcess = spawn('python', ['backend/app.py'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } else {
    const backendExe = path.join(process.resourcesPath, 'clinic_server.exe');
    flaskProcess = spawn(backendExe, [], {
      cwd: process.resourcesPath,
      stdio: 'inherit'
    });
  }

  createWindow();
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (flaskProcess) flaskProcess.kill();
    app.quit();
  }
});
