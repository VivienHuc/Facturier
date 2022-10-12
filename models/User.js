const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  raisonSociale: {
    type: String
  },
  identifiantTva: {
    type: String
  },
  formeJuridique: {
    type: String
  },
  telephone: {
    type: String
  },
  mail: {
    type: String
  },
  adresse: {
    type: String
  },
  cp: {
    type: String
  },
  ville: {
    type: String
  },
  updated: {
    type: Boolean,
    default: false
  }
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
