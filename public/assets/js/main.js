var db = firebase.database();
var user = firebase.auth().currentUser;
// Used to keep track of user list
var currentRef;
// Global random array so don't have to query db every time to check for this array
var randomArray = [];
// Similar global variable to keep track of ongoing game
var gameOngoing;

// Optional sign-in using google
function signIn() {
    //Set Persistence to session, if users close it will sign them out
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(function() {
            var provider = new firebase.auth.GoogleAuthProvider();
            return firebase.auth().signInWithPopup(provider);
        })
        .then(function() {
            addToOnlineList(getUserID(), getUserName());
        })
        .catch(function(error) {
            console.error('Error signing in with Google', error);
        });
}

// Sign out of firebase
function signOut() {
    firebase.auth().signOut();
}

// Initiate firebase auth
function initFirebaseAuth() {
    firebase.auth().onAuthStateChanged(authStateObserver);
}
// return profile pic
function getProfilePicUrl() {
    return firebase.auth().currentUser.photoURL || 'assets/images/profile_placeholder.png';
}

// return signed in users name
function getUserName() {
    return firebase.auth().currentUser.displayName;
}

// return signed in user ID
function getUserID() {
    return firebase.auth().currentUser.uid;
}

// check if user is signed-in
function isUserSignedIn() {
    return !!firebase.auth().currentUser;
}

// Generate 9 random letters
function generateLetters() {
    var letters = [];
    var possibleLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var possibleVowels = "AEIOU";
    var possibleConsonants = "BCDFGHJKLMNPQRSTVWXYZ";

    // For loop to get a random number (0-25) and get char at the position
    for (var i = 0; i < 5; i++) {
        letters.push(possibleLetters.charAt(Math.floor(Math.random() * possibleLetters.length)));
    }
    for (var j = 0; j < 2; j++) {
        letters.push(possibleVowels.charAt(Math.floor(Math.random() * possibleVowels.length)));
    }
    for (var k = 0; k < 2; k++) {
        letters.push(possibleConsonants.charAt(Math.floor(Math.random() * possibleConsonants.length)));
    }
    return letters;
}

// Start game button function
function startGame() {
    randomArray = generateLetters();
    var ref = db.ref('/GlobalGame/');
    ref.child('gameOngoing').set(true);
    ref.child('timer').set(60);
    ref.child('randomLetters').set(randomArray);
    ref.child('restartGame').set(true);
    startTimer(60);
}

// Start timer function, grabs the time on db and starts an interval every second to sync timers
function startTimer(timeLeft) {
    var timerRef = db.ref('/GlobalGame/timer/');
    var gameOngoingRef = db.ref('/GlobalGame/gameOngoing/');
    var gameTimer = setInterval(function() {
        timeLeft--;
        timerRef.set(timeLeft);
        // if timer is less than 1, stop interval
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
        }
    }, 1000);
}

// Get a random position on the game-container to place the hot word
function getRandomPosition(element) {
    var x = document.getElementById('game-container').clientWidth - 150;
    var y = document.getElementById('game-container').clientHeight - 250;
    var randomX = Math.floor(Math.random() * x);
    // +125 to prevent overlapping over the letter choices during game
    var randomY = 125 + Math.floor(Math.random() * y);
    return [randomX, randomY];
}

// Main game logic and sync all data
function gameUpdate() {
    var ref = db.ref('/GlobalGame/');
    var timerRef = db.ref('/GlobalGame/timer/');
    var gameOngoingRef = db.ref('/GlobalGame/gameOngoing/');
    var randomLetterRef = db.ref('/GlobalGame/randomLetters/');
    var restartGameRef = db.ref('/GlobalGame/restartGame/');
    var timeLeft;
    // Create random letter divs
    randomLetterRef.on('value', function(snap) {
        randomStringElement.innerHTML = '';
        randomArray = snap.val();
        for (var i = 0; i < randomArray.length; i++) {
            var randomLetter = document.createElement('div');
            randomLetter.innerHTML = randomArray[i];
            randomStringElement.appendChild(randomLetter);
        }
    });
    // New words, place on random positions in game-container
    db.ref('/Words/').on('child_added', function(snap) {
        var floatingText = document.createElement('div');
        floatingText.classList.add('floating-text');
        snap.forEach(function(dataSnap){
            floatingText.innerHTML = dataSnap.val().text;
        })
        gameElement.appendChild(floatingText);
        var xy = getRandomPosition(floatingText);
        floatingText.style.left = xy[0] + 'px';
        floatingText.style.top = xy[1] + 'px';
    });
    // Initial read onload to check if game is ongoing
    ref.once('value').then(function(snap) {
        if (snap.val().gameOngoing == true) {
            timeLeft = snap.val().timer;
            startGameElement.hidden = true;
            timerElement.hidden = false;
            randomStringElement.hidden = false;
            gameOngoing = true;
        } else {
            startGameElement.hidden = false;
            timerElement.hidden = true;
            randomStringElement.hidden = true;
            gameOngoing = false;
        }
    });
    // Sync game ongoing when another player clicks start game button and if game is ended, calculate winner
    gameOngoingRef.on('value', function(snap) {
        if (snap.val() == true) {
            startGameElement.hidden = true;
            timerElement.hidden = false;
            randomStringElement.hidden = false;
            winnerElement.hidden = true;
            gameOngoing = true;

        } else {
            startGameElement.hidden = false;
            timerElement.hidden = true;
            randomStringElement.hidden = true;
            winnerElement.hidden = false;
            gameOngoing = false;
            calculateWinner();
        }
    });
    restartGameRef.on('value', function(snap) {
        if (snap.val() == true) {
            restartGame();
            restartGameRef.set(false);
        }
    });
    // For every time tick, update screen
    timerRef.on('value', function(snap) {
        timeLeft = snap.val();
        timerElement.textContent = timeLeft;
        if (timeLeft <= 0) {
            gameOngoingRef.set(false);
        }
    });
    // Onload, if game is running, get time data
    timerRef.once('value', function(snap) {
        timeLeft = snap.val();
        timerElement.textContent = timeLeft;
        if (timeLeft > 0) {
            startTimer(timeLeft);
        }
    })
}

// Clear previous words in database and all floating words
function restartGame() {
    db.ref('/validWords/').remove()
        .then(function() {
            console.log('Removed valid Words db');
        })
        .catch(function(err) {
            console.error('Remove failed: ', err);
        });
    db.ref('/Words/').remove()
        .then(function() {
            console.log('Removed Words');
        });
    var floatingText = document.getElementsByClassName('floating-text');
    while (floatingText.length > 0) {
        floatingText[0].parentNode.removeChild(floatingText[0]);
    }
}

// Display winner function
function calculateWinner() {
    var winner;
    var ref = db.ref('/validWords/');
    var winnerArray = [];
    ref.once('value').then(function(snap) {
        // For each player, add their name and number of words into array
        snap.forEach(function(childSnap) {
            var snapObj = { name: childSnap.key, wordCount: childSnap.numChildren() };
            winnerArray.push(snapObj);
        })
    }).then(function() {
        if (winnerArray.length == 0) {
            numberOfWords = 0;
        } else {
            // Map through the player array and get the highest word count value
            var numberOfWords = Math.max.apply(Math, winnerArray.map(obj => obj.wordCount));
        }
        // Use the highest word count value from <230) and filter the player array to only players with that value of words and return their names into an array
        var filteredArray = winnerArray.filter(x => x.wordCount == numberOfWords).map(x => x.name);
        randomStringElement.hidden = false;
        winnerElement.hidden = false;
        winnerElement.innerHTML = 'Word Count: ' + numberOfWords;
        if (filteredArray.length == 0) {
            randomStringElement.innerHTML = '<p>No winner!!</p>';
        } else {
            randomStringElement.innerHTML = '<p>Winner: ' + filteredArray.join(' & ') + '</p>';
        }

    });
}

// Check if the letters in the word are from the given letters
function validLetters(word, array) {
    // Copy the letter array for splice mutations (so it doesn't affect the actual randomArray)
    var validLetterArray = [...array];
    for (var i = 0; i < word.length; i++) {
        // Find the index where word[i] letter matches the copied array validLetterArray, else return -1
        var foundIndex = validLetterArray.findIndex(function(element) {
            return element == word[i];
        });
        if (foundIndex == -1) {
            return false;
        } else {
            validLetterArray.splice(foundIndex, 1, '');
        }
    }
    return true;
}

// Check if the word is an English word
function validWord(msg) {
    var word = msg.toUpperCase().split('');
    for (var i = 0; i < word.length; i++) {
        if (!validLetters(word, randomArray)) {
            var invalidLettersSnackbar = {
                message: "Answers must use the letters provided, Try Again!",
                timeout: 2000
            };
            signInSnackbarElement.MaterialSnackbar.showSnackbar(invalidLettersSnackbar);
            return false;
        } else {
            // Look to find at least one element that matches an English word from allWords.js
            if (allWords.words.some(e => e.aa === msg.toLowerCase()) == false) {
                var invalidWordSnackBar = {
                    message: "Answers must be English words, Try Again!",
                    timeout: 2000
                };
                signInSnackbarElement.MaterialSnackbar.showSnackbar(invalidWordSnackBar);
                return false;
            }
        }
    }
    return true;
}

// load chat message and listen for new messages
function loadMessages() {
    var callback = function(snap) {
        var data = snap.val();
        displayMessage(snap.key, data.name, data.text, data.profilePicUrl, data.imageUrl);
    };
    // Load last 100 messages
    db.ref('/messages/').limitToLast(100).on('child_added', callback);
    db.ref('/messages/').limitToLast(100).on('child_changed', callback);
}

// Saves a new message on the Firebase DB.
function saveMessage(messageText) {
    return db.ref('/messages/').push({
        key: getUserID(),
        name: getUserName(),
        text: messageText,
        profilePicUrl: getProfilePicUrl()
    }).catch(function(error) {
        console.error('Error writing message to Firebase', error);
    });
}

function addToOnlineList(uuid, username) {
    currentRef = '/online/' + uuid;
    return db.ref(currentRef).push({
            name: username,
            uid: uuid
        })
        .catch(function(error) {
            console.error('Error adding to online list', error);
        });
}

// Check if the word has already been submitted to the database
function alreadySubmitted(msg) {
    var userRef = '/validWords/' + getUserName();
    var ref = db.ref(userRef);
    var upperMsg = msg.toUpperCase();
    var wordRefQuery = '/Words/' + upperMsg;
    var wordRef = db.ref(wordRefQuery);
    wordRef.once('value', function(snap) {
        // Check to see if the reference datasnapshot exists, else set a new record
        console.log(snap.exists());
        if(snap.exists()) {
            var alreadySubmittedSnackbar = {
                message: msg + ' has already been submitted, Try another word!',
                timeout: 2000
            };
            signInSnackbarElement.MaterialSnackbar.showSnackbar(alreadySubmittedSnackbar);
        }else {
            ref.child(upperMsg).set({
                key: getUserID(),
                name: getUserName(),
                text: upperMsg
            });
            wordRef.push({
                text: upperMsg
            });
        }
    })
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
    e.preventDefault();
    var message = messageInputElement.value;
    var isItValid = validWord(message);
    // Check that the user entered a message and is signed in.
    if (message && checkSignedInWithMessage()) {
        // Check if gaming is running
        if (gameOngoing == true) {
            //Check if string is one word (no spaces)
            if (message.includes(' ') == false) {
                if (isItValid == true) {
                    alreadySubmitted(message);
                }
            } else {
                var spaceSnackbar = {
                    message: "Answers can't have any spaces, Try Again!",
                    timeout: 2000
                };
                signInSnackbarElement.MaterialSnackbar.showSnackbar(spaceSnackbar);
            }
        }
        saveMessage(message).then(function() {
            // Clear message text field and re-enable the SEND button.
            resetMaterialTextfield(messageInputElement);
            toggleButton();
        });
    }
}

function refreshUserList() {
    db.ref('/online/').on('value', function(snap) {
        if (currentRef !== undefined) {
            db.ref(currentRef).onDisconnect().remove();
        }
        userListElement.innerHTML = '';
        snap.forEach(function(childSnap) {
            var childData = childSnap.val();
            var childName = childData[Object.keys(childData)[0]].name;
            var newLI = document.createElement("LI");
            var textnode = document.createTextNode(childName);
            newLI.appendChild(textnode);
            userListElement.appendChild(newLI);
        })
    });
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
    if (user) { // User is signed in!
        // Get the signed-in user's profile pic and name.
        var profilePicUrl = getProfilePicUrl();
        var userName = getUserName();
        // Set the user's profile pic and name.
        userPicElement.style.backgroundImage = 'url(' + profilePicUrl + ')';
        userNameElement.textContent = userName;

        // Show user's profile and sign-out button.
        userNameElement.removeAttribute('hidden');
        userPicElement.removeAttribute('hidden');
        signOutButtonElement.removeAttribute('hidden');

        // Hide sign-in button.
        signInButtonElement.setAttribute('hidden', 'true');
        signInButtonAnon.setAttribute('hidden', 'true');

    } else { // User is signed out!
        // Hide user's profile and sign-out button.

        if (currentRef !== undefined) {
            db.ref(currentRef).remove();
        }
        userNameElement.setAttribute('hidden', 'true');
        userPicElement.setAttribute('hidden', 'true');
        signOutButtonElement.setAttribute('hidden', 'true');

        // Show sign-in button.
        signInButtonElement.removeAttribute('hidden');
        signInButtonAnon.removeAttribute('hidden');
    }
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
    // Return true if the user is signed in Firebase
    if (isUserSignedIn()) {
        return true;
    }

    // Display a message to the user using a Toast.
    var data = {
        message: 'You must sign-in first',
        timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
    element.value = '';
    element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
    '<div class="message-container">' +
    '<div class="spacing"><div class="pic"></div></div>' +
    '<div class="message"></div>' +
    '<div class="name"></div>' +
    '</div>';

// Displays a Message in the UI. Template from Codelabs demo
function displayMessage(key, name, text, picUrl, imageUrl) {
    var div = document.getElementById(key);
    // If an element for that message does not exists yet we create it.
    if (!div) {
        var container = document.createElement('div');
        container.innerHTML = MESSAGE_TEMPLATE;
        div = container.firstChild;
        div.setAttribute('id', key);
        messageListElement.appendChild(div);
    }
    if (picUrl) {
        div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
    }
    div.querySelector('.name').textContent = name;
    var messageElement = div.querySelector('.message');
    if (text) { // If the message is text.
        messageElement.textContent = text;
        // Replace all line breaks by <br>.
        messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
    } else if (imageUrl) { // If the message is an image.
        var image = document.createElement('img');
        image.addEventListener('load', function() {
            messageListElement.scrollTop = messageListElement.scrollHeight;
        });
        image.src = imageUrl + '&' + new Date().getTime();
        messageElement.innerHTML = '';
        messageElement.appendChild(image);
    }
    // Show the card fading-in and scroll to view the new message.
    setTimeout(function() { div.classList.add('visible') }, 1);
    messageListElement.scrollTop = messageListElement.scrollHeight;
    messageInputElement.focus();
}

// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
    if (messageInputElement.value) {
        submitButtonElement.removeAttribute('disabled');
    } else {
        submitButtonElement.setAttribute('disabled', 'true');
    }
}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
    if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
        window.alert('You have not configured and imported the Firebase SDK. ' +
            'Make sure you go through the codelab setup instructions and make ' +
            'sure you are running the codelab using `firebase serve`');
    }
}

// Checks that Firebase has been imported.
checkSetup();

var dialog = document.querySelector('dialog');
var showDialogButton = document.querySelector('#sign-in-anonymous');
if (!dialog.showModal) {
    dialogPolyfill.registerDialog(dialog);
}
showDialogButton.addEventListener('click', function() {
    dialog.showModal();
});
dialog.querySelector('.close').addEventListener('click', function() {
    dialog.close();
});
dialog.querySelector('.accept').addEventListener('click', function() {
    var inputuser = dialog.querySelector('#username').value;
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(function() {
            firebase.auth().signInAnonymously()
                .then(function() {
                    console.log(firebase.auth().currentUser);
                    firebase.auth().currentUser.updateProfile({
                            displayName: inputuser
                        })
                        .then(function() {
                            userNameElement.innerHTML = firebase.auth().currentUser.displayName;
                        })
                        .then(function() {
                            addToOnlineList(getUserID(), getUserName());
                        })
                        .catch(function(err) {
                            console.error('Error updating anonymous user', err);
                        });
                })
                .then(function() {
                    return firebase.auth().currentUser;
                })
                .then(function() {
                    dialog.close();
                })
                .catch(function(error) {
                    console.error('Error signing in anonymously', error);
                })
        })
})

// Shortcuts to DOM Elements.
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var userListElement = document.getElementById('userlist-ul')
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signInButtonAnon = document.getElementById('sign-in-anonymous');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');
var startGameElement = document.getElementById('start-game');
var randomStringElement = document.getElementById('letter-container');
var timerElement = document.getElementById('timer');
var winnerElement = document.getElementById('winner-container');
var gameElement = document.getElementById('game-container');
// Saves message on form submit.
startGameElement.addEventListener('click', startGame);
messageFormElement.addEventListener('submit', onMessageFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// initialize Firebase
initFirebaseAuth();

// We load currently existing chat messages and listen to new ones.
window.onload = function() {
    loadMessages();
    refreshUserList();
    gameUpdate();
}