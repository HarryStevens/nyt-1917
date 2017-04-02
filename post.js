var Twit = require("twit");

var T = new Twit({
  consumer_key: "OtNYj1vCYvzir6YTfUBcieRD9",
  consumer_secret: "T9OQf4N4BBiT5QlZZ4COVLxPQeuZmWc60J8fXwOBtLzEtR2bxC",
  access_token: "848440144541605888-pxQxguIkIntSEvLK4EuDmplQliLXPo8",
  access_token_secret: "pvSWeBsVfuwT6CjXAlp42gLRLAoYW1bydg3bWOQSsbYeM",
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
});

var _ = require("underscore"),
  fs = require("fs");

// underscore rateLimit function
_.rateLimit = function(func, rate, async) {
  var queue = [];
  var timeOutRef = false;
  var currentlyEmptyingQueue = false;
  
  var emptyQueue = function() {
    if (queue.length) {
      currentlyEmptyingQueue = true;
      _.delay(function() {
        if (async) {
          _.defer(function() { queue.shift().call(); });
        } else {
          queue.shift().call();
        }
        emptyQueue();
      }, rate);
    } else {
      currentlyEmptyingQueue = false;
    }
  };
  
  return function() {
    var args = _.map(arguments, function(e) { return e; }); // get arguments into an array
    queue.push( _.bind.apply(this, [func, this].concat(args)) ); // call apply so that we can pass in arguments as parameters as opposed to an array
    if (!currentlyEmptyingQueue) { emptyQueue(); }
  };
};

// date parser
var date;
new Date().toISOString().split("T")[0].split("-").forEach((d, i) =>{

  date = i == 0 ? d - 100 + "-" : i == 1 ? date + d + "-" : date + d;

});

// update
console.log("Posting tweets from " + date);

// parse the json string to a json object literal
var json = JSON.parse(fs.readFileSync("tweets/tweets_" + date + ".json", "utf8"));

var tweet_limited = _.rateLimit(tweet, 5000);

shuffle(json).forEach(tweet_limited);

function tweet(t){

  console.log(t.tweet);
  console.log(" ");

  //  tweet 'hello world!'
  //
  T.post("statuses/update", { status: t.tweet }, function(err, data, response) {
    console.log(data)
  });


}

function shuffle(array) {
  var m = array.length, t, i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}