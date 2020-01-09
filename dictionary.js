const endSymbol = Symbol('rabbit');

class Dictionary {
    constructor() {
        this.dictionaryMap = new Map([]);
        this.lineEnders = [];
        this.bannedWords = [];
    }

    addWord(word, nextWord) {
        if(word.replace(/\s/g, '').length) {
            if (this.dictionaryMap.has(word)) {
                const wordList = this.dictionaryMap.get(word);
                let wordCount = wordList.has(nextWord) ? wordList.get(nextWord) + 1 : 1;
                wordList.set(nextWord, wordCount);
                this.dictionaryMap.set(word, wordList);
            } else {
                const nextWordMap = new Map([])
                nextWordMap.set(nextWord, 1);
                this.dictionaryMap.set(word, nextWordMap);
            }
        }
    }

    getBannedWords() {
        return this.bannedWords;
    }

    addBannedWord(word) {
        if (!this.bannedWords.includes(word)) {
            this.bannedWords.push(word);
            return true;
        }

        const index = this.bannedWords.indexOf(word);
        if (index > -1) {
            this.bannedWords.splice(index, 1);
        }
        return false;
    }

    addLine(line) {
        const words = line.split(/[\s]+/);
        for (let i = 0; i < words.length - 1; i++) {
            this.addWord(words[i], words[i+1]);
            if (words[i].endsWith('.') || words[i].endsWith('!')) {
                this.addWord(words[i], endSymbol);
            }
        }
        this.addWord(words[words.length-1], endSymbol);
    }

    createMarkovSentence(start) {
        let sentence = '';
        if (!this.dictionaryMap.has(start) || !start.replace(/\s/g, '').length || this.bannedWords.includes(start.toLowerCase())) {
            const words = Array.from(this.dictionaryMap.keys());
            sentence = words[Math.floor(Math.random() * words.length)];
        } else {
            sentence = start;
        }
        let possibleNextWords = this.dictionaryMap.get(sentence);
        for (let i = 1; i <= 200; i++) {
            
            const filteredWordList = Array.from(possibleNextWords.entries())
                .filter(([word]) => { return word === endSymbol || !this.bannedWords.includes(word.toLowerCase()) });
            const totalOccurrences = filteredWordList.reduce((acc, [, occurrences]) => acc + occurrences, 0);
            let randPicker = Math.floor(Math.random() * totalOccurrences);
            let nextWord = '';
            for (let j = 0; j <= filteredWordList.length; j++) {
                if (!filteredWordList[j]) {
                    break;
                }
                    nextWord = filteredWordList[j][0];
                    randPicker -= filteredWordList[j][1];
                if (randPicker < 0) {
                    break;
                }
            }
            
            if (nextWord == endSymbol) {
                break;
            }

            sentence = sentence + ' ' + nextWord;

            if (!this.dictionaryMap.has(nextWord)) {
                break;
            }

            possibleNextWords = this.dictionaryMap.get(nextWord);
        }
        return(sentence);
    }
}

module.exports = Dictionary;

