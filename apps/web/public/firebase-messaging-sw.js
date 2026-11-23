// Firebase Cloud Messaging service worker (scope /firebase-cloud-messaging-push-scope).
// Messages carry a `notification` payload, so Firebase shows them itself and
// opens webpush.fcm_options.link on click. Config arrives in the query string.
importScripts("https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});
firebase.messaging();
