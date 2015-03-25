/*
 * Main function
 */
/* jshint evil: true */
function lite() {
  var RE_NODE_ID = /^#[\w\.\-]+$/;
  var args = [].slice.call(arguments);

  function hashcode(s) {
    var hash = 0, i, chr, len;
    if (s.length === 0) return hash;
    for (i = 0, len = s.length; i < len; i++) {
      chr = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  // lite(object)?
  if (args.length === 1 && typeof args[0] === 'object') {
    // return Freak instance
    return require('freak')(args[0]);
  }

  // lite('#target')?
  else if (args.length === 1 && typeof args[0] === 'string' && args[0].match(RE_NODE_ID)) {
    return document.querySelector(args[0]).__lite__;
  }

  // lite(DOMElement)?
  else if (args.length === 1 && args[0].nodeType) {
    return args[0].__lite__;
  }

  // lite(template)?
  else if (args.length === 1 && typeof args[0] === 'string') {
    var template = lite.parse(args[0]);
    return lite.compile(template, 'lite-' + hashcode(template));
  }

  // lite(target, template, model)?
  else if (
    (args[0] && args[0].nodeType) &&
    (typeof args[1] === 'string') &&
    (typeof args[2] === 'function')
  ) {
    // Empty target
    args[0].innerHTML = '';

    // Assign compiled template
    args[0].appendChild(
      eval(
        lite(
          args[1].match(RE_NODE_ID) ?
            document.querySelector(args[1]).innerHTML :
            args[1]
        ) + '(args[2])'
      )
    );

    // Store model reference
    args[0].__lite__ = args[2];
  }

  else {
    console.error('lite called with invalid parameters:', args);
    console.log(new Error().stack);
    console.log('Usage:\n',
      'var target = document.getElementById("target");\n',
      'var template = document.getElementById("template").innerHTML;\n',
      'var model = lite(object);\n',
      'lite(target, template, model);'
    );
  }
}

/*
 * Export stuff
 *
 */

lite.parse = require('./parse');
lite.compile = require('./compile');
lite.utemplate = require('./utemplate');
lite._get = function(model, prop) {
  var val = model(prop);
  return (typeof val === 'function') ?
    JSON.stringify(val.values) :
    val;
};


/*
 * Export
 */
module.exports = lite;
if (typeof window !== 'undefined') window.lite = lite;
