var str = "M'ADOO F.B.I ARRANGES TOUR OF THE WEST TO PUSH THE LOAN; Plans Strong Appeals to Patriotism to Loosen Nation's...";
var str_b = "THINKS WE CANNOT UNDERSTAND GERMANY; German Writer Ascribes President's Views to 'Primitive Intellectuality of Colonial..."

var a = toTitleCase(str_b);

console.log(a);

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