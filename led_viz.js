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
// Duration of door event
const DOOR_MS = 5000;

let locations;
let blasts = [];
let doorEvents = [];

function draw() {
  var millis = new Date().getTime();
  // Draw location temperature colors
  for (var pixel = 0; pixel < NUM_PIXELS; pixel++) {
    /*var hue2 = pixel * 0.1 + millis * 0.0002;
    client.setPixel(pixel, ...OPC.hsv(hue2, 1, 1));
    continue;*/
    if (locations === undefined) {
      client.setPixel(pixel, 0, 0, 0);
      continue;
    }

    let location = locations[pixel];
    let mode = location.mode;
    
    let hue, saturation = 1, brightness = 1;
    
    switch(mode){
      case 'air':
        let temp = location.temp;
        // If temp not available display orange color to alert
        if(temp===null){
          hue = 0.10;
        }
        else{
          hue =((temp -65) *0.02) +0.65;
        }
        break;
      case 'light':
        let levelPercent = location.levelPercent;
        brightness = levelPercent/100;
        hue = 0.15; //color yellow
        break;
      case 'room':
        let reservedStatus =location.reservedStatus;
        if (reservedStatus === 'reserved'){
          hue = 0.45; //dim cyan
          saturation = 0.4;
          brightness = 0.4;
        }
        else if(reservedStatus === 'occupied'){
          hue = 0.45; //cyan
        }
        else if (reservedStatus === 'available'){
          hue = 0.35; //green
        }
        else{
          //grey
          hue = 0.35; 
          saturation = 0;
          brightness = 0.4;
        }
        break;
      default:
        brightness = 0;
    }
    client.setPixel(pixel, ...OPC.hsv(hue, saturation, brightness));
  }

  // Draw door events if any
  for (let i in doorEvents) {
    const doorEvent = doorEvents[i];
    const event_age = millis - doorEvent.when;
    
    if (event_age > DOOR_MS){
      console.log("Door unlocked!", doorEvent);
      doorEvents.splice(i,1);
      continue;
    }
    var hue = 0.35;
    let brightness = 1;
    var isEven = Math.round(event_age/1000)%2;
    
    if (isEven === 0){
      brightness = 0.6;
    }
    for (var pixel = 0; pixel < NUM_PIXELS; pixel++) {
      client.setPixel(pixel, ...OPC.hsv(hue, 1, brightness));
    }
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
    try {
      body = Buffer.concat(body).toString();
      body = JSON.parse(body);
      console.log("message:\n", body);
    } catch (e) {
      console.log("body is not json", body, e);
      // For now, turn any non-JSON request into a doorEvent
      body = {type: 'doorEvent'};
    }
    if (body.type === 'update') {
      locations = body.locations;
      console.log("locations updated"); 
    }
    else if(body.type === 'doorEvent'){
      body.when = new Date().getTime();
      doorEvents.push(body);
    }
    else if (body.type === 'blast') {
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
}).listen(7889);
