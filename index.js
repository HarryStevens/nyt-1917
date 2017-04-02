// // dependencies
var request = require("request"), fs = require("fs"), Twit = require("twit");

// a new Twit instance
var T = new Twit({
  consumer_key: "OtNYj1vCYvzir6YTfUBcieRD9",
  consumer_secret: "T9OQf4N4BBiT5QlZZ4COVLxPQeuZmWc60J8fXwOBtLzEtR2bxC",
  access_token: "848440144541605888-pxQxguIkIntSEvLK4EuDmplQliLXPo8",
  access_token_secret: "pvSWeBsVfuwT6CjXAlp42gLRLAoYW1bydg3bWOQSsbYeM"
});

// date parser
var date;
new Date().toISOString().split("T")[0].split("-").forEach((d, i) => {
  date = i == 0 ? d - 100 + "-" : i == 1 ? date + d + "-" : date + d;
});

// log to get started...
console.log("Getting tweets from " + date);

// request articles from nytimes
request.get(
  {
    url: "https://api.nytimes.com/svc/archive/v1/1917/4.json",
    qs: {
      "api-key": "6ec2da195c80457a827aa558bbb82f95"
    }
  },
  function(err, response, body) {
    // this is the response body
    body = JSON.parse(body);
    var docs = body.response.docs;

    // write filtered tweets to json
    docs.forEach((d, i) => {
      // an empty object to store data
      var obj = {};

      obj.headline = d.headline.main;
      obj.url = "http://query.nytimes.com/mem/archive-free/pdf?res=" +
        d.web_url.split("res=")[1];
      obj.date = d.pub_date.split("T")[0];

      var tweet_end = obj.url + " #1917LIVE";

      // the tweet content is dependent upon the length of the headline
      // if the headline is too long, we'll cut it off and add three dots
      if (obj.headline.length > 103) {
        obj.tweet = obj.headline.substr(0, 103) + "... " + tweet_end;
      } else {
        obj.tweet = obj.headline + " " + tweet_end;
      }

      // some dependencies to filter out only tweets we want
      // they must be from the correct date and they must be about either russia or germany
      if (
        obj.date == date &&
        (
        	(
        		obj.headline.toLowerCase().includes("russia") ||
        		(d.lead_paragraph && d.lead_paragraph.toLowerCase().includes("russia")) ||
          	(d.snippet && d.snippet.toLowerCase().includes("russia"))
          ) ||
          
          (
          	obj.headline.toLowerCase().includes("lenin") ||
          	(d.lead_paragraph && d.lead_paragraph.toLowerCase().includes("lenin")) ||
          	(d.snippet && d.snippet.toLowerCase().includes("lenin"))
          ) ||
          
          (
          	obj.headline.toLowerCase().includes("petrograd") ||
          	(d.lead_paragraph && d.lead_paragraph.toLowerCase().includes("petrograd")) ||
          	(d.snippet && d.snippet.toLowerCase().includes("petrograd"))
          )
        )
      ) {
        // post to twitter
        T.post(
          "statuses/update",
          { status: obj.tweet },
          function(err, data, response) {
            console.log(data.text);
            console.log(" ");
          }
        );

        // and we'll save the tweets for fun
        fs.writeFileSync(
          "tweets/tweets_" + date + ".json",
          JSON.stringify(tweets)
        );
      } // end if filter
    }); // end forEach()
  }
); // end request