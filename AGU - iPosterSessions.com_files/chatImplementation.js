﻿
//enum:page momde!
const PAGE_MODE = {
    EDIT: "edit",
    VIEW: "view"
}
//this is just about chat window, is open: active, is close: inactive
const CHAT_STATE = {
    ACTIVE: "active",
    INACTIVE: "inactive"
}
function getChatUserName() {
    return localStorage.getItem('chatUserName')
}
function getChatEmailAddress() {
    return localStorage.getItem('chatEmailAddress');
}
function setChatUserName(username) {
    localStorage.setItem('chatUserName', username)
}
function setChatEmailAddress(email) {
    localStorage.setItem('chatEmailAddress', email);
}
//connected members
var users = [];

//start & end chat signal content
const startChatMessage = posterId + ':' + 'START_CHAT';
const endChatMessage = posterId + ':' + 'END_CHAT';
const syncRequestMessage = posterId + ':' + 'SYNC_CHAT_REQUEST';
const AuthorWelcomeMessagePrefix = 'Welcome to the chat room for my iPoster';

//chat helper object
var chatHelper;

//main chat objects
var clientChatObject;
var broadcasterChannel;
var posterChatChannel;

//current poster info
var posterId;
var posterName;
var authorNames;

//diagnostic information
var pageMode;

//broadcaster channel name
var broadcasterChannelName;

var AuthorWelcomeMessage;

//client information
var clientUniqueName;
var guestId;
var clientChatWindowState;
var authorChatWindowState
//~ when document is ready:
$(function () {
    let chatStatus = getChatFeatureStatus();
    if (chatStatus == true) {
        initializeChat();
        setEvents();
    }

});

//functionality
function initializeChat() {
    initializeChatRequiredFields();

    if (pageMode == PAGE_MODE.EDIT && isAuthor())
        authorChatInitialization(chatHelper, clientUniqueName, getChatUserName(), broadcasterChannelName);

    else if (pageMode == PAGE_MODE.VIEW)
        visitorChatInitialization(chatHelper, clientUniqueName, getChatUserName(), broadcasterChannelName);
};
function initializeChatRequiredFields() {


    chatHelper = new ChatHelper();
    clientChatWindowState = CHAT_STATE.INACTIVE;
    authorChatWindowState == CHAT_STATE.INACTIVE;
    posterId = getPosterId();
    broadcasterChannelName = getBroadcasterChannelName(posterId);
    posterName = getPosterTitle();
    authorNames = getAuthorNames();
    pageMode = getPageMode();

    if (getPageMode() == PAGE_MODE.EDIT && isAuthor() == true) {
        AuthorWelcomeMessage = AuthorWelcomeMessagePrefix + ' "' + getPosterTitle().trim() + '"'
    }

    if (getUserName())
        setChatUserName(getUserName());

    if (getUserEmail())
        setChatEmailAddress(getUserEmail());

    guestId = getChatUserUniqueIdForGuests();

    //Notice: We should not pass the ChatEmailAddress to this method!
    clientUniqueName = getChatUserUniqueName(getUserEmail(), guestId);
}
function getChatFeatureStatus() {
    return Boolean.parse($('#hdnChatIsEnable').val());
}
function getPosterId() {
    return $('#PageShortName').val();
}
function getBroadcasterChannelName(posterId) {
    return 'broadcaster_' + posterId;
}
function getPosterIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('s');
}
function getPosterTitle() {
    return $('#iTitleStudy').text();
}
function getAuthorNames() {
    return $('#iAuthorNames').text();
}
function getPageMode() {
    return Boolean.parse($('#EditMode').val()) == true ? PAGE_MODE.EDIT : PAGE_MODE.VIEW;
}
function getUserName() {
    return $('#ClientName').val();
}
function getUserEmail() {
    return $('#ClientEmailAddress').val();
}
function isAuthor() {
    return Boolean.parse($('#AuthorLoggedIn').val());
}
function getChatUserUniqueIdForGuests() {
    let chatGuestUserUniqueId = $('#GuestId').val();
    if (chatGuestUserUniqueId) {
        return chatGuestUserUniqueId;
        return alert('guest user id not found.');;
    }
}
function getChatUserUniqueName(clientEmailAddress, guestId) {

    if (clientEmailAddress) {
        return clientEmailAddress;
    }
    else {
        let storedName = localStorage.getItem('clientUniqueName');
        if (storedName) {
            return storedName;
        }
        localStorage.setItem('clientUniqueName', guestId);
        return guestId;
    }
}
function authorChatInitialization(chatHelper, clientUniqueName, clientName, broadcasterChannelName) {

    chatHelper.initializeClientChatObject(clientUniqueName, clientName).then(initializationResult => {
        if (initializationResult.status == false) {
            return alert(initializationResult.message);
        }
        clientChatObject = initializationResult.clientChatObject;
        authorInitializationCompleteEvent(chatHelper, clientChatObject, clientUniqueName, broadcasterChannelName, posterId);
    });
}

// function to handle User updates(user reachablity)
function handleUserUpdate(user, updateReasons) {

    if (user.identity == clientChatObject.user.identity)
        return;

    updateReasons.forEach(reason => {
        if (reason == 'online') {
            if (user.online == false) {

                if (posterChatChannel)
                    chatHelper.removeMember(posterChatChannel, user.identity).then(result => {
                        console.log(result.message);
                    });
            }
            else if (user.online == true) {
                if (broadcasterChannel)
                    sendSyncRequestMessageToSpeceficClient(chatHelper, broadcasterChannel, user.identity);
            }
        }
    });
}
function authorInitializationCompleteEvent(chatHelper, clientChatObject, clientUniqueName, broadcasterChannelName, posterId) {

    //load broadcaster channel as default channel
    chatHelper.getChannelByUniqueName(clientChatObject, broadcasterChannelName).then(result => {

        if (result.status == true) {
            broadcasterChannel = result.channel;
            joinAuthorToBroadcasterChannel(chatHelper, clientChatObject, broadcasterChannel, posterId, clientUniqueName);
        }
        else {
            chatHelper.createNewChannel(clientChatObject, broadcasterChannelName, "This is a public channel to broadcast important notices to clients", false).then(createChannelResult => {
                if (createChannelResult.status == true) {
                    broadcasterChannel = createChannelResult.channel;
                    joinAuthorToBroadcasterChannel(chatHelper, clientChatObject, broadcasterChannel, posterId, clientUniqueName);
                }
                else {
                    console.error(createChannelResult.message);
                    return alert('Broadcaster channel can not create. Please inform the system admin about this issue.');
                }
            });
        }
    });
}
function joinAuthorToBroadcasterChannel(chatHelper, clientChatObject, broadcasterChannel, posterId, clientUniqueName) {
    chatHelper.joinToChannel(broadcasterChannel).then(joinResult => {

        if (joinResult.status == false && joinResult.code != "50404") {
            console.error(joinResult.message);
            return alert('Author can not join to broadcaster channel. Please inform the system admin about this issue.');
        }
        //register broadcaster listeners
        resetBroadcasterListeners(broadcasterChannel);
        setUserUpdateHandlerForAllExistingUsers(broadcasterChannel);
        //if posterchannel is exists
        chatHelper.checkChannelExistence(clientChatObject, posterId).then(existanceResult => {

            if (existanceResult.status == false) {
                return true;
            }
            broadcastRemoveChannelMessage(chatHelper, broadcasterChannel).then(broadcastMessageResult => {
                //remove posterchannel
                chatHelper.serverSideDeleteChannel(existanceResult.channel.sid, clientUniqueName).then(deleteActionResult => {
                    if (deleteActionResult.status == false) {
                        console.error(deleteActionResult.message);
                        return alert('operation was not completed. please call admin');
                    }
                    else
                        posterChatChannel = null;
                });
            });


        });
    });
}
function visitorChatInitialization(chatHelper, clientUniqueName, clientName, broadcasterChannelName) {
    chatHelper.initializeClientChatObject(clientUniqueName, clientName).then(initializationResult => {
        if (initializationResult.status == false) {
            return alert(initializationResult.message);
        }
        clientChatObject = initializationResult.clientChatObject;
        visitorInitializationCompleteEvent(chatHelper, clientChatObject, clientUniqueName, broadcasterChannelName);
    });

}
function loadVisitorNameAndEmail(clientChatObject, clientUniqueName) {
    try {
        $(".ChatUserName").val(getChatUserName());
        $(".ChatEmailAddress").val(getChatEmailAddress());
    }
    catch (e) {
        console.error(e);
    }
}
function visitorInitializationCompleteEvent(chatHelper, clientChatObject, clientUniqueName, broadcasterChannelName) {
    loadVisitorNameAndEmail(clientChatObject);
    chatHelper.getChannelByUniqueName(clientChatObject, broadcasterChannelName).then(loadChannelResult => {

        if (loadChannelResult.status == false) {
            return console.error('broadcaster channel does not exists. please inform the admin');
        }
        broadcasterChannel = loadChannelResult.channel;

        //load broadcaster channel
        chatHelper.joinToChannel(broadcasterChannel).then(joinResult => {

            //error code:50404 means user joined before in this channel
            if (joinResult.status == false && joinResult.code != "50404") {

                if (joinResult.code == "50403")
                    return console.error('This chat(Broadcaster) is full. Please try again later.');
                else
                    return console.error('Client can not join to broadcaster channel. please inform the admin');
            }
            //register broadcaster listeners
            resetBroadcasterListeners(broadcasterChannel);

            //if posterchannel is exists
            chatHelper.checkChannelExistence(clientChatObject, posterId).then(existanceResult => {

                if (existanceResult.status == false) {
                    return true;
                }
                enableJoinChatButton();
                posterChatChannel = existanceResult.channel;

            });

        });
    });


}
function resetBroadcasterListeners(channel) {

    chatHelper.removeAllChannelListeners(channel);
    if (pageMode == PAGE_MODE.EDIT && isAuthor()) {
        chatHelper.addListenerOnMemberJoinedEvent(channel, memberJoinedInBroadcasterEvent);
    }
    else if (pageMode == PAGE_MODE.VIEW) {
        chatHelper.addListenerOnMessageAddedEvent(channel, newBroadcastedMessageReceivedEvent);
    }
}
function setUserUpdateHandlerForAllExistingUsers(channel) {
    chatHelper.getChannelMembers(channel).then(result => {
        result.forEach(member => {
            chatHelper.getUser(clientChatObject, member.identity).then(user => {
                user.on('updated', event => handleUserUpdate(event.user, event.updateReasons));
            });
        });
    });
}
function memberJoinedInBroadcasterEvent(member) {

    if (pageMode == PAGE_MODE.EDIT) {
        chatHelper.getUser(clientChatObject, member.identity).then(user => {
            user.on('updated', event => handleUserUpdate(event.user, event.updateReasons));
        });
    }
}
function broadcastRemoveChannelMessage(chatHelper, broadcasterChannel) {
    return chatHelper.sendMessage(broadcasterChannel, endChatMessage, null);
}
function resetPosterChatChannelListeners(chatHelper, channel) {
    chatHelper.removeAllChannelListeners(channel);
    chatHelper.addListenerOnMessageAddedEvent(channel, newMessageReceivedEvent);

    //Author in edit mode
    if (pageMode == PAGE_MODE.EDIT && isAuthor()) {
        chatHelper.addListenerOnMemberJoinedEvent(channel, memberJoinedEvent);
        chatHelper.addListenerOnMemberLeftEvent(channel, memberLeftEvent);
    }
}
function broadcastAddChannelMessage(chatHelper, broadcasterChannel) {
    return chatHelper.sendMessage(broadcasterChannel, startChatMessage);
}
function sendSyncRequestMessageToSpeceficClient(chatHelper, broadcasterChannel, userId) {
    let message = createSyncRequestMessage(userId);
    return chatHelper.sendMessage(broadcasterChannel, message);
}
function createSyncRequestMessage(userId) {
    return userId + ':' + syncRequestMessage;
}
function startChat() {
    let chatSettingResult = provideChatSettingsData();
    if (chatSettingResult.status == false) {

        return;
    }
    SaveChatSettings(chatSettingResult.data, true).then(saveResult => {
        authorChatWindowState = CHAT_STATE.ACTIVE;
        if (saveResult.status == false) {
            return console.error(saveResult);
        }
        initializeGeneralChatChannel().then(initResult => {
            if (initResult == false) {
                alert(initResult.message);
            }
            if (AuthorWelcomeMessage) {
                sendMessageByAuthor(AuthorWelcomeMessage);
            }

            $('.popupwindow_titlebar_button_close').unbind('click').bind("click", function () {
                window.onbeforeunload = null;
                $(".EndChat").trigger("click");
            });
        })

    })

}
function initializeGeneralChatChannel() {
    return new Promise((resolve) => {
        chatHelper.createNewChannel(clientChatObject, posterId, posterName, false).then(createChannelResult => {

            if (createChannelResult.status == false) {
                resolve({ status: false, message: createChannelResult.message });
            }
            posterChatChannel = createChannelResult.channel;
            chatHelper.joinToChannel(posterChatChannel).then(joinResult => {
                if (joinResult.code == false) {
                    resolve({ status: false, message: joinResult.message });
                }

                resetPosterChatChannelListeners(chatHelper, posterChatChannel);
                broadcastAddChannelMessage(chatHelper, broadcasterChannel);
                resolve({ status: true });

            });

        });
    });
}
function createAdditionalMessageAttributesJsonObject(senderEmailAddress, senderName, senderIsAuthor, sourceUsername, sourceMessage) {
    return {
        "senderEmailAddress": senderEmailAddress,
        "senderName": senderName,
        "senderIsAuthor": senderIsAuthor,
        "sourceUsername": sourceUsername,
        "sourceMessage": sourceMessage
    }
};
function sendMessage(chatHelper, channel, message, sourceUsername = null, sourceMessage = null) {
    var additionalProperties = createAdditionalMessageAttributesJsonObject(getChatEmailAddress(), getChatUserName(), isAuthor(), sourceUsername, sourceMessage);
    //isRepliedMessage and parentMessageId are just sent for now and dont use.
    chatHelper.sendMessage(channel, message, additionalProperties);

}
function createAdditionalUserAttributesJsonObject(emailAddress, name, isAuthor) {
    return {
        "emailAddress": emailAddress,
        "name": name,
        "isAuthor": isAuthor
    }
};
function channelAddedEvent(channel) {
    if (pageMode == PAGE_MODE.EDIT && isAuthor())
        return;

    posterChatChannel = channel;
    enableJoinChatButton();

}
function addUserToJoinedMemberList(userUniqueId, userName, userEmail) {
    let code = "";
    let userexists = false;
    userexists = users.includes(userEmail)

    if (userexists == false) {
        code = '<div class="user"  id="' + userUniqueId + '"><a id="' + userUniqueId + '" >' + userName + '</a><br /><span>' + userEmail + '</span></div>'; //" class="user"
        $("#divusers").append(code);
    }

    var height = $("#divusers")[0].scrollHeight;
    $("#divusers").scrollTop(height);
    users.push(userEmail);
}
var usersobject = [];
function memberJoinedEvent(member) {

    if (pageMode == PAGE_MODE.EDIT) {
        chatHelper.getUser(clientChatObject, member.identity).then(user => {
            addUserToJoinedMemberList(member.identity, user.attributes.name, user.attributes.emailAddress);
        });
    }
}
function resetChatForAuthor() {
    users = [];
    closeChatWindow();
}
function channelRemovedEvent(channel) {
    //this event does not call for author
    if (pageMode == PAGE_MODE.EDIT && isAuthor()) {
        resetChatForAuthor();
    }
    else
        endClientChatByForceOfTheAuthor();
}
function memberLeftEvent(member) {
    if (pageMode == PAGE_MODE.EDIT) {
        chatHelper.getUserDescriptor(clientChatObject, member.identity).then(user => {

            removeUserFromJoinedMemberList(member.identity, user.attributes.emailAddress);
        });
    }
}
function removeUserFromJoinedMemberList(userId, userEmailAddress) {
    var userexists = users.includes(userEmailAddress);
    if (userexists) {

        for (var i = 0; i < users.length; i++) {
            var getUserEmailAddress = users[i];
            if (getUserEmailAddress == userEmailAddress) {
                $("#" + userId).remove();
                //we should remove user from twilio here
                users.splice(i, 1);
            }
        }
    }
}
function newBroadcastedMessageReceivedEvent(message) {
    if (message.body === startChatMessage) {
        chatHelper.getChannelByUniqueName(clientChatObject, posterId).then(getChannelResult => {
            if (getChannelResult.status == false) {
                return alert(getChannelResult.message);
            }
            channelAddedEvent(getChannelResult.channel);
        });
    }
    else if (message.body === endChatMessage) {
        channelRemovedEvent(posterChatChannel);
    }
    //it means client conneced again: so we need to sync 
    else if (message.body === createSyncRequestMessage(clientUniqueName)) {
        if (clientChatWindowState == CHAT_STATE.ACTIVE) {
            chatHelper.joinToChannel(posterChatChannel).then(joinResult => {
                if (joinResult.status == false) {
                    //member already exists
                    if (joinResult.code == "50404") {
                        ;
                    }
                    else
                        alert('Your connection has been lost! please end chat and join again.');
                }
                resetPosterChatChannelListeners(chatHelper, posterChatChannel);
            });
        }
        else if (clientChatWindowState == CHAT_STATE.INACTIVE) {
            updateJoinChatButtonState();
        }
    }
}
function updateJoinChatButtonState() {
    chatHelper.getChannelByUniqueName(clientChatObject, posterId).then(getChannelResult => {
        //if I am not a member of channel or channel does not exists
        if (getChannelResult.status == false) {
            disableJoinChatButton();
        }
        else {
            enableJoinChatButton();
        }

    });
}
function newMessageReceivedEvent(message) {

    printMessageOnScreen(message.sid, message.attributes.senderIsAuthor, message.attributes.senderName, message.body, message.author == clientUniqueName, message.attributes.sourceUsername, message.attributes.sourceMessage);
}
function generateMessageHtmCode(messageObject) {

    let repliedMessaga = messageObject.isAReplyMessage == true ? '<span class="AuthorReply">@' + messageObject.originalMessageTitle + ": " + messageObject.originalMessageBody + '</span>' : ""
    let newMessageTitle = '<span><b class="userName' + (messageObject.messageSenderIsAuthor == true ? " isAuthor" : "") + '" messageTitle="' + messageObject.messageTitle + '" id="username_' + messageObject.messageId + '">' + messageObject.messageTitle + '</b></span>';
    let newMessage = '<span id=message_' + messageObject.messageId + '>' + messageObject.messageBody + ' </span>'

    let replyButton = messageObject.showReplyButton == true && !isAuthor() ? '<button id="replyButton_' + messageObject.messageId + '" class="answer submitButton">' + $('.answerText').html() + '</button>' : "";

    let result = '<div id=' + messageObject.messageId + ' class="message">' + newMessageTitle + ': ' + repliedMessaga + newMessage + '<br />' + replyButton + '</div>';
    return result;
}
function printMessageOnScreen(messageId, messageHasBeenSentByAuthor, username, message, messageHasBeenSentByCurrentClient, sourceUsername, sourceMessage) {
    let isReplyMessage = (sourceUsername && sourceMessage) ? true : false;
    let messageGeneratorInputObject = {
        messageId: messageId,
        messageTitle: username,
        messageSenderIsAuthor: messageHasBeenSentByAuthor,
        messageBody: message,
        isAReplyMessage: isReplyMessage,
        originalMessageTitle: sourceUsername,
        originalMessageBody: sourceMessage,
        showReplyButton: pageMode == PAGE_MODE.EDIT && isAuthor() == true && !isReplyMessage,
    }
    var messageElementHtmlCode = generateMessageHtmCode(messageGeneratorInputObject);
    $('#divChatWindow').append(messageElementHtmlCode);

    if (pageMode == PAGE_MODE.EDIT && isAuthor() == true) {
        $(".answer").unbind("click").bind('click', function (e) {

            e.preventDefault();

            var replyingto = $("#ParenMessagetId").attr("msgId");
            var cId = $(this).parent(".message").attr("id");

            if (replyingto != cId) {

                $("#ParenMessagetId").attr("msgId", cId);
                var userName = $("#username_" + cId).attr("messageTitle");

                $("#ParenMessagetId").text("Replying to: " + userName);
                $(".StopReply").show();
            }
        });
    }

    var height = $('#divChatWindow')[0].scrollHeight;
    $('#divChatWindow').scrollTop(height);
}
function printMessageHistoryOnScreen(messages) {

    for (var i = 0; i < messages.length; i++) {
        var messageElementHtmlCode = generateMessageHtmCode(messages[i]);
        $('#divChatWindow').append(messageElementHtmlCode);
    }
    var height = $('#divChatWindow')[0].scrollHeight;
    $('#divChatWindow').scrollTop(height);
}
function closeChatWindow() {
    $("#divusers").empty();
    $('#divChatWindow').empty()
    $("#popup-chat").PopupWindow("close");
    $("#popup-chat").hide();

}
function enableJoinChatButton() {
    $("#ctl00_LoginChatPnl").show();
    $("#ctl00_ChatClosedPnl").hide();
}
function disableJoinChatButton() {

    $("#ctl00_LoginChatPnl").hide();
    $("#ctl00_ChatClosedPnl").show();

}
function sendMessageByClient(message) {
    sendMessage(chatHelper, posterChatChannel, message);
    setTimeout(function () {
        $("#txtMessage").val("");
    }, 100);
    $(".StopReply").hide();
}
function sendMessageByAuthor(message) {

    var sourceMessage = getSourceMessage();
    var sourceUsername = getSourceUsername();

    sendMessage(chatHelper, posterChatChannel, message, sourceUsername, sourceMessage);
    setTimeout(function () {
        $("#txtMessage").val("");
        stopReply();
    }, 100);

}
function getSourceMessage() {
    var messageId = $("#ParenMessagetId").attr("msgid");
    if (messageId)
        return $("#message_" + messageId).text();
    else
        return null;
}
function getSourceUsername() {
    var messageId = $("#ParenMessagetId").attr("msgid");
    if (messageId)
        return $("#username_" + messageId).text();
    else
        return null;
}
function stopReply() {
    $("#ParenMessagetId").text("");
    $("#ParenMessagetId").removeAttr("msgId");
    $(".StopReply").hide();
}
function clearChatWindow() {
    $("#divChatWindow").html("");
}
function clientSetupChatWindow() {
    $("#divusers").html("");
    $("#UsersPanel").hide();
    $("body").find("div#wrapper").addClass("isUserIposterWrapper");
    $("body").find("div.w1").addClass("isUserIposterW1");
    $("body").find("div.w2").addClass("isUserIposterW2");

    $("#popup-chat").addClass("isUser");
    $(".isUser").parent("div").addClass("parentIsUser");
    setTimeout(function () {
        $(".parentIsUser").parent("#fancybox-content").addClass("isUserBoxContet");
        $(".isUserBoxContet").parent("div").parent("#fancybox-wrap").addClass("isUserWrap");
        $(".isUserWrap").prev("#fancybox-overlay").addClass("isUserOverlay");
    }, 500);
}
function endClientChatByForceOfTheClient(chatHelper, channel) {


    chatHelper.leaveChannel(channel).then(leaveResult => {
        if (leaveResult.status == false) {
            console.error(leaveResult);
        }

        removeIsUser();
        $("#popup-chat").hide();
        enableJoinChatButton();
        clientChatWindowState = CHAT_STATE.INACTIVE;
    });


}

function joinChat(username, email) {

    //we can update user attr just when username or email are different of current data
    chatHelper.updateUserAttributes(clientChatObject, createAdditionalUserAttributesJsonObject(email, username, isAuthor())).then(updateResult => {

        //it happens when join chat button, clicks multiple
        if (updateResult.status == false)
            console.error(updateResult.message);

        //update client data
        setChatUserName(username);
        setChatEmailAddress(email);


        chatHelper.getChannelByUniqueName(clientChatObject, posterId).then(getChannelResult => {
            if (getChannelResult.status == false) {
                return alert('getchannelresult' + getChannelResult.message);
            }
            posterChatChannel = getChannelResult.channel;
            clearChatWindow();
            //load chat message history (old conversations):
            chatHelper.getAllRawMessages(posterChatChannel, clientUniqueName).then(getMessagesResult => {
                if (getMessagesResult.status == false) {
                    return console.error(getMessagesResult.message);
                }

                printMessageHistoryOnScreen(getMessagesResult.data);
            });
            chatHelper.joinToChannel(posterChatChannel).then(joinResult => {

                //member already exists
                if (joinResult.status == false) {
                    if (joinResult.code == "50404") {
                        alert('warning(' + joinResult.code + '):' + joinResult.message);
                    }
                    else if (joinResult.code == "50403") {
                        return alert('This chat is full. Please try again later.');
                    }
                    else
                        return console.error(joinResult);

                }

                resetPosterChatChannelListeners(chatHelper, posterChatChannel);
                clientSetupChatWindow();
                openChatPnnel();
                clientChatWindowState = CHAT_STATE.ACTIVE;
            });
        })
    });
}
function endClientChatByForceOfTheAuthor() {

    removeIsUser();
    $("#popup-chat").hide();
    disableJoinChatButton();
    posterChatChannel = null;
    if (clientChatWindowState == CHAT_STATE.ACTIVE) {
        setTimeout(function () {
            alert('The author has closed the chat. Please use the "Contact Author" button to get in touch with the author.', 300);
        })

    }
    clientChatWindowState = CHAT_STATE.INACTIVE;
}
function downloadChatConversation() {
    chatHelper.getAllFormattedMessages(posterChatChannel, clientUniqueName).then(result => {
        if (result && result.data) {
            result.data = (posterName ? posterName.trim() + "\r\n" : "") + (authorNames ? authorNames.trim() + "\r\n" : "") + result.data;
        }

        downloadDataAsAFile(result.data);
    });
}
function downloadDataAsAFile(data) {


    var link = document.createElement('a');
    link.setAttribute('download', 'ChatConversation' + Date.now().toLocaleString() + '.txt');
    link.href = makeTextFile(data);
    document.body.appendChild(link);

    // wait for the link to be added to the document
    window.requestAnimationFrame(function () {
        var event = new MouseEvent('click');
        link.dispatchEvent(event);
        document.body.removeChild(link);
    });

}
function makeTextFile(text) {
    let textFile = null;
    var data = new Blob([text], { type: 'text/plain' });

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);

    return textFile;
}
function endOwnerChat(chatHelper, posterChatChannel, broadcasterChannel, clientUniqueName) {

    broadcastRemoveChannelMessage(chatHelper, broadcasterChannel).then(result => {
        chatHelper.checkChannelExistence(clientChatObject, posterId).then(checkResult => {
            users = [];
            closeChatWindow();
            authorChatWindowState = CHAT_STATE.INACTIVE;

            if (checkResult.status == true) {
                chatHelper.serverSideDeleteChannel(posterChatChannel.sid, clientUniqueName).then(result => {
                    //check result
                    if (result.status == false)
                        console.error(result);
                    posterChatChannel = null;
                });

            }

        });
    })

}
function removeIsUser() {
    $(".isUserWrap").prev("#fancybox-overlay").removeClass("isUserOverlay");
    $(".isUserBoxContet").parent("div").parent("#fancybox-wrap").removeClass("isUserWrap");
    $(".parentIsUser").parent("#fancybox-content").removeClass("isUserBoxContet");
    $(".isUser").parent("div").removeClass("parentIsUser");
    $("#popup-chat").removeClass("isUser");
    $("body").find("div#wrapper").removeClass("isUserIposterWrapper");
    $("body").find("div.w1").removeClass("isUserIposterW1");
    $("body").find("div.w2").removeClass("isUserIposterW2");


}
function validateJoinChatInputs(userName, email) {
    if (userName && email && ValidateEmail(email)) //ChatDetailid 
    {
        return true;
    }

    return false;
}
function ValidateEmail(email) {
    var expr = /^([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
    return expr.test(email);
};
function openChatPnnel() {
    $("#popup-chat").show();
    $("#ctl00_LoginChatPnl").hide();
    $("#fancybox-close").trigger("click");
    $('#spnWarning').hide();
}
function setEvents() {
    window.addEventListener('beforeunload', async function (e) {

        if (pageMode == PAGE_MODE.EDIT && isAuthor()) {
            broadcastRemoveChannelMessage(chatHelper, broadcasterChannel);
            //if channel is exists
            if (authorChatWindowState == CHAT_STATE.ACTIVE)
                chatHelper.serverSideDeleteChannel(posterChatChannel.sid, clientUniqueName);
        }
        else {
            chatHelper.leaveChannel(posterChatChannel);
            chatHelper.leaveChannel(broadcasterChannel);
        }
    });

    $("#popup-chat").parent("div").parent("#fancybox-content").parent("div").parent("#fancybox-wrap").addClass("ChatBoxContet");

    removeIsUser();

    $(".StopReply").hide();
    $("#joinChatLogin").unbind("click").bind('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        try {
            $('#spnWarning').hide();
            let userName = $(".ChatUserName").val();
            let email = $(".ChatEmailAddress").val();

            if (validateJoinChatInputs(userName, email)) {
                joinChat(userName, email);
            }
            else {

                if (!userName) {
                    $('#spnWarning').text('Please enter name!');
                    $('#spnWarning').show();

                } else if (!email) {
                    $('#spnWarning').text('Please enter email!');
                    $('#spnWarning').show();

                } else if (!ValidateEmail(email)) {
                    $('#spnWarning').text('Invalid email address.');
                    $('#spnWarning').show();

                }
                closeChatWindow();


                $("#ctl00_LoginChatPnl").show();
            }

            return false;
        } catch (e) {
            console.error(e);
        }
        finally {

        }
    });
    $(".EndChat").unbind("click").bind('click', function (e) {
        if (pageMode == PAGE_MODE.EDIT && isAuthor()) {
            getwarnmessage = confirm("Do you want to end chat? This will remove all messages and users from the chat.");
            if (getwarnmessage) {
                endOwnerChat(chatHelper, posterChatChannel, broadcasterChannel, clientUniqueName);
            }
        }
        else {
            var getwarnmessage = confirm("Do you really want to close chat?");

            if (getwarnmessage) {
                endClientChatByForceOfTheClient(chatHelper, posterChatChannel);
            }
        }


        window.onbeforeunload = null;
        e.preventDefault();
        return false;

    });
    $("a[data-toggle='modal']").unbind("click").bind('click', function (e) {

        e.preventDefault();
        var getId = $(this).attr("data-target");
        $(getId).toggle();
        $(getId).removeClass("fade");
        $("#fancybox-close").trigger("click");
        //var close = $(".close").attr("data-dismiss");
    });

    $(".close").unbind("click").bind('click', function (ev) {

        if ($(this).attr("data-dismiss") == "modal")
            $(getId).toggle();
        var authorId = $(".authorId").val();
        var getwarnmessage = '';
        if ($('#ctl00_LoginView_LoginStatus1').text() == "" || null || undefined) {
            getwarnmessage = confirm("Do you really want to close chat?");
        } else {
            getwarnmessage = confirm("Do you want to end chat? This will remove all messages and users from the chat.");
        }

        var getautor = authorId != undefined && authorId.length > 0
        if (getautor) {
            if (getwarnmessage) {
                removeIsUser();
                $("#divusers").html("");
                $("#divChatWindow").html("");
            }
        }
        else {
            removeIsUser();
        }
        window.onbeforeunload = null;
        ev.preventDefault();
    });

    $('.btnSendMsg').unbind("click").bind('click', function (e) {


        var message = $("#txtMessage").val();
        if (message && message.trim()) {
            if (pageMode == PAGE_MODE.EDIT && isAuthor())
                sendMessageByAuthor(message.trim());
            else
                sendMessageByClient(message.trim());
        }
        e.preventDefault();
        return false;
    });

    $(".SaveChat").unbind("click").bind('click', function (e) {

        e.preventDefault();

        downloadChatConversation();

    });

    $(".ChatEmailAddress").keypress(function (e) {

        if (e.which == 13) {
            $("#joinChatLogin").click();
        }
    });

    $('#txtMessage').unbind('keyup').bind('keyup', function (e) {

        if (e.which == 13 && !e.shiftKey) {
            var message = $("#txtMessage").val().trim();
            if (message.trim().length > 0) {
                if (pageMode == PAGE_MODE.EDIT && isAuthor())
                    sendMessageByAuthor(message);
                else
                    sendMessageByClient(message);
            }
            e.preventDefault();
            return false;
        }
    });
    $(".StopReply").unbind("click").bind('click', function (e) {
        e.preventDefault();
        $("#ParenMessagetId").text("");
        $("#ParenMessagetId").removeAttr("msgId");
        $(".StopReply").hide();
    });
}
