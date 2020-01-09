
class MessageParser {
    constructor(client) {
        this.client = client;
        this.modules = new Map();
        this.firehose = [];
    }

    hook(command, cb) {
        if (command) {
            this.modules.set(command, cb);
        } else {
            this.firehose.push(cb);
        }
    }

    informModules(msg) {
        const message = msg.content;
        const command = message.split(' ')[0];
        const cb = this.modules.get(command);
        if (cb) {
            cb(msg);
        } else {
            for (const cb of this.firehose) {
                cb(msg);
            }
        }
    }
}

module.exports = MessageParser;