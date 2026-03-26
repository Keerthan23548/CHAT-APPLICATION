const socket = io();

const username = localStorage.getItem("username");

// Emoji data
const commonEmojis = [
'😀','😃','😄','😁','😆','😅','🤣','😂',
'🙂','🙃','😉','😊','😇','🥰','😍','🤩',
'😘','😗','☺️','😚','😙','🥲','😋','😛',
'😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
'🤐','🤨','😐','😑','😶','😏','😒','🙄',
'😬','🤥','😌','😔','😪','🤤','😴','😷',
'🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴',
'😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
'😕','😟','🙁','☹️','😮','😯','😲','😳',
'🥺','😦','😧','😨','😰','😥','😢','😭',
'😱','😖','😣','😞','😓','😩','😫','🥱',
'😤','😡','😠','🤬','😈','👿','💀','☠️',
'💩','🤡','👹','👺','👻','👽','👾','🤖',
'👋','🤚','🖐️','✋','🖖','👌','🤌','🤏',
'✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
'👇','☝️','👍','👎','✊','👊','🤛','🤜',
'❤️','🧡','💛','💚','💙','💜','🖤','🤍',
'🤎','💔','❣️','💕','💞','💓','💗','💖',
'✨','🌟','⭐','🌙','☀️','⛅','☁️','❄️',
'🔥','💧','🌊','🎉','🎊','🎈','🎁','🎀'
];

// Check if user is logged in
if(!username){
window.location.href="login.html";
}

// Display current username in header
const currentUserProfile= localStorage.getItem("userProfile") || "default.png";
document.getElementById("currentUsername").innerText=username;

// Load user data to get latest profile picture
async function loadUserProfile(){
try{
const res = await fetch("/users");
const users = await res.json();
const myUser = users.find(u => u.username === username);
if(myUser && myUser.profile){
document.getElementById("userProfilePic").src = `/uploads/${myUser.profile}`;
localStorage.setItem("userProfile", myUser.profile);
}else{
document.getElementById("userProfilePic").src = `/uploads/${currentUserProfile}`;
}
}catch(err){
console.error(err);
document.getElementById("userProfilePic").src = `/uploads/${currentUserProfile}`;
}
}

loadUserProfile();

// Hide chat header initially
document.getElementById("emptyState").style.display="flex";
document.getElementById("chatHeader").style.display="none";

socket.emit("userConnected",username);

let selectedUser="";
let allUsers=[];

// Load all users from database
async function loadAllUsers(){
const res = await fetch("/users");
allUsers = await res.json();

// Get unread message counts
const unreadRes = await fetch(`/unreadCount/${username}`);
const unreadCounts = await unreadRes.json();

const usersDiv=document.getElementById("users");
usersDiv.innerHTML="";

allUsers.forEach(user=>{
if(user.username!==username){
const div=document.createElement("div");
div.className="user";

// Create user item with avatar and status indicator
const userItem = document.createElement("div");
userItem.className="user-item";

const avatarContainer= document.createElement("div");
avatarContainer.className="user-avatar-container";

const avatar = document.createElement("img");
avatar.className="user-avatar";
avatar.src=user.profile ? `/uploads/${user.profile}` : "https://via.placeholder.com/49";

const statusIndicator = document.createElement("div");
statusIndicator.className=onlineUsersList.includes(user.username) ? "user-avatar-online" : "user-avatar-offline";

avatarContainer.appendChild(avatar);
avatarContainer.appendChild(statusIndicator);

const userInfo = document.createElement("div");
userInfo.style.flex="1";

const userName = document.createElement("div");
userName.className="user-name";
userName.innerText=user.username;

const userStatus = document.createElement("div");
userStatus.className="user-status";
userStatus.innerText=onlineUsersList.includes(user.username) ? "Online" : "Offline";

userInfo.appendChild(userName);
userInfo.appendChild(userStatus);

// Add unread badge if there are unread messages
const unreadCount = unreadCounts[user.username] || 0;
if(unreadCount > 0){
const unreadBadge = document.createElement("div");
unreadBadge.className="unread-badge";
unreadBadge.innerText=unreadCount > 99 ? "99+" : unreadCount;
userInfo.appendChild(unreadBadge);
}

userItem.appendChild(avatarContainer);
userItem.appendChild(userInfo);

div.appendChild(userItem);

div.onclick=async()=>{
selectedUser=user.username;
document.getElementById("chatUser").innerText=user.username;
document.getElementById("chatAvatar").src=user.profile ? `/uploads/${user.profile}` : "https://via.placeholder.com/40";
document.getElementById("chatStatus").innerText=onlineUsersList.includes(user.username) ? "Online" : "Offline";
document.getElementById("emptyState").style.display="none";
document.getElementById("chatHeader").style.display="flex";
// Mark messages from this user as read
await fetch(`/markAsRead/${username}/${user.username}`,{method:"POST"});
loadMessages();
};

usersDiv.appendChild(div);
}
});
}

let onlineUsersList=[];

socket.on("onlineUsers",(users)=>{
onlineUsersList=users;
// Refresh user list to update online/offline status
if(allUsers.length>0){
loadAllUsers();
}
});

// Initial load of all users
loadAllUsers();

async function loadMessages(){

// Don't load messages if no user is selected
if(!selectedUser){
return;
}

const res = await fetch(`/messages/${username}/${selectedUser}`);

const messages = await res.json();

const chat=document.getElementById("chat-box");

chat.innerHTML="";

messages.forEach(msg=>{

const time = new Date(msg.time).toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
});

// Check if message is a file
const fileMatch = msg.message.match(/\[FILE:([^\]]+)\](.+)/);
if(fileMatch){
const fileName = fileMatch[1];
const fileData = fileMatch[2];

if(msg.from===username){
chat.innerHTML+=`
<div class="sent" data-id="${msg._id}" oncontextmenu="showDeleteMenu(event, '${msg._id}', '${msg.from}')" style="max-width:300px;">
<div style="text-align:center;">
<img src="${fileData}" alt="${fileName}" style="max-width:280px;max-height:280px;border-radius:8px;margin-bottom:8px;cursor:pointer;object-fit:cover;" onclick="viewImage('${fileData}')">
<div style="font-size:13px;color:#666;padding:4px 8px;">📎 ${fileName}</div>
</div>
<span class="time">${time} ✓✓</span>
<button class="delete-btn" onclick="showDeleteMenu(event, '${msg._id}', '${msg.from}')">🗑️</button>
</div>`;
}else{
chat.innerHTML+=`
<div class="received" data-id="${msg._id}" style="max-width:300px;">
<div style="text-align:center;">
<img src="${fileData}" alt="${fileName}" style="max-width:280px;max-height:280px;border-radius:8px;margin-bottom:8px;cursor:pointer;object-fit:cover;" onclick="viewImage('${fileData}')">
<div style="font-size:13px;color:#666;padding:4px 8px;">📎 ${fileName}</div>
</div>
<span class="time">${time}</span>
</div>`;
}
}else{
// Regular text message
if(msg.from===username){

chat.innerHTML+=`
<div class="sent" data-id="${msg._id}" oncontextmenu="showDeleteMenu(event, '${msg._id}', '${msg.from}')">
${msg.message}
<span class="time">${time} ✓✓</span>
<button class="delete-btn" onclick="showDeleteMenu(event, '${msg._id}', '${msg.from}')">🗑️</button>
</div>`;

}else{

chat.innerHTML+=`
<div class="received" data-id="${msg._id}">
${msg.message}
<span class="time">${time}</span>
</div>`;

}
}

});

// Refresh unread badges after loading messages (marks as read)
loadAllUsers();

// Scroll to bottom after loading messages
setTimeout(()=>{
const chat = document.getElementById("chat-box");
if(chat) chat.scrollTop = chat.scrollHeight;
}, 10);

}

function send(){

const message=document.getElementById("message").value;

socket.emit("privateMessage",{
from:username,
to:selectedUser,
message
});

document.getElementById("message").addEventListener("input",()=>{

socket.emit("typing",{
from:username,
to:selectedUser
});

});

// Don't add message here - it will come from socket event
document.getElementById("message").value="";

}

socket.on("message",(data)=>{

const chat=document.getElementById("chat-box");

const time = new Date(data.time).toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
});

// Check if message already exists (to avoid duplicates)
const existingMsg = document.querySelector(`[data-id="${data.id}"]`);
if(existingMsg) return;

// Only display message if we're currently viewing this conversation
// OR if it's our own sent message
if(selectedUser === "" && data.from !== username){
// Don't show messages from others when no user is selected
return;
}

const div=document.createElement("div");

div.className=data.from===username ? "sent":"received";
div.dataset.id=data.id;

// Check if message is a file
const fileMatch = data.message.match(/\[FILE:([^\]]+)\](.+)/);
if(fileMatch){
const fileName = fileMatch[1];
const fileData = fileMatch[2];

if(data.from===username){
// Only add context menu and delete button for sent messages
div.oncontextmenu=function(e){ showDeleteMenu(e, data.id, data.from); };
div.style.maxWidth= '300px';
div.innerHTML=`
<div style="text-align:center;">
<img src="${fileData}" alt="${fileName}" style="max-width:280px;max-height:280px;border-radius:8px;margin-bottom:8px;cursor:pointer;object-fit:cover;" onclick="viewImage('${fileData}')">
<div style="font-size:13px;color:#666;padding:4px 8px;">📎 ${fileName}</div>
</div>
<span class="time">${time} ✓✓</span>
<button class="delete-btn" onclick="showDeleteMenu(event, '${data.id}', '${data.from}')">🗑️</button>
`;
}else{
// No delete button for received messages
div.style.maxWidth= '300px';
div.innerHTML=`
<div style="text-align:center;">
<img src="${fileData}" alt="${fileName}" style="max-width:280px;max-height:280px;border-radius:8px;margin-bottom:8px;cursor:pointer;object-fit:cover;" onclick="viewImage('${fileData}')">
<div style="font-size:13px;color:#666;padding:4px 8px;">📎 ${fileName}</div>
</div>
<span class="time">${time}</span>
`;
}
}else{
// Regular text message
if(data.from===username){
// Only add context menu and delete button for sent messages
div.oncontextmenu=function(e){ showDeleteMenu(e, data.id, data.from); };
div.innerHTML=`
${data.message}
<span class="time">${time} ✓✓</span>
<button class="delete-btn" onclick="showDeleteMenu(event, '${data.id}', '${data.from}')">🗑️</button>
`;
}else{
// No delete button for received messages
div.innerHTML=`
${data.message}
<span class="time">${time}</span>
`;
}
}

chat.appendChild(div);

// Scroll to bottom when new message arrives
setTimeout(()=>{
chat.scrollTop = chat.scrollHeight;
}, 10);

});

async function deleteMessage(messageId, type){

if(type==="everyone"){
// Delete for everyone - mark as deleted in database
const res = await fetch("/deleteMessageForEveryone/" + messageId, {
method: "POST"
});

// Emit socket event to notify other users
socket.emit("deleteMessageForEveryone", messageId);

// Remove from UI
const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
if(messageDiv) messageDiv.remove();

}else if(type==="me"){
// Delete for me only - call API to mark as deleted for this user
await fetch(`/deleteMessageForMe/${messageId}/${username}`, {
method: "POST"
});

// Remove from UI
const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
if(messageDiv) messageDiv.remove();
}

// Close the menu
hideDeleteMenu();

}

let currentMenu=null;

function showDeleteMenu(event, messageId, messageFrom){

event.preventDefault();
event.stopPropagation();

// Remove any existing menu
hideDeleteMenu();

// Create context menu
const menu = document.createElement("div");
menu.className="delete-menu";
menu.innerHTML=`
<button onclick="deleteMessage('${messageId}', 'me')">Delete for Me</button>
<button onclick="deleteMessage('${messageId}', 'everyone')">Delete for Everyone</button>
`;

// Position menu near the click
document.body.appendChild(menu);

const x = event.clientX;
const y = event.clientY;

menu.style.left = x + "px";
menu.style.top = y + "px";

currentMenu = menu;

// Close menu when clicking elsewhere
setTimeout(()=>{
document.addEventListener("click", hideDeleteMenu, {once:true});
}, 100);

}

function hideDeleteMenu(){
if(currentMenu){
currentMenu.remove();
currentMenu=null;
}
}

// Listen for messages deleted by others
socket.on("messageDeleted", (messageId)=>{

const messageDiv=document.querySelector(`[data-id="${messageId}"]`);
if(messageDiv) messageDiv.remove();

});

// Listen for new message notifications to update unread count
socket.on("newMessageNotification", (data)=>{
// Only update if we're not currently viewing this user's chat
if(data.from !== selectedUser){
loadAllUsers();
}
});

socket.on("typing",(user)=>{

const chat=document.getElementById("chat-box");

const typing=document.createElement("div");

typing.id="typing";
typing.innerText=user+" is typing...";

chat.appendChild(typing);

setTimeout(()=>{
const el=document.getElementById("typing");
if(el) el.remove();
},2000);

});

function logout(){
localStorage.removeItem("username");
window.location.href="login.html";
}

// Profile picture functions
function openProfileUpload(){
document.getElementById("profileModal").style.display="flex";
}

function closeProfileModal(){
document.getElementById("profileModal").style.display="none";
document.getElementById("profileInput").value="";
document.getElementById("profilePreview").src="";
}

function previewProfile(){
const file = document.getElementById("profileInput").files[0];
if(file){
const reader = new FileReader();
reader.onload = function(e){
document.getElementById("profilePreview").src = e.target.result;
};
reader.readAsDataURL(file);
}
}

async function uploadProfile(){
const file = document.getElementById("profileInput").files[0];
if(!file){
alert("Please select a file first");
return;
}

const formData = new FormData();
formData.append("profile", file);
formData.append("username", username);

try{
const res = await fetch("/upload", {
method: "POST",
body: formData
});

const data = await res.json();

if(data.message === "Profile updated"){
// Save to localStorage
localStorage.setItem("userProfile", file.name);
// Update UI immediately
document.getElementById("userProfilePic").src = `/uploads/${file.name}?t=${Date.now()}`;
closeProfileModal();
alert("Profile picture updated!");
// Reload user list to update avatar everywhere
loadAllUsers();
}
}catch(err){
console.error(err);
alert("Failed to upload profile picture");
}
}

// Close modal when clicking outside
window.onclick = function(event){
const modal = document.getElementById("profileModal");
if(event.target == modal){
closeProfileModal();
}
const contactModal = document.getElementById("contactModal");
if(event.target == contactModal){
closeContactModal();
}
}

// Contact view functions
let currentSelectedUser="";

function viewContact(){
if(!selectedUser) return;

currentSelectedUser = selectedUser;
const allUsersDiv = document.getElementById("users");
const userElements = allUsersDiv.querySelectorAll(".user");

userElements.forEach(el=>{
const nameEl = el.querySelector(".user-name");
if(nameEl && nameEl.innerText === selectedUser){
const avatarEl = el.querySelector(".user-avatar");
const statusEl = el.querySelector(".user-status");

document.getElementById("contactAvatar").src = avatarEl ? avatarEl.src : "https://via.placeholder.com/150";
document.getElementById("contactName").innerText = selectedUser;
document.getElementById("contactStatus").innerText = statusEl ? statusEl.innerText : "Offline";

document.getElementById("contactModal").style.display="flex";
}
});
}

function closeContactModal(){
document.getElementById("contactModal").style.display="none";
}

function sendDocument(){
if(!selectedUser){
alert("Please select a user first");
return;
}
document.getElementById('documentInput').click();
}

function handleDocumentUpload(){
const fileInput = document.getElementById('documentInput');
const file= fileInput.files[0];

if(!file){
return;
}

// Validate file size (max 10MB)
if(file.size > 10 * 1024 * 1024){
alert('File size should be less than 10MB');
fileInput.value = '';
return;
}

const reader= new FileReader();
reader.onload = function(e){
const fileData = e.target.result;
const fileName = file.name;

// Send file via socket
socket.emit('privateMessage', {
from: username,
to: selectedUser,
message: `[FILE:${fileName}]${fileData}`,
isFile: true
});

// Add file message to chat
addFileMessage(fileName, fileData);

fileInput.value = '';
};

if(file.type.startsWith('image/')){
reader.readAsDataURL(file);
}else{
reader.readAsDataURL(file);
}
}

function addFileMessage(fileName, fileData){
const chat = document.getElementById('chat-box');
const div = document.createElement('div');
div.className = 'sent';
div.style.maxWidth= '300px';

let fileContent = '';

if(fileData && fileData.startsWith('data:image/')){
// Image file
fileContent = `
<div style="text-align:center;">
<img src="${fileData}" alt="${fileName}" style="max-width:280px;max-height:280px;border-radius:8px;margin-bottom:8px;cursor:pointer;object-fit:cover;" onclick="viewImage('${fileData}')">
<div style="font-size:13px;color:#666;padding:4px 8px;">📎 ${fileName}</div>
</div>
`;
}else{
// Other files
fileContent = `
<div style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(0,0,0,0.05);border-radius:8px;">
<div style="font-size:28px;">📄</div>
<div style="flex:1;">
<div style="font-weight:500;font-size:14px;">${fileName}</div>
<div style="font-size:12px;color:#666;">Document</div>
</div>
</div>
`;
}

div.innerHTML = fileContent;
chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;
}

function viewImage(imageSrc){
const modal = document.createElement('div');
modal.style.cssText = `
display:flex;
position:fixed;
top:0;
left:0;
width:100%;
height:100%;
background:rgba(0,0,0,0.9);
z-index:10000;
justify-content:center;
align-items:center;
cursor:pointer;
animation:fadeIn 0.3s ease;
`;

const img = document.createElement('img');
img.src= imageSrc;
img.style.cssText = `
max-width:90%;
max-height:90%;
object-fit:contain;
border-radius:8px;
`;

modal.appendChild(img);
modal.onclick = () => modal.remove();

document.body.appendChild(modal);
}

// Enhanced send function to handle regular messages
function send(){
const message = document.getElementById('message').value;

if(!message.trim()) return;

socket.emit('privateMessage',{
from:username,
to:selectedUser,
message
});

document.getElementById('message').addEventListener('input',()=>{
socket.emit('typing',{
from:username,
to:selectedUser
});
});

document.getElementById('message').value='';
}

// Filter users function
function filterUsers(){
const searchTerm = document.getElementById("searchInput").value.toLowerCase();
const allUsersDiv = document.getElementById("users");
const userElements = allUsersDiv.querySelectorAll(".user");

userElements.forEach(el=>{
const nameEl = el.querySelector(".user-name");
if(nameEl){
const userName = nameEl.innerText.toLowerCase();
if(userName.includes(searchTerm)){
el.style.display = "block";
}else{
el.style.display = "none";
}
}
});
}

// Initialize emoji picker - works even if DOMContentLoaded already fired
(function initEmojiPicker() {
console.log('Initializing emoji picker...');
const emojiBtn = document.querySelector('.emoji-btn');
const emojiPicker= document.getElementById('emojiPicker');

console.log('Emoji button:', emojiBtn);
console.log('Emoji picker:', emojiPicker);

if(!emojiBtn || !emojiPicker){
console.log('Elements not found, waiting for DOM...');
setTimeout(initEmojiPicker, 100);
return;
}

console.log('Elements found! Setting up emoji picker');

emojiBtn.addEventListener('click', function(e){
e.stopPropagation();
console.log('Emoji button clicked!');
toggleEmojiPicker();
});

// Generate emojis
commonEmojis.forEach(emoji => {
const span = document.createElement('span');
span.className = 'emoji-item';
span.textContent = emoji;
span.onclick = () => {
console.log('Emoji clicked:', emoji);
selectEmoji(emoji);
};
emojiPicker.appendChild(span);
});
console.log('Generated', commonEmojis.length, 'emojis');

// Close when clicking outside
document.addEventListener('click', function(event){
const emojiPickerEl = document.getElementById('emojiPicker');
const emojiBtnEl = document.querySelector('.emoji-btn');
if(emojiPickerEl && emojiBtnEl && !emojiPickerEl.contains(event.target) && !emojiBtnEl.contains(event.target)){
emojiPickerEl.classList.remove('show');
}
});
})();

function toggleEmojiPicker(){
const emojiPicker= document.getElementById('emojiPicker');
console.log('toggleEmojiPicker called, picker:', emojiPicker);
if(emojiPicker){
const isShowing = emojiPicker.classList.contains('show');
console.log('Emoji picker was showing:', isShowing);
emojiPicker.classList.toggle('show');
console.log('Emoji picker now showing:', emojiPicker.classList.contains('show'));
}
}

function selectEmoji(emoji){
const messageInput = document.getElementById('message');
if(messageInput && emoji){
messageInput.value += emoji;
toggleEmojiPicker();
messageInput.focus();
}
}
