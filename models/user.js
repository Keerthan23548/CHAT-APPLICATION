const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

username:String,
password:String,
email:{
type:String,
unique:true,
sparse:true
},
profile:{
type:String,
default:"default.png"
}

});

module.exports = mongoose.model("User",UserSchema);