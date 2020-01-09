const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.txt'), 'utf8');

class ConfigTracker {
    get(option) {
      return config[option];
    }
    set(option, value) {
      config[option] = value;
      fs.writeFileSync('config.txt', JSON.stringify(config), 'utf8');
    }
}

module.exports = ConfigTracker;