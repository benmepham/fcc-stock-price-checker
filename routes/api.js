/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

"use strict";

var expect = require("chai").expect;
var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectID;
const fetch = require("node-fetch");

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

function getStock(stock, done) {
  fetch(
    `https://repeated-alpaca.glitch.me/v1/stock/${stock.toUpperCase()}/quote`
  )
    .then(res => res.json())
    .then(json =>
      done("stock", null, { stock: json.symbol, price: json.latestPrice })
    )
    .catch(err => done("stock", err, null));
}

function getLikes(stock, like, ip, done) {
  MongoClient.connect(CONNECTION_STRING, function(err, client) {
    if (err) return done("likes", err, null);
    let db = client.db("fccdb");
    var collection = db.collection("stockpricechecker");
    if (!like || like === "false") {
      collection.find({ stock: stock.toLowerCase() }).toArray((err, doc) => {
        const likes = doc.length == 0 ? 0 : doc[0].likes.length;
        return done("likes", null, { stock: stock.toUpperCase(), likes });
      });
    } else {
      collection.findOneAndUpdate(
        { stock: stock.toLowerCase() },
        { $addToSet: { likes: ip } },
        { upsert: true, returnOriginal: false },
        (err, doc) => {
          // if (err) return console.error(err);
          return done("likes", null, {
            stock: stock.toUpperCase(),
            likes: doc.value.likes.length
          });
        }
      );
    }
  });
}

module.exports = function(app) {
  app.route("/api/stock-prices").get(function(req, res) {
    const stock = req.query.stock;
    const like = req.query.like || false;
    let ip;
    if (process.env.NODE_ENV === "test") ip = "testing_final";
    else ip = req.headers["x-forwarded-for"].split(",")[0];

    let stockData,
      likeData,
      multiple = false;

    if (Array.isArray(stock)) {
      stockData = [];
      likeData = [];
      multiple = true;
    }

    function processData(type, err, data) {
      if (err) return res.json({ err });
      if (data.stock == undefined) return res.send("Error: not found");
      if (type == "stock") {
        multiple ? stockData.push(data) : (stockData = data);
      } else {
        multiple ? likeData.push(data) : (likeData = data);
      }
      //console.log(stockData, likeData);
      if (!multiple && stockData && likeData !== undefined) {
        stockData.likes = likeData.likes;
        return res.json({ stockData });
      } else if (multiple && stockData.length == 2 && likeData.length == 2) {
        if (stockData[0].stock == likeData[0].stock) {
          stockData[0].rel_likes = likeData[0].likes - likeData[1].likes;
          stockData[1].rel_likes = likeData[1].likes - likeData[0].likes;
        } else {
          stockData[0].rel_likes = likeData[1].likes - likeData[0].likes;
          stockData[1].rel_likes = likeData[0].likes - likeData[1].likes;
        }
        res.json({ stockData });
      }
    }

    if (multiple) {
      getStock(stock[0], processData);
      getLikes(stock[0], like, ip, processData);
      getStock(stock[1], processData);
      getLikes(stock[1], like, ip, processData);
    } else {
      getStock(stock, processData);
      getLikes(stock, like, ip, processData);
    }
  });
};
