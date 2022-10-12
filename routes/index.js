var fonts = {
  Roboto: {
    normal: 'fonts/Roboto-Regular.ttf',
    bold: 'fonts/Roboto-Medium.ttf',
    italics: 'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-MediumItalic.ttf'
  }
};

const generateUniqueId = require('generate-unique-id');
const schedule = require('node-schedule');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  ensureAuthenticated,
  forwardAuthenticated
} = require('../config/auth');
const config = require('../config/nodemailer')
const NodeGeocoder = require('node-geocoder');
const PdfPrinter = require('pdfmake');
const User = require('../models/User');
const Client = require('../models/Client');
const Prestation = require('../models/Prestation');
const Parametre = require('../models/Parametre');
const Devis = require('../models/Devis');
const Facture = require('../models/Facture');
const ObjectId = require('mongodb').ObjectID;
const printer = new PdfPrinter(fonts);

const router = express.Router();

var options = {
  provider: 'opendatafrance',
  httpAdapter: 'https',
  formatter: null
};

var geocoder = NodeGeocoder(options);

const OAuth2 = google.auth.OAuth2
const OAuth2_client = new OAuth2(config.clientId, config.clientSecret)
OAuth2_client.setCredentials( {refresh_token : config.refreshToken} )
const accessToken = OAuth2_client.getAccessToken()

const transporter = nodemailer.createTransport({
  service: "gmail",
        auth: {
          type: "OAuth2",
          user: config.user,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          refreshToken: config.refreshToken,
          accessToken: accessToken
        }
});

function getDate() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  if (mm <= 9) {
    mm = '0' + mm;
  }
  var today = dd + '/' + mm + '/' + yyyy;
  return today;
}

function getEcheanceDate() {
  var date = new Date();
  date.setMonth(date.getMonth() + 1);
  var dd = date.getDate();
  var mm = date.getMonth() + 1;
  var yyyy = date.getFullYear();

  if (mm <= 9) {
    mm = '0' + mm;
  }
  var date = dd + '/' + mm + '/' + yyyy;
  return date;
}

function process(date) {
  var parts = date.split("/");
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

var j = schedule.scheduleJob('0 0 1 * *', function() {
  Parametre.findOne({
    "name": "factureCounter"
  }).then(counter => {
    counter.counter = 0;
    counter.save();
  })
});

router.get('/', forwardAuthenticated, (req, res) => res.render('welcome'));

router.get('/updateInfos', ensureAuthenticated, function(req, res) {
  User.findOne({
    _id: req.user._id
  }).then(user => {
    res.render('infos', {
      user: user
    })
  });
});

router.post('/updateInfos', ensureAuthenticated, function(req, res) {
  User.findOne({
    _id: new ObjectId(req.user._id)
  }).then(user => {
    user.adresse = req.body.adresse;
    user.cp = req.body.cp;
    user.ville = req.body.ville;
    user.telephone = req.body.telephone;
    user.mail = req.body.mail;
    user.raisonSociale = req.body.raisonSociale;
    user.identifiantTva = req.body.identifiantTva;
    user.formeJuridique = req.body.formeJuridique;
    user.updated = true;
    user.save();
  });
  res.redirect('/dashboard');
});

router.get('/dashboard', ensureAuthenticated, function(req, res) {
  Client.find({
    id: req.user._id
  }).sort({
    entreprise: 1
  }).exec(function(err, clients) {
    res.render('clients', {
      clients: clients
    })
  });
});

router.get('/client/:id', ensureAuthenticated, function(req, res) {
  Client.findOne({
    '_id': new ObjectId(req.params.id)
  }).then(client => {
    res.render('client', {
      client: client
    })
  });
});


router.get('/deleteClient/:id', ensureAuthenticated, function(req, res) {
  Client.deleteOne({
    '_id': new ObjectId(req.params.id)
  }, function(err) {
    if (err) return handleError(err);
    res.redirect('/');
  });
});

router.get('/updateClient/:id', ensureAuthenticated, function(req, res) {
  Client.findOne({
    '_id': new ObjectId(req.params.id)
  }).then(client => {
    res.render('updateClient', {
      client: client
    })
  });
});

router.post('/updateClient/:id', ensureAuthenticated, function(req, res) {
  Client.findOne({
    '_id': new ObjectId(req.body.id)
  }).then(client => {
    if (client.adresse != req.body.adresse || client.ville != req.body.ville) {
      geocoder.geocode(req.body.adresse + ' ' + req.body.ville, function(err, geoloc) {
        client.geoloc = {
          latitude: geoloc[0].latitude,
          longitude: geoloc[0].longitude
        };
        client.entreprise = req.body.entreprise;
        client.nom = req.body.nom;
        client.prenom = req.body.prenom;
        client.adresse = req.body.adresse;
        client.adresseBis = req.body.adresseBis;
        client.ville = req.body.ville;
        client.cp = req.body.cp;
        client.telephone = req.body.telephone;
        client.mail = req.body.mail;
        client.save();
      });
    } else {
      client.entreprise = req.body.entreprise;
      client.nom = req.body.nom;
      client.prenom = req.body.prenom;
      client.adresse = req.body.adresse;
      client.adresseBis = req.body.adresseBis;
      client.ville = req.body.ville;
      client.cp = req.body.cp;
      client.telephone = req.body.telephone;
      client.mail = req.body.mail;
      client.save();
    }
  })
  res.redirect('/client/' + req.body.id);
});

router.post("/search", (req, res) => {
  Client.find({
    $or: [{
        "entreprise": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "nom": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "prenom": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "telephone": req.body.search
      },
      {
        "adresse": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "adresseBis": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "ville": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "clientID": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "cp": {
          $regex: new RegExp(req.body.search, 'i')
        }
      }
    ]
  }, function(err, clients) {
    if (!err) {
      var userClients = [];
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].id == req.user._id.toString()) {
          userClients.push(clients[i]);
        }
      }
      res.render('clients', {
        clients: userClients
      })
    };
  });
});

router.get('/prestations', ensureAuthenticated, function(req, res) {
  Prestation.find({
    id: req.user._id
  }).then(prestations => {
    res.render('prestations', {
      prestations: prestations
    })
  });
});

router.get('/deletePrestation/:id', ensureAuthenticated, function(req, res) {
  Prestation.deleteOne({
    '_id': new ObjectId(req.params.id)
  }, function(err) {
    if (err) return handleError(err);
    res.redirect('/prestations');
  });
});

router.post("/prestationsSearch", (req, res) => {
  Prestation.find({
    "name": {
      $regex: new RegExp(req.body.search, 'i')
    }
  }, function(err, prestations) {
    if (!err) {
      var userPrestations = [];
      for (var i = 0; i < prestations.length; i++) {
        if (prestations[i].id == req.user._id.toString()) {
          userPrestations.push(prestations[i])
        }
      }
      res.render('prestations', {
        prestations: userPrestations
      })
    }
  });
});

router.get('/add', ensureAuthenticated, function(req, res) {
  res.render('add');
});

router.post('/addClient', ensureAuthenticated, function(req, res) {
  if (req.body.adresse == "" || req.body.ville == "") {
    var newClient = new Client({
      _id: new ObjectId(),
      entreprise: req.body.entreprise,
      prenom: req.body.prenom,
      nom: req.body.nom,
      adresse: req.body.adresse,
      adresseBis: req.body.adresseBis,
      ville: req.body.ville,
      cp: req.body.cp,
      telephone: req.body.telephone,
      mail: req.body.mail,
      devis: [],
      factures: [],
      geoloc: {
        latitude: "",
        longitude: ""
      },
      id: req.user._id.toString(),
      clientID: generateUniqueId({
        length: 5
      })
    });
    newClient.save(function(err) {
      if (err) return console.log(err);
      res.redirect('/');
    });
  } else {
    geocoder.geocode(req.body.adresse + ' ' + req.body.adresseBis + ' ' + req.body.ville, function(err, geoloc) {
      var newClient = new Client({
        _id: new ObjectId(),
        entreprise: req.body.entreprise,
        prenom: req.body.prenom,
        nom: req.body.nom,
        adresse: req.body.adresse,
        adresseBis: req.body.adresseBis,
        ville: req.body.ville,
        cp: req.body.cp,
        telephone: req.body.telephone,
        mail: req.body.mail,
        devis: [],
        factures: [],
        geoloc: {
          latitude: geoloc[0].latitude,
          longitude: geoloc[0].longitude
        },
        id: req.user._id.toString(),
        clientID: generateUniqueId({
          length: 5
        })
      });
      newClient.save(function(err) {
        if (err) return console.log(err);
        res.redirect('/');
      });
    });
  }
});

router.post('/addPrestation', ensureAuthenticated, function(req, res) {
  var tva = JSON.parse(req.body.tva);
  var newTvaValue = Number(tva.tvaValue);
  var newPriceTTC = Math.round(req.body.price * newTvaValue * 100) / 100;
  var newTvaMontant = Math.round((newPriceTTC - req.body.price) * 100) / 100;
  var newPrestation = new Prestation({
    _id: new ObjectId(),
    name: req.body.name,
    priceHT: req.body.price,
    tva: tva.tva,
    tvaValue: newTvaValue,
    priceTTC: newPriceTTC,
    tvaMontant: newTvaMontant,
    id: req.user._id
  });
  newPrestation.save(function(err) {
    if (err) return console.log(err);
    res.redirect('/prestations');
  });
});

router.get("/devis/:id", ensureAuthenticated, (req, res) => {
  Client.findOne({
    "_id": new ObjectId(req.params.id)
  }, (error, this_client) => {
    if (error) return res.status(500).send(error);
    Prestation.find({
      id: req.user._id
    }).then(prestations => {
      res.render('devis', {
        this_client: this_client,
        prestations: prestations
      });
    });
  });
});

router.get("/devis", ensureAuthenticated, (req, res) => {
  Devis.find({
    id: req.user._id
  }).then(devis => {
    res.render('devisList', {
      devis: devis
    })
  });
});

router.post("/devis", ensureAuthenticated, (req, res) => {
  Parametre.findOne({
    "name": "devisCounter"
  }, function(err, result) {
    function getNumber(counter) {
      var resultat;
      var today = new Date();
      var year = today.getFullYear();
      var month = today.getMonth();
      month++;
      if (month <= 9) {
        month = '0' + month;
      }
      resultat = year.toString() + '.' + month.toString() + '_' + counter.toString();
      return resultat;
    }

    function giveContent() {
      var resultat = [];
      resultat.push([{
        text: 'Désignation',
        bold: true
      }, {
        text: 'Prix Unitaire HT',
        bold: true
      }, {
        text: 'Quantité',
        bold: true
      }, {
        text: 'Montant HT',
        bold: true
      }]);
      for (var i = 0; i <= req.body.counter; i++) {
        if (req.body.name[i] && req.body.tva[i] && req.body.quantity[i] && req.body.price[i] && req.body.priceTTC[i]) {
          resultat.push([
            req.body.name[i],
            Number(req.body.price[i]).toFixed(2) + "€",
            req.body.quantity[i],
            Number(req.body.price[i] * req.body.quantity[i]).toFixed(2) + "€",
          ]);
        }
      }
      return resultat;
    }

    function giveTotal() {
      var resultat = [];
      var totalHT = 0;
      var totalTVA = 0;
      var totalTTC = 0;
      for (var i = 0; i <= req.body.counter; i++) {
        if (req.body.price[i] && req.body.tvaMontant[i] && req.body.priceTTC[i]) {
          totalHT += Number(req.body.price[i]) * Number(req.body.quantity[i]);
          totalTVA += Number(req.body.tvaMontant[i]) * Number(req.body.quantity[i]);
          totalTTC += Number(req.body.priceTTC[i]) * Number(req.body.quantity[i]);
        }
      }
      resultat.push([{
        text: 'Total HT',
        bold: true
      }, totalHT.toFixed(2) + "€"]);
      resultat.push([{
        text: 'Total TVA',
        bold: true
      }, totalTVA.toFixed(2) + "€"]);
      resultat.push([{
        text: 'Total TTC',
        bold: true
      }, totalTTC.toFixed(2) + "€"]);
      return resultat;
    }
    var docDefinition = {
      pageMargins: [0, 100, 0, 0],
      header: {
        columns: [{
            image: "views/src/facturelogo.png",
            width: 130,
            height: 130,
            margin: 10
          },
          {
            text: [
              'Identifiant TVA : ' + req.user.identifiantTva + '\n',
              req.user.formeJuridique + ' ' + req.user.raisonSociale + '\n',
              req.user.adresse + '\n',
              req.user.ville + ' ' + req.user.cp + '\n',
              req.user.email + '\n',
              req.user.telephone
            ],
            alignment: 'right',
            margin: 10
          }
        ]
      },
      content: [{
        columns: [{
          text: [{
              text: "Identifiant Client: " + req.body.clientID + "\n",
              fontSize: 13.5,
              bold: true
            },
            {
              text: "Devis Numéro: " + getNumber(result.counter) + "\n",
              fontSize: 13.5,
              bold: true
            },
            {
              text: "Date du Devis: " + getDate() + "\n",
              fontSize: 13.5,
              bold: true
            },
            {
              text: "Date de Validité: " + getEcheanceDate(),
              fontSize: 13.5,
              bold: true
            },
          ],
          margin: [40, 50]
        }, {
          text: [
            req.body.nom + " ",
            req.body.prenom + "\n",
            req.body.adresse + "\n",
            req.body.adresseBis + "\n",
            req.body.cp + " " + req.body.ville + "\n",
            req.body.telephone + "\n",
            req.body.mail
          ],
          alignment: 'right',
          margin: 40
        }]
      }, {
        margin: 20,
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*'],
          body: giveContent()
        }
      }, {
        margin: [300, 10],
        table: {
          headerRows: 1,
          widths: [100, 80],
          body: giveTotal()
        }
      }]
    };
    var options = {};
    var devisName = 'Devis N°' + getNumber(result.counter) + '.pdf';
    var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(devisName));
    Client.findOne({
      '_id': new ObjectId(req.body._id)
    }).then(client => {
      client.devis.push(devisName);
      client.save();
    });
    var newDevis = {};
    newDevis._id = new ObjectId();
    newDevis.client_id = req.body._id;
    newDevis.clientID = req.body.clientID;
    newDevis.nom = req.body.nom;
    newDevis.prenom = req.body.prenom;
    newDevis.adresse = req.body.adresse;
    newDevis.adresseBis = req.body.adresseBis;
    newDevis.ville = req.body.ville;
    newDevis.cp = req.body.cp;
    newDevis.telephone = req.body.telephone;
    newDevis.mail = req.body.mail;
    newDevis.counter = req.body.counter;
    newDevis.devisNumber = getNumber(result.counter);
    newDevis.prestations = [];
    newDevis.id = req.user._id;
    for (var i = 0; i <= newDevis.counter; i++) {
      newDevis.prestations.push({
        id: req.body.id[i],
        name: req.body.name[i],
        price: req.body.price[i],
        quantity: req.body.quantity[i],
        priceTTC: req.body.priceTTC[i],
        tvaMontant: req.body.tvaMontant[i],
        tvaValue: req.body.tvaValue[i],
        tva: req.body.tva[i]
      })
    }
    var saveDevis = new Devis(newDevis);
    saveDevis.save(function(err) {
      if (err) return console.log(err);
    });
    pdfDoc.end();
    var mailOptions = {
      from: 'no-reply@factureplus.com',
      to: req.body.mail,
      subject: 'Devis',
      text: 'Un nouveau devis est disponible',
      attachments: [{
        path: devisName
      }]
    };
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  });
  Parametre.findOne({
    "name": "devisCounter"
  }).then(counter => {
    counter.counter++;
    counter.save();
  });
  var redirLink = '/client/' + req.body._id;
  res.redirect(redirLink);
});

router.get("/displayDevis/:id", ensureAuthenticated, (req, res) => {
  Devis.findOne({
    "_id": new ObjectId(req.params.id)
  }, (error, devis) => {
    if (error) return res.status(500).send(error);
    devis._id = req.params.id;
    res.render('displayDevis', {
      devis: devis
    });
  });
});

router.get("/deleteDevis/:id", ensureAuthenticated, (req, res) => {
  Devis.deleteOne({
    '_id': new ObjectId(req.params.id)
  }, function(err) {
    if (err) return handleError(err);
    res.redirect('/devis');
  });
});

router.post("/devisSearch", (req, res) => {
  Devis.find({
    $or: [{
        "devisNumber": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "nom": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "prenom": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "adresse": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "adresseBis": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "ville": {
          $regex: new RegExp(req.body.search, 'i')
        }
      },
      {
        "clientID": {
          $regex: new RegExp(req.body.search, 'i')
        }
      }
    ]
  }, function(err, devis) {
    if (!err) {
      var userDevis = [];
      for (var i = 0; i < devis.length; i++) {
        if (devis[i].id == req.user._id.toString()) {
          userDevis.push(devis[i])
        }
      }
      res.render('devisList', {
        devis: userDevis
      })
    }
  });
});

router.get("/factures", ensureAuthenticated, (req, res) => {
  Facture.find({
    id: req.user._id
  }).sort({
    date: 'descending'
  }).exec(function(err, factures) {
    for (var i = 0; i < factures.length; i++) {
      if (process(getDate()) >= process(factures[i].limit)) {
        factures[i].limitHit = true;
      }
    }
    res.render('factures', {
      factures: factures,
      searched: ""
    })
  });
});

router.post("/factureSearch", (req, res) => {
  if (req.body.searchFilter == 'notPayed') {
    Facture.find({
      $and: [{
          $or: [{
              "factureNumber": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "nom": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "prenom": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "adresse": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "adresseBis": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "ville": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "clientID": {
                $regex: new RegExp(req.body.search, 'i')
              }
            }
          ]
        },
        {
          payed: false
        }
      ]
    }, null, {
      sort: {
        index: 'descending'
      }
    }, function(err, factures) {
      if (!err) {
        var userFactures = [];
        for (var i = 0; i < factures.length; i++) {
          if (process(getDate()) >= process(factures[i].limit)) {
            factures[i].limitHit = true;
          }
          if (factures[i].id == req.user._id.toString()) {
            userFactures.push(factures[i])
          }
        }
        res.render('factures', {
          factures: userFactures,
          searched: req.body.search
        })
      }
    });
  } else if (req.body.searchFilter == 'isPayed') {
    Facture.find({
      $and: [{
          $or: [{
              "factureNumber": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "nom": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "prenom": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "adresse": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "adresseBis": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "ville": {
                $regex: new RegExp(req.body.search, 'i')
              }
            },
            {
              "clientID": {
                $regex: new RegExp(req.body.search, 'i')
              }
            }
          ]
        },
        {
          payed: true
        }
      ]
    }, null, {
      sort: {
        index: 'descending'
      }
    }, function(err, factures) {
      if (!err) {
        var userFactures = [];
        for (var i = 0; i < factures.length; i++) {
          if (process(getDate()) >= process(factures[i].limit)) {
            factures[i].limitHit = true;
          }
          if (factures[i].id == req.user._id.toString()) {
            userFactures.push(factures[i])
          }
        }
        res.render('factures', {
          factures: userFactures,
          searched: req.body.search
        })
      }
    });
  } else {
    Facture.find({
      $or: [{
          "factureNumber": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "nom": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "prenom": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "adresse": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "adresseBis": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "ville": {
            $regex: new RegExp(req.body.search, 'i')
          }
        },
        {
          "clientID": {
            $regex: new RegExp(req.body.search, 'i')
          }
        }
      ]
    }, null, {
      sort: {
        index: 'descending'
      }
    }, function(err, factures) {
      if (!err) {
        var userFactures = [];
        for (var i = 0; i < factures.length; i++) {
          if (process(getDate()) >= process(factures[i].limit)) {
            factures[i].limitHit = true;
          }
          if (factures[i].id == req.user._id.toString()) {
            userFactures.push(factures[i])
          }
        }
        res.render('factures', {
          factures: userFactures,
          searched: req.body.search
        })
      }
    });
  }
});

router.post("/isPayed/:id", ensureAuthenticated, (req, res) => {
  Facture.findOne({
    _id: req.params.id
  }).then(facture => {
    facture.payed = true;
    facture.save();
  });
  Facture.find({
    $or: [{
        "factureNumber": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "nom": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "prenom": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "adresse": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "adresseBis": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "ville": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      },
      {
        "clientID": {
          $regex: new RegExp(req.body.searched, 'i')
        }
      }
    ]
  }, null, {
    sort: {
      index: 'descending'
    }
  }, function(err, factures) {
    if (!err) {
      var userFactures = [];
      for (var i = 0; i < factures.length; i++) {
        if (process(getDate()) >= process(factures[i].limit)) {
          factures[i].limitHit = true;
        }
        if (factures[i].id == req.user._id.toString()) {
          userFactures.push(factures[i])
        }
      }
      res.render('factures', {
        factures: userFactures,
        searched: req.body.searched
      })
    }
  });
});

router.post("/devisToFacture", ensureAuthenticated, (req, res) => {
  Parametre.findOne({
    "name": "factureCounter"
  }, (error, result) => {
    if (error) return res.status(500).send(error);
    Devis.findOne({
      '_id': new ObjectId(req.body._id)
    }, (error, devis) => {
      if (error) return res.status(500).send(error);
      var newFacture = {};
      newFacture._id = new ObjectId();
      newFacture.client_id = devis.client_id;
      newFacture.clientID = devis.clientID;
      newFacture.nom = devis.nom;
      newFacture.prenom = devis.prenom;
      newFacture.adresse = devis.adresse;
      newFacture.adresseBis = devis.adresseBis;
      newFacture.ville = devis.ville;
      newFacture.cp = devis.cp;
      newFacture.telephone = devis.telephone;
      newFacture.mail = devis.mail;
      newFacture.counter = devis.counter;
      newFacture.factureNumber = getNumber(result.counter);
      newFacture.prestations = [];
      newFacture.id = req.user._id;
      for (var i = 0; i <= newFacture.counter; i++) {
        newFacture.prestations.push({
          id: devis.prestations[i].id,
          name: devis.prestations[i].name,
          price: devis.prestations[i].price,
          quantity: devis.prestations[i].quantity,
          priceTTC: devis.prestations[i].priceTTC,
          tvaMontant: devis.prestations[i].tvaMontant,
          tvaValue: devis.prestations[i].tvaValue,
          tva: devis.prestations[i].tva
        })
      }
      var saveFacture = new Facture(newFacture);
      saveFacture.save(function(err) {
        if (err) return console.log(err);
      });
    });
    var prestations;
    if (Array.isArray(req.body.prestation)) {
      prestations = [];
      for (var i = 0; i < req.body.prestation.length; i++) {
        prestations[i] = JSON.parse(req.body.prestation[i]);
      }
    } else {
      prestations = [JSON.parse(req.body.prestation)];
    }

    function getNumber(counter) {
      var resultat;
      var today = new Date();
      var year = today.getFullYear();
      var month = today.getMonth();
      month++;
      if (month <= 9) {
        month = '0' + month;
      }
      resultat = year.toString() + '.' + month.toString() + '_' + counter.toString();
      return resultat;
    }

    function giveContent() {
      var resultat = [];
      resultat.push(['Désignation', 'TVA', 'Qté', 'P.U. HT', 'P.U. TTC', 'Montant TTC']);
      prestations.forEach(function(prestation) {
        var rr = Number(prestation.priceTTC) * prestation.quantity;
        resultat.push([
          prestation.name,
          prestation.tva + "%",
          prestation.quantity,
          Number(prestation.price).toFixed(2) + "€",
          Number(prestation.priceTTC).toFixed(2) + "€",
          rr.toFixed(2) + "€"
        ]);
      })
      return resultat;
    }

    function giveTotal() {
      var resultat = [];
      var totalHT = 0;
      var totalTVA = 0;
      var totalTTC = 0;
      prestations.forEach(function(prestation) {
        totalHT += Number(prestation.price) * prestation.quantity;
        totalTVA += Number(prestation.tvaMontant) * prestation.quantity;
        totalTTC += Number(prestation.priceTTC) * prestation.quantity;
      })
      resultat.push([
        'Total HT', totalHT.toFixed(2) + "€"
      ]);
      resultat.push([
        'Total TVA', totalTVA.toFixed(2) + "€"
      ]);
      resultat.push([
        'Total TTC', totalTTC.toFixed(2) + "€"
      ]);
      return resultat;
    }
    var docDefinition = {
      pageMargins: [0, 100, 0, 0],
      header: {
        columns: [{
            image: 'views/src/logo2.png',
            width: 140,
            height: 100,
            margin: 10
          },
          {
            text: [
              'Identifiant TVA : ' + req.user.identifiantTva + '\n',
              req.user.formeJuridique + ' ' + req.user.raisonSociale + '\n',
              req.user.adresse + '\n',
              req.user.ville + ' ' + req.user.cp + '\n',
              req.user.email + '\n',
              req.user.telephone
            ],
            alignment: 'right',
            margin: 10
          }
        ]
      },
      content: [{
        columns: [{
          text: [
            "Facture Numéro: " + getNumber(result.counter) + "\n",
            "Date de la Facture: " + getDate() + "\n",
            "Date Limite de Paiement: " + getEcheanceDate() + "\n",
            "Identifiant Client: " + req.body.clientID
          ],
          margin: 40
        }, {
          text: [
            req.body.nom + " ",
            req.body.prenom + "\n",
            req.body.adresse + "\n",
            req.body.adresseBis + "\n",
            req.body.cp + " " + req.body.ville + "\n",
            req.body.telephone + "\n",
            req.body.mail
          ],
          alignment: 'right',
          margin: 40
        }]
      }, {
        margin: 20,
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*'],
          body: giveContent()
        }
      }, {
        margin: [300, 10],
        table: {
          headerRows: 1,
          widths: [100, 80],
          body: giveTotal()
        }
      }]
    };
    var options = {};
    var factureName = 'Facture N°' + getNumber(result.counter) + '.pdf';
    var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(factureName));
    Client.findOne({
      "_id": new ObjectId(req.body.client_id)
    }).then(client => {
      client.factures.push(factureName);
      client.save();
    });
    pdfDoc.end();
    var mailOptions = {
      from: 'no-reply@factureplus.com',
      to: req.body.mail,
      subject: 'Facture',
      text: 'Une nouvelle facture est disponible',
      attachments: [{
        path: factureName
      }]
    };
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  });
  Parametre.findOne({
    "name": "factureCounter"
  }).then(counter => {
    counter.counter++;
    counter.save();
  });
  var redirLink = '/client/' + req.body.client_id;
  res.redirect(redirLink);
});

router.get("/facturation/:id", ensureAuthenticated, (req, res) => {
  // if (req.user.updated == false) {
  // res.redirect('/err_update')
  // } else {
  Client.findOne({
    "_id": new ObjectId(req.params.id)
  }, (error, result) => {
    if (error) return res.status(500).send(error);
    Prestation.find({
      id: req.user._id
    }).then(prestations => {
      res.render('facturation', {
        this_client: result,
        prestations: prestations
      });
    });
  });
  // }
});

router.post("/facturation", ensureAuthenticated, (req, res) => {
  function getNumber(counter) {
    var resultat;
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth();
    month++;
    if (month <= 9) {
      month = '0' + month;
    }
    resultat = year.toString() + '.' + month.toString() + '_' + counter.toString();
    return resultat;
  }
  Parametre.findOne({
    "name": "factureCounter"
  }, (error, result) => {
    if (error) return res.status(500).send(error);

    function giveContent() {
      var resultat = [];
      resultat.push([{
        text: 'Désignation',
        bold: true
      }, {
        text: 'Quantité',
        bold: true
      }, {
        text: 'Prix Unitaire HT',
        bold: true
      }, {
        text: 'Montant HT',
        bold: true
      }]);
      for (var i = 0; i <= req.body.counter; i++) {
        if (req.body.name[i] && req.body.tva[i] && req.body.quantity[i] && req.body.price[i] && req.body.priceTTC[i]) {
          resultat.push([
            req.body.name[i],
            req.body.quantity[i],
            Number(req.body.price[i]).toFixed(2) + "€",
            Number(req.body.price[i] * req.body.quantity[i]).toFixed(2) + "€",
          ]);
        }
      }
      return resultat;
    }

    function giveTotal() {
      var resultat = [];
      var totalHT = 0;
      var totalTVA = 0;
      var totalTTC = 0;
      for (var i = 0; i <= req.body.counter; i++) {
        if (req.body.price[i] && req.body.tvaMontant[i] && req.body.priceTTC[i]) {
          totalHT += Number(req.body.price[i]) * Number(req.body.quantity[i]);
          totalTVA += Number(req.body.tvaMontant[i]) * Number(req.body.quantity[i]);
          totalTTC += Number(req.body.priceTTC[i]) * Number(req.body.quantity[i]);
        }
      }
      resultat.push([{
        text: 'Total HT',
        bold: true
      }, totalHT.toFixed(2) + "€"]);
      resultat.push([{
        text: 'Total TVA',
        bold: true
      }, totalTVA.toFixed(2) + "€"]);
      resultat.push([{
        text: 'Total TTC',
        bold: true
      }, totalTTC.toFixed(2) + "€"]);
      return resultat;
    }

    function getData() {
      var data = "";
      if (req.body.entreprise != '') {
        data += req.body.entreprise + "\n";
      }
      // if (req.body.nom != '') {
      //   data += req.body.nom + " ";
      // }
      // if (req.body.prenom != '') {
      //   data += req.body.prenom + "\n";
      // }
      if (req.body.adresse != '') {
        data += req.body.adresse + " " + req.body.adresseBis + '\n';
      }
      if (req.body.cp != '' || req.body.ville != '') {
        data += req.body.cp + " " + req.body.ville + "\n";
      }
      // if (req.body.mail != '') {
      //   data += req.body.mail;
      // }
      return data;
    }

    function getDateData() {
      if (req.body.payeecejour == 'check') {
        return 'Facture payée ce jour'
      } else {
        return 'Date limite de paiement : ' + getEcheanceDate()
      }
    }
    var docDefinition = {
      pageMargins: [0, 90, 0, 100],
      header: {
        columns: [{
            image: 'views/src/facturelogo.png',
            width: 130,
            height: 130,
            margin: [5, 5],
            alignment: 'left',
          },
          {
            text: [{
              text: "Facture Numéro: " + getNumber(result.counter) + "\nIdentifiant Client : " + req.body.clientID,
              fontSize: 14,
              bold: true
            }],
            margin: [70, 25]
          }
        ]
      },
      footer: {
        columns: [{
          text: [
            "N° Siret : 490 362 407 000 10\nN° TVA Intracommunautaire : FR 490 362 407 00010\nIBAN : FR76 1780 7006 0225 4215 4938 732\n",
            {
              text: "\nConformément à l'article L441-6 du code de commerce, des pénalités de retard sont dues à défaut de règlement le jour suivant la date de paiement qui figure sur la facture. Une indemnité forfaitaire pour frais de recouvrement de 40€ à laquelle il convient d'ajouter des pénalités de retard dont le taux est égal à 3 fois le taux d'intérêt légal.",
              fontSize: 11
            }
          ],
          alignment: 'center'
        }],
        margin: [5, 5],
      },
      content: [{
        columns: [{
          text: [
            "PARRA PIEDS - Mr. ALBENGE Joël\n",
            "Borio Blanco - 2895 Route de Parisot\n",
            "81800 COUFFOULEUX\n",
            "Téléphone : 05 63 40 65 51\n",
            "Portable : 06 18 15 03 56"
          ],
          alignment: 'left',
          margin: [30, 50]
        }, {
          text: [{
            text: 'Date de la facture : ' + getDate() + '\n' + getDateData(),
            fontSize: 14,
            bold: true
          }, '\n\n\n' + getData()],
          alignment: 'right',
          margin: [0, 15, 30, 0]
        }]
      }, {
        margin: [15, 0, 15, 10],
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*'],
          body: giveContent()
        }
      }, {
        margin: [300, 10],
        table: {
          headerRows: 1,
          widths: [100, 80],
          body: giveTotal()
        }
      }]
    };
    var options = {};
    var factureName = 'Facture N°' + getNumber(result.counter) + '.pdf';
    var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(factureName));
    Client.findOne({
      "_id": new ObjectId(req.body._id)
    }).then(client => {
      client.factures.push(factureName);
      client.save();
    });
    var newFacture = {};
    newFacture._id = new ObjectId();
    newFacture.client_id = req.body._id;
    newFacture.clientID = req.body.clientID;
    newFacture.entreprise = req.body.entreprise;
    // newFacture.nom = req.body.nom;
    // newFacture.prenom = req.body.prenom;
    newFacture.date = new Date(Date.now());
    newFacture.adresse = req.body.adresse;
    newFacture.adresseBis = req.body.adresseBis;
    newFacture.ville = req.body.ville;
    newFacture.cp = req.body.cp;
    newFacture.telephone = req.body.telephone;
    newFacture.mail = req.body.mail;
    newFacture.counter = req.body.counter;
    newFacture.factureNumber = getNumber(result.counter);
    newFacture.prestations = [];
    newFacture.id = req.user._id;
    newFacture.index = result.counter;
    newFacture.limit = getEcheanceDate();
    if (req.body.payeecejour == 'check') {
      newFacture.payed = true
    } else {
      newFacture.payed = false
    }
    for (var i = 0; i <= newFacture.counter; i++) {
      newFacture.prestations.push({
        id: req.body.id[i],
        name: req.body.name[i],
        price: req.body.price[i],
        quantity: req.body.quantity[i],
        priceTTC: req.body.priceTTC[i],
        tvaMontant: req.body.tvaMontant[i],
        tvaValue: req.body.tvaValue[i],
        tva: req.body.tva[i]
      })
    }
    var saveFacture = new Facture(newFacture);
    saveFacture.save(function(err) {
      if (err) return console.log(err);
    });
    pdfDoc.end();

    if (req.body.mail != '') {
      var mailOptions = {
        from: 'no-reply@factureplus.com',
        to: req.body.mail,
        subject: 'Facture',
        text: 'Une nouvelle facture est disponible',
        attachments: [{
          path: factureName
        }]
      };
      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
    }
  });
  Parametre.findOne({
    "name": "factureCounter"
  }).then(counter => {
    counter.counter++;
    counter.save();
  });
  res.redirect('factures');
});

router.get("/facture/:name", ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname + '/../', req.params.name));
});

router.get("/err_update", ensureAuthenticated, (req, res) => {
  res.render('err_update');
});

router.get("/updateFacture/:number", ensureAuthenticated, (req, res) => {
  Facture.findOne({
    factureNumber: req.params.number
  }).then(facture => {
    Prestation.find({
      id: req.user._id
    }).then(prestations => {
      res.render('updateFacture', {
        facture: facture,
        prestations: prestations
      });
    });
  });
});

function search(id, prestations) {
  for (var i = 0; i < prestations.length; i++) {
    if (prestations[i]._id.toString() === id) {
      return prestations[i];
    }
  }
}

function searchPos(id, prestations) {
  for (var i = 0; i < prestations.length; i++) {
    if (prestations[i].id === id) {
      return i;
    }
  }
}

router.post("/updateFacture/:id", ensureAuthenticated, (req, res) => {
  Prestation.find({}).then(prestations => {
    Facture.findOne({
      _id: req.params.id
    }).then(facture => {
      var updates = [];
      if (typeof req.body.update === 'string') {
        updates.push(JSON.parse(req.body.update));
      } else if (typeof req.body.update === 'object') {
        for (var i = 0; i < req.body.update.length; i++)
          updates.push(JSON.parse(req.body.update[i]));
      }
      for (var y = 0; y < updates.length; y++) {
        if (updates[y].update == 'delete') {
          facture.prestations.splice(searchPos(updates[y].id, facture.prestations), 1);
        } else if (updates[y].update == 'update') {
          facture.prestations[searchPos(updates[y].id, facture.prestations)].quantity = updates[y].quantity;
        } else if (updates[y].update == 'add') {
          var prestation = search(updates[y].id, prestations);
          var newPrestation = {
            id: prestation._id.toString(),
            name: prestation.name,
            price: prestation.priceHT,
            priceTTC: prestation.priceTTC,
            tvaMontant: prestation.tvaMontant,
            tvaValue: prestation.tvaValue,
            tva: prestation.tva,
            quantity: updates[y].quantity
          }
          facture.prestations.push(newPrestation);
        }
      }

      function getDateUpdate(date) {
        var today = new Date(date);
        var dd = today.getDate();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();

        if (mm <= 9) {
          mm = '0' + mm;
        }
        var today = dd + '/' + mm + '/' + yyyy;
        return today;
      }


      function getDateDataUpdate(statut, date) {
        if (statut == true) {
          return 'Facture payée ce jour'
        } else {
          return 'Date limite de paiement : ' + getEcheanceDateUpdate(date)
        }
      }

      function getEcheanceDateUpdate(dateUpdate) {
        var date = new Date(dateUpdate);
        date.setMonth(date.getMonth() + 1);
        var dd = date.getDate();
        var mm = date.getMonth() + 1;
        var yyyy = date.getFullYear();

        if (mm <= 9) {
          mm = '0' + mm;
        }
        var date = dd + '/' + mm + '/' + yyyy;
        return date;
      }

      function getDataUpdate() {
        var data = "";
        if (facture.entreprise != '') {
          data += facture.entreprise + "\n";
        }
        // if (req.body.nom != '') {
        //   data += req.body.nom + " ";
        // }
        // if (req.body.prenom != '') {
        //   data += req.body.prenom + "\n";
        // }
        if (facture.adresse != '') {
          data += facture.adresse + " " + facture.adresseBis + '\n';
        }
        if (facture.cp != '' || facture.ville != '') {
          data += facture.cp + " " + facture.ville + "\n";
        }
        // if (req.body.mail != '') {
        //   data += req.body.mail;
        // }
        return data;
      }

      function giveContentUpdate() {
        var resultat = [];
        resultat.push([{
          text: 'Désignation',
          bold: true
        }, {
          text: 'Quantité',
          bold: true
        }, {
          text: 'Prix Unitaire HT',
          bold: true
        }, {
          text: 'Montant HT',
          bold: true
        }]);
        for (var i = 0; i < facture.prestations.length; i++) {
          resultat.push([
            facture.prestations[i].name,
            facture.prestations[i].quantity,
            Number(facture.prestations[i].price).toFixed(2) + "€",
            Number(Number(facture.prestations[i].price) * Number(facture.prestations[i].quantity)).toFixed(2) + "€"
          ]);
        }
        return resultat;
      }

      function giveTotalUpdate() {
        var resultat = [];
        var totalHT = 0;
        var totalTVA = 0;
        var totalTTC = 0;
        for (var i = 0; i < facture.prestations.length; i++) {
          totalHT += Number(facture.prestations[i].price) * Number(facture.prestations[i].quantity);
          totalTVA += Number(facture.prestations[i].tvaMontant) * Number(facture.prestations[i].quantity);
          totalTTC += Number(facture.prestations[i].priceTTC) * Number(facture.prestations[i].quantity);
        }
        resultat.push([{
          text: 'Total HT',
          bold: true
        }, totalHT.toFixed(2) + "€"]);
        resultat.push([{
          text: 'Total TVA',
          bold: true
        }, totalTVA.toFixed(2) + "€"]);
        resultat.push([{
          text: 'Total TTC',
          bold: true
        }, totalTTC.toFixed(2) + "€"]);
        return resultat;
      }

      var docDefinition = {
        pageMargins: [0, 90, 0, 100],
        header: {
          columns: [{
              image: 'views/src/facturelogo.png',
              width: 130,
              height: 130,
              margin: [5, 5],
              alignment: 'left',
            },
            {
              text: [{
                text: "Facture Numéro: " + facture.factureNumber + "\nIdentifiant Client : " + facture.clientID,
                fontSize: 14,
                bold: true
              }],
              margin: [70, 25]
            }
          ]
        },
        footer: {
          columns: [{
            text: [
              "N° Siret : 490 362 407 000 10\nN° TVA Intracommunautaire : FR 490 362 407 00010\nIBAN : FR76 1780 7006 0225 4215 4938 732\n",
              {
                text: "\nConformément à l'article L441-6 du code de commerce, des pénalités de retard sont dues à défaut de règlement le jour suivant la date de paiement qui figure sur la facture. Une indemnité forfaitaire pour frais de recouvrement de 40€ à laquelle il convient d'ajouter des pénalités de retard dont le taux est égal à 3 fois le taux d'intérêt légal.",
                fontSize: 11
              }
            ],
            alignment: 'center'
          }],
          margin: [5, 5],
        },
        content: [{
          columns: [{
            text: [
              "PARRA PIEDS - Mr. ALBENGE Joël\n",
              "Borio Blanco - 2895 Route de Parisot\n",
              "81800 COUFFOULEUX\n",
              "Téléphone : 05 63 40 65 51\n",
              "Portable : 06 18 15 03 56"
            ],
            alignment: 'left',
            margin: [30, 50]
          }, {
            text: [{
              text: 'Date de la facture : ' + getDateUpdate(facture.date) + '\n' + getDateDataUpdate(facture.payed, facture.date),
              fontSize: 14,
              bold: true
            }, '\n\n\n' + getDataUpdate()],
            alignment: 'right',
            margin: [0, 15, 30, 0]
          }]
        }, {
          margin: [15, 0, 15, 10],
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: giveContentUpdate()
          }
        }, {
          margin: [300, 10],
          table: {
            headerRows: 1,
            widths: [100, 80],
            body: giveTotalUpdate()
          }
        }]
      };

      var options = {};
      var factureName = 'Facture N°' + facture.factureNumber + '.pdf';
      var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
      pdfDoc.pipe(fs.createWriteStream(factureName));
      pdfDoc.end();

      Facture.findOneAndUpdate({
        _id: req.params.id
      }, {
        prestations: facture.prestations
      }, function(err) {
        if (err) return console.log(err);
        res.redirect("/facture/Facture%20N°" + facture.factureNumber + '.pdf');
      });
    });
  })
});

router.get("/lockFacture/:id", ensureAuthenticated, (req, res) => {
  Facture.findOneAndUpdate({
    _id: req.params.id
  }, {
    compta: true
  }, function(err) {
    if (err) return console.log(err);
    res.redirect("/factures");
  });
});

module.exports = router;
