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
    return "please enter valid phone and audio";
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

        const response = await client.sendMessage(`${phone}@c.us`, media);

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

  return {
    message: message,
    audioCache: media,
  };
}

const normalizeNumber = (number) => {
  return number.replace('+', '').replace(/\s/g, '');
}

const normalizeMessage = (messsage, name, topic, subject) => {
  return messsage.replace('{name}', name)
    .replace('{topic}', topic)
    .replace('{subject}', subject)
}

const sendMessages = async (data, name, number, topic, subject, audioUrl, audioPath) => {
  const responses = [];
  let audio = undefined;

  for(let i = 0; i < data.length; i++) {
    const item = data[i];

    if (item.tipo === 'text') {
      const message = normalizeMessage(item.valor, name, topic, subject)
      const resp = await sendMessage(number, message);
      responses.push(resp);
    } else if (item.tipo === 'audio') {
      const {
        message: resp,
        audioCache,
      } = await sendAudio(number, audioUrl, audioPath);
      media = audioCache;
      responses.push(resp);
    }
  }

  return {
    responses,
    audioCache: media,
  };
}

router.post('/message', async (req, res) => {
  const message = req.body.message;

  if (message == undefined) {
    res.send("please enter valid message");
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

    const sheet = doc.sheetsById[process.env.GOOGLE_SHEET_CONTACTS_ID];
    const rows = await sheet.getRows();

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].AVISOS == 'true' || rows[i].AVISOS == 'verdadeiro') {
        const name = rows[i].NOME;
        const number = normalizeNumber(rows[i].TELEFONE);
        const valideMessage = normalizeMessage(message, name);
        const response = await sendMessage(number, valideMessage);
        messages.push(response);
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
    message: messages,
  })
});

module.exports = router;


router.post('/pre-group-1', async (req, res) => {
  const topic = req.body.topic;
  const subject = req.body.subject;
  const audioUrl = req.body.audio;
  let media = undefined;
  let data;

  if (topic == undefined || subject == undefined) {
    res.send({
      status: "error",
      message: "please enter valid topic and subject"
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

    const factory = doc.sheetsById[process.env.GOOGLE_SHEET_FACTORY_ID];
    data = await factory.getRows();

    if (data.length === 0) {
      res.send({
        status: 'success',
        message: 'no data.',
      })

      return;
    }

    const sheet = doc.sheetsById[process.env.GOOGLE_SHEET_CONTACTS_ID];
    const rows = await sheet.getRows();

    for (let i = 0; i < rows.length; i+=1) {
      if ((rows[i].ÁUDIOS == 'verdadeiro' || rows[i].ÁUDIOS == 'true') && rows[i].TELEFONE != '') {
        const name = rows[i].NOME;
        const number = normalizeNumber(rows[i].TELEFONE);
        const {
          responses,
          audioCache,
        } = await sendMessages(data, name, number, topic, subject, audioUrl, media);
        media = audioCache;
        messages.push(...responses);
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
    message: messages,
  })
});

module.exports = router;
