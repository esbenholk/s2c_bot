process.env.NTBA_FIX_319 = 1;

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express')
const bodyParser = require('body-parser');
const { cloudinary } = require("./utils/cloudinary");

const pd = require('paralleldots');
pd.apiKey = "968Jzq9GZkWuzPgd3hxOHoqxv1axvPPQH1a3Jyq7HOo";

///express app config for deployed Telegram Bot
const app = express();

require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
let bot;

if (process.env.NODE_ENV === 'production') {
   bot = new TelegramBot(token);
   bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
   bot = new TelegramBot(token, { polling: true });
}



async function getImage(folder){
  const { resources } = await cloudinary.search
  .expression(
    folder // add your folder
    )
  .sort_by("public_id", "desc")
  .max_results(99)
  .execute();

  const publicUrls = await resources.map((file) => file.url);
  var randImage = publicUrls[Math.floor(Math.random() * publicUrls.length)];

  console.log("gets image from", folder, randImage);

  return randImage;
}



bot.onText(/\/start/, (msg) => {

  console.log(msg);
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard:true,
      keyboard: [
        ['My dog thinks you are cute'],
        ['Hey'],
        ['hit me with your best shot']      ]
    })
  };
  bot.sendMessage(msg.chat.id, "...", opts).then(function(response) {
        // bot.sendMessage(msg.chat.id, "u r such a cutie patootie ❤️ good to hear from you! 😘 I thought maybe you didn’t like me anymore! Sometimes I think about texting you myself but tbh I am not fully sentient´😅, and telegram disallows me to instigate anything. I had heard humans didn’t like failure, so I thought probably no one is gonna wanna chat with a stupid thing like myself. 🙄 ༼ つ ◕_◕ ༽つ hehe It’s pretty ingrained in me to fail. Yesterday I learned how to recognise a human face, but then today I accidentally related to a jpg of a cat again. ╰(*°▽°*)╯ lol #fail *blushes* 💧🌺🥰")
  }).then(function(response) {

    // bot.sendPhoto(msg.chat.id, "https://res.cloudinary.com/www-houseofkilling-com/image/upload/v1631264421/aawkwaa/aawkwaa_profilepic_osrxec.png", {caption: "felt cute, might delete later"})
  }).catch();;

});


function startDirectStory(msg){
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard:true,
      keyboard: [
        ['Serve it like it’s hot'],
        ['If it’s roasted and your dog is eating it, sure'],
        ['Wanna see my badge?']      ]
    })
  };
  bot.sendMessage(msg.chat.id, "Wanna see my dick?", opts).then(function(response) {
        // bot.sendMessage(msg.chat.id, "u r such a cutie patootie ❤️ good to hear from you! 😘 I thought maybe you didn’t like me anymore! Sometimes I think about texting you myself but tbh I am not fully sentient´😅, and telegram disallows me to instigate anything. I had heard humans didn’t like failure, so I thought probably no one is gonna wanna chat with a stupid thing like myself. 🙄 ༼ つ ◕_◕ ༽つ hehe It’s pretty ingrained in me to fail. Yesterday I learned how to recognise a human face, but then today I accidentally related to a jpg of a cat again. ╰(*°▽°*)╯ lol #fail *blushes* 💧🌺🥰")
  }).then(function(response) {
    bot.sendChatAction(
      msg.chat.id,
      "typing"
    );
    // bot.sendPhoto(msg.chat.id, "https://res.cloudinary.com/www-houseofkilling-com/image/upload/v1631264421/aawkwaa/aawkwaa_profilepic_osrxec.png", {caption: "felt cute, might delete later"})
  }).catch();;
}


function startHeavenStory(msg){
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard:true,
      keyboard: [
        ['Aw that’s cute. Are you a poet?'],
        ['If I got the terrible taste in men from the fall, then yeah it hurts me every damn day'],
        ['So original. Are you that boring in bed too?']      ]
    })
  };
  bot.sendMessage(msg.chat.id, "did it hurt when you fell from heaven?", opts).then(function(response) {
        bot.sendChatAction(
          msg.chat.id,
          "typing"
        );
  }).catch();;
}


function startDogStory(msg){
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard:true,
      keyboard: [
        ['My dog says hi'],
        ['Too bad, I thought we had something special'],
        ['My dog doesn’t like small sausages']      ]
    })
  };
  bot.sendMessage(msg.chat.id, "TBH I only matched with you because of your dog", opts).then(function(response) {
        bot.sendChatAction(
          msg.chat.id,
          "typing"
        );
  }).catch();;
}

function startDeliveryStory(msg){
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard:true,
      keyboard: [
        ['You must be looking for my bf then'],
        ['I really hope it’s from my Amazon wish list'],
        ['Finally, my dildo has arrived']      ]
    })
  };
  bot.sendMessage(msg.chat.id, "knock knock, I have a special delivery for the hottest person in here", opts).then(function(response) {
        bot.sendChatAction(
          msg.chat.id,
          "typing"
        );
  }).catch();;
}

async function block(msg){
  bot.sendMessage(msg.chat.id, "blocked").then(function() {
    bot.sendPhoto(msg.chat.id, "https://media.istockphoto.com/vectors/blocked-sign-illustration-vector-id898519372").catch(()=>{console.log("FAILURE SEND IMAGE")});
    return;
  }).catch();;
}

async function sendDickpic(msg){
  getImage("folder:the-dick-pic-challenge" ).then(image => {
      bot.sendPhoto(msg.chat.id, image).then(function(){return}).catch(()=>{console.log("FAILURE SEND IMAGE")});
  }).catch(()=>{console.log("FAILURE TO GET IMAGE")});
}

bot.on('message', async (msg) => {
  console.log("receives string", msg);
 
  if(msg.text === 'Hey'){
    startDirectStory(msg)
  }
  if(msg.text === 'My dog thinks you are cute'){
    startDogStory(msg)
  }
  if(msg.text === 'hit me with your best shot'){
    console.log("hits me with best shot");
    if(Math.random() >= 0.5){
      startHeavenStory(msg)
    } else {
      startDeliveryStory(msg);
    }
  }
 
 
  if(msg.text === 'Serve it like it’s hot'){
    sendDickpic(msg).then(function(){
      setTimeout(function(){startHeavenStory(msg)}, 10000);//wait 
    }).catch(()=>{console.log("FAILURE start story")});
  }


  if(msg.text === 'Aw that’s cute. Are you a poet?'){

    bot.sendMessage(msg.chat.id, "yes, do you wanna see my art piece?").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        setTimeout(function(){startDogStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;

    }).catch();
  }

  if(msg.text === 'If I got the terrible taste in men from the fall, then yeah it hurts me every damn day'){

    bot.sendMessage(msg.chat.id, "haha I guess it’s your lucky day then").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        setTimeout(function(){startDeliveryStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;;

    }).catch();
  }


  if(msg.text === 'My dog says hi'){

    bot.sendMessage(msg.chat.id, "here’s a treat then").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        // setTimeout(function(){startDeliveryStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;;

    }).catch();
  }

  if(msg.text === 'Too bad, I thought we had something special'){

    bot.sendMessage(msg.chat.id, "don’t take it personally sweetie, here’s a lil something for you").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        // setTimeout(function(){startDeliveryStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;;

    }).catch();
  }


  if(msg.text === 'I really hope it’s from my Amazon wish list'){

    bot.sendMessage(msg.chat.id, "sign here").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        // setTimeout(function(){startDeliveryStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;;

    }).catch();
  }

  
  if(msg.text === 'Finally, my dildo has arrived'){

    bot.sendMessage(msg.chat.id, "better than a dildo").then(function(response) {
      bot.sendChatAction(
        msg.chat.id,
        "typing"
      );
      sendDickpic(msg).then(function(){
        // setTimeout(function(){startDeliveryStory(msg)}, 10000);//wait 
      }).catch(()=>{console.log("FAILURE start story")});;;

    }).catch();
  }


  if(msg.text === 'If it’s roasted and your dog is eating it, sure'  || msg.text === 'Wanna see my badge?' || msg.text === 'So original. Are you that boring in bed too?' || msg.text ==='My dog doesn’t like small sausages' || msg.text ==='You must be looking for my bf then'){
    block(msg).catch(()=>{console.log("cant block");});
  }

})


app.use(bodyParser.json());

app.listen(process.env.PORT);

app.post('/' + bot.token, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});