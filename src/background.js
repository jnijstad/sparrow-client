// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.
process.env.GOOGLE_API_KEY = "AIzaSyAti_Nd3jah7ffj7bBb4C-RovY9lEYJgvk"

import path from "path";
import url from "url";
import { app, Menu } from "electron";
import { devMenuTemplate } from "./menu/dev_menu_template";
import { editMenuTemplate } from "./menu/edit_menu_template";
import createWindow from "./helpers/window";
import { autoUpdater } from "electron-updater"
const AutoLaunch = require('auto-launch')

const sparrowAutoLauncher = new AutoLaunch({
  name: 'Sparrow'
});
sparrowAutoLauncher.enable();
const autoLaunch = require('auto-launch');

autoUpdater.checkForUpdatesAndNotify()



// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";
const devWindow = {
  width: 400,
  height: 400
}

const prodWindow = {
  fullscreen: true,
  kiosk: true,
  autoHideMenuBar: true
}

const setApplicationMenu = () => {
  const menus = [editMenuTemplate];
  if (env.name !== "production") {
    menus.push(devMenuTemplate);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== "production") {
  const userDataPath = app.getPath("userData");
  app.setPath("userData", `${userDataPath} (${env.name})`);
}

let mainWindow

app.on("ready", () => {
  setApplicationMenu();

  if (env.name !== "production") {
    mainWindow = createWindow("main", devWindow);
  }
  else {
    mainWindow = createWindow("main", prodWindow);    
  }

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "app.html"),
      protocol: "file:",
      slashes: true
    })
  );

  if (env.name === "development") {
    mainWindow.openDevTools();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
