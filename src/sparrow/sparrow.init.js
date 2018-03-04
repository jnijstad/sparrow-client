// Initialize Firebase
// const firebase = require('@firebase/app').default;
// import * as firebase from "./lib/firebase.js";
// console.log(firebase);

import { remote } from "electron";
import jetpack from "fs-jetpack";
import $ from "jquery";
// import tns from 'tiny-slider';
import "./sparrow.register-service-worker.js";
import env from "env";

// console.log(tns);


const app = remote.app;
const net = remote.net

import firebase from '@firebase/app';
import '@firebase/firestore'

// These imports load individual services into the firebase namespace.
const si = require('systeminformation');
const wifi = require('node-wifi');
const isOnline = require('is-online');
const getUrls = require('get-urls');
// const location = require('isomorphic-location')

// Example retrieve IP from request
// const ip = req.header('x-forwarded-for') || req.connection.remoteAddress;

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
    console.log("initialized Sparrow class");
    this.sliderElement = document.getElementById('ad-slider')
    this.deviceData = {};
    this.dialogs = {};
    this.deviceId = {};
    this.ads = {};
    this.slider = false; 
    this.slideTimeOut = 10000
    this.adSets = {
      a: "test",
      b: "test 2"
    }; 

    // Listen to when an image src or alt gets changed (ex: slideshow, etc.)
    this.sliderElement.addEventListener("DOMNodeInserted", function (e) {
      $('.ad').first().addClass('active-slide')      
      // Record the occurrence
    }, false);
    
    
    this.isOnline()
      .then(online => {
        if (!online)
          return this.connectToWifi();            
        this.getDeviceInformation()
          .then(deviceData => {
            this.deviceData = deviceData;
            // update in db
            this.updateDevice()
              .then(() => {
                this.reRenderSlider()                                              
                this.getAdsets(this.deviceData.serial)
                  // // render 
                  // .then(() => {
                  //   // this.renderAds();
                  //   // console.log(this.ads);
                  // });
              })
          });
        console.log(online);
      })
  }

    updateDevice() {
      console.log(this.deviceData.serial);
      // see if devices exist
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
      });
    }

    // native notifications
    notification(title, body) {
      new Notification(title, {
        body: body
      })
    }


  getDeviceInformation() {
    const getSystemInfo = si.system()
    getSystemInfo.then((data) => {
      // return data;    
      // console.log(data);        
      wifi.getCurrentConnections().then((currentConnections, err) => {
        if (err) {
          console.log(err)
        } else {
          // console.log(currentConnections);    
          // console.log(data);
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
    return isOnline().then(online => {
      return online;
    });
  }

  /**
   * Connect to wifi using provided wifi passwords.
   */
  connectToWifi() {
    console.log("connect to wifi");
  }


  getAds(adsetDoc){
    const adsString = JSON.stringify(adsetDoc.data());
    let adUrls = getUrls(adsString)
    adUrls = Array.from(adUrls)
    //  add all assetUrls to cache, then load slider
    this.cacheAssets(adUrls).then(() => {
      this.renderSlide(adsetDoc.id, adsetDoc.data())
    });
  }
  /**
   * 
   */
  getAdsets (deviceId) {
    console.log("getting ad of:");
    const deviceAdsetsRef = db.collection("/deviceAdsets").doc(deviceId);
    deviceAdsetsRef.onSnapshot((doc) => {
      const adSets = doc.data().adSets;
      Object.entries(adSets).forEach(([key, adsetId]) => {
        // get adsets and also watch for changes in firestore.
        console.log("looks like we added an adset");        
        db.collection("adsets").doc(adsetId).onSnapshot((doc) => {
          this.getAds(doc)
        });
      });     
    })
  };

  renderSlide(id, adSet) {
    console.log(adSet);
    const landscape = adSet.ads['1920_1080'].default
    const potrait = adSet.ads['1080_1920'].default || null
    // fucking orientation isn't working :-S
    let content = `
      <picture>
        <source srcset="${potrait}" media="screen and (max-width: 1000px)"/>
        <source srcset="${landscape}" media="screen and (min-width: 1000px)" />
        <img src="${landscape}" alt="">
      </picture>
      `
    const elem = document.getElementById(id);
    if (elem) {
      elem.innerHTML = content
    } else {
      const slide = document.createElement('div');
      slide.className = 'ad';
      slide.id = id
      slide.innerHTML = content;
      this.sliderElement.append(slide)    
    }
  }

  reRenderSlider () {

    // setInterval 
    setInterval(() => {
      // if no active class, add to first
      const $activeSlide = $('.active-slide');
      if ($activeSlide === undefined || $activeSlide.length == 0){
        $('.ad').first().addClass('active-slide')
      }
      else {
        let nextSlide = $activeSlide.removeClass('active-slide').next()
        if (nextSlide.length) {
          nextSlide.addClass('active-slide')
        }
        else {
          $('.ad').first().addClass('active-slide')
        }
      }

    }, this.slideTimeOut);
  };


  detectDbChanges () {
    console.log("detect db changes and refresh");
  };


  addAssetToCache(assetUrl){
    return new Promise((resolve, reject) => {
      caches.open('assets')
      .then(cache =>{
        cache.add(assetUrl)
          .then(() => {
            console.log(`Added ${assetUrl} to cache`)
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
    })
  }


  cacheAssets(assets) {
    return new Promise(function (resolve, reject) {
      // open cache
      caches.open('assets')
        .then(cache => {
          // the API does all the magic for us
          cache.addAll(assets)
            .then(() => {
              console.log('all assets added to cache')
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
  downloadAds () {
    const adsString = JSON.stringify(this.ads);
    let adUrls = getUrls(adsString);
    adUrls = Array.from(adUrls)
    this.cacheAssets(adUrls);     
    // console.log(adUrls.Set);    
  }
}
// end of class Sparrow


/**
 * All View Functions
 */


export default Sparrow
