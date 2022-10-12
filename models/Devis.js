const mongoose = require('mongoose');

const DevisSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  client_id: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  prenom: {
    type: String,
    required: true
  },
  adresse: {
    type: String,
    required: true
  },
  adresseBis: {
    type: String,
  },
  ville: {
    type: String,
    required: true
  },
  cp: {
    type: String,
    required: true
  },
  telephone: {
    type: String,
    required: true
  },
  mail: {
    type: String,
    required: true
  },
  counter: {
    type: String,
    required: true
  },
  devisNumber: {
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
  }
});

const Devis = mongoose.model('Devis', DevisSchema);

module.exports = Devis;
