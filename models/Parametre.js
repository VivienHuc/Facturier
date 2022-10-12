const mongoose = require('mongoose');

const ParametreSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  counter: {
    type: Number,
    required: true
  }
});

const Parametre = mongoose.model('Parametre', ParametreSchema);

module.exports = Parametre;
