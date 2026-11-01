const fs = require('fs');

const rules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() { return request.auth != null; }
    
    function existing() { return resource.data; }
    function incoming() { return request.resource.data; }
    
    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) 
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
    }

    function isValidId(id) { 
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$'); 
    }

    function isValidUser(data) {
      return data.keys().hasAll(["userId", "firebaseUid", "fullName", "email", "createdAt", "lastLogin", "loginCount", "provider", "role"])
        && data.userId is string && data.userId.size() <= 64
        && data.firebaseUid is string && data.firebaseUid.size() <= 128
        && data.fullName is string && data.fullName.size() <= 128
        && data.email is string && data.email.size() <= 256
        && data.createdAt is timestamp
        && data.lastLogin is timestamp
        && data.loginCount is number
        && data.provider is string && data.provider.size() <= 32
        && data.role is string && data.role in ["Student", "Teacher", "Admin"]
        && data.firebaseUid == request.auth.uid;
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn() && isValidId(userId) && userId == request.auth.uid && isValidUser(incoming()) && incoming().createdAt == request.time && incoming().lastLogin == request.time && incoming().role == 'Student' && incoming().loginCount == 1;
      allow update: if isSignedIn() && isValidId(userId) && userId == request.auth.uid && isValidUser(incoming()) && incoming().createdAt == existing().createdAt && incoming().userId == existing().userId && incoming().firebaseUid == existing().firebaseUid && (incoming().role == existing().role || isAdmin()) && incoming().lastLogin == request.time;
    }

    function isValidSearchLog(data) {
      return data.keys().hasAll(["userId", "firebaseUid", "fullName", "email", "timestamp", "page", "searchQuery", "detectedSubject", "aiResponse", "browser", "operatingSystem", "device", "language", "responseTime"])
        && data.userId is string && data.userId.size() <= 64
        && data.firebaseUid is string && data.firebaseUid == request.auth.uid
        && data.fullName is string && data.fullName.size() <= 128
        && data.email is string && data.email.size() <= 256
        && data.timestamp is timestamp
        && data.page is string && data.page.size() <= 128
        && data.searchQuery is string && data.searchQuery.size() <= 2000
        && data.detectedSubject is string && data.detectedSubject.size() <= 128
        && data.aiResponse is string && data.aiResponse.size() <= 10000
        && data.browser is string && data.browser.size() <= 64
        && data.operatingSystem is string && data.operatingSystem.size() <= 64
        && data.device is string && data.device.size() <= 64
        && data.language is string && data.language.size() <= 32
        && data.responseTime is number;
    }

    match /search_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn() && isValidId(logId) && isValidSearchLog(incoming()) && incoming().timestamp == request.time;
      allow update, delete: if false; // immutable logs
    }
    
    // allow access to other collections based on old rules or default them to owner access if they exist
    match /semesters/{semesterId} {
      allow read: if isSignedIn() && existing().userId == request.auth.uid;
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && existing().userId == request.auth.uid && incoming().userId == request.auth.uid;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
    match /subjects/{subjectId} {
      allow read: if isSignedIn() && existing().userId == request.auth.uid;
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && existing().userId == request.auth.uid && incoming().userId == request.auth.uid;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
    match /units/{unitId} {
      allow read: if isSignedIn() && existing().userId == request.auth.uid;
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && existing().userId == request.auth.uid && incoming().userId == request.auth.uid;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
    match /notes/{noteId} {
      allow read: if isSignedIn() && existing().userId == request.auth.uid;
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && existing().userId == request.auth.uid && incoming().userId == request.auth.uid;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
    match /study_tasks/{taskId} {
      allow read: if isSignedIn() && existing().userId == request.auth.uid;
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && existing().userId == request.auth.uid && incoming().userId == request.auth.uid;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
  }
}
`;

fs.writeFileSync('firestore.rules', rules);
