#!/usr/bin/env node

// Simple red/blue fade with Node and opc.js

var http = new require('http');
var OPC = new require('./opc')
var client = new OPC(process.argv[2] || 'localhost', 7890);

foo = 'hi'

function draw() {
  var millis = new Date().getTime();

  for (var pixel = 0; pixel < 400; pixel++) {
    var hue = pixel * 0.1 + millis * 0.0002;
    client.setPixel(pixel, ...OPC.hsv(hue, 1, 1));
  }
  client.writePixels();
}

setInterval(draw, 30);


http.createServer(function(req, res) {
  console.log("HEY!");
  var body;
  req.on('data', function (data) {
    body = JSON.parse(data);
    console.log("BOD", body);
  });
  res.write("hi back!");
  res.end();
}).listen(3000);
