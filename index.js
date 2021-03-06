// dependencies
var request = require("request"), 
	fs = require("fs"),
  _ = require("underscore"),
	Twit = require("twit"),
  moment = require("moment"),
  cheerio = require("cheerio"),
  http = require("http"),
  PDFImage = require("pdf-image").PDFImage,
  jz = require("jeezy"),
  download = require("download");

var current_hour = moment().format("H");

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

// and make it anew
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
    name: "NICHOLAS II.,",
    handle: "NicholasII_1917"
  },
  {
    name: "ALEXANDRA FEODOROVNA, CZARINA OF RUSSIA",
    handle: "EmpressAlix1917"
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
  },
  {
    name: "MCADOO, WILLIAM GIBBS",
    handle: "WillMcAdoo_1917"
  },
  {
    name: "MILUKOFF, PAUL N.",
    handle: "Milyukov_1917"
  },
  {
    name: "LUXEMBURG, ROSA",
    handle: "luxemburgquotes"
  },
  {
    name: "KORNILOFF",
    handle: "GenKornilov1917"
  },
  {
    name: "GUCHKOFF, ALEXANDER J.",
    handle: "Guchkov_1917"
  },
  {
    name: "BRUSILOFF, ALEXIS",
    handle: "GenBrusilov1917"
  },
  {
    name: "BRUSILOFF, ALEXEI A.",
    handle: "GenBrusilov1917"
  },
  {
    name: "LVOFF, GEORGE E.",
    handle: "PrinceLvov_1917"
  },
  {
    name: "MOLOTOFF, VIACHESLAV MICHAELOVICH",
    handle: "Molotov_1917"
  },
  {
    name: "RODZIANKO, MICHAEL",
    handle: "MRodzianko_1917"
  },
  {
    name: "ALEXEIEFF, MICHAEL V.",
    handle: "GenAlexeev_1917 "
  },
  {
    name: "FREUD, SIGMUND",
    handle: "SigmundFreud_BP"
  },
  {
    name: "CLEMENCEAU, GEORGES",
    handle: "Clemenceau_BP"
  },
  {
    name: "BERTIE, FRANCIS LEVESON",
    handle: "WW1Bertie"
  },
  {
    name: "KROPOTKIN , PETER",
    handle: "PKropotkin_1917‏"
  },
  {
    name: "KROPOTKIN, PETER",
    handle: "PKropotkin_1917‏"
  },
  {
    name: "KROPOTKIN, PETER ALEXEIEVITCH",
    handle: "PKropotkin_1917‏"
  },
  {
    name: "KROPOTKIN , PETER ALEXEIVICH",
    handle: "PKropotkin_1917‏"
  },
  {
    name: "POINCARE, RAYMOND",
    handle: "RPoincare_1917"
  },
  {
    name: "BUBLIKOFF, ALEXANDER ALEXANDROVITCH",
    handle: "Bublikov_1917"
  },
  {
    name: "TSERETELLI",
    handle: "Mensheviks_1917"
  }
];

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
  for (var i = 0; i < pages; i++){
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
        obj.tweet_number = (page * 10) + obj.page_index;
        
        // calculate the hour of the day that the tweet should go out, based on the total number of tweets
        obj.hour_of_tweet = Math.round((obj.tweet_number * 24) / hits);

        obj.url = "http://query.nytimes.com/mem/archive-free/pdf?res=" + d.web_url.split("res=")[1];
        obj.date = d.pub_date.split("T")[0];

        // this is the pdf file name
        obj.pdf_file_name = "temp/" + obj.date + "_" + obj.page + "_" + obj.page_index + ".pdf";

        // create the tweet, including cleaning headline to make more readable
        obj.headline = d.headline.main
        var tweet_start = obj.headline;

        var tweet_end = "#" + date.format("YYYY") + "LIVE";

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

        var end_len = tweet_end.length + 1; // the 1 is for the space between the tweet and the end

        // the tweet content is dependent upon the length of the headline
        // if the headline is too long, we'll cut it off, if necessary adding 3 dots
        if (tweet_start.length > (280 - end_len - 3)) {

          tweet_start = tweet_start.substr(0, (280 - end_len - 3));
          // put the elipses after the space
          var li = tweet_start.lastIndexOf(" ");
          tweet_start = tweet_start.substr(0, li) + "...";

        } 

        // console.log(tweet_start);
        obj.tweet = toTitleCase(tweet_start) + " " + tweet_end;

        // lose the obituaries of all those people
        if (obj.tweet.indexOf("Obituary ") == -1){

          // first time
          // console.log(persons);
          // console.log(obj.tweet);
          // console.log(" ");
          // and we'll save the tweets for fun
          // tweets.push(obj)
          // fs.writeFileSync("tweets/tweets_" + date.format("YYYY-MM-DD") + ".json", JSON.stringify(tweets));
          
          // once we set the cron job, we'll use this conditional
          // second time
          if (obj.hour_of_tweet == current_hour){
            
            // download_convert_post(obj.url, obj.pdf_file_name);

            // until the above gets fixed
            T.post("statuses/update", {status: obj.tweet}, function (err, data, response) {
              if (!err){
                console.log(data.text);
                console.log(" ");
              } else {
                console.log(err.message);
              }
            });
            
          }

          // this is temporary to test
          if (i == 0) {

            // download_convert_post(obj.url, obj.pdf_file_name); 
          }
          
          
          // downloads a pdf (and also converts it to an image and posts the tweet)
          function download_convert_post(input, output){

            // console.log(input);
            // console.log(output);

            // download(input).then(data => {
            //   fs.writeFileSync(output, data);
            // });

            // request(input, (err, res, body) => {
                
            //   if (err || res.statusCode !== 200) console.log("Request didn't work.");

            //   var $ = cheerio.load(body);
            //   console.log($("body").html());

            // })

            http.get(input, res => {
              var chunks = [];

              res.on("data", chunk => {

                  console.log("Downloading .pdf from " + input);

                  chunks.push(chunk);

              });

              res.on("end", () => {
                console.log(chunks);
              });
            })



            // // a stream to write the pdf file for downloading
            // var file = fs.createWriteStream(output); 

            // // get the html of the nyt page
            // request(input, function(error, response, body){

            //   if (!error && response.statusCode == 200){
            //     // load cheerio
            //     var $ = cheerio.load(body);

            //     // find the pdf url in the response
            //     var pdf = $("iframe").attr("src");

            //     // time to download the pdf
            //     var request = http.get(pdf, function(response) {
                  
            //       // pipe the response to the file
            //       var stream = response.pipe(file);
                  
            //       // when it's done, we'll convert to an image and post the tweet
            //       stream.on("finish", function(){

            //         // convert to image, with white background
            //         var pdfImage = new PDFImage(output, {
            //             convertOptions: {
            //               '-background': 'white',
            //               '-flatten': ''
            //             }
            //         });

            //         pdfImage.convertPage(0).then(function (imagePath) {
                      
            //           //
            //           // post a tweet with media
            //           //
            //           var b64content = fs.readFileSync(imagePath, { encoding: "base64" })

            //           // first we must post the media to Twitter
            //           T.post("media/upload", { media_data: b64content }, function (err, data, response) {
                        
            //             // now we can assign alt text to the media, for use by screen readers and
            //             // other text-based presentations and interpreters
            //             var mediaIdStr = data.media_id_string;
            //             var altText = obj.headline;
            //             var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }

            //             T.post("media/metadata/create", meta_params, function (err, data, response) {
            //               if (!err) {
            //                 // now we can reference the media and post a tweet (media will attach to the tweet)
            //                 var params = { status: obj.tweet, media_ids: [mediaIdStr] }

            //                 // post the tweet
            //                 T.post("statuses/update", params, function (err, data, response) {
            //                   if (!err){
            //                     console.log(data.text);
            //                     console.log(" ");
            //                   } else {
            //                     console.log(err.message);
            //                   }
            //                 });

            //               }
                          
            //             });

            //           });
                      
            //         });

            //       });

            //     });

            //   }

            // }); 

          }

        }

      });

    });

  }

});

function toTitleCase(x){

  var punctuation = "~`!@#$%^&*()_+-={}|[];:,./<>?";
  var quote_marks = "\"'";
  var lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
  var uppercase = lowercase.map(function(d){ return d.toUpperCase(); });
  
  // articles, conjunctions, prepositions -- fewer than 5 letters
  var smalls = [];
  var articles = ["a", "an", "the"].forEach(function(d){ smalls.push(d); })
  var conjunctions = ["and", "but", "or", "nor", "so"].forEach(function(d){ smalls.push(d); })
  var prepositions = ["as", "at", "by", "into", "it", "in", "for", "from", "of", "onto", "on", "out", "per", "to", "up", "upon", "with"].forEach(function(d){ smalls.push(d); });
  
  var words = x.split(" "),
    word_count = words.length;

  var meta_data = words.map(function(word, word_index){

    var obj = {};
    obj.word = word;
    obj.word_index = word_index + 1;

    // first, determine if the word ends with punctuation
    var chars = word.split(""),
      char_count = chars.length;

    obj.char_count = char_count;

    // get meta data for each character
    meta_chars = chars.map(function(char, char_index){
      var obj = {};

      obj.index = char_index + 1;
      obj.character = char;
      obj.type = punctuation.indexOf(char) != -1 ? "punctuation" : lowercase.indexOf(char) != -1 ? "lowercase" : uppercase.indexOf(char) != -1 ? "uppercase" : "other";
      obj.quote = quote_marks.indexOf(char) != -1 ? true : false;

      return obj;
    });

    obj.meta_chars = meta_chars;

    var last_letter_index = meta_chars.filter(function(object){
      return (object.type == "lowercase" || object.type == "uppercase")
    }).map(function(d){ return d.index; });
    last_letter_index = last_letter_index[last_letter_index.length - 1];

    var first_punctuation_index = meta_chars.filter(function(object){
      return (object.type == "punctuation" || object.type == "other")
    }).map(function(d){ return d.index; })
    first_punctuation_index = first_punctuation_index[0];

    var contains_punctuation = chars.map(function(d){ return punctuation.indexOf(d) == -1 ? false : true; })
    
    obj.has_punctuation = contains_punctuation.indexOf(true) != -1 ? true : false;

    obj.is_acronym = false;
    // now see if it's an acronym, and be sure to ignore possessive words
    if (obj.has_punctuation && last_letter_index > first_punctuation_index && obj.word[first_punctuation_index - 1] != "'") {
      obj.is_acronym = true;
    }

    // see if it ends a sentence
    obj.is_end_of_sentence = false;
    if (!obj.is_acronym && char_count > last_letter_index){
      obj.is_end_of_sentence = true;
    }

    // see if it is a preposition or contractions
    obj.is_small = false;

    var no_punct = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    var no_punct_final = no_punct.replace(/\s{2,}/g," ").toLowerCase();
    if (smalls.indexOf(no_punct_final) != -1){
      obj.is_small = true;
    }

    // see if it is a quote
    obj.is_quote_start = false;
    if (obj.meta_chars[0].quote){
      obj.is_quote_start = true;
    }

    //TODO Add other potential acronyms

    // TODO Deal with hyphens

    return obj;

  });

  // more meta data processing
  meta_data.forEach(function(d, i){

    d.is_start_of_sentence = false;

    if (meta_data[i-1] != undefined && meta_data[i - 1].is_end_of_sentence || i == 0){
      d.is_start_of_sentence = true;
    }

  });

  // now lets capitalize and whatnot
  meta_data.forEach(function(d, i){

    d.final_word = d.word;

    if (d.is_acronym){
      var split = d.final_word.replace(/[^\w\s]|_/g, function ($1) { return ' ' + $1 + ' ';}).replace(/[ ]+/g, ' ').split(' ');
      d.final_word = split.map(function(e){ return toStartCase(e); }).join("");
    } else {

      if (d.is_start_of_sentence){
        d.final_word = toStartCase(d.final_word);
      } else {
        
        // run the prepositions
        if (d.is_small){
          d.final_word = d.final_word.toLowerCase();
        } else {
          d.final_word = toStartCase(d.final_word);
        }

      }

    }

    if (d.is_quote_start && d.final_word[1] != undefined){
      d.final_word = replaceAt(d.final_word, 1, d.final_word[1].toUpperCase())
    }

    return d;

  });

  var final_words = meta_data.map(function(d){ return d.final_word; });

  function toStartCase(x){
    var first = x.charAt(0);
    var rest = x.substr(1, x.length -1);
    return first.toUpperCase() + rest.toLowerCase();
  }

  function replaceAt(string, index, replacement){
    return string.substr(0, index) + replacement + string.substr(index + replacement.length);
  }

  return final_words.join(" ");

}