// Initialize Firebase
// const firebase = require('@firebase/app').default;
// import * as firebase from "./lib/firebase.js";
// console.log(firebase);

import { remote } from "electron";
import jetpack from "fs-jetpack";
import $ from "jquery";
import Siema from 'siema';
// import { greet } from "./hello_world/hello_world";
import env from "env";

const app = remote.app;
const userDataDir = jetpack.cwd(app.getPath("userData"));

import firebase from '@firebase/app';
import '@firebase/firestore'

// These imports load individual services into the firebase namespace.
const si = require('systeminformation');
const wifi = require('node-wifi');
const isOnline = require('is-online');
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

export default class Sparrow2 {
  constructor(){
    console.log("initialized class");    
  }
}

/**
 * Initializes the Sparrow app.
 */
function Sparrow() {
  this.filters = {
    city: '',
    price: '',
    category: '',
    sort: 'Rating'
  };

  this.deviceData = {};
  this.dialogs = {};
  this.deviceId = {};
  this.ads = {};
  this.slider = {};
  this.test();
  
  

  // check if online
  this.isOnline()
  .then(online => {
    // if online, get device info
    this.renderSlider()          
    if (online) {
      this.getDeviceInformation()
      .then(deviceData => {
        this.deviceData = deviceData;
        // update in db
        this.updateDevice()
        .then(()=> {
          console.log("yaas");
          this.getAds(this.deviceData.serial)
          // render 
          .then(()=> {
            this.renderAds();
            // console.log(this.ads);
          });
        })
      });
    }
    // is offline
    else {
      this.connectToWifi();
    }
  });


  // if online, get device info and update databse it

  

  // firebase.auth().signInAnonymously().then(() => {
  //   console.log("yoow");    
    
  // }).catch(err => {
  //   console.log(err);
  // });
}


/**
 * Check the statitacs main. Yu don know.
 */

Sparrow.prototype.updateDevice = function() {

  // console.log(this.deviceData);
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
      }, {merge: true});    
      // console.log(`${doc.id} => ${doc.data()}`);
    });
  });
};

/**
 * Check if has internet connection.
 */

Sparrow.prototype.isOnline = function(){
  return isOnline().then(online => {
    return online;
  });
}


/**
 * Connect to wifi using provided wifi passwords.
 */

Sparrow.prototype.connectToWifi = function(){
  console.log("connect to wifi");
}

Sparrow.prototype.getDeviceInformation = function(){
  const getSystemInfo = si.system()
  getSystemInfo.then((data)=> {
    // return data;    
    // console.log(data);        
    wifi.getCurrentConnections().then((currentConnections, err) => {
      if (err) { 
        console.log(err) 
      }
      else {
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
 * All Data Functions
 */


Sparrow.prototype.detectDbChanges = function(){
  console.log("detect db changes and refresh");  
};

Sparrow.prototype.getAds = function (deviceId) {
  console.log("getting ad of:");
  console.log(deviceId);
  
  
  const devicesRef = db.collection("adsets");
  const query = devicesRef.where(`devices.${deviceId}`, "==", true);
  // return firebase.firestore().collection('restaurants').doc(deviceId).get();
  return query.get().then((querySnapshot) => {
    return querySnapshot.forEach((doc) => {
      this.ads = doc.data();
    });
  });
};


// remove out of date ads and dowload new ads
Sparrow.prototype.downloadAds = function () {

}



/**
 * All View Functions
 */


Sparrow.prototype.renderSlider = function() {
  this.slider = new Siema({
    duration: 0,
    loop: true
  });

  // listen for keydown event
  setInterval(() => this.slider.next(), 1000);
}

Sparrow.prototype.renderAds = function () {
  const sliderElement = document.getElementById('ad-slider');
  const ads = this.ads.ads;

  const adElement = function(){
    return '<picture><source srcset = "http://via.placeholder.com/1080x1920/ffcb00/?text=lol" media = "(orientation: potrait)" /><source srcset="http://via.placeholder.com/1920x1080/ffcb00/?text=lol" media="(orientation: landscape)" /><img src="http://via.placeholder.com/1080x1920/ffcb00/?text=lol" alt=""></picture>';     
  }


  for (const ad in ads) {
    if (ads.hasOwnProperty(ad)) {
      const element = ads[ad];
      const slide = document.createElement('div');
      slide.innerHTML = adElement();
      this.slider.append(slide)
    }
  }
  // ads.forEach(element => {
  //   console.log(element);    
  // });
};
 




window.onload = () => {
};
