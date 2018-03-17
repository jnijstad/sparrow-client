import {
  remote
} from "electron";
import $ from "jquery";
// import tns from 'tiny-slider';
import "./sparrow.register-service-worker.js";
import env from "env";
import firebase from '@firebase/app';
import '@firebase/firestore'
import * as WifiPasswords from './wifi-passwords.json'

process.env.GOOGLE_API_KEY = "AIzaSyAti_Nd3jah7ffj7bBb4C-RovY9lEYJgvk"

const app = remote.app;
const net = remote.net

const si = require('systeminformation');
const wifi = require('node-wifi');
const isOnline = require('is-online');
const getUrls = require('get-urls');

// Get data

wifi.init({
  iface: null // network interface, choose a random wifi interface if set to null
});


const config = {
  apiKey: "AIzaSyDicrmyyki5n-XwKQnxnLYHCfcQQsshpHw",
  authDomain: "sparrow-flock.firebaseapp.com",
  databaseURL: "https://sparrow-flock.firebaseio.com",
  projectId: "sparrow-flock",
  storageBucket: "sparrow-flock.appspot.com",
  messagingSenderId: "422441952368"
};

firebase.initializeApp(config);

const db = firebase.firestore();

class Sparrow {

  constructor() {
    this.sliderElement = document.getElementById('ad-slider')
    this.deviceData = {};
    this.dialogs = {};
    this.deviceId = {};
    this.ads = {};
    this.location = {};    
    this.slider = false;
    this.slideTimeOut = false
    this.wifiAttempt = 1
    this.numOfAdsets = 0
    this.screenFormat = "landscape"
    this.adSets = {
      a: "test",
      b: "test 2"
    };

    // // Listen to when an image src or alt gets changed (ex: slideshow, etc.)
    let that = this

    // Options for the observer (which mutations to observe)
    let config = {
      attributes: true,
      childList: true
    };
    // Callback function to execute when mutations are observed
    const callback = function (mutationsList) {
      that.reRenderSlider()
    };

    // Create an observer instance linked to the callback function
    let observer = new MutationObserver(callback);
    // Start observing the target node for configured mutations
    observer.observe(this.sliderElement, config);
      
    
    // init sparrow main
    this.init()
    // init timer for daytime ad variants
    this.initTimeVariant()    
    // init timer to poll weather for add variants

    // init timer to check for morning, afternoon evening
  }

  init() {
    let connectDevice = this.isOnline();

    connectDevice.then(online => {
      if (!online)
        return
      this._getLocation()
      .then(() =>{
        this.getDeviceInformation()
          .then(deviceData => {
            this.screenFormat = this._calculateScreenMode(window.screen.availWidth, window.screen.availHeight)
            this.deviceData = deviceData;
            console.log(this.deviceData);
            // update in db
            this.updateDevice()
              .then(() => {
                this.getAdsets(this.deviceData.serial)
                // .then(
                //   this.reRenderSlider()                
                // )
              })
          });
        console.log(online);
      })
    })
  }

  initTimeVariant(){
    console.log("time");    
    let timeVariantClass;
    let morning = ('morning');
    let afternoon = ('afternoon');
    let evening = ('evening');
    
    setInterval(() => {
      let thehours = new Date().getHours();      
      if (thehours >= 5 && thehours < 12) {
        timeVariantClass = morning;

      } else if (thehours >= 12 && thehours < 18) {
        timeVariantClass = afternoon;

      } else if (thehours >= 18 && thehours < 5) {
        timeVariantClass = evening;
      }
      else {
        timeVariantClass = 'default';        
      }
      $('body').addClass(timeVariantClass)
    }, 600)
  }

  _calculateScreenMode(width, height){
    if (width > height) {
      return "landscape"
    }
    else if (height > width){
      return "potrait"
    }
    else {
      return "square"
    }
  }

  initLogger() {

  }

  log(message, type=false) {
    $('.sparrow-logger').find('.message').text(message)
    if (type === 'start') {
      $('.sparrow-logger').fadeIn(300);
    }
    else if(type === 'end'){
      $('.sparrow-logger').fadeOut(300)
    }
    else{
      $('.sparrow-logger').fadeIn(300, function () {
        $(this).delay(200).fadeOut(400)
      })
    }
  }

  _getLocation(){
    let sparrow = this
    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition((pos) => {
        console.log(pos);        
        sparrow.location = {
          accuracy: pos.coords.accuracy,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }
        resolve()        
      }, (err) => {
        console.log(err);        
        reject(err)        
      });
    });
  }



  updateDevice() {
    // see if devices exist
    this.log("Updating device information")
    const devicesRef = db.collection("devices");
    const query = devicesRef.where("serialNumber", "==", this.deviceData.serial);

    return query.get().then((querySnapshot) => {
      return querySnapshot.forEach((doc) => {
        devicesRef.doc(`${doc.id}`).set({
          updateAt: firebase.firestore.FieldValue.serverTimestamp(),
          serialNumber: this.deviceData.serial,
          deviceMeta: this.deviceData,
          location: this.location
        }, {
          merge: true
        });
      });
    }).catch(err => {
      console.log(err);      
      console.log('device id not found in db. Please register device first')
    });
  }

  getDeviceInformation() {
    const getSystemInfo = si.system()
    let sparrow = this
    getSystemInfo.then((data) => {
      wifi.getCurrentConnections().then((currentConnections, err) => {
        if (err) {
          console.log(err)
        } else {
          data.network = currentConnections
          console.log(data.network);
        }
      });
    });

    return getSystemInfo
  }


  /**
   * Check if has internet connection.
   */
  isOnline() {
    let sparrow = this    
    sparrow.log('Checking if device is online', 'start')
    return isOnline().then(online => {
      if (online) {
        sparrow.log('Device is online.', 'end')        
        return true
      } else {
        sparrow.connectToWifi();
      }
    });
  }

  /**
   * Connect to wifi using provided wifi passwords.
   */
  connectToWifi() {
    this.log(`Device offline, trying to scan and connect to wifi (attempt ${this.wifiAttempt})`)
    this.wifiAttempt++
      let sparrow = this
    // All functions also return promise if there is no callback given
    wifi.scan().then(function (networks) {
      let networkAmount = networks.length
      sparrow.log(`Found ${networkAmount} networks.. See if we can connect.`);
      if (networkAmount > 0) {
        for (const network in networks) {
          if (networks.hasOwnProperty(network)) {
            const networkObj = networks[network];
            const ssid = networkObj.ssid.toString()
            if (WifiPasswords.hasOwnProperty(ssid)) {
              sparrow.log("found a registred wifi network, connecting...");
              // Connect to a network         
              wifi.connect({
                ssid: ssid,
                password: WifiPasswords[ssid]
              }, function (err) {
                if (err) {
                  console.log(err);
                } else {
                  sparrow.log(`Connected to ${ssid}. Restarting Sparrow.`)
                  sparrow.init()
                  return true
                }
              });
            }
          }
        }
      } else {
        sparrow.log('No networks found. Make sure wifi is available.')
        sparrow.init()
      }
      // networks.

      // networks
    }).catch(function (error) {
      console.log(error);
      // error
    })
  }

  buildSlideHtml(docData){
    const slide = document.createElement('div');
    let content = ''
    let sparrow = this
    let ads = docData.ads[sparrow.screenFormat]    
    if (docData.type === "image") {  
      for (const key in ads) {
        if (ads.hasOwnProperty(key)) {
          const element = ads[key];
          console.log(element);          
          content += `
          <picture class="ad-child ${key}" data-duration="${docData.duration}" data-name="${docData.name}" data-type="${docData.type}">
            <img src="${element}" alt="">
          </picture>
          `          
        }
      }
      // fucking orientation isn't working :-S
    }
    else if (docData.type == "video") {
      for (const key in ads) {
        if (ads.hasOwnProperty(key)) {
          const element = ads[key];
          content += `
          <video class="ad-child ${key}" data-duration="${docData.duration}" data-name="${docData.name}" data-type="${docData.type}" muted preload>
            <source src="${element.webm}" type=video/webm> 
            <source src="${element.mp4}" type=video/mp4>
          </video>`
        }
      }
    }

    if ($(this.sliderElement).children().length < 1) {
      slide.className = 'ad active-slide'
    }
    slide.className = 'ad';
    slide.id = docData.id
    slide.innerHTML = content;
    return slide
    
  }

  addSlide(docData) {
    let slide = this.buildSlideHtml(docData)
    this.sliderElement.append(slide)   
  }

  modifySlide(docData) {
    let slide = this.buildSlideHtml(docData)    
    const elem = document.getElementById(docData.id);
    elem.innerHTML = slide.innerHTML
  }

  /**
   * 
   */
  getAdsets(deviceId) {
    const deviceAdsetsRef = db.collection("/deviceAdsets").doc(deviceId);
    let sparrow = this
    deviceAdsetsRef.onSnapshot((doc) => {
      const adSets = doc.data().adSets;
      const adSetRef = db.collection("adsets")
      Object.entries(adSets).forEach(([key, adsetId]) => {
        // get adsets and also watch for changes in firestore.
        console.log(`looks like we added an adset ${key}:${adsetId}`);
        adSetRef.where('id', '==', adsetId)
      });
      return adSetRef.onSnapshot((snapshot) => {
        sparrow.numOfAdsets = snapshot.size
        // download all adsets and add all to cache first       
        // sparrow.downloadAds()
        let adsStatic = []
        snapshot.docs.forEach(function (doc) {
          adsStatic.push(doc.data().ads[sparrow.screenFormat]);
        })               
        adsStatic = JSON.stringify(adsStatic)
        sparrow.cacheAssets(adsStatic).then(()=>{
          snapshot.docChanges.forEach(function (change) {
            console.log(change.doc);
            let docData = change.doc.data()
            if (change.type === "added") {
              sparrow.addSlide(docData)
            }
            if (change.type === "modified") {
              sparrow.modifySlide(docData)
            }
            if (change.type === "removed") {
              sparrow.removeSlide(docData)
            }
            sparrow.reRenderSlider()
          });
        })
        // this.getAds(doc)
      });
    })
  };

  reRenderSlider() {
    let sparrow = this
    let ads = $(sparrow.sliderElement).children()
    sparrow.log('Render slider')

    if (ads.length !== this.numOfAdsets)
      return

    // setInterval
    if (sparrow.slideTimeOut) {
      clearTimeout(sparrow.slideTimeOut)
    }

    const durationList = $('.ad').map(function (index, item) {
      console.log($(item).find('.ad-child').attr('data-duration'))
      return $(item).find('.ad-child').attr('data-duration')
    });

    // console.log(durationList);
    console.log("before change slide function");        
    let slideIndex = 0;
    let $activeSlide = ''
    if (!$activeSlide.length) {
      $activeSlide = $('.ad').first().addClass('active-slide')
    }
    const changeSlide = function (timing) {
      console.log("change slide function");    
      let $activeSlide = $('.active-slide');
      if ($activeSlide.find('video').length) {
        console.log("has video");
        console.log($activeSlide.find('video').get(0));
        $activeSlide.find('video').get(0).play()
      }
      sparrow.slideTimeOut = setTimeout(function () {
        // check for video
        if (timing !== 0) {
          // slider.slick('slickNext');
          $activeSlide.removeClass('active-slide').next().addClass('active-slide')
        }
        if (slideIndex >= durationList.length) {
          console.log("from beginning");
          ads.first().addClass('active-slide')
          slideIndex = 0; //Start from beginning?
        }
        changeSlide(durationList[slideIndex++]); //Calls itself with duration for next slide
      }, timing);
    }

    changeSlide(0);
  };


  // cache all assets
  cacheAssets(assets) {
    const sparrow = this
    sparrow.log('downloading ads to cache', 'start')
    let adUrls = getUrls(assets);
    assets = Array.from(adUrls)
    return new Promise(function (resolve, reject) {
      // open cache
      caches.open('assets')
        .then(cache => {
          // the API does all the magic for us
          console.log(cache);                        
          cache.addAll(assets)
            .then((cache) => {
              console.log('All assets added to cache')
              sparrow.log('Done adding ads to cache. Retreiving ads', 'end')
              resolve()
            })
            .catch(err => {
              console.log('error when syncing assets', err)
              reject()
            })
        }).catch(err => {
          console.log('error when opening cache', err)
          reject()
        })
    });
  }

  // remove out of date ads and dowload new ads
  downloadAds() {
    const adsString = JSON.stringify(this.ads);
    let adUrls = getUrls(adsString);
    adUrls = Array.from(adUrls)
    this.cacheAssets(adUrls);
  }
}
// end of class Sparrow


/**
 * All View Functions
 */


export default Sparrow
