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

// Global cache for structured missions
let MISSIONS = [];

function isValidMission(m) {
  return (
    m &&
    typeof m.artwork_id === "string" &&
    typeof m.mission_id === "string" &&
    typeof m.playmode === "string" &&
    typeof m.mission_prompt === "string" &&
    typeof m.award_text_on_complete === "string" &&
    typeof m.fail_text_on_fail === "string"
  );
}

async function loadMissions(filePath = path.join(__dirname, "missions.json")) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : parsed.missions || [];
  const unique = new Map();
  for (const m of arr)
    if (isValidMission(m) && !unique.has(m.mission_id))
      unique.set(m.mission_id, m);
  MISSIONS = Array.from(unique.values());
  if (MISSIONS.length === 0) throw new Error("No valid missions found.");
  console.log(`Loaded ${MISSIONS.length} missions.`);
}

// boot-time load
loadMissions().catch((err) => {
  console.error("Mission load failed:", err);
  process.exit(1);
});

const players = new Map(); // uid -> { score: number, difficulty: 'easy'|'medium'|'hard' }

function getPlayer(uid) {
  if (!players.has(uid))
    players.set(uid, {
      score: 0,
      mode: "stealth",
      finishedMissions: [],
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
  stealth: "̤̤̈:̤̤̤̈̈̈s̤̤̈:̤̤̤̤̈̈:̤̤̤̈̈̈ẗ̤̤:̤̤̤̤̈̈:̤̤̤̈̈̈ë̤̤:̤̤̤̤̈̈:̤̤̤̈̈̈ä̤̤:̤̤̤̤̈̈:̤̤̤̈̈̈l̤̤̈:̤̤̤̤̈̈:̤̤̤̈̈̈ẗ̤̤:̤̤̤̤̈̈:̤̤̤̈̈̈ḧ̤̤:̤̤̈",
  social: "💲💣©️📍🅰️L",
  improvisational: "͐͋ɨ͎̗͋͐ʍ̗͎ρя๏˅͐͋ɨ͋͐$͛ą͛ţ͐͋ɨ͋͐๏ñ͛ą͛ℓ",
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
  if (msg.text == "random mission") {
    sendMission(msg.chat.id, msg.from.id);
  }
  if (msg.text == "send me on a random side quest") {
    sendMission(msg.chat.id, msg.from.id);
  }
  if (
    msg.text == "send me on a side quest for a specific work" ||
    msg.text == "change artwork"
  ) {
    giveArtWorkChoice(msg.chat.id);
  }
  if (takeMeToAnotherQuestResponses.includes(msg.text)) {
    sendMissionChoice(msg.chat.id);
  }
  if (msg.text == "I am done") {
    finishMission(msg.chat.id);
  }
  if (failResponses.includes(msg.text)) {
    failed(msg);
  }
  if (successResponses.includes(msg.text)) {
    win(msg);
  }
});

function sendModeChoice(id) {
  bot.sendMessage(
    id,
    "this experience can be served in different mods: plz choose playmode: ",
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
  for (const m of MISSIONS) {
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

function sendMissionChoice(chatId) {
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

function sendMission(chatId, uid = chatId) {
  const player = getPlayer(uid);
  const { mode, finishedMissions, currentArtWorkId } = player;

  // choose pool
  let pool = currentArtWorkId
    ? poolForPlayerArtwork(player)
    : poolForPlayer(player);

  // case: artwork chosen but empty
  if (currentArtWorkId && pool.length === 0) {
    const anyRemainingThisArtworkAnyMode = MISSIONS.some(
      (m) =>
        m.artwork_id === currentArtWorkId &&
        !finishedMissions.includes(m.mission_id)
    );
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,
        keyboard: [
          ["random mission"],
          ["change artwork"],
          ...(anyRemainingThisArtworkAnyMode ? [["change mod"]] : []),
        ],
      }),
    };
    bot.sendMessage(
      chatId,
      `no more ${PLAYMODE_LABELS[mode]} missions for this artwork. wanna switch artwork or get a random mission?`,
      opts
    );
    return;
  }

  // case: no artwork chosen and empty in this mode
  if (!currentArtWorkId && pool.length === 0) {
    const anyOtherModes = MISSIONS.some(
      (m) => !finishedMissions.includes(m.mission_id) && m.playmode !== mode
    );
    const opts = {
      reply_markup: JSON.stringify({
        one_time_keyboard: true,
        keyboard: anyOtherModes
          ? [["🎛️ Change mode"], ["🔀 Random mission"]]
          : [["🔁 Reset progress"]],
      }),
    };
    bot.sendMessage(
      chatId,
      `you’ve completed all ${PLAYMODE_LABELS[mode]} missions. switch mode or take a random mission?`,
      opts
    );
    return;
  }

  // send one mission
  const mission = pickRandom(pool);

  bot.sendMessage(chatId, mission.mission_prompt);

  // remember current mission if useful
  player.currentMissionId = mission.mission_id;

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

function finishMission(id) {
  bot
    .sendPhoto(
      id,
      "https://res.cloudinary.com/www-houseofkilling-com/image/upload/c_thumb,w_200,g_face/v1632228041/aawkwaa/goodjob_qfim9b.png",
      { caption: "good job ༼ つ ◕_◕ ༽つ (⊙_⊙;)!" }
    )
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
  const p = getPlayer(uid);

  const missionId = p.currentMissionId; // set by sendMission()
  recordCompletion(p, missionId);
  addScore(uid); // uses your DIFF_MULT

  p = getPlayer(uid);

  const mission = getMissionById(missionId);
  const award =
    mission?.award_text_on_complete ||
    success_answers[Math.floor(Math.random() * success_answers.length)];

  bot
    .sendVideo(
      chatId,
      "https://res.cloudinary.com/www-houseofkilling-com/video/upload/v1631365794/aawkwaa/embarressed_dfaxck.mp4"
    )
    .then(function () {
      bot.sendMessage(chatId, award);
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
      } else {
        setTimeout(followup, 4000); //wait 2 seconds
      }
    })
    .catch();
}

function diveIntoTheSimulation() {
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
      bot.sendChatAction(msg.chat.id, "typing");

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

  const missionId = p.currentMissionId;
  recordCompletion(p, missionId); // record even on fail (your request)

  const mission = getMissionById(missionId);
  const failLine =
    mission?.fail_text_on_fail ||
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
      "hmm, i can’t see any artworks yet. add some to missions.json?"
    );
    return;
  }

  const buttons = artworks.map((id) => ({
    text: prettyArtworkLabel(id),
    callback_data: `aw:${id}`, // keep it short for Telegram
  }));

  // add a "random/any" option
  buttons.unshift({ text: "🔀 Any artwork", callback_data: "aw:" });

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

    sendMissionChoice(chatId);
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
        ? `locked on: *${prettyArtworkLabel(artId)}* — sending you a mission…`
        : `no artwork lock — sending a random mission in your mode…`,
      {
        chat_id: chatId,
        message_id: q.message.message_id,
        parse_mode: "Markdown",
      }
    );

    // immediately send a mission respecting mode + artwork
    sendMission(chatId, uid);
    return;
  }
});

bot.onText(/\/quest/, (msg) => sendMissionChoice(msg.chat.id));
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
  if (!Array.isArray(p.completedMissions)) {
    // migrate from legacy finishedMissions if present
    p.completedMissions = Array.isArray(p.finishedMissions)
      ? [...p.finishedMissions]
      : [];
  }
  // keep legacy prop in sync so existing filters still work
  p.finishedMissions = p.completedMissions;
}

function recordCompletion(p, missionId) {
  if (!missionId) return false;
  ensureCompletedArray(p);
  if (!p.completedMissions.includes(missionId)) {
    p.completedMissions.push(missionId);
    p.finishedMissions = p.completedMissions; // keep synced
    return true;
  }
  return false;
}

function getMissionById(missionId) {
  return MISSIONS?.find?.((m) => m.mission_id === missionId);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function poolForPlayer(player) {
  return MISSIONS.filter(
    (m) =>
      m.playmode === player.mode &&
      !player.finishedMissions.includes(m.mission_id)
  );
}

function poolForPlayerArtwork(player) {
  if (!player.currentArtWorkId) return [];
  return MISSIONS.filter(
    (m) =>
      m.playmode === player.mode &&
      m.artwork_id === player.currentArtWorkId &&
      !player.finishedMissions.includes(m.mission_id)
  );
}

// add/replace your helpers
function ui(lines, choices = [], state = {}, events = []) {
  return { lines, choices, state, events };
}
function choice(label, action, payload) {
  return { label, action, payload };
}

function act(uid, action = "start", payload = {}) {
  const p = getPlayer(uid);
  const ANY = ""; // artwork unlocked
  const L = (arr) => arr[Math.floor(Math.random() * arr.length)];

  switch (action) {
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
          choice("get a quest", "missionChoice"),
          choice("help", "help"),
        ],
        { score: p.score, mode: p.mode }
      );

    case "mode":
      return ui(
        [
          "this experience can be served in different mods: plz choose playmode:",
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
      setMode(uid, payload.mode);
      const pp = getPlayer(uid);
      return ui(
        [
          `Playmode locked: ${PLAYMODE_LABELS[pp.mode]}. Current score: ${
            pp.score
          }`,
        ],
        [
          choice("get a quest", "missionChoice"),
          choice("change artwork", "artworkPicker"),
        ],
        { score: pp.score, mode: pp.mode }
      );
    }

    case "missionChoice":
      return ui(
        ["lets play!!!"],
        [
          choice("send me on a random side quest", "mission"),
          choice(
            "send me on a side quest for a specific work",
            "artworkPicker"
          ),
        ],
        { score: p.score, mode: p.mode, artwork: p.currentArtWorkId || ANY }
      );

    case "artworkPicker": {
      const all = getUniqueArtworks();
      const first = all.slice(0, 6); // keep it tight for the web UI; can paginate later
      const picks = [
        choice("🔀 Any artwork", "setArtwork", { id: ANY }),
        ...first.map((id) =>
          choice(prettyArtworkLabel(id), "setArtwork", { id })
        ),
      ];
      return ui(["wander to an artwork of your choosing:"], picks, {
        pickCount: first.length,
        total: all.length,
      });
    }

    case "setArtwork": {
      const id = payload.id ?? ANY;
      p.currentArtWorkId = id;
      return act(uid, "mission"); // immediately give a mission
    }

    case "mission": {
      const pool = p.currentArtWorkId
        ? poolForPlayerArtwork(p)
        : poolForPlayer(p);

      if (p.currentArtWorkId && pool.length === 0) {
        const anyRemainingThisArtworkAnyMode = MISSIONS.some(
          (m) =>
            m.artwork_id === p.currentArtWorkId &&
            !p.finishedMissions.includes(m.mission_id)
        );
        const choices = [
          choice("random mission", "mission"),
          choice("change artwork", "artworkPicker"),
        ];
        if (anyRemainingThisArtworkAnyMode)
          choices.push(choice("change mod", "mode"));
        return ui(
          [
            `no more ${
              PLAYMODE_LABELS[p.mode]
            } missions for this artwork. wanna switch artwork or get a random mission?`,
          ],
          choices
        );
      }

      if (!p.currentArtWorkId && pool.length === 0) {
        const anyOtherModes = MISSIONS.some(
          (m) =>
            !p.finishedMissions.includes(m.mission_id) && m.playmode !== p.mode
        );
        return ui(
          [
            `you’ve completed all ${
              PLAYMODE_LABELS[p.mode]
            } missions. switch mode or take a random mission?`,
          ],
          anyOtherModes
            ? [
                choice("🎛️ Change mode", "mode"),
                choice("🔀 Random mission", "mission"),
              ]
            : [choice("🔁 Reset progress", "reset")]
        );
      }

      const mission = pickRandom(pool);
      p.currentMissionId = mission.mission_id;

      return ui(
        [
          mission.mission_prompt,
          "Let me know when you are done -- but like, take your time. I am not going anywhere",
        ],
        [choice("I am done", "done")],
        {
          missionId: mission.mission_id,
          artwork: mission.artwork_id,
          mode: p.mode,
        }
      );
    }

    case "done":
      return ui(
        ["sooo..... did you succeed in your side quest?"],
        [
          choice("✅ " + L(successResponses), "succeed"),
          choice("❌ " + L(failResponses), "fail"),
        ]
      );

    case "succeed": {
      const mission = getMissionById(p.currentMissionId);
      recordCompletion(p, p.currentMissionId);
      addScore(uid);
      const award =
        mission?.award_text_on_complete ||
        success_answers[Math.floor(Math.random() * success_answers.length)];
      const continueChoices = [
        choice(L(takeMeToAnotherQuestResponses), "missionChoice"),
        choice(L(noStopTheGameResponses), "bar"),
      ];
      return ui(
        [
          award,
          "so do you wanna continue? we haven't even touched the edges of the simulation yet",
        ],
        continueChoices,
        { score: p.score }
      );
    }

    case "fail": {
      const mission = getMissionById(p.currentMissionId);
      recordCompletion(p, p.currentMissionId);
      const failLine =
        mission?.fail_text_on_fail ||
        fail_answers[Math.floor(Math.random() * fail_answers.length)];
      return ui(
        [failLine, "¯_(ツ)_/¯ u could always try again?"],
        [
          choice(L(takeMeToAnotherQuestResponses), "missionChoice"),
          choice(L(noStopTheGameResponses), "bar"),
        ]
      );
    }

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
          choice("get a quest", "missionChoice"),
          choice("take me into the simulation", "enter"),
        ]
      );

    case "reset": {
      p.finishedMissions = [];
      p.completedMissions = [];
      p.currentArtWorkId = ANY;
      return ui(
        ["progress reset."],
        [choice("random mission", "mission"), choice("choose mode", "mode")]
      );
    }

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
