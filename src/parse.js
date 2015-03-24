/**
 * Parse a text template to DOM structure ready for compiling
 * @see compile
 *
 * @param {string} template
 *
 * @returns {Element}
 */
function parse(template) {

  var iframe, body;

  function preprocess(template) {

    // replace {{{tag}}} with {{&tag}}
    template = template.replace(/\{\{\{([\S\s]*?)\}\}\}/g, '{{&$1}}');

    // 1. wrap each non-attribute tag in <script type="text/lite-tag">
    // 2. remove Mustache comments
    // TODO: handle tags in HTML comments
    template = template.replace(
      /\{\{([\S\s]*?)\}\}/g,
      function(match, match1, pos) {
        var head = template.slice(0, pos);
        var insideTag = !!head.match(/<[\w\-]+[^>]*?$/);
        var opening = head.match(/<(script|SCRIPT)/g);
        var closing = head.match(/<\/(script|SCRIPT)/g);
        var insideScript =
            (opening && opening.length || 0) > (closing && closing.length || 0);
        var insideComment = !!head.match(/<!--\s*$/);
        var isMustacheComment = match1.indexOf('!') === 0;

        return insideTag || insideComment ?
          isMustacheComment ?
            '' :
            match :
          insideScript ?
            match :
            '<script type="text/lite-tag">' + match1.trim() + '\x3C/script>';
      }
    );
    // prefix 'selected' and 'checked' attributes with 'lite-'
    // (to avoid "special" processing, oh IE8)
    template = template.replace(
      /(<(?:option|OPTION)[^>]*?)(?:selected|SELECTED)=/g,
      '$1lite-selected=');

    template = template.replace(
      /(<(?:input|INPUT)[^>]*?)(?:checked|CHECKED)=/g,
      '$1lite-checked=');

    return template;
  }

  template = preprocess(template);
  body = document.createElement('body');
  body.innerHTML = template;

  return body;
}



module.exports = parse;
