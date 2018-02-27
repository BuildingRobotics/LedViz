#!/usr/bin/env node

// Simple red/blue fade with Node and opc.js

var http = new require('http');
var OPC = new require('./opc')
var client = new OPC(process.argv[2] || 'localhost', 7890);

let locations;

function draw() {
  var millis = new Date().getTime();
  if (locations === undefined) {
    return;
  }
  for (var pixel = 0; pixel < 200; pixel++) {
    var temp = locations[pixel].temp;
    let hue =((temp -65) *0.02) +0.65;
    client.setPixel(pixel, ...OPC.hsv(hue, 1, 1));
  }
  client.writePixels();
}

setInterval(draw, 30);


http.createServer(function(req, res) {
  console.log("HEY!");
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = JSON.parse(Buffer.concat(body).toString());
    locations = body.locations;
    console.log("BOD", body);
  });
  res.write("hi back!");
  res.end();
}).listen(3000);
