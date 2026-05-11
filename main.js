const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
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

  // Open Developer Tools automatically
  mainWindow.webContents.openDevTools();

  // Load the live URL from Netlify for instant updates
  const LIVE_URL = "https://smilecarepro.netlify.app"; 
  mainWindow.loadURL(LIVE_URL);

  mainWindow.maximize();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  createWindow();
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
