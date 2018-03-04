// console.log(app);

Sparrow.prototype.getAds = function (deviceId) {
  return firebase.firestore().collection('restaurants').doc(id).get();
};


// Sparrow.prototype.

