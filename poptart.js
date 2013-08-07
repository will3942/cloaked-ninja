var irc = require('irc'),
    youtube = require('youtube-feeds'),
    request = require('request'),
    cheerio = require('cheerio'),
    mongodb = require('mongojs');
  
var currentchan = "";
var silent = 1;
var poptart = new irc.Client('irc.freenode.net', 'waffle', {
  channels: ['#ircnode', '#yrss'],
  port: 6667,
  userName: 'waffle',
  realName: 'beep'
});

var db = mongodb.connect('irc', ['messages']);

function parseYoutubeUrl(url) {
  var reg = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
  return (url.match(reg)) ? RegExp.$1 : false;
}
function parseYoutubeInfo(err, data) {
  if( err instanceof Error ) {
  } else {
    poptart.say(currentchan, "Title: " + data.title + " | Likes: " + data.likeCount + " | Views: " + data.viewCount + " | Duration: " + Math.round(data.duration / 60) + " minutes");
  }
}

function parsePageInfo(url, to) {
  request.get(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body, { lowerCaseTags: true });
      if ($('title').text() !== '') {
        var title = $('title').text();
        title = title.replace(/(\r\n|\n|\r)/gm,"");
        poptart.say(to, "Page Title: " + title);
      }
    }
  });
}

function findUrl(msg){
  var source = (msg || '').toString();
  var urlArray = [];
  var url;
  var matchArray;
  var regexToken = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3})/g;
  while( (matchArray = regexToken.exec(source)) !== null ){
    var token = matchArray[0];
    urlArray.push( token );
  }
  return urlArray[0];
}

poptart.addListener('message', function(from, to, message) {
  var now = new Date().toJSON();
  db.messages.save({nick: from, message: message, date: now}, function(err, saved) {
  });
  var url = findUrl(message);
  var ytId = parseYoutubeUrl(message);
  if (ytId) {
    currentchan = to;
    youtube.video(ytId, parseYoutubeInfo);
  }
  else if (typeof url != 'undefined' && !silent) {
    parsePageInfo(url, to);    
  }
  if (message.match(/.help/) ) {
    if (!silent) {
      poptart.say(to, "Use .lastsaw NICK to check when NICK last sent a message. Paste a YouTube URL and I will post info about the title, likes, views and duration. Paste a URL and I will tell you about the page title.");
    }
    else {
      poptart.say(to, "Oops, I've been silenced! I'm a silent logger. Use .lastsaw NICK to check when NICK last sent a message.");
    }
  }
  if (message.match(/.silent/)) {
    silent = 1;
    poptart.say(to, "I'm quiet.");
  }
  if (message.match(/.speak/)) {
    silent = 0;
    poptart.say(to, "I'll speak more now :-)");
  }
  if (message.match(/.lastsaw /) ) {
    message = message.replace(".lastsaw ", "");
    message = message.replace(/ /g, "");
    if (message !== "poptart") {
      db.messages.find({nick: message}).sort({_id:-1}).limit(1, function(err, messages) {
        if (typeof messages[0] != 'undefined') {
          var date = new Date(messages[0].date);
          var diff = new Date() - date;
          var seconds = Math.round(diff / 1000);
          var minutes = Math.round(seconds / 60);
          var hours = Math.round(minutes / 60);
          var days = Math.round(hours / 24);
          if (seconds >= 60) {
            if (minutes >= 60) {
              if (hours >= 24) {
                poptart.say(to, messages[0].nick + " was last seen " + days + " days ago.");
              }
              else {
                poptart.say(to, messages[0].nick + " was last seen " + hours + " hours ago.");
              }
            }
            else {
              poptart.say(to, messages[0].nick + " was last seen " + minutes + " minutes ago.");
            }
          }
          else {
            poptart.say(to, messages[0].nick + " was last seen " + seconds + " seconds ago.");
          }
        }
        else {
          poptart.say(to, message + " was not found in my logs :o");
        }
      });
    }
    else {
      poptart.say(to, "You can't look for a poptart ;n;");
    }    
  }
});
poptart.addListener('error', function(message) {
    console.log('error: ', message);
});
