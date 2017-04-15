// dependencies
var request = require("request"), 
	fs = require("fs"),
  _ = require("underscore"),
	Twit = require("twit"),
  moment = require('moment');

// a new Twit instance
var T = new Twit({
  consumer_key: "OtNYj1vCYvzir6YTfUBcieRD9",
  consumer_secret: "T9OQf4N4BBiT5QlZZ4COVLxPQeuZmWc60J8fXwOBtLzEtR2bxC",
  access_token: "848440144541605888-pxQxguIkIntSEvLK4EuDmplQliLXPo8",
  access_token_secret: "pvSWeBsVfuwT6CjXAlp42gLRLAoYW1bydg3bWOQSsbYeM"
});

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

// an empty array
var tweets = [];

// use moment for date parser
var date = moment().subtract(100, "years"); // "today", but actually 100 years ago

// log to get started...
console.log("Getting articles from " + date.format("MMMM Do, YYYY") + ".");
console.log(" ")

// each page only returns 10 requests, so we'll find out how many there are first
request.get({
  url: "https://api.nytimes.com/svc/search/v2/articlesearch.json",
  qs: {
    "api-key": "6ec2da195c80457a827aa558bbb82f95",
    "fq": "russia OR lenin OR trotsky OR germany",
    "begin_date": date.format("YYYYMMDD"),
    "end_date": date.format("YYYYMMDD"),
  },
}, function(err, response, body) {
  var hits = JSON.parse(body).response.meta.hits;
  var pages = Math.ceil(hits / 10);
  console.log("Found " + hits + " articles on " + pages + " pages of results.");
  console.log(" ");

  // a rate-limited version of the request
  var makeRequest_limited = _.rateLimit(makeRequest, 1000);
  for (var i = 0; i < pages; i++){
    makeRequest_limited(i);
  }

  // so now we'll actually get the articles based on the number of pages
  function makeRequest(page){
    request.get({
      url: "https://api.nytimes.com/svc/search/v2/articlesearch.json",
      qs: {
        'api-key': "6ec2da195c80457a827aa558bbb82f95",
        'q': "russia",
        'begin_date': date.format("YYYYMMDD"),
        'end_date': date.format("YYYYMMDD"),
        'page': page
      },
    }, function(err, response, body) {
      
      body = JSON.parse(body);
      var docs = body.response.docs;

      //write filtered tweets to json
      docs.forEach((d, i) => {
        
        // an empty object to store data
        var obj = {};

        obj.day_index = i;
        obj.headline = d.headline.main;
        obj.url = "http://query.nytimes.com/mem/archive-free/pdf?res=" + d.web_url.split("res=")[1];
        obj.date = d.pub_date.split("T")[0];

        var tweet_end = obj.url + " #1917LIVE";

        // the tweet content is dependent upon the length of the headline
        // if the headline is too long, we'll cut it off and add three dots
        if (obj.headline.length > 103) {
          obj.tweet = obj.headline.substr(0, 103) + "... " + tweet_end;
        } else {
          obj.tweet = obj.headline + " " + tweet_end;
        }

        // post to twitter
        // T.post("statuses/update", { status: obj.tweet }, (err, data, response) => {
        //   if (!err){
        //     console.log(data.text);
        //     console.log(" ");
        //   } else {
        //     console.log(err.message);
        //   }
        // });

        console.log(obj.url);
        console.log(" ");

        // and we'll save the tweets for fun
        tweets.push(obj)
        fs.writeFileSync("tweets/tweets_" + date.format("YYYY-MM-DD") + ".json", JSON.stringify(tweets));

      });

    });

  }

});