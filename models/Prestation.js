const mongoose = require('mongoose');

const PrestationSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  priceHT: {
    type: String,
    required: true
  },
  tva: {
    type: String,
    required: true
  },
  tvaValue: {},
  priceTTC: {
    type: Number,
    required: true
  },
  tvaMontant: {
    type: Number,
    required: true
  },
  id: {
    type: String,
    required: true
  }
});

const Prestation = mongoose.model('Prestation', PrestationSchema);

module.exports = Prestation;
