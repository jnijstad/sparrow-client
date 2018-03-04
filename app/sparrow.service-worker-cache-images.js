// this is the service worker which intercepts all http requests
console.log('test');
console.log(self);

self.addEventListener('fetch', function fetcher(event) {
  console.log("fetch event");    
  var request = event.request;
  // check if request 
  console.log(request.url);
  if (request.url.includes('firebasestorage')) {
    // contentful asset detected
    console.log("tryig to get from cache");    
    event.respondWith(
      caches.match(event.request).then(function (response) {
        console.log(`this is what i got from cache:`);
        console.log(response);        
        // return from cache, otherwise fetch from network
        return response || fetch(request);
      })
    );
  }
  // otherwise: ignore event
});