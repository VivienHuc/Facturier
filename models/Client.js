const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  entreprise: {
    type: String
    },
  prenom: {
    type: String
    },
  nom: {
    type: String,
  },
  adresse: {
    type: String,
    },
  adresseBis: {
    type: String
  },
  ville: {
    type: String,
  },
  cp: {
    type: String,
  },
  telephone: {
    type: String,
  },
  mail: {
    type: String,
  },
  devis: {
    type: Array,
  },
  factures: {
    type: Array,
    required: true
  },
  geoloc: {
    type: Object,
  },
  id: {
    type: String,
    required: true
  },
  clientID: {
    type: String,
    required: true
  }
});

const Client = mongoose.model('Client', ClientSchema);

module.exports = Client;
