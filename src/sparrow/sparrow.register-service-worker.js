// register service worker
navigator.serviceWorker.register('sparrow.service-worker-cache-images.js')
  .then(navigator.serviceWorker.ready)
  .then(function () {
    console.log('service worker registered')
  })
  .catch(function (error) {
    console.log('error when registering service worker', error, arguments)
  });