const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({

from:String,
to:String,
message:String,
read:{
type:Boolean,
default:false
},

// Track which users have deleted this message for themselves
deletedFor:{
type:[String],
default:[]
},

// Flag if message is deleted for everyone
deletedForEveryone:{
type:Boolean,
default:false
},

time:{
type:Date,
default:Date.now
}

});

module.exports = mongoose.model("Message",MessageSchema);