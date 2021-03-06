// Copied from electron quickstart.
const electron = require('electron')
const {autoUpdater} = require('electron-updater')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const {promisify} = require('util')
const _ = require('lodash/fp')
const debounce = (() => {
  const _debounce = _.debounce.convert({fixed: false})
  return _.curry((opts, wait, fn) => _debounce(wait, fn, opts))
})()
let argv = require('minimist')(process.argv)
// --dev is a shortcut for some other flags
if (argv.dev) argv = {livereload: true, menu: true, ...argv}

if (argv.healthcheck)
  healthcheck()
else
  main()

// --healthcheck verifies the app's built correctly without actually running it
function healthcheck() {
  const fs = require('fs')
  const files = [
    'node_modules/@mapwatch/www/dist',
    'node_modules/@mapwatch/lib/dist',
  ]
  Promise.all(files.map(f => promisify(fs.access)(f)))
  .then(() => process.exit(0))
  .catch(err => {
    console.error('healthcheck failed', err)
    process.exit(1)
  })
}
function main() {
  autoUpdater.logger = require('electron-log')
  autoUpdater.logger.transports.file.level = 'debug'
  autoUpdater.checkForUpdatesAndNotify()
  if (!app) throw new Error("usage: `electron main.js` (not `node main.js`)")
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  let mainWindow

  function createWindow () {
    // Create the browser window.
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      icon: path.join(__dirname, 'node_modules/@mapwatch/www/dist/favicon.jpeg'),
    })
    if (!argv.menu) {
      mainWindow.setMenu(null)
    }
    // https://stackoverflow.com/questions/32402327/how-can-i-force-external-links-from-browser-window-to-open-in-a-default-browser
    mainWindow.webContents.on('new-window', (e, url) => {
      console.log('new-window', url)
      e.preventDefault()
      require('electron').shell.openExternal(url)
    })

    // and load the index.html of the app.
    const initUrl = url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true,
      query: {
        ..._.pick(['path', 'clear'], argv),
        ...(argv.pathSelect ? {pathSelect: 1} : {}),
        ...(argv.example ? {example: 'stripped-client.txt', tickStart: '1526941861000'} : {}),
      },
    })
    console.log(initUrl)
    mainWindow.loadURL(initUrl)

    if (argv.livereload) {
      const child_process = require('child_process')
      const watch = {}
      watch.yarn = child_process.spawn('yarn', ['build:watch'], {cwd: "../www"})
      watch.yarn.stdout.on('data', data => process.stdout.write(data.toString()))
      watch.yarn.stderr.on('data', data => process.stderr.write(data.toString()))
      watch.yarn.stderr.on('exit', code => {
        if (code) console.error('yarn build:watch failed ('+code+')')
        app.quit()
      })

      const chokidar = require('chokidar')
      watch.chok = chokidar.watch(['.', '../www/dist'], {
        ignored: ['./node_modules'],
        ignoreInitial: true,
      })
      .on('all', debounce({leading: true, trailing: true}, 250, (event, path) => {
        console.log('livereload:', event, path)
        mainWindow.loadURL(initUrl)
      }))
      app.on('quit', () => {
        watch.chok.close()
        watch.yarn.kill()
      })
    }

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null
    })
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow)

  // Quit when all windows are closed.
  app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow()
    }
  })

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.
}
