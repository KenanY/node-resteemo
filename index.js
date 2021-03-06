var find = require('lodash.find');
var isFunction = require('lodash.isfunction');
var isNull = require('lodash.isnull');
var isString = require('lodash.isstring');
var isUndefined = require('lodash.isundefined');
var request = require('request');

var ENDPOINT = 'http://api.captainteemo.com';
var PLATFORMS = [
  {'short': 'na', 'full': 'North_America'},
  {'short': 'br', 'full': 'Brasil'},
  {'short': 'ru', 'full': 'Russia'},
  {'short': 'euw', 'full': 'Europe_West'},
  {'short': 'eun', 'full': 'Europe_East'},
  {'short': 'tr', 'full': 'Turkey'},
  {'short': 'las', 'full': 'Latin_America_South'},
  {'short': 'lan', 'full': 'Latin_America_North'}
];

/**
 * Create an error whose message begins with 'node-resteemo - '.
 *
 * @private
 * @param {String} value The error message.
 * @return {Error}
 */
function brandError(value) {
  return new Error('node-resteemo - ' + value);
}

/**
 * Converts a full platform string to its shorthand equivalent.
 *
 * @private
 * @param {String} platform The platform to shorten.
 * @return {String} The shorthand equivalent of `platform` if one exists, else
 *   `null`.
 */
function normalizePlatform(platform) {
  var matchFromShortPlatform = find(PLATFORMS, {'short': platform});
  if (!isUndefined(matchFromShortPlatform)) {
    return platform;
  }

  var matchFromFullPlatform = find(PLATFORMS, {'full': platform});
  if (!isUndefined(matchFromFullPlatform)) {
    return matchFromFullPlatform['short'];
  }

  return null;
}

/**
 * Parse JSON data from a request.
 *
 * @private
 * @param {Object} req The request instance to handle.
 * @param {Function} callback The callback, which is given two arguments:
 *   `(err, response)`, where `response` is a JSON Object from `req`.
 */
function responseHandler(req, callback) {
  req.on('response', function(res) {
    var response = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      response += chunk;
    });
    res.on('end', function() {
      try {
        response = JSON.parse(response);
      }
      catch(e) {
        var error = brandError('invalid json response');
        return callback(error);
      }

      if (!response.success) {
        var error = brandError('api failed');
        return callback(error);
      }

      if (!isUndefined(response.data._success)) {
        if (!response.data._success) {
          var error = brandError('api failed at second success check');
          return callback(error);
        }
      }

      callback(null, response);
    });
  });
}

/**
 * Establishes the user agent of all API calls.
 *
 * @param {String} refererString The referer string to use in API calls.
 * @return {Object}
 */
module.exports = function(refererString) {
  if (!isString(refererString)) {
    var error = brandError('`refererString` not defined');
    throw error;
  }

  /**
   * Contructs the headers and options for the API request.
   *
   * @private
   * @param {String} method The HTTP verb.
   * @param {String} path The path to query from the API endpoint.
   * @param {Function} callback The callback, which is passed to
   *   `responseHandler`.
   */
  function prepareRequest(method, path, callback) {
    if (!isFunction(callback)) {
      var error = brandError('missing callback');
      throw error;
    }

    var headers = {
      'Accept'    : 'application/json',
      'User-Agent': refererString
    };

    var requestOptions = {
      method : method,
      uri    : ENDPOINT + path,
      headers: headers
    };

    var req = request(requestOptions);
    responseHandler(req, callback);
    req.end();
  }

  /**
   * Begins the preparation for a GET request.
   *
   * @private
   * @param {String} path The path to query from the API endpoint.
   * @param {Function} callback The callback, which is passed to
   *   `prepareRequest`.
   */
  function get(path, callback) {
    prepareRequest('GET', path, callback);
  }

  /**
   * Contructs the path to query.
   *
   * @private
   * @param {Object} options
   * @param {Function} callback
   */
  function constructPath(options, callback) {
    var shortPlatform = normalizePlatform(options.platform);
    if (isNull(shortPlatform)) {
      var error = brandError('invalid platform');
      return callback(error);
    }

    if (isUndefined(options.path)) {
      options.path = '';
    } else {
      options.path = '/' + options.path;
    }

    if (options.summoner) {
      get('/player/' + shortPlatform + '/' + options.summoner + options.path + (options.season || ''), callback);
    }
    else if (options.tag || options.guid) {
      get('/team/' + shortPlatform + options.path + '/' + (options.tag || options.guid) + (options.guid ? '/leagues' : ''), callback);
    }
    else {
      get('/service-state/' + shortPlatform + options.path, callback);
    }
  }

  var teemo = {};

  /**
   * Returns primarily ID-based data for String `summoner` on String `platform`.
   * Account and summoner IDs are not unique across multiple platforms.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, profile)` where
   *   `profile` is the API response as an Object.
   */
  teemo.player = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner
    }, callback);
  };

  /**
   * Returns observer metadata and information if String `summoner` on String
   * `platform` is playing a valid game.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, profile)` where
   *   `game` is the API response as an Object.
   */
  teemo.player.ingame = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'ingame'
    }, callback);
  };

  /**
   * Returns last 10 matches (order is random) for String `summoner` on String
   * `platform`.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, games)` where `games`
   *   is the API response as an Object.
   */
  teemo.player.recentGames = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'recent_games'
    }, callback);
  };

  /**
   * Returns lifetime influence point gains for String `summoner` on String
   * `platform`.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, points)` where `points`
   *   is the API response as an Object.
   */
  teemo.player.influencePoints = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'influence_points'
    }, callback);
  };

  /**
   * Returns runepages for String `summoner` on String `platform`.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, runes)` where `runes`
   *   is the API response as an Object.
   */
  teemo.player.runes = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'runes'
    }, callback);
  };

  /**
   * Returns mastery pages for String `summoner` on String `platform`.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, pages)` where `pages`
   *   is the API response as an Object.
   */
  teemo.player.mastery = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'mastery'
    }, callback);
  };

  /**
   * Returns Season 3 Leagues info.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, leagues)` where
   *   `leagues` is the API response as an Object.
   */
  teemo.player.leagues = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'leagues'
    }, callback);
  };

  /**
   * Returns honor.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, honor)` where `honor`
   *   is the API response as an Object.
   */
  teemo.player.honor = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'honor'
    }, callback);
  };

  /**
   * Returns ranked stats for String `summoner` in Number `season`.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Number} season
   * @param {Function} callback Used as `callback(error, stats)` where `stats`
   *   is the API response as an Object.
   */
  teemo.player.rankedStats = function(platform, summoner, season, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'ranked_stats/season/',
      season: season
    }, callback);
  };

  /**
   * Returns all teams (and team match history) that `summoner` is a member of.
   *
   * @public
   * @param {String} platform
   * @param {String} summoner
   * @param {Function} callback Used as `callback(error, stats)` where `teams`
   *   is the API response as an Object.
   */
  teemo.player.teams = function(platform, summoner, callback) {
    constructPath({
      platform: platform,
      summoner: summoner,
      path: 'teams'
    }, callback);
  };

  /**
   * Returns team information and matches.
   *
   * @public
   * @param {String} platform
   * @param {String} tag
   * @param {Function} callback Used as `callback(error, response)` where
   *   `response` is the API response as an Object.
   */
  teemo.team = function(platform, tag, callback) {
    constructPath({
      platform: platform,
      tag: tag,
      path: 'tag'
    }, callback);
  };

  /**
   * Returns leagues for a given team GUID.
   *
   * @public
   * @param {String} platform
   * @param {String} guid
   * @param {Function} callback Used as `callback(error, response)` where
   *   `response` is the API response as an Object.
   */
  teemo.team.leagues = function(platform, guid, callback) {
    constructPath({
      platform: platform,
      guid: guid,
      path: 'guid'
    }, callback);
  };

  /**
   * Returns free week.
   *
   * @public
   * @param {String} platform
   * @param {Function} callback Used as `callback(error, response)` where
   *   `response` is the API response as an Object.
   */
  teemo.freeWeek = function(platform, callback) {
    constructPath({
      platform: platform,
      path: 'free-week'
    }, callback);
  };

  return teemo;
};