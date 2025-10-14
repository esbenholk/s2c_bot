process.env.NTBA_FIX_319 = 1;

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const { cloudinary } = require("./utils/cloudinary");

const cookieParser = require("cookie-parser");
const { nanoid } = require("nanoid");

const fs = require("fs/promises");
const path = require("path");

///express app config for deployed Telegram Bot
const app = express();
app.use(express.static("public")); // serves public/index.html
app.use(cookieParser());
app.use(bodyParser.json());

require("dotenv").config();

const { collageImages } = require("./collage");

let readytoplayprompt = "send me on a side quest";
let needtoentersimulation = "take me into the simulation";
let takemetothebar = "lets go to the bar";

let successResponses = [
  "omg I nailed it",
  "i was succesful",
  "quest completed",
];
let failResponses = [
  "no I couldnt do it",
  "i failed",
  "uuuu didn't really pan out as I planned",
];

let fail_answers = [
  "it can be difficult to take charge in the simulation",
  "Dont think two seconds about it",
  "I still love you",
];
let success_answers = ["fantastic job <3!", "U did it!!! Congratualtions!"];

let takeMeToAnotherQuestResponses = [
  "yes, lets keep playing",
  "yes, take me on another quest",
];
let noStopTheGameResponses = [
  "no thank you, take me to the bar",
  "no I done. can we just linger in simulacra for a bit?",
];

let winAmount = 5;

const token = process.env.TELEGRAM_TOKEN;
let bot;

if (process.env.NODE_ENV === "production") {
  bot = new TelegramBot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new TelegramBot(token, { polling: true });
}

// Global cache for structured quests
let questS = [];
const videoCache = new Map(); // key: artwork_id -> { fileId, uniqueId }

// Per-chat scratch space to stash incoming photos
const collageBuckets = new Map(); // chatId -> Buffer[]

function isValidquest(m) {
  return (
    m &&
    typeof m.artwork_id === "string" &&
    typeof m.quest_id === "string" &&
    typeof m.playmode === "string" &&
    typeof m.quest_prompt === "string" &&
    typeof m.award_text_on_complete === "string" &&
    typeof m.fail_text_on_fail === "string"
  );
}

async function loadquests(filePath = path.join(__dirname, "quests.json")) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : parsed.quests || [];
  const unique = new Map();
  for (const m of arr)
    if (isValidquest(m) && !unique.has(m.quest_id)) unique.set(m.quest_id, m);
  questS = Array.from(unique.values());
  if (questS.length === 0) throw new Error("No valid quests found.");
  console.log(`Loaded ${questS.length} quests.`);
}

// boot-time load
loadquests().catch((err) => {
  console.error("quest load failed:", err);
  process.exit(1);
});

const players = new Map(); // uid -> { score: number, difficulty: 'easy'|'medium'|'hard' }

function getPlayer(uid) {
  if (!players.has(uid))
    players.set(uid, {
      score: 0,
      mode: "stealth",
      finishedquests: [],
      currentArtWorkId: "",
    });
  return players.get(uid);
}

function setMode(uid, mode) {
  const p = getPlayer(uid);
  if (["stealth", "social", "improvisational"].includes(mode)) p.mode = mode;
  return p;
}

const PLAYMODE_LABELS = {
  stealth: "̤̤̈stealth  *where your play wont be recognised",
  social: "social *where you play with others",
  improvisational: "͐͋ɨ͎̗͋͐ʍ̗͎ρя๏˅͐͋ɨ͋͐$͛ą͛ţ͐͋ɨ͋͐๏ñ͛ą͛ℓ *where you play in public",
};

function addScore(uid) {
  const p = getPlayer(uid);
  p.score += 1;
  return p;
}

async function getImage(folder) {
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
  startBot(msg);
});

function startBot(msg) {
  bot
    .sendMessage(msg.chat.id, "̤̤̈l̶̟̯͕̼̤͖̳͗̒̆̈́o̷̿͌̎̕͜͝ȧ̴̯̍͆̆̐̄͘̚ḑ̴̡̧̪̯̯̯̘̰̾̍͋̒̚͝͠ī̶̬̅̍̈́̀ǹ̶͙͚̞̬̒̀͘͝͝͝͝ğ̴͍͋̈́̇͆̓͠ s̵̝̒͗ī̶̬̅̍̈́̀m̸̥̬͌̊̈́̽͋̋̿̄u̶̢͇͍͖̔̅̂l̶̟̯͕̼̤͖̳͗̒̆̈́ȧ̴̯̍͆̆̐̄͘̚t̶͔́ī̶̬̅̍̈́̀o̷̿͌̎̕͜͝ǹ̶͙͚̞̬̒̀͘͝͝͝͝")
    .then(function (response) {
      bot.sendMessage(msg.chat.id, "hello there " + msg.chat.first_name);
    })
    .then(function (response) {
      bot.sendChatAction(msg.chat.id, "typing");
      const opts = {
        reply_markup: JSON.stringify({
          one_time_keyboard: true,
          keyboard: [
            [needtoentersimulation],
            [readytoplayprompt],
            [takemetothebar],
          ],
        }),
      };
      function followup() {
        bot.sendMessage(msg.chat.id, "welcome to the exhibition simulacrum");
        bot.sendMessage(
          msg.chat.id,
          "I will be your guide to the authentic ---hyperreal- simulation experience - do you wanna play with me?",
          opts
        );
      }

      setTimeout(followup, 2000); //wait 2 seconds

      // bot.sendPhoto(
      //   msg.chat.id,
      //   "https://res.cloudinary.com/www-houseofkilling-com/image/upload/v1631264421/aawkwaa/aawkwaa_profilepic_osrxec.png",
      //   opts
      // );
    })
    .catch();
}

bot.on("message", async (msg) => {
  console.log("receives string", msg);
  if (msg.text === readytoplayprompt) {
    // getImage("folder:aawkwaa/cheer_up_images")
    //   .then((image) => {
    //     bot.sendMessage(msg.chat.id, "of course " + msg.chat.first_name + "❤️");
    //     bot.sendPhoto(msg.chat.id, image, { caption: "here u go babe" });
    //   })
    //   .then(function (response) {
    //     function followup() {
    //       const opts = {
    //         reply_markup: JSON.stringify({
    //           one_time_keyboard: true,

    //           keyboard: [
    //             ["Yeah! let´s play 😁"],
    //             ["tell me a bit more about the game maybe?"],
    //             ["I dont wanna play today 😬"],
    //           ],
    //         }),
    //       };

    //       bot.sendMessage(
    //         msg.chat.id,
    //         "I feel like you and me will be okay! ╰(*°▽°*)╯ in a way we are both failures. Wanna play my game now?",
    //         opts
    //       );
    //     }

    //     setTimeout(followup, 3000); //wait 2 seconds
    //   })
    //   .catch(console.log("FAILURE TO GET IMAGE"));
    // bot.sendMessage(
    //   msg.chat.id,
    //   "fantastic, before we begin - lets choose a play mode"
    // );
    sendModeChoice(msg.chat.id);
  }
  if (msg.text === needtoentersimulation) {
    bot
      .sendMessage(
        msg.chat.id,
        "”There is an important truth about the world that must be understood and trusted, if this game is to work. That something is fiction, doesn’t make it any less real.”"
      )
      .then(function (response) {
        const opts = {
          reply_markup: JSON.stringify({
            one_time_keyboard: true,
            keyboard: [["what?"], ["oh i see"]],
          }),
        };
        bot.sendMessage(
          msg.chat.id,
          "I will be your unreliable guide into the art show, where artworks are woven into social game systems of understanding",
          opts
        );
      });
  }
  if (msg.text === "what?" || msg.text === "oh i see") {
    diveIntoTheSimulation(msg.chat.id);
  }

  if (
    msg.text === "does that mean that nothing is real?" ||
    msg.text === "does that mean that anyone might be a player?"
  ) {
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,
        keyboard: [[readytoplayprompt], [takemetothebar]],
      }),
    };
    bot.sendMessage(msg.chat.id, "I think u get it now <3");
    bot.sendMessage(msg.chat.id, "so do you wanna play?", opts);
  }

  if (msg.text === "restart") {
    startBot(msg);
  }
  if (
    msg.text === takemetothebar ||
    noStopTheGameResponses.includes(msg.text)
  ) {
    bot
      .sendMessage(
        msg.chat.id,
        "sure, " +
          msg.chat.first_name +
          ", just because you are not playing does not mean that game doesnt exist"
      )
      .then(function (response) {
        const opts = {
          reply_markup: JSON.stringify({
            one_time_keyboard: true,
            keyboard: [["restart"]],
          }),
        };
        bot.sendMessage(
          msg.chat.id,
          "go to the bar... but dont be so sure that the people there arent avatars. u might be the only npc",
          opts
        );
      });
  }
  if (msg.text == "change mod") {
    sendModeChoice(msg.chat.id);
  }
  if (msg.text == "random quest") {
    sendquest(msg.chat.id, msg.from.id);
  }
  if (msg.text == "send me on a random side quest") {
    sendquest(msg.chat.id, msg.from.id);
  }
  if (
    msg.text == "send me on a side quest for a specific work" ||
    msg.text == "change artwork"
  ) {
    giveArtWorkChoice(msg.chat.id);
  }
  if (takeMeToAnotherQuestResponses.includes(msg.text)) {
    sendquestChoice(msg.chat.id);
  }
  if (msg.text == "I am done") {
    finishquest(msg.chat.id);
  }
  if (failResponses.includes(msg.text)) {
    failed(msg);
  }
  if (successResponses.includes(msg.text)) {
    win(msg);
  }

  if (
    msg.text != null &&
    msg.text.trim().toLowerCase() === "generate collage"
  ) {
    const bucket = collageBuckets.get(msg.chat.id) || [];
    if (bucket.length < 2) {
      bot.sendMessage(msg.chat.id, "Send me at least 2 photos first.");
      return;
    }

    // You can tweak these to taste or randomize sizes
    const options = {
      iterations: 100,
      patchWidth: 70,
      patchHeight: 70,
      // seed: 12345, // uncomment to make it deterministic per user
    };

    try {
      bot.sendChatAction(msg.chat.id, "upload_photo");
      const pngBuffer = await collageImages(bucket, options);

      // Option A: send directly as a photo
      await bot.sendPhoto(msg.chat.id, pngBuffer, {
        caption: `collage: ${options.iterations} swaps of ${options.patchWidth}×${options.patchHeight} patches`,
        filename: "collage.png",
        contentType: "image/png",
      });

      // Option B (optional): upload to Cloudinary and share a URL
      // const url = await new Promise((resolve, reject) => {
      //   cloudinary.uploader.upload_stream(
      //     { folder: "aawkwaa/collages", resource_type: "image" },
      //     (err, res) => (err ? reject(err) : resolve(res.secure_url))
      //   ).end(pngBuffer);
      // });
      // await bot.sendMessage(chatId, `Uploaded: ${url}`);

      // Clear bucket so each run is fresh (or keep it if you want iterative collages)
      collageBuckets.set(msg.chat.id, []);
    } catch (e) {
      console.error(e);
      bot.sendMessage(msg.chat.id, "Collage failed. Try different images?");
    }
  }
});

function sendModeChoice(id) {
  bot.sendMessage(
    id,
    "this experience can be served in different mods (that means, you get to choose what kind of missions you embark on): plz choose playmode: ",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: PLAYMODE_LABELS.stealth, callback_data: "mode:stealth" }],
          [{ text: PLAYMODE_LABELS.social, callback_data: "mode:social" }],
          [
            {
              text: PLAYMODE_LABELS.improvisational,
              callback_data: "mode:improvisational",
            },
          ],
        ],
      },
    }
  );
}
function getUniqueArtworks() {
  const seen = new Set();
  const out = [];
  for (const m of questS) {
    if (
      !seen.has(m.artwork_id) &&
      m.artwork_id &&
      m.artwork_id !== "exhibition-wide"
    ) {
      seen.add(m.artwork_id);
      out.push(m.artwork_id);
    }
  }
  // sort for stable UI
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function sendquestChoice(chatId) {
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard: true,
      keyboard: [
        ["send me on a random side quest"],
        ["send me on a side quest for a specific work"],
      ],
    }),
  };
  bot.sendMessage(chatId, "lets play!!!", opts);
}

async function sendquest(chatId, uid = chatId) {
  const player = getPlayer(uid);
  const { mode, finishedquests, currentArtWorkId } = player;

  // choose pool
  let pool = currentArtWorkId
    ? poolForPlayerArtwork(player)
    : poolForPlayer(player);

  // case: artwork chosen but empty
  if (currentArtWorkId && pool.length === 0) {
    const anyRemainingThisArtworkAnyMode = questS.some(
      (m) =>
        m.artwork_id === currentArtWorkId &&
        !finishedquests.includes(m.quest_id)
    );
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,
        keyboard: [
          ["random quest"],
          ["change artwork"],
          ...(anyRemainingThisArtworkAnyMode ? [["change mod"]] : []),
        ],
      }),
    };
    bot.sendMessage(
      chatId,
      `no more ${PLAYMODE_LABELS[mode]} quests for this artwork. wanna switch artwork or get a random quest?`,
      opts
    );
    return;
  }

  // case: no artwork chosen and empty in this mode
  if (!currentArtWorkId && pool.length === 0) {
    const anyOtherModes = questS.some(
      (m) => !finishedquests.includes(m.quest_id) && m.playmode !== mode
    );
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,
        keyboard: anyOtherModes
          ? [["🎛️ change mod"], ["🔀 random quest"]]
          : [["🔁 Reset progress"]],
      }),
    };
    bot.sendMessage(
      chatId,
      `you’ve completed all ${PLAYMODE_LABELS[mode]} quests. switch mode or take a random quest?`,
      opts
    );
    return;
  }

  // send one quest
  const quest = pickRandom(pool);

  const cached = videoCache.get(quest.artwork_id);
  let msg;

  try {
    if (cached?.fileId) {
      // reuse Telegram's cached file
      msg = await bot.sendVideo(chatId, cached.fileId);
    } else {
      // first time: send from web, then cache returned file_id
      msg = await bot.sendVideo(chatId, quest.image_url);
      if (msg.video?.file_id) {
        videoCache.set(quest.artwork_id, {
          fileId: msg.video.file_id,
          uniqueId: msg.video.file_unique_id,
        });
      }
    }
  } catch (err) {
    // if a cached file_id ever goes stale, fall back to URL and refresh the cache
    msg = await bot.sendVideo(chatId, quest.image_url);
    if (msg.video?.file_id) {
      videoCache.set(quest.artwork_id, {
        fileId: msg.video.file_id,
        uniqueId: msg.video.file_unique_id,
      });
    }
  }

  bot
    .sendMessage(chatId, `arrive @: *${prettyArtworkLabel(quest.artwork_id)}*`)
    .then(function () {
      bot.sendMessage(chatId, quest.quest_prompt);
    });

  // remember current quest if useful
  player.currentquestId = quest.quest_id;

  // follow-up
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard: true,
      keyboard: [["I am done"]],
    }),
  };
  setTimeout(() => {
    bot.sendMessage(
      chatId,
      "Let me know when you are done -- but like, take your time. I am not going anywhere",
      opts
    );
  }, 8000);
}

function finishquest(id) {
  bot
    .sendMessage(id, "good job ༼ つ ◕_◕ ༽つ (⊙_⊙;)!")
    .then(function () {
      const opts = {
        reply_markup: JSON.stringify({
          one_time_keyboard: true,
          keyboard: [
            [
              successResponses[
                Math.floor(Math.random() * success_answers.length)
              ],
            ],
            [failResponses[Math.floor(Math.random() * success_answers.length)]],
          ],
        }),
      };
      bot.sendMessage(
        id,
        "sooo..... did you succeed in your side quest?",
        opts
      );
    })
    .catch();
}

function win(msg) {
  const uid = msg.from.id;
  const chatId = msg.chat.id;
  let p = getPlayer(uid);

  const questId = p.currentquestId; // set by sendquest()
  recordCompletion(p, questId);
  addScore(uid); // uses your DIFF_MULT

  p = getPlayer(uid);

  const quest = getquestById(questId);
  const award =
    quest?.award_text_on_complete ||
    success_answers[Math.floor(Math.random() * success_answers.length)];

  bot
    .sendVideo(
      chatId,
      "https://res.cloudinary.com/dmwpm8iiw/image/upload/v1760380360/s2c/bot_main_mswase.gif"
    )
    .then(function () {
      bot.sendMessage(chatId, award + " you have " + p.score + " aura points");
      bot.sendChatAction(chatId, "typing");
    })
    .then(function () {
      function followup() {
        const opts = {
          reply_markup: JSON.stringify({
            one_time_keyboard: true,

            keyboard: [
              [
                takeMeToAnotherQuestResponses[
                  Math.floor(
                    Math.random() * takeMeToAnotherQuestResponses.length
                  )
                ],
              ],
              [
                noStopTheGameResponses[
                  Math.floor(Math.random() * noStopTheGameResponses.length)
                ],
              ],
            ],
          }),
        };
        bot.sendMessage(
          chatId,
          "so do you wanna continue? we haven't even touched the edges of the simulation yet",
          opts
        );
      }

      if (p.score >= winAmount) {
        bot
          .sendMessage(
            chatId,
            "hej babe, have we been co-inhabiting this simulation together?"
          )
          .then(function () {
            bot
              .sendMessage(
                chatId,
                "You are so beautiful to me: top player with all the quests. The simulation bends to your will. Your speed run glitches the software. I welcome you to the edges of the simulacra. Clay turns to pixels. Code turns to system."
              )
              .then(function () {
                bot
                  .sendPhoto(
                    chatId,
                    "https://res.cloudinary.com/dmwpm8iiw/image/upload/v1760384377/s2c/Aktiv_1landscape_sx7ty6.png",
                    { caption: "win token" }
                  )
                  .then(function () {
                    const finishOpts = {
                      reply_markup: JSON.stringify({
                        one_time_keyboard: true,

                        keyboard: [
                          [
                            takeMeToAnotherQuestResponses[
                              Math.floor(
                                Math.random() *
                                  takeMeToAnotherQuestResponses.length
                              )
                            ],
                          ],
                          [
                            noStopTheGameResponses[
                              Math.floor(
                                Math.random() * noStopTheGameResponses.length
                              )
                            ],
                          ],
                        ],
                      }),
                    };

                    bot.sendMessage(
                      chatId,
                      "You can continue the game, or you can show this win token to context creators (S2C) at the bar and collect your prize.... sooooo should we still play?",
                      finishOpts
                    );
                  });
              });
          });
      } else {
        setTimeout(followup, 4000); //wait 2 seconds
      }
    })
    .catch();
}

function diveIntoTheSimulation(chatId) {
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard: true,
      keyboard: [
        ["does that mean that nothing is real?"],
        ["does that mean that anyone might be a player?"],
      ],
    }),
  };
  bot
    .sendMessage(
      chatId,
      "Hej babe, are you also [coinhabiting synthetic worlds with machines] lately? Yearning for soft sympoesis and running on absurdity, the exhibition invites artists working across videogame engines, generative algorithmic systems and soft worldings to fabulate new unrealities. The main plot is leaking. Truth feels like a swamp– slippery, gloopy, always shifting underfoot. Step too close and it distorts, slurps you down. This simulation frolics between pixels and petals, between code and clay. The digital cracks open portals into alternate realities; the physical insists on weight, touch, presence. Joystick in one hand, flower in the other. Together, they compose side quests that aren’t detours or escapes, but necessary strategies for care and fabulation in viscous times, asking: Whose simulation is it anyway?"
    )
    .then(function () {
      bot.sendChatAction(chatId, "typing");

      bot.sendMessage(
        chatId,
        "this exhibition is a simulation --- ღ(¯`◕‿◕´¯) ♫ ♪ ♫ everything is a game ♫ ♪ ♫ (¯`◕‿◕´¯)ღ ",
        opts
      );
    })
    .catch();
}

function failed(msg) {
  const uid = msg.from.id;
  const chatId = msg.chat.id;
  const p = getPlayer(uid);

  const questId = p.currentquestId;
  recordCompletion(p, questId); // record even on fail (your request)

  const quest = getquestById(questId);
  const failLine =
    quest?.fail_text_on_fail ||
    fail_answers[Math.floor(Math.random() * fail_answers.length)];

  bot.sendMessage(chatId, failLine);

  bot.sendChatAction(chatId, "typing");

  function followup() {
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,

        keyboard: [
          [
            takeMeToAnotherQuestResponses[
              Math.floor(Math.random() * takeMeToAnotherQuestResponses.length)
            ],
          ],
          [
            noStopTheGameResponses[
              Math.floor(Math.random() * noStopTheGameResponses.length)
            ],
          ],
        ],
      }),
    };
    bot.sendMessage(chatId, "¯_(ツ)_/¯ u could always try again?", opts);
  }

  setTimeout(followup, 4000); //wait 2 seconds
}

function giveArtWorkChoice(chatId) {
  const artworks = getUniqueArtworks();

  if (artworks.length === 0) {
    bot.sendMessage(
      chatId,
      "hmm, i can’t see any artworks yet. add some to quests.json?"
    );
    return;
  }

  const buttons = artworks.map((id) => ({
    text: prettyArtworkLabel(id),
    callback_data: `aw:${id}`, // keep it short for Telegram
  }));

  // add a "random/any" option
  buttons.push({ text: "🔀 Any artwork", callback_data: "aw:" });

  const inline_keyboard = chunk(buttons, 2).map((row) =>
    row.map((b) => ({ text: b.text, callback_data: b.callback_data }))
  );

  bot.sendMessage(chatId, "wander to an artwork of your choosing:", {
    reply_markup: { inline_keyboard },
  });
}
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const uid = q.from.id;

  if (q.data.startsWith("mode:")) {
    const mode = q.data.split(":")[1]; // stealth|social|improvisational
    setMode(uid, mode);
    const p = getPlayer(uid);
    bot.answerCallbackQuery(q.id, {
      text: `Mode set: ${PLAYMODE_LABELS[p.mode]}`,
    });
    bot.editMessageText(
      `Playmode locked: *${PLAYMODE_LABELS[p.mode]}*. Current score: ${
        p.score
      }`,
      {
        chat_id: chatId,
        message_id: q.message.message_id,
        parse_mode: "Markdown",
      }
    );

    sendquestChoice(chatId);
    return;
  }
  if (q.data.startsWith("aw:")) {
    const artId = q.data.slice(3); // may be "" for Any artwork
    const p = getPlayer(uid);
    p.currentArtWorkId = artId; // "" means no lock (random within mode)

    bot.answerCallbackQuery(q.id, {
      text: artId
        ? `Artwork set: ${prettyArtworkLabel(artId)}`
        : "Artwork cleared (any).",
      show_alert: false,
    });

    // edit the chooser message for feedback (optional)
    bot.editMessageText(
      artId
        ? `locked on: *${prettyArtworkLabel(artId)}* — sending you a quest…`
        : `no artwork lock — sending a random quest in your mode…`,
      {
        chat_id: chatId,
        message_id: q.message.message_id,
        parse_mode: "Markdown",
      }
    );

    // immediately send a quest respecting mode + artwork
    sendquest(chatId, uid);
    return;
  }
});

async function fetchTelegramFileAsBuffer(fileId) {
  const link = await bot.getFileLink(fileId);
  const resp = await axios.get(link, { responseType: "arraybuffer" });
  return Buffer.from(resp.data);
}

// When users send photos, keep the highest-res variant
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  try {
    const variants = msg.photo || [];
    const biggest = variants[variants.length - 1];
    if (!biggest || !biggest.file_id) return;

    const buf = await fetchTelegramFileAsBuffer(biggest.file_id);
    if (!collageBuckets.has(chatId)) collageBuckets.set(chatId, []);
    collageBuckets.get(chatId).push(buf);

    let imageAmount = collageBuckets.get(chatId).length;

    if (imageAmount > 2) {
      const opts = {
        reply_markup: JSON.stringify({
          one_time_keyboard: true,

          keyboard: [["generate collage"]],
        }),
      };
      bot.sendMessage(
        chatId,
        `these are great images! send me more or generate the collage now`
      );
    } else {
      bot.sendMessage(chatId, `i need more images to make the collage with`);
    }
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, "Couldn't read that photo, sorry :(");
  }
});

bot.onText(/\/quest/, (msg) => sendquestChoice(msg.chat.id));
// bot.onText(/\/artworkquest/, (msg) => giveArtWorkChoice(msg.chat.id));
bot.onText(/\/mode/, (msg) => {
  sendModeChoice(msg.chat.id);
});

bot.onText(/\/goodbye/, (msg) => {
  bot.sendMessage(msg.chat.id, "I will miss you " + msg.chat.first_name);
  bot.sendMessage(msg.chat.id, "Come back one day! ");
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, "Are you confused " + msg.chat.first_name + "?");
  bot.sendChatAction(msg.chat.id, "typing");
  const opts = {
    reply_markup: JSON.stringify({
      one_time_keyboard: true,

      keyboard: [
        [
          takeMeToAnotherQuestResponses[
            Math.floor(Math.random() * takeMeToAnotherQuestResponses.length)
          ],
        ],
        [needtoentersimulation],
        [
          noStopTheGameResponses[
            Math.floor(Math.random() * noStopTheGameResponses.length)
          ],
        ],
      ],
    }),
  };
  bot.sendMessage(
    msg.chat.id,
    "dont worry too much about it. simulacra slime on buttefly wings. the game is simple: you ask for quests and do your best to complete them. if you succeed enough, you can even win prizes.",
    opts
  );
});

// -- nicer button labels from ids (slug -> Title Case)
function prettyArtworkLabel(id) {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// -- chunk into rows
function chunk(arr, size = 2) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}
function ensureCompletedArray(p) {
  if (!Array.isArray(p.completedquests)) {
    // migrate from legacy finishedquests if present
    p.completedquests = Array.isArray(p.finishedquests)
      ? [...p.finishedquests]
      : [];
  }
  // keep legacy prop in sync so existing filters still work
  p.finishedquests = p.completedquests;
}

function recordCompletion(p, questId) {
  if (!questId) return false;
  ensureCompletedArray(p);
  if (!p.completedquests.includes(questId)) {
    p.completedquests.push(questId);
    p.finishedquests = p.completedquests; // keep synced
    return true;
  }
  return false;
}

function getquestById(questId) {
  return questS?.find?.((m) => m.quest_id === questId);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function poolForPlayer(player) {
  return questS.filter(
    (m) =>
      m.playmode === player.mode && !player.finishedquests.includes(m.quest_id)
  );
}

function poolForPlayerArtwork(player) {
  if (!player.currentArtWorkId) return [];
  return questS.filter(
    (m) =>
      m.playmode === player.mode &&
      m.artwork_id === player.currentArtWorkId &&
      !player.finishedquests.includes(m.quest_id)
  );
}

// add/replace your helpers
function ui(lines, choices = [], state = {}, events = []) {
  return { lines, choices, state, events };
}
function choice(label, action, payload) {
  return { label, action, payload };
}

// keep your existing ui() and choice() helpers above this

function act(uid, action = "start", payload = {}) {
  const p = getPlayer(uid);
  const ANY = ""; // no artwork lock
  const L = (arr) => arr[Math.floor(Math.random() * arr.length)];

  switch (action) {
    // ---------------- ENTRY ----------------
    case "start":
      return ui(
        [
          "̤̤̈l̶̟̯͕̼̤͖̳͗̒̆̈́o̷̿͌̎̕͜͝ȧ̴̯̍͆̆̐̄͘̚ḑ̴̡̪̯̯̯̘̰̾̍͋̒̚͝͠ī̶̬̅̍̈́̀ǹ̶͙͚̞̬̒̀͘͝͝͝͝ğ̴͍͋̈́̇͆̓͠ s̵̝̒͗ī̶̬̅̍̈́̀m̸̥̬͌̊̈́̽͋̋̿̄u̶̢͇͍͖̔̅̂l̶̟̯͕̼̤͖̳͗̒̆̈́ȧ̴̯̍͆̆̐̄͘̚t̶͔́ī̶̬̅̍̈́̀o̷̿͌̎̕͜͝ǹ̶͙͚̞̬̒̀͘͝͝͝͝",
          "hello there player",
          "welcome to the exhibition simulacrum",
          "I will be your guide to the authentic ---hyperreal- simulation experience - do you wanna play with me?",
        ],
        [
          choice("take me into the simulation", "enter"),
          choice("send me on a side quest", "mode"),
          choice("lets go to the bar", "bar"),
        ],
        { score: p.score, mode: p.mode, artwork: p.currentArtWorkId }
      );

    case "enter":
      return ui(
        [
          "”There is an important truth about the world that must be understood and trusted, if this game is to work. That something is fiction, doesn’t make it any less real.”",
          "I will be your unreliable guide into the art show, where artworks are woven into social game systems of understanding",
        ],
        [
          choice("choose mode", "mode"),
          choice("get a quest", "questChoice"),
          choice("help", "help"),
        ],
        { score: p.score, mode: p.mode }
      );

    // ---------------- MODES ----------------
    case "mode":
      return ui(
        [
          "this experience can be served in different mods (that means, you get to choose what kind of missions you embark on): plz choose playmode:",
        ],
        [
          choice(PLAYMODE_LABELS.stealth, "setMode", { mode: "stealth" }),
          choice(PLAYMODE_LABELS.social, "setMode", { mode: "social" }),
          choice(PLAYMODE_LABELS.improvisational, "setMode", {
            mode: "improvisational",
          }),
        ],
        { score: p.score, mode: p.mode }
      );

    case "setMode": {
      if (["stealth", "social", "improvisational"].includes(payload.mode)) {
        setMode(uid, payload.mode);
      }
      const pp = getPlayer(uid);
      return ui(
        [
          `Playmode locked: ${PLAYMODE_LABELS[pp.mode]}. Current score: ${
            pp.score
          }`,
        ],
        [
          choice("get a quest", "questChoice"),
          choice("change artwork", "artworkPicker"),
        ],
        { score: pp.score, mode: pp.mode }
      );
    }

    // --------------- QUEST FLOW ---------------
    case "questChoice":
      return ui(
        ["lets play!!!"],
        [
          choice("send me on a random side quest", "quest"),
          choice(
            "send me on a side quest for a specific work",
            "artworkPicker"
          ),
        ],
        { score: p.score, mode: p.mode, artwork: p.currentArtWorkId || ANY }
      );

    case "artworkPicker": {
      const all = getUniqueArtworks();
      const first = all.slice(0, 8);
      const picks = [
        ...first.map(
          (id) => choice(prettyArtworkLabel(id), "setArtwork", { id }),
          choice("🔀 Any artwork", "setArtwork", { id: ANY })
        ),
      ];
      return ui(["wander to an artwork of your choosing:"], picks, {
        totalArtworks: all.length,
        showing: first.length,
      });
    }

    case "setArtwork": {
      p.currentArtWorkId = payload?.id ?? ANY;
      return act(uid, "quest");
    }

    case "quest": {
      const pool = p.currentArtWorkId
        ? poolForPlayerArtwork(p)
        : poolForPlayer(p);

      if (p.currentArtWorkId && pool.length === 0) {
        const anyRemainingThisArtworkAnyMode = questS.some(
          (m) =>
            m.artwork_id === p.currentArtWorkId &&
            !p.finishedquests.includes(m.quest_id)
        );
        const choices = [
          choice("random quest", "quest"),
          choice("change artwork", "artworkPicker"),
        ];
        if (anyRemainingThisArtworkAnyMode)
          choices.push(choice("change mod", "mode"));
        return ui(
          [
            `no more ${
              PLAYMODE_LABELS[p.mode]
            } quests for this artwork. wanna switch artwork or get a random quest?`,
          ],
          choices
        );
      }

      if (!p.currentArtWorkId && pool.length === 0) {
        const anyOtherModes = questS.some(
          (m) => !p.finishedquests.includes(m.quest_id) && m.playmode !== p.mode
        );
        return ui(
          [
            `you’ve completed all ${
              PLAYMODE_LABELS[p.mode]
            } quests. switch mode or take a random quest?`,
          ],
          anyOtherModes
            ? [
                choice("🎛️ Change mode", "mode"),
                choice("🔀 Random quest", "quest"),
              ]
            : [choice("🔁 Reset progress", "reset")]
        );
      }

      const q = pickRandom(pool);
      p.currentquestId = q.quest_id;

      // Send the artwork “video”/gif to the web UI too:
      // Your Telegram path uses quest.image_url in sendVideo — we surface the same for web.
      const events = q.image_url
        ? [
            {
              type: "video",
              url: q.image_url,
              caption: prettyArtworkLabel(q.artwork_id),
            },
          ]
        : [];

      return ui(
        [
          `arrive @: ${prettyArtworkLabel(q.artwork_id)}`,
          q.quest_prompt,
          "Let me know when you are done -- but like, take your time. I am not going anywhere",
        ],
        [choice("I am done", "done")],
        { questId: q.quest_id, artwork: q.artwork_id, mode: p.mode },
        events
      );
    }

    case "done":
      // If you want a celebratory image here, add to events.
      return ui(
        ["sooo..... did you succeed in your side quest?"],
        [
          choice("✅ " + L(successResponses), "succeed"),
          choice("❌ " + L(failResponses), "fail"),
        ]
      );

    case "succeed": {
      const q = getquestById(p.currentquestId);
      recordCompletion(p, p.currentquestId);
      addScore(uid);

      const award = q?.award_text_on_complete || L(success_answers);

      // Use your Cloudinary “bot_main_mswase.gif” as a visual moment in the web UI
      const events = [
        {
          type: "image",
          url: "https://res.cloudinary.com/dmwpm8iiw/image/upload/v1760380360/s2c/bot_main_mswase.gif",
          caption: "✨ aura +1",
        },
      ];

      // If they’ve hit winAmount, also include the win token image
      if (p.score >= winAmount) {
        events.push({
          type: "image",
          url: "https://res.cloudinary.com/dmwpm8iiw/image/upload/v1760384377/s2c/Aktiv_1landscape_sx7ty6.png",
          caption: "win token",
        });
      }

      return ui(
        [
          `${award} you have ${p.score} aura points`,
          "so do you wanna continue? we haven't even touched the edges of the simulation yet",
        ],
        [
          choice(L(takeMeToAnotherQuestResponses), "questChoice"),
          choice(L(noStopTheGameResponses), "bar"),
        ],
        { score: p.score },
        events
      );
    }

    case "fail": {
      const q = getquestById(p.currentquestId);
      recordCompletion(p, p.currentquestId);
      const failLine = q?.fail_text_on_fail || L(fail_answers);
      return ui(
        [failLine, "¯_(ツ)_/¯ u could always try again?"],
        [
          choice(L(takeMeToAnotherQuestResponses), "questChoice"),
          choice(L(noStopTheGameResponses), "bar"),
        ]
      );
    }

    // --------------- MISC ---------------
    case "bar":
      return ui(
        [
          "sure, player, just because you are not playing does not mean that game doesnt exist",
          "go to the bar... but dont be so sure that the people there arent avatars. u might be the only npc",
        ],
        [choice("ok fine, choose mode", "mode"), choice("restart", "start")]
      );

    case "help":
      return ui(
        [
          "dont worry too much about it. simulacra slime on buttefly wings.",
          "the game is simple: you ask for quests and do your best to complete them.",
          "if you succeed enough, you can even win prizes.",
        ],
        [
          choice("get a quest", "questChoice"),
          choice("take me into the simulation", "enter"),
        ]
      );

    case "reset":
      p.finishedquests = [];
      p.completedquests = [];
      p.currentArtWorkId = ANY;
      p.currentquestId = undefined;
      return ui(
        ["progress reset."],
        [choice("random quest", "quest"), choice("choose mode", "mode")],
        { score: p.score, mode: p.mode }
      );

    default:
      return ui([`Unknown action: ${action}`], [choice("restart", "start")]);
  }
}

app.post("/api/act", (req, res) => {
  try {
    const { action, payload, sessionId } = req.body || {};
    console.log("action:", action, "payload:", payload);

    // prefer explicit sessionId (if you keep it on the client), else cookie, else mint
    let sid = sessionId || req.cookies.sid;
    if (!sid) {
      sid = nanoid(); // short, URL-safe id
      // 1-year cookie; lax so same-origin POSTs work; httpOnly to keep it out of JS
      res.cookie("sid", sid, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }

    const result = act(String(sid), action || "start", payload || {});
    // (optional) include sid in the response for debugging
    result.state = { ...(result.state || {}), sid };
    res.json(result);
  } catch (e) {
    console.error("api/act error:", e);
    res.status(500).json({ error: "internal error" });
  }
});

// app.listen(process.env.PORT);

app.post("/" + bot.token, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`server listening on :${port}`));
