const router = require('express').Router();
const {
  MessageMedia
} = require('whatsapp-web.js');
const request = require('request');
const fs = require('fs');
const fsPromises = require('fs').promises;
const vuri = require('valid-url');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { OAuth2Client } = require('google-auth-library');
const data = require('../sender');

const sendMessage = async (phone, message) => {
  let result = '';

  if (phone == undefined || message == undefined) {
    result = "please enter valid phone and message";
  } else {
    const response = await client.sendMessage(phone + '@c.us', message);

    if (response.id.fromMe) {
      result = `Message successfully sent to ${phone}`;
    }
  }

  return result;
}

const sendAudio = async (phone, audio, media) => {
  const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  let message = '';

  if (phone == undefined || audio == undefined) {
    return "please enter valid phone and message";
  } else {
    if (base64regex.test(audio)) {
      if (!media) {
        media = new MessageMedia('audio/mpeg', audio);
      }

      const response = await client.sendMessage(`${phone}@c.us`, media, {
        caption: caption || '',
        sendAudioAsVoice: true
      });

      if (response.id.fromMe) {
        message = `Audio MediaMessage successfully sent to ${phone}`;
      }
    } else if (vuri.isWebUri(audio)) {
      try {
        const path = audio;
        if (!media) {
          media = await MessageMedia.fromUrl(path, { unsafeMime: true });
        } else {
          console.log("audio cache")
        }

        const response = await client.sendMessage(`${phone}@c.us`, media, {
          sendAudioAsVoice: true
        });

        if (response.id.fromMe) {
          message = `Audio MediaMessage successfully sent to ${phone}`;
        } else {
          message = `Audio MediaMessage not sent.`;
        }
      } catch (e) {
        return e.message;
      }
    } else {
      if (!fs.existsSync('./temp')) {
        await fs.mkdirSync('./temp');
      }

      if (!media) {
        const path = './temp/' + audio.split("/").slice(-1)[0];
        await fsPromises.copyFile(audio, path);
        media = await MessageMedia.fromFilePath(path);
      }

      const response = await client.sendMessage(`${phone}@c.us`, media, {
        sendAudioAsVoice: true
      });

      if (response.id.fromMe) {
        message = `Audio MediaMessage successfully sent to ${phone}`;
      } else {
        message = `Audio MediaMessage not sent.`;
      }
    }
  }

  return message;
}

const normalizeNumber = (number) => {
  return number.replace('+', '');
}

const normalizeMessage = (messsage, name, topic, subject) => {
  return messsage.replace('{name}', name)
    .replace('{topic}', topic)
    .replace('{subject}', subject)
}

const sendMessages = async (name, number, topic, subject, media, audioLink) => {
  const responses = [];

  for(let i = 0; i < data.length; i++) {
    const item = data[i];

    if (item.type === 'text') {
      const message = normalizeMessage(item.value, name, topic, subject)
      const resp = await sendMessage(number, message);
      responses.push(resp);
    } else if (item.type === 'audio') {
      const audio = item.value || audioLink;
      const resp = await sendAudio(number, audio, media);
      responses.push(resp);
    }
  }

  return responses;
}

router.get('/message', async (req, res) => {
  const topic = req.query.topic;
  const subject = req.query.subject;
  const audio = req.query.audio;
  let media;

  if (topic == undefined || subject == undefined) {
    res.send({
      status: "error",
      message: "please enter valid topic and subject"
    })
    return;
  }

  if (data.length === 0) {
    res.send({
      status: 'success',
      message: 'no data.',
    })

    return;
  }

  const messages = [];
  let total = 0;

  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID);

    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY,
    });

    await doc.loadInfo();

    const sheet = doc.sheetsById[process.env.GOOGLE_SHEET_ID];
    const rows = await sheet.getRows();

    for (let i = 1; i < rows.length; i++) {
      if (rows[i].ÁUDIOS == 'TRUE' ) {
        const name = rows[i].NOME;
        const number = normalizeNumber(rows[i].TELEFONE);
        const response = await sendMessages(name, number, topic, subject, audio, media);
        messages.push(...response);
        total++;
      }
    }
    messages.push(`total: ${total}`);
  } catch (e) {
    res.send({
      status: 'error',
      message: e.message,
    })

    return
  }

  res.send({
    status: 'success',
    message: messages.join('\n'),
  })
});

module.exports = router;
