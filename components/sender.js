const router = require('express').Router();
const {
  MessageMedia
} = require('whatsapp-web.js');
const request = require('request')
const vuri = require('valid-url');

const sendMessage = async (phone, message) => {
  if (phone == undefined || message == undefined) {
    return "please enter valid phone and message";
  } else {
    const response = await client.sendMessage(phone + '@c.us', message);

    if (response.id.fromMe) {
      return `Message successfully sent to ${phone}`;
    }
  }
}

const sendAudio = async (phone, audio) => {
  const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

  if (phone == undefined || audio == undefined) {
    return "please enter valid phone and message";
  } else {
    if (base64regex.test(audio)) {
      const media = new MessageMedia('audio/mpeg', audio);
      const response = await client.sendMessage(`${phone}@c.us`, media, {
        caption: caption || '',
        sendAudioAsVoice: true
      });

      if (response.id.fromMe) {
        return `Audio MediaMessage successfully sent to ${phone}`;
      }
    } else if (vuri.isWebUri(audio)) {
      const path = audio;
      const media = await MessageMedia.fromUrl(path);
      const response = await client.sendMessage(`${phone}@c.us`, media, {
        sendAudioAsVoice: true
      });

      if (response.id.fromMe) {
        return `Audio MediaMessage successfully sent to ${phone}`;
      }
    } else {
      return 'Invalid URL/Base64 Encoded Audio Media';
    }
  }
}

router.get('/message', async (req, res) => {
  const topic = req.params.topic;
  const subject = req.params.subject;
  const audio = req.params.audio;

  if (topic == undefined || subject == undefined || audio == undefined) {
    res.send({
      status: "error",
      message: "please enter valid topic and subject and audio"
    })
    return;
  }

  const resp1 = await sendMessage(number, message);
  const resp2 = await sendAudio(number, audio);
  const resp3 = await sendMessage(number, message2);
  const resp4 = await sendMessage(number, message3);

  const messages = [resp1, resp2, resp3, resp4];

  res.send({
    status: 'success',
    message: messages.join('\n'),
  })
});

module.exports = router;
