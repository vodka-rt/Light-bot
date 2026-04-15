const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("🟢 Banco conectado"))
.catch(err => console.log(err));

module.exports = mongoose;
