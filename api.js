const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const {
  Client,
  LocalAuth
} = require('whatsapp-web.js');

process.title = 'whatsapp-node-api';
global.client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
   args: ['--no-sandbox'],
   headless: false,
 },
});

global.authed = false;

const app = express();

const port = process.env.PORT || 5000;
//Set Request Size Limit 50 MB
app.use(bodyParser.json({
  limit: '50mb'
}));

app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({
  extended: true
}));

client.on('qr', (qr) => {
  console.log('qr');
  fs.writeFileSync('./components/last.qr', qr);
});

client.on('authenticated', () => {
  console.log('AUTH!');
  authed = true;

  try {
    fs.unlinkSync('./components/last.qr');
  } catch (err) {}
});

client.on('auth_failure', () => {
  console.log('AUTH Failed !');
  process.exit();
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async (msg) => {
  if (process.env.WEBHOOK_ENABLED) {
    if (msg.hasMedia) {
      const attachmentData = await msg.downloadMedia();
      msg.attachmentData = attachmentData;
    }
    axios.post(process.env.WEBHOOK_PATH, {
      msg
    });
  }
});
client.on('disconnected', () => {
  console.log('disconnected');
});
client.initialize();

const chatRoute = require('./components/chatting');
const groupRoute = require('./components/group');
const authRoute = require('./components/auth');
const contactRoute = require('./components/contact');
const sender = require('./components/sender');

app.use(function (req, res, next) {
  console.log(req.method + ' : ' + req.path);
  next();
});
app.use('/chat', chatRoute);
app.use('/group', groupRoute);
app.use('/auth', authRoute);
app.use('/contact', contactRoute);
app.use('/send', sender);

app.listen(port, () => {
  console.log('Server Running Live on Port : ' + port);
});
