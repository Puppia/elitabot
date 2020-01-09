const dictionary = require('../dictionary');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const FETCH_LIMIT = 100;

function cleanMessage(message) {
  return (message
      // @user, @!user
      .replace(/<@!?(\d+)>/g, (_, mention) => {
        return '';
      })
      // #channel
      .replace(/<#(\d+)>/g, (_, mention) => {
        return '';
      })
      // @role
      .replace(/<@&(\d+)>/g, (_, mention) => {
        return '';
      })
      // :emoji:
      .replace(/<a?:(\w+):(\d+)>/g, (_, mention) => '')
    );
}

function pullMessages(channelID, begin, client, db) {
  const channel = client.channels.get(channelID);
  if (channel == null) {
    throw new Error(`bad channel ID: ${channelID}`);
  }

  const debugName = `#${channel.name} (${channel.id})`;
  console.log(`* pullMessages(): ${debugName}, starting ${begin}`)

  return channel.fetchMessages({ limit: FETCH_LIMIT, after: begin })
    .then(messages => {
      if (messages.size === 0) {
        console.log(`done for ${debugName}`);
        return;
      }

      const filteredMessages = messages.filter(
        message =>
          !message.author.bot &&
          message.embeds.length === 0 &&
          !message.content.includes('http') &&
          !message.isMentioned(client.user)
      );

      filteredMessages.forEach(message => {
        // console.log(`--- writing ${channel.id}, ${message.id}`);
        db.run(`
        INSERT INTO messages (message_id, message_text, author_id, channel_id)
        VALUES (?, ?, ?, ?)
        `, [message.id, message.content, message.author.id, message.channel.id], (err) => {
          if (err) {
            console.error(err.message);
          }
        });
      });
      console.log(`[${debugName}] saved ${filteredMessages.size} of ${messages.size} messages`);

      if (messages.size === FETCH_LIMIT) {
        return pullMessages(channelID, messages.first().id, client, db);
      }
    })
    .catch(error => {
      console.error(error);
    });
}

function sentenceGenerator(message, MarkovDictionary) {
  let sentence;
  if (message) {
    const words = cleanMessage(message.content).split(/[\s]+/).slice(1);
    let markovWord;
    if (words.length > 0) {
      markovWord = words[Math.floor(Math.random() * words.length)];
    }
    sentence = MarkovDictionary.createMarkovSentence(markovWord);
  } else {
    sentence = MarkovDictionary.createMarkovSentence();
  }

  return sentence;
}

class MarkovModule {
  constructor(context) {
    this.dispatch = context.dispatch;
    this.config = context.config;
    this.client = context.client;
    this.db = new sqlite3.Database(path.join(__dirname, '../db/markovdb.db'));
    this.MarkovDictionary = new dictionary();

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        author_id TEXT,
        message_text TEXT,
        PRIMARY KEY (channel_id, message_id)
      )`, (err) => { 
        if (err) {
          console.error(err.message)
        }
        const usedChannels = this.config.get('listen-channels');
        const promises = new Map();
        const makePullPromise = (id, start = 1) => promises.set(id, pullMessages(id, start, this.client, this.db));
    
        const sql = `
        SELECT
          channel_id,
          MAX(message_id) AS last_seen_message
        FROM messages
        GROUP BY channel_id
        `;
        this.db.each(sql, (err, row) => {
          if (err) {
            console.error(err.message);
          }
          if (usedChannels.includes(row['channel_id'])) {
            const lastSeenMessageID = row['last_seen_message'];
            if (lastSeenMessageID != null) {
              makePullPromise(row['channel_id'], row['last_seen_message']);
            }
          }
        }, async () => {
          for (const channelID of usedChannels) {
            if (!promises.has(channelID)) {
              makePullPromise(channelID);
            }
          }
      
          await Promise.all(promises.values());
          console.log('done');

          const messageSql = `SELECT message_text, message_id FROM messages ORDER BY message_id`;
          this.db.all(messageSql, [], (err, rows) => {
            if (err) {
              throw err;
            }
            rows.forEach((row) => {
              const line = cleanMessage(row.message_text);
              if (!line.includes('http')) {
                this.MarkovDictionary.addLine(line);
              }
            });
          });
        });
      });


    this.dispatch.hook(null, (message) => {
      //Add a message to Markov dictionary
      const channels = this.config.get('listen-channels');
      if (channels.includes(message.channel.id) && !message.content.includes('http') && !message.author.bot) {
        this.db.run(`
        INSERT INTO messages (message_id, message_text, author_id, channel_id)
        VALUES (?, ?, ?, ?)
        `, [message.id, message.content, message.author.id, message.channel.id], (err) => {
          if (err) {
            console.error(err.message);
          }
        });
        const lines = cleanMessage(message.content);
        if (lines !== '') {
          this.MarkovDictionary.addLine(lines);
        }
      }
    });

    this.dispatch.hook(null, (message) => {
      //Generate a markov sentence
      const channels = this.config.get('reply-channels');
      if (message.isMemberMentioned(message.client.user) && channels.includes(message.channel.id)) {
        const sentence = sentenceGenerator(message, this.MarkovDictionary);
        message.channel.send(sentence);
      }
    });
  }  
}

module.exports = MarkovModule;