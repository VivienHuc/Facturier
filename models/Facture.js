const mongoose = require('mongoose');

const FactureSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  client_id: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  limit: {
    type: String,
    required: true
  },
  limitHit: {
    type: Boolean,
    default: false
  },
  entreprise: {
    type: String,
    required: false
  },
  nom: {
    type: String,
    required: false
  },
  prenom: {
    type: String,
    required: false
  },
  adresse: {
    type: String,
    required: false
  },
  adresseBis: {
    type: String,
  },
  ville: {
    type: String,
    required: false
  },
  cp: {
    type: String,
    required: false
  },
  telephone: {
    type: String,
    required: false
  },
  mail: {
    type: String,
    required: false
  },
  counter: {
    type: String,
    required: true
  },
  factureNumber: {
    type: String,
    required: true
  },
  prestations: {
    type: Array,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  clientID: {
    type: String,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  payed: {
    type: Boolean
  },
  compta: {
    type: Boolean,
    default: false
  }
});

const Facture = mongoose.model('Facture', FactureSchema);

module.exports = Facture;
