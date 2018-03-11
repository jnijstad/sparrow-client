console.log(firebase);

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

// console.log(tns);


const app = remote.app;
const net = remote.net

const si = require('systeminformation');
const wifi = require('node-wifi');
const isOnline = require('is-online');
const getUrls = require('get-urls');



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
    this.slider = false;
    this.slideTimeOut = false
    this.wifiAttempt = 1
    this.numOfAdsets = 0
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

    this.init()
    // initiate logger
  }

  init() {
    let connectDevice = this.isOnline();

    connectDevice.then(online => {
      if (!online)
        return
      this.getDeviceInformation()
        .then(deviceData => {
          this.deviceData = deviceData;
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
  }

  initLogger() {

  }

  log(message) {
    $('.sparrow-logger').find('.message').text(message)
    $('.sparrow-logger').fadeIn(300, function () {
      $(this).delay(200).fadeOut(400)
    })
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
          deviceMeta: this.deviceData
        }, {
          merge: true
        });
      });
    }).catch(err => {
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
    this.log('Checking if device is online')
    let sparrow = this
    return isOnline().then(online => {
      if (online) {
        return true
      } else {
        console.log("connect again to wifi");
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
        sparrow.log('No networks found. Make sure wifi available.')
        sparrow.init()
      }
      // networks.

      // networks
    }).catch(function (error) {
      console.log(error);
      // error
    })
  }

  addSlide(docData) {
    if (docData.type === "image") {
      const landscape = docData.ads['1920_1080'].default
      const potrait = docData.ads['1080_1920'].default || null
      // fucking orientation isn't working :-S
      let content = `
      <picture>
        <source srcset="${potrait}" media="screen and (max-width: 1000px)"/>
        <source srcset="${landscape}" media="screen and (min-width: 1000px)" />
        <img src="${landscape}" alt="">
      </picture>
      `
      const slide = document.createElement('div');
      slide.className = 'ad';
      if ($(this.sliderElement).children().length < 1) {
        slide.className = 'ad active-slide'
      }
      slide.setAttribute('data-duration', docData.duration)
      slide.setAttribute('data-name', docData.name)
      slide.setAttribute('data-type', docData.type)      
      slide.id = docData.id
      slide.innerHTML = content;
      this.sliderElement.append(slide) 
    }
    else if (docData.type == "video"){

      let content = `
      <video autoplay loop muted preload>
        <source src="${docData.ads['1080_1920'].default.webm}" type=video/webm> 
        <source src="${docData.ads['1080_1920'].default.mp4}" type=video/mp4>
      </video>`
      const slide = document.createElement('div');
      slide.className = 'ad';
      slide.setAttribute('data-name', docData.name)
      slide.setAttribute('data-type', docData.type)
      slide.setAttribute('data-duration', '5000')      
      slide.id = docData.id
      slide.innerHTML = content;
      this.sliderElement.append(slide) 

    }
  }

  modifySlide(docData) {
    const landscape = docData.ads['1920_1080'].default
    const potrait = docData.ads['1080_1920'].default || null

    let content = `
      <picture>
        <source srcset="${potrait}" media="screen and (max-width: 1000px)"/>
        <source srcset="${landscape}" media="screen and (min-width: 1000px)" />
        <img src="${landscape}" alt="">
      </picture>
      `
    const elem = document.getElementById(docData.id);
    elem.innerHTML = content
  }

  /**
   * 
   */
  getAdsets(deviceId) {
    console.log("getting ad of:");
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
          adsStatic.push(doc.data());
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
        console.log("should be done by now?");
        // this.getAds(doc)
      });
    })
  };

  reRenderSlider() {
    console.log(this.numOfAdsets);
    let sparrow = this
    let ads = $(sparrow.sliderElement).children()

    if (ads.length !== this.numOfAdsets)
      return

    // setInterval
    if (sparrow.slideTimeOut) {
      clearTimeout(sparrow.slideTimeOut)
    }

    const durationList = $('.ad').map(function (index, item) {
      return item.getAttribute('data-duration');
    });

    console.log(durationList);
    let slideIndex = 0;
    const changeSlide = function (timing) {
      sparrow.slideTimeOut = setTimeout(function () {
        let $activeSlide = $('.active-slide');
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
    this.log('downloading ads to cache')
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
