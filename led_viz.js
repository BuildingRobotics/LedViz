#!/usr/bin/env node

// Simple red/blue fade with Node and opc.js

var http = new require('http');
var OPC = new require('./opc')
var client = new OPC(process.argv[2] || 'localhost', 7890);

// Total number of pixels; we expect locations to be this long
const NUM_PIXELS = 200;
// Duration of blast animation
const BLAST_MS = 2000;
// Max width of blast animation centered on location
const BLAST_PIXELS = 40;

let locations;
let blasts = [];

function draw() {
  var millis = new Date().getTime();
  if (locations === undefined) {
    return;
  }

  // Draw location temperature colors
  for (var pixel = 0; pixel < NUM_PIXELS; pixel++) {
    var temp = locations[pixel].temp;
    let hue =((temp -65) *0.02) +0.65;
    client.setPixel(pixel, ...OPC.hsv(hue, 1, 1));
  }

  // Draw blasts if any
  for (let i in blasts) {
    const blast = blasts[i];
    const blast_age = millis - blast.when;
    if (blast_age >= BLAST_MS) {
      console.log("blast done!", blast);
      blasts.splice(i, 1);
      continue;
    }
    const distance = Math.sin(blast_age / BLAST_MS * Math.PI)
      * BLAST_PIXELS / 2;
    for (let j = blast.locationIndex - distance;
         j < blast.locationIndex + distance;
         j++) {
      client.setPixel(Math.round((j + NUM_PIXELS) % NUM_PIXELS),
        ...blast.color);
    }
  }
  client.writePixels();
}

setInterval(draw, 30);


http.createServer(function(req, res) {
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = JSON.parse(Buffer.concat(body).toString());
    console.log("message:\n", body);
    if (body.type === 'update') {
      locations = body.locations;
      console.log("locations updated");
    } else if (body.type === 'blast') {
      if (!locations) {
        console.log("no locations so no blast");
        return;
      }
      body.locationIndex = locations.map(
        function(l) { return l.id; }
      ).indexOf(body.location);
      if (body.locationIndex === -1) {
        console.log("location not found:", body);
        return;
      }
      if (body.blastKind == 'warm') {
        body.color = [255, 0, 0];
      } else if (body.blastKind == 'cool') {
        body.color = [0, 0, 255];
      } else if (body.blastKind == 'comfy') {
        body.color = [255, 255, 255];
      } else {
        console.log("unrecognized blast type:", body);
        return;
      }
      body.when = new Date().getTime();
      blasts.push(body);
      console.log("now blasts:", blasts);
    }
  });
  res.write("hi back!");
  res.end();
}).listen(3000);
