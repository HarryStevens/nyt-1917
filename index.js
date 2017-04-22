// dependencies
var request = require("request"), 
	fs = require("fs"),
  _ = require("underscore"),
	Twit = require("twit"),
  moment = require("moment"),
  cheerio = require("cheerio"),
  http = require("http"),
  PDFImage = require("pdf-image").PDFImage;

// remove everything in the temp folder
rmDir = function(dirPath) {
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  fs.rmdirSync(dirPath);
};
rmDir("temp");
fs.mkdirSync("temp");

// an array for matching famous people
var people = [
  {
    name: "WILSON, WOODROW",
    handle: "POTUS28_1917"
  },
  {
    name: "NICHOLAS II., CZAR OF RUSSIA",
    handle: "NicholasII_1917"
  },
  {
    name: "KERENSKY, ALEXANDER F.",
    handle: "Kerensky_1917"
  },
  {
    name: "WILLIAM II., EMPEROR OF GERMANY",
    handle: "Kaiser_1917"
  },
  {
    name: "TROTZKY, LEON",
    handle: "LeoTrotsky_1917"
  },
  {
    name: "ALFONSO XIII., KING OF SPAIN",
    handle: "AlfonsoXIII1917"
  },
  {
    name: "LENIN, NIKOLAI",
    handle: "VLenin_1917"
  },
  {
    name: "GEORGE V., KING OF ENGLAND",
    handle: "GeorgeV_1917"
  }
];

// the length of a tweet url
var url_len = 23;

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

// nyt query
var key = "6ec2da195c80457a827aa558bbb82f95",
  query = "russia OR lenin OR trotsky OR germany OR czar OR socialism";

// each page only returns 10 requests, so we'll find out how many there are first
request.get({
  url: "https://api.nytimes.com/svc/search/v2/articlesearch.json",
  qs: {
    "api-key": key,
    "fq": query,
    "begin_date": date.format("YYYYMMDD"),
    "end_date": date.format("YYYYMMDD"),
  },
}, function(err, response, body) {
  var hits = JSON.parse(body).response.meta.hits;
  var pages = Math.ceil(hits / 10);
  console.log("Found " + hits + " articles on " + pages + " pages of results.");
  console.log(" ");

  // a rate-limited version of the request
  var makeRequest_limited = _.rateLimit(makeRequest, 10000);
  for (var i = 5; i < pages; i++){
    makeRequest_limited(i);
  }

  // so now we'll actually get the articles based on the number of pages
  function makeRequest(page){
    request.get({
      url: "https://api.nytimes.com/svc/search/v2/articlesearch.json",
      qs: {
        "api-key": key,
        "fq": query,
        "begin_date": date.format("YYYYMMDD"),
        "end_date": date.format("YYYYMMDD"),
        "page": page
      },
    }, function(err, response, body) {
      
      body = JSON.parse(body);
      var docs = body.response.docs;

      //write filtered tweets to json
      docs.forEach((d, i) => {
        
        // an empty object to store data
        var obj = {};

        obj.page = page + 1;
        obj.page_index = i + 1;
        obj.url = "http://query.nytimes.com/mem/archive-free/pdf?res=" + d.web_url.split("res=")[1];
        obj.date = d.pub_date.split("T")[0];

        // this is the pdf file name
        obj.pdf_file_name = "temp/" + obj.date + "_" + obj.page + "_" + obj.page_index + ".pdf";

        // create the tweet, including cleaning headline to make more readable
        obj.headline = d.headline.main
        var tweet_start = obj.headline;

        var tweet_end = "#1917LIVE";

        // figure out if any of the 1917crowd are mentioned
        var persons = d.keywords.filter(function(key){
          return key.name == "persons"
        }).map(function(person){
          return person.value
        });
        obj.people_mentioned = persons;

        var lookup = people.map(function(p){
          return p.name
        })
        var mentions = _.intersection(persons, lookup).map(function(p){
          return "@" + _.where(people, {name: p})[0].handle;
        }); 
        // if they are add them to the end of the tweet
        if (mentions.length > 0){
          tweet_end = tweet_end + " " + mentions.join(" ");
        }

        var end_len = url_len + tweet_end.length + 2; // the two is for the spaces in front and back of the url

        // the tweet content is dependent upon the length of the headline
        // if the headline is too long, we'll cut it off, if necessary adding 3 dots
        if (tweet_start.length > (140 - end_len)) {

          // first we'll split on the semicolon and check again
          // tweet_start = tweet_start.split(";")[0];

          // if it's still longer, we'll do some elipses
          if (tweet_start.length > (140 - end_len - 3)){
            tweet_start = tweet_start.substr(0, (140 - end_len - 3));
            // put the elipses after the space
            var li = tweet_start.lastIndexOf(" ");
            tweet_start = tweet_start.substr(0, li) + "...";
          }
        } 


        obj.tweet = tweet_start.toTitleCase() + " " + obj.url + " " + tweet_end;

        // lose the obituaries of all those people
        if (obj.tweet.indexOf("Obituary ") == -1){

          // first time
          // console.log(persons);
          // console.log(obj.tweet);
          // console.log(" ");

          // second time
          download_convert_post(obj.url, obj.pdf_file_name);

          // downloads a pdf (and also converts it to an image and posts the tweet)
          function download_convert_post(input, output){

            // a stream to write the pdf file for downloading
            var file = fs.createWriteStream(output); 

            // get the html of the nyt page
            request(input, function(error, response, body){

              if (!error && response.statusCode == 200){
                // load cheerio
                var $ = cheerio.load(body);

                // find the pdf url in the response
                var pdf = $("iframe").attr("src");

                // time to download the pdf
                var request = http.get(pdf, function(response) {
                  
                  // pipe the response to the file
                  var stream = response.pipe(file);
                  
                  // when it's done, we'll convert to an image and post the tweet
                  stream.on("finish", function(){

                    // convert to image, with white background
                    var pdfImage = new PDFImage(output, {
                        convertOptions: {
                            '-background': 'white',
                            '-flatten': ''
                        }
                    });

                    pdfImage.convertPage(0).then(function (imagePath) {
                      
                      //
                      // post a tweet with media
                      //
                      var b64content = fs.readFileSync(imagePath, { encoding: "base64" })

                      // first we must post the media to Twitter
                      T.post("media/upload", { media_data: b64content }, function (err, data, response) {
                        
                        // now we can assign alt text to the media, for use by screen readers and
                        // other text-based presentations and interpreters
                        var mediaIdStr = data.media_id_string;
                        var altText = obj.headline;
                        var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }

                        T.post("media/metadata/create", meta_params, function (err, data, response) {
                          if (!err) {
                            // now we can reference the media and post a tweet (media will attach to the tweet)
                            var params = { status: obj.tweet, media_ids: [mediaIdStr] }

                            // post the tweet
                            T.post("statuses/update", params, function (err, data, response) {
                              if (!err){
                                console.log(data.text);
                                console.log(" ");
                              } else {
                                console.log(err.message);
                              }
                            });

                            // and we'll save the tweets for fun
                            tweets.push(obj)
                            fs.writeFileSync("tweets/tweets_" + date.format("YYYY-MM-DD") + ".json", JSON.stringify(tweets));

                          }
                        })
                      })

                      // second time
                      // post();
                      
                    });


                    

                  });

                });

              }

            }); 

          }

        }

        // function post(){
        //   // post to twitter
        //   T.post("statuses/update", { status: obj.tweet }, (err, data, response) => {
        //     if (!err){
        //       console.log(data.text);
        //       console.log(" ");
        //     } else {
        //       console.log(err.message);
        //     }
        //   });

          
        // } // end post()

        

      });

    });

  }

});

String.prototype.toTitleCase = function() {
  var i, j, str, lowers, uppers;
  str = this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });

  // Certain minor words should be left lowercase unless 
  // they are the first or last words in the string
  lowers = ['A', 'An', 'The', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At', 
  'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'Onto', 'To', 'With'];
  for (i = 0, j = lowers.length; i < j; i++)
    str = str.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'), 
      function(txt) {
        return txt.toLowerCase();
      });

  // Certain words such as initialisms or acronyms should be left uppercase
  uppers = ['Id', 'Tv'];
  for (i = 0, j = uppers.length; i < j; i++)
    str = str.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'), 
      uppers[i].toUpperCase());

  // others
  [{a:"U.s.",b:"U.S."},{a:"Y.m.c.a",b:"Y.M.C.A"},{a:"E.h.",b:"E.H."},{a:"C.p.",b:"C.P."},{a:"W.s.",b:"W.S."}]
    .forEach(function(d,i){
      str = replaceAll(str, d.a, d.b);    
    });
  
  function replaceAll(string, search, replacement) {
    var target = string;
    return target.replace(new RegExp(search, 'g'), replacement);
  };

  return str;
}