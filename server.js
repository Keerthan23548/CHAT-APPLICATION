const multer=require("multer");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
require('dotenv').config();

const User= require("./models/user");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.options("*", cors());
app.use(express.json());
app.use(express.static("public"));

mongoose.connect("mongodb://127.0.0.1:27017/chatapp")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

app.delete("/deleteMessage/:id",async(req,res)=>{

await Message.findByIdAndDelete(req.params.id);

res.json({success:true});

});

/* ---------------- DELETE MESSAGE FOR ME ---------------- */

app.post("/deleteMessageForMe/:id/:username",async(req,res)=>{

const {id,username}=req.params;

// Add user to deletedFor array
await Message.findByIdAndUpdate(id,{
$addToSet:{deletedFor:username}
});

res.json({success:true});

});

/* ---------------- DELETE MESSAGE FOR EVERYONE ---------------- */

app.post("/deleteMessageForEveryone/:id",async(req,res)=>{

const {id}=req.params;

// Mark message as deleted for everyone
await Message.findByIdAndUpdate(id,{
deletedForEveryone:true
});

res.json({success:true});

});

/* ---------------- REGISTER ---------------- */

app.post("/register", async (req,res)=>{

const {username,password,email}=req.body;

const userExists = await User.findOne({$or:[{username},{email}]});

if(userExists){
return res.json({message:"User already exists"});
}

const user= new User({
username,
password,
email
});

await user.save();

res.json({success:true,message:"Registration successful"});

});

/* ---------------- LOGIN ---------------- */

app.post("/api/login", async (req,res)=>{

const {username,password}=req.body;

const user = await User.findOne({username});

if(!user){
return res.json({success:false,message:"User not found"});
}

if(user.password===password){

res.json({success:true});

}else{

res.json({success:false,message:"Wrong password"});

}

});

/* ---------------- PASSWORD RESET OTP ---------------- */

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = {};

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST || 'smtp.ethereal.email',
port: parseInt(process.env.SMTP_PORT) || 587,
secure: false,
auth: {
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASS
}
});

// Send reset OTP
app.post("/sendResetOTP", async (req,res)=>{

const {email} = req.body;

if(!email){
return res.json({success:false,message:"Email is required"});
}

// Check if user exists
const user = await User.findOne({email});
if(!user){
return res.json({success:false,message:"No account found with this email"});
}

// Generate 6-digit OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString();

// Store OTP with expiry (10 minutes)
otpStore[email] = {
otp,
expiresAt: Date.now() + 10*60*1000
};

// Send email
const mailOptions = {
from: '"Chat App" <noreply@chatapp.com>',
to: email,
subject: 'Password Reset OTP',
html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#667eea;">Password Reset Request</h2>
<p>You requested to reset your password. Use the following OTP:</p>
<div style="background:#f4f4f4;padding:20px;text-align:center;margin:20px 0;">
<span style="font-size:32px;font-weight:bold;letter-spacing:5px;color:#667eea;">${otp}</span>
</div>
<p>This OTP is valid for 10 minutes.</p>
<p>If you didn't request this, please ignore this email.</p>
</div>
`
};

try{
await transporter.sendMail(mailOptions);
console.log('OTP sent to:', email);
res.json({success:true,otp}); // In production, don't send OTP in response
}catch(err){
console.error('Email send error:', err);
res.json({success:false,message:"Failed to send OTP. Please try again."});
}

});

// Verify OTP and reset password
app.post("/verifyResetOTP", async (req,res)=>{

const {email,otp} = req.body;

if(!email || !otp){
return res.json({success:false,message:"Email and OTP are required"});
}

// Check if OTP exists and is valid
const storedOTP = otpStore[email];
if(!storedOTP){
return res.json({success:false,message:"OTP not found or expired"});
}

if(Date.now() > storedOTP.expiresAt){
delete otpStore[email];
return res.json({success:false,message:"OTP has expired"});
}

if(otp !== storedOTP.otp){
return res.json({success:false,message:"Invalid OTP"});
}

// Generate a temporary password
const tempPassword = Math.random().toString(36).slice(-8);

// Update user password
await User.updateOne(
{email},
{$set:{password:tempPassword}}
);

// Delete used OTP
delete otpStore[email];

res.json({success:true,message:"Password reset successful",tempPassword});

});

const storage = multer.diskStorage({
destination:"public/uploads",
filename:(req,file,cb)=>{
cb(null,Date.now()+"-"+file.originalname);
}
});

const upload = multer({storage});

app.post("/upload",upload.single("profile"),async(req,res)=>{

await User.updateOne(
{username:req.body.username},
{profile:req.file.filename}
);

res.json({message:"Profile updated"});

});

/* ---------------- CHAT HISTORY ---------------- */

app.get("/messages/:user1/:user2", async (req,res)=>{

const {user1,user2}=req.params;

// Get messages but exclude those deleted for user1
const messages = await Message.find({
$or:[
{from:user1,to:user2},
{from:user2,to:user1}
],
deletedForEveryone:false // Don't show messages deleted for everyone
}).sort({time:1});

// Filter out messages that are deleted for user1
const filteredMessages = messages.filter(msg => {
return !msg.deletedFor.includes(user1);
});

// Mark messages as read when loading (only messages TO user1 that are unread)
await Message.updateMany(
{from:user2,to:user1,read:false},
{$set:{read:true}}
);

res.json(filteredMessages);

});

app.get("/users",async(req,res)=>{

const users = await User.find({}, {username:1,profile:1});

res.json(users);

});

/* ---------------- CLEAR ALL USERS ---------------- */

app.delete("/clear-users", async (req,res)=>{

await User.deleteMany({});

res.json({success:true,message:"All users deleted"});

});

/* ---------------- CLEAR ALL MESSAGES ---------------- */

app.delete("/clear-messages", async (req,res)=>{

await Message.deleteMany({});

res.json({success:true,message:"All messages deleted"});

});

// Get unread message counts
app.get("/unreadCount/:username", async (req,res)=>{

const username = req.params.username;

const unreadCounts = await Message.aggregate([
{$match:{to:username,read:false}},
{$group:{_id:"$from",count:{$sum:1}}}
]);

// Convert to object {user1: 5, user2: 3}
const countObj = {};
unreadCounts.forEach(item=>{
countObj[item._id] = item.count;
});

res.json(countObj);

});

// Mark specific user's messages as read
app.post("/markAsRead/:user1/:user2", async (req,res)=>{

const {user1,user2}=req.params;

await Message.updateMany(
{from:user2,to:user1,read:false},
{$set:{read:true}}
);

res.json({success:true});

});

/* ---------------- SOCKET CHAT ---------------- */

const onlineUsers = {};

io.on("connection",(socket)=>{

socket.on("typing",(data)=>{

const receiverSocket = onlineUsers[data.to];

if(receiverSocket){
socket.to(receiverSocket).emit("typing",data.from);
}

});

socket.on("userConnected",(username)=>{

onlineUsers[username]=socket.id;

io.emit("onlineUsers",Object.keys(onlineUsers));

});

socket.on("privateMessage", async(data)=>{

const msg = new Message({
from:data.from,
to:data.to,
message:data.message,
time:new Date()
});

await msg.save();

const receiverSocket = onlineUsers[data.to];

// Send ONLY to the specific receiver
if(receiverSocket){
io.to(receiverSocket).emit("message",{
from:data.from,
to:data.to,
message:data.message,
time:msg.time,
id:msg._id
});
// Emit notification for unread count
io.to(receiverSocket).emit("newMessageNotification",{
from:data.from,
count:1
});
}

// Send back to sender only
socket.emit("message",{
from:data.from,
to:data.to,
message:data.message,
time:msg.time,
id:msg._id
});

});

socket.on("disconnect",()=>{

for(const user in onlineUsers){

if(onlineUsers[user]===socket.id){
delete onlineUsers[user];
}

}

io.emit("onlineUsers",Object.keys(onlineUsers));

});

socket.on("deleteMessageForEveryone", async(messageId)=>{

// Mark message as deleted for everyone
await Message.findByIdAndUpdate(messageId,{
deletedForEveryone:true
});

// Emit to all connected clients to remove this message
io.emit("messageDeleted", messageId);

});

});

/* ---------------- SERVER ---------------- */

server.listen(3000,()=>{
console.log("Server running at http://localhost:3000");
});