(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.lite = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function freak(obj, root, parent, prop) {

  var listeners = {
    'change': {},
    'update': {},
    'insert': {},
    'delete': {}
  };
  var _dependentProps = {};
  var _dependentContexts = {};
  var cache = {};
  var children = {};

  // Assert condition
  function assert(cond, msg) {
    if (!cond) {
      throw msg || 'assertion failed';
    }
  }

  // Mix properties into target
  function mixin(target, properties) {
    for (var i = 0, props = Object.getOwnPropertyNames(properties), len = props.length;
        i < len; i++) {
      target[props[i]] = properties[props[i]];
    }
  }

  function deepEqual(x, y) {
    if (typeof x === "object" && x !== null &&
        typeof y === "object" && y !== null) {

      if (Object.keys(x).length !== Object.keys(y).length) {
        return false;
      }

      for (var prop in x) {
        if (x.hasOwnProperty(prop)) {
          if (y.hasOwnProperty(prop)) {
            if (!deepEqual(x[prop], y[prop])) {
              return false;
            }
          }
          else {
            return false;
          }
        }
      }

      return true;
    }
    else if (x !== y) {
      return false;
    }

    return true;
  }

  // Event functions
  function on() {
    var event = arguments[0];
    var prop = ['string', 'number'].indexOf(typeof arguments[1]) > -1 ?
      arguments[1] : null;
    var callback =
      typeof arguments[1] === 'function' ?
        arguments[1] :
        typeof arguments[2] === 'function' ?
          arguments[2] : null;

    // Args check
    assert(['change', 'update', 'insert', 'delete'].indexOf(event) > -1);
    assert(
      (['change'].indexOf(event) > -1 && prop !== null) ||
      (['insert', 'delete', 'update'].indexOf(event) > -1 && prop === null)
    );

    // Init listeners for prop
    if (!listeners[event][prop]) {
      listeners[event][prop] = [];
    }
    // Already registered?
    if (listeners[event][prop].indexOf(callback) === -1) {
      listeners[event][prop].push(callback);
    }
  }

  // Remove all or specified listeners given event and property
  function off() {
    var event = arguments[0];
    var prop = typeof arguments[1] === 'string' ? arguments[1] : null;
    var callback =
      typeof arguments[1] === 'function' ?
        arguments[1] :
        typeof arguments[2] === 'function' ?
          arguments[2] : null;
    var i;

    if (!listeners[event][prop]) return;

    // Remove all property watchers?
    if (!callback) {
      listeners[event][prop] = [];
    }
    else {
      // Remove specific callback
      i = listeners[event][prop].indexOf(callback);
      if (i > -1) {
        listeners[event][prop].splice(i, 1);
      }
    }

  }

  // trigger('change', prop)
  // trigger('update', prop)
  // trigger('insert' or 'delete', index, count)
  function trigger(event, a, b) {
    var handlers = (listeners[event][['change'].indexOf(event) > -1 ? a : null] || []);
    var i, len = handlers.length;
    for (i = 0; i < len; i++) {
      handlers[i].call(instance, a, b);
    };
  }

  // Export model to JSON string
  // NOT exported:
  // - properties starting with _ (Python private properties convention)
  // - computed properties (derived from normal properties)
  function toJSON() {
    function filter(obj) {
      var key, filtered = Array.isArray(obj) ? [] : {};
      for (key in obj) {
        if (typeof obj[key] === 'object') {
          filtered[key] = filter(obj[key]);
        }
        else if (typeof obj[key] !== 'function' && key[0] !== '_') {
          filtered[key] = obj[key];
        }
      }
      return filtered;
    }
    return JSON.stringify(filter(obj));
  }

  // Load model from JSON string or object
  function fromJSON(data) {
    var key;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    for (key in data) {
      instance(key, data[key]);
      trigger('update', key);
    }
    instance.len = obj.length;
  }

  // Update handler: recalculate dependent properties,
  // trigger change if necessary
  function update(prop) {
    if (!deepEqual(cache[prop], get(prop, function() {}, true))) {
      trigger('change', prop);
    }

    // Notify dependents
    for (var i = 0, dep = _dependentProps[prop] || [], len = dep.length;
        i < len; i++) {
      delete children[dep[i]];
      _dependentContexts[prop][i].trigger('update', dep[i]);
    }

    if (instance.parent) {
      // Notify computed properties, depending on parent object
      instance.parent.trigger('update', instance.prop);
    }
  }

  // Proxy the accessor function to record
  // all accessed properties
  function getDependencyTracker(prop) {
    function tracker(context) {
      return function(_prop, _arg) {
        if (!context._dependentProps[_prop]) {
          context._dependentProps[_prop] = [];
          context._dependentContexts[_prop] = [];
        }
        if (context._dependentProps[_prop].indexOf(prop) === -1) {
          context._dependentProps[_prop].push(prop);
          context._dependentContexts[_prop].push(instance);
        }
        return context(_prop, _arg, true);
      }
    }
    var result = tracker(instance);
    construct(result);
    if (parent) {
      result.parent = tracker(parent);
    }
    result.root = tracker(root || instance);
    return result;
  }

  // Shallow clone an object
  function shallowClone(obj) {
    var key, clone;
    if (obj && typeof obj === 'object') {
      clone = {};
      for (key in obj) {
        clone[key] = obj[key];
      }
    }
    else {
      clone = obj;
    }
    return clone;
  }

  // Getter for prop, if callback is given
  // can return async value
  function get(prop, callback, skipCaching) {
    var val = obj[prop];
    if (typeof val === 'function') {
      val = val.call(getDependencyTracker(prop), callback);
      if (!skipCaching) {
        cache[prop] = (val === undefined) ? val : shallowClone(val);
      }
    }
    else if (!skipCaching) {
      cache[prop] = val;
    }
    return val;
  }

  function getter(prop, callback, skipCaching) {
    var result = get(prop, callback, skipCaching);

    return result && typeof result === 'object' ?
      // Wrap object
      children[prop] ?
        children[prop] :
        children[prop] = freak(result, root || instance, instance, prop) :
      // Simple value
      result;
  }

  // Set prop to val
  function setter(prop, val) {
    var oldVal = get(prop);

    if (typeof obj[prop] === 'function') {
      // Computed property setter
      obj[prop].call(getDependencyTracker(prop), val);
    }
    else {
      // Simple property
      obj[prop] = val;
      if (val && typeof val === 'object') {
        delete cache[prop];
        delete children[prop];
      }
    }

    if (oldVal !== val) {
      trigger('update', prop);
    }
  }

  // Functional accessor, unify getter and setter
  function accessor(prop, arg, skipCaching) {
    return (
      (arg === undefined || typeof arg === 'function') ?
        getter : setter
    )(prop, arg, skipCaching);
  }

  // Attach instance members
  function construct(target) {
    mixin(target, {
      values: obj,
      parent: parent || null,
      root: root || target,
      prop: prop === undefined ? null : prop,
      // .on(event[, prop], callback)
      on: on,
      // .off(event[, prop][, callback])
      off: off,
      // .trigger(event[, prop])
      trigger: trigger,
      toJSON: toJSON,
      // Deprecated. It has always been broken, anyway
      // Will think how to implement properly
      fromJSON: fromJSON,
      // Internal: dependency tracking
      _dependentProps: _dependentProps,
      _dependentContexts: _dependentContexts
    });

    // Wrap mutating array method to update
    // state and notify listeners
    function wrapArrayMethod(method, func) {
      return function() {
        var result = [][method].apply(obj, arguments);
        this.len = this.values.length;
        cache = {};
        children = {};
        func.apply(this, arguments);
        target.parent.trigger('update', target.prop);
        return result;
      };
    }

    if (Array.isArray(obj)) {
      mixin(target, {
        // Function prototype already contains length
        // `len` specifies array length
        len: obj.length,

        pop: wrapArrayMethod('pop', function() {
          trigger('delete', this.len, 1);
        }),

        push: wrapArrayMethod('push', function() {
          trigger('insert', this.len - 1, 1);
        }),

        reverse: wrapArrayMethod('reverse', function() {
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        shift: wrapArrayMethod('shift', function() {
          trigger('delete', 0, 1);
        }),

        unshift: wrapArrayMethod('unshift', function() {
          trigger('insert', 0, 1);
        }),

        sort: wrapArrayMethod('sort', function() {
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        splice: wrapArrayMethod('splice', function() {
          if (arguments[1]) {
            trigger('delete', arguments[0], arguments[1]);
          }
          if (arguments.length > 2) {
            trigger('insert', arguments[0], arguments.length - 2);
          }
        })

      });
    }
  }

  on('update', update);

  // Create freak instance
  var instance = function() {
    return accessor.apply(null, arguments);
  };

  // Attach instance members
  construct(instance);

  return instance;
}

// CommonJS export
if (typeof module === 'object') module.exports = freak;

},{}],2:[function(require,module,exports){
var RE_DELIMITED_VAR = /^\{\{([\w\.\-]+)\}\}$/;


/*
 * Attribute rules
 *
 */
module.exports = [

  /**
   * value="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'value' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            var val = lite._get(model, prop);
            if (node[attr] !== val) {
              node[attr] = val || '';
            }
          }

          // text input?
          var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
            'keyup' : 'change'; // IE9 incorectly reports it supports input event

          node.addEventListener(eventType, function() {
            model(prop, node[attr]);
          });

          model.on('change', prop, change);
          change();

        }
      };
    }
  },




  /**
   * selected="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'lite-selected' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            if (node.nodeName === 'OPTION') {
              var i = selects.indexOf(node.parentNode);
              if (selectsUpdating[i]) {
                return;
              }
              for (var j = 0, len = selectOptions[i].length; j < len; j++) {
                selectOptions[i][j].selected = selectOptionsContexts[i][j](prop);
              }
            }
            else {
              node.selected = model(prop);
            }
          }

          if (node.nodeName === 'OPTION') {

            // Process async, as parentNode is still documentFragment
            setTimeout(function() {
              var i = selects.indexOf(node.parentNode);
              if (i === -1) {
                // Add <select> to list
                i = selects.push(node.parentNode) - 1;
                // Init options
                selectOptions.push([]);
                // Init options contexts
                selectOptionsContexts.push([]);
                // Attach change listener
                node.parentNode.addEventListener('change', function() {
                  selectsUpdating[i] = true;
                  for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
                    selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
                  }
                  selectsUpdating[i] = false;
                });
              }
              // Remember option and context
              selectOptions[i].push(node);
              selectOptionsContexts[i].push(model);
            }, 0);

          }
          else {
            node.addEventListener('change', function() {
              model(prop, this.selected);
            });
          }

          model.on('change', prop, change);
          setTimeout(change);
        }
      };
    }
  },




  /**
   * checked="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'lite-checked' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            if (node.name) {
              if (radioGroupsUpdating[node.name]) {
                return;
              }
              for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                radioGroups[node.name][0][i].checked = radioGroups[node.name][1][i](prop);
              }
            }
            else {
              node.checked = model(prop);
            }
          }

          function init() {
            // radio group?
            if (node.type === 'radio' && node.name) {
              if (!radioGroups[node.name]) {
                // Init radio group ([0]: node, [1]: model)
                radioGroups[node.name] = [[], []];
              }
              // Add input to radio group
              radioGroups[node.name][0].push(node);
              // Add context to radio group
              radioGroups[node.name][1].push(model);
            }

            node.addEventListener('click', function() {
              if (node.type === 'radio' && node.name) {
                radioGroupsUpdating[node.name] = true;
                // Update all inputs from the group
                for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                  radioGroups[node.name][1][i](prop, radioGroups[node.name][0][i].checked);
                }
                radioGroupsUpdating[node.name] = false;
              }
              else {
                // Update current input only
                model(prop, node.checked);
              }
            });

            model.on('change', prop, change);
            setTimeout(change);
          }

          setTimeout(init);
        }

      };
    }
  },




  /**
   * attribute="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            var val = lite._get(model, prop);
            return val ?
              node.setAttribute(attr, val) :
              node.removeAttribute(attr);
          }

          model.on('change', prop, change);
          change();
        }
      };
    }
  },




  /**
   * Fallback rule, process via @see utemplate
   * Strip lite- prefix
   */
  function(node, attr) {
    return {
      prop: node.getAttribute(attr),
      rule: function(node, attr, model, prop) {
        var attrName = attr.replace('lite-', '');
        function change() {
          node.setAttribute(
            attrName,
            lite.utemplate(prop, model, change)
          );
        }
        change();
      }
    };
  }

];

},{}],3:[function(require,module,exports){
/*
 * Node rules
 *
 */
module.exports = [

  /* jshint evil: true */




  /**
   * {{var}}
   */
  function(node) {
    if (node.innerHTML.match(/^[\w\.\-]+$/)) {

      return {

        prop: node.innerHTML,

        rule: function(fragment, model, prop) {
          var textNode = document.createTextNode(lite._get(model, prop) || '');
          fragment.appendChild(textNode);
          model.on('change', prop, function() {
            textNode.data = lite._get(model, prop) || '';
          });
        }
      };
    }
  },




  /**
   * {{&var}}
   */
  function(node) {
    var match = node.innerHTML.match(/^&([\w\.\-]+)$/);
    if (match) {
      return {

        prop: match[1],

        rule: function(fragment, model, prop) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
          var length = 0;

          function change() {
            var frag = document.createDocumentFragment();
            var el = document.createElement('body');
            var i;

            // Delete old rendering
            while (length) {
              anchor.parentNode.removeChild(anchor.previousSibling);
              length--;
            }

            el.innerHTML = model(prop) || '';
            length = el.childNodes.length;
            for (i = 0; i < length; i++) {
              frag.appendChild(el.childNodes[0]);
            }
            anchor.parentNode.insertBefore(frag, anchor);
          }

          fragment.appendChild(anchor);
          model.on('change', prop, change);
          change();
        }

      };
    }
  },




  /**
   * {{>partial}}
   */
  function(node) {
    // match: [1]=var_name, [2]='single-quoted' [3]="double-quoted"
    var match = node.innerHTML.match(/>([\w\.\-]+)|'([^\']*)\'|"([^"]*)"/);

    if (match) {
      return {

        prop: match[0],

        rule: function(fragment, model, match) {

          var anchor = document.createComment('');
          var target;

          function change() {
            if (!target) {
              target = anchor.parentNode;
            }
            lite(
              target,
              match[1] ?
                // Variable
                model(match[1]) :
                // Literal
                match[2] || match[3],
              model
            );
          }
          if (match[1]) {
            // Variable
            model.on('change', match[1], change);
          }
          fragment.appendChild(anchor);
          change();
        }
      };
    }
  },




  /**
   * {{#section}}
   */
  function(node) {
    var match = node.innerHTML.match(/^#([\w\.\-]+)$/);

    if (match) {

      return {

        block: match[1],

        rule: function(fragment, model, prop, template) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
          var length = 0;
          // How many childNodes in one section item
          var chunkSize;

          function update(i) {
            return function() {
              var parent = anchor.parentNode;
              var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
              var pos = anchorIndex - length + i * chunkSize;
              var size = chunkSize;
              var arr = prop === '.' ? model : model(prop);

              while (size--) {
                parent.removeChild(parent.childNodes[pos]);
              }
              parent.insertBefore(
                eval(template + '(arr(i))'),
                parent.childNodes[pos]
              );
            };
          }

          function insert(index, count) {
            var parent = anchor.parentNode;
            var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
            var pos = anchorIndex - length + index * chunkSize;
            var size = count * chunkSize;
            var i, fragment;
            var arr = prop === '.' ? model : model(prop);

            for (i = 0, fragment = document.createDocumentFragment();
                i < count; i++) {
              fragment.appendChild(eval(template + '(arr(index + i))'));
            }

            parent.insertBefore(fragment, parent.childNodes[pos]);
            length = length + size;
          }

          function del(index, count) {
            var parent = anchor.parentNode;
            var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
            var pos = anchorIndex - length + index * chunkSize;
            var size = count * chunkSize;

            length = length - size;

            while (size--) {
              parent.removeChild(parent.childNodes[pos]);
            }
          }

          function change() {
            var val = prop === '.' ? model : model(prop);
            var i, len, render;

            // Delete old rendering
            while (length) {
              anchor.parentNode.removeChild(anchor.previousSibling);
              length--;
            }

            // Array?
            if (typeof val === 'function' && val.len !== undefined) {
              val.on('insert', insert);
              val.on('delete', del);
              render = document.createDocumentFragment();

              //console.log('rendering ' + val.len + ' values');
              var func = eval(template);
              var child, childModel;
              for (i = 0, len = val.values.length; i < len; i++) {
                // TODO: implement event delegation for array indexes
                // Also, using val.values[i] instead of val[i]
                // saves A LOT of heap memory. Figure out how to do
                // on demand model creation.
                val.on('change', i, update(i));
                //render.appendChild(eval(template + '(val(i))'));
                //render.appendChild(func(val.values[i]));
                childModel = val(i);
                child = func(childModel);
                child.__lite__ = childModel;
                render.appendChild(child);
              }

              length = render.childNodes.length;
              chunkSize = ~~(length / len);
              anchor.parentNode.insertBefore(render, anchor);
            }

            // Object?
            else if (typeof val === 'function' && val.len === undefined) {
              render = eval(template + '(val)');
              length = render.childNodes.length;
              chunkSize = length;
              anchor.parentNode.insertBefore(render, anchor);
              anchor.parentNode.__lite__ = model;
            }

            // Cast to boolean
            else {
              if (!!val) {
                render = eval(template + '(model)');
                length = render.childNodes.length;
                chunkSize = length;
                anchor.parentNode.insertBefore(render, anchor);
              }
            }
          }

          fragment.appendChild(anchor);
          change();
          model.on('change', prop, change);
        }
      };
    }
  },





  /**
   * {{^inverted_section}}
   */
  function(node) {
    var match = node.innerHTML.match(/^\^([\w\.\-]+)$/);

    if (match) {

      return {

        block: match[1],

        rule: function(fragment, model, prop, template) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
          var length = 0;

          function change() {
            var val = prop === '.' ? model : model(prop);
            var i, len, render;

            // Delete old rendering
            while (length) {
              anchor.parentNode.removeChild(anchor.previousSibling);
              length--;
            }

            // Array?
            if (typeof val === 'function' && val.len !== undefined) {
              val.on('insert', change);
              val.on('delete', change);
              render = document.createDocumentFragment();

              if (val.len === 0) {
                render.appendChild(eval(template + '(val(i))'));
              }

              length = render.childNodes.length;
              anchor.parentNode.insertBefore(render, anchor);
            }
            // Cast to boolean
            else {
              if (!val) {
                render = eval(template + '(model)');
                length = render.childNodes.length;
                anchor.parentNode.insertBefore(render, anchor);
              }
            }
          }

          fragment.appendChild(anchor);
          change();
          model.on('change', prop, change);
        }


      };
    }
  },



  /*
   * Fallback rule, not recognized lite tag
   */
  function(node) {
    return {
      rule: function(fragment) {
        fragment.appendChild(document.createTextNode('REMOVEMELATER'));
      }
    };
  }
];

},{}],4:[function(require,module,exports){
/**
 * Compile a template, parsed by @see parse
 *
 * @param {documentFragment} template
 * @param {string|undefined} sourceURL - include sourceURL to aid debugging
 *
 * @returns {string} - Function body, accepting Freak instance parameter, suitable for eval()
 */
function compile(template, sourceURL, depth) {

  var ri, rules, rlen;
  var match, block;

  // Generate dynamic function body
  var func = '(function(model) {\n' +
    'var frag = document.createDocumentFragment(), node;\n\n';

  if (!depth) {
    // Global bookkeeping
    func +=
      'var radioGroups = {};\n' +
      'var radioGroupsUpdating = {};\n' +
      'var selects = [];\n' +
      'var selectsUpdating = [];\n' +
      'var selectOptions = [];\n' +
      'var selectOptionsContexts = [];\n\n';
  }

  // Wrap model in a Freak instance, if necessary
  func += 'model = typeof model === "function" ?' +
    'model : ' +
    'typeof model === "object" ?' +
      'lite(model) :' +
      'lite({".": model});\n\n';

  // Iterate childNodes
  for (var i = 0, childNodes = template.childNodes, len = childNodes.length, node;
       i < len; i++) {

    node = childNodes[i];

    switch (node.nodeType) {

      // Element node
      case 1:

        // lite tag?
        if (node.nodeName === 'SCRIPT' && node.type === 'text/lite-tag') {

          for (ri = 0, rules = require('./compile-rules-node'), rlen = rules.length;
              ri < rlen; ri++) {

            match = rules[ri](node);

            // Rule found?
            if (match) {

              // Block tag?
              if (match.block) {

                // Fetch block template
                block = document.createDocumentFragment();
                for (i++;
                    (i < len) && !matchEndBlock(match.block, childNodes[i].innerHTML || '');
                    i++) {
                  block.appendChild(childNodes[i].cloneNode(true));
                }

                if (i === len) {
                  throw 'lite: Unclosed ' + match.block;
                }
                else {
                  func += '(' + match.rule.toString() + ')' +
                    '(frag, model, ' +
                    JSON.stringify(match.block) + ', ' +   // prop
                    JSON.stringify(
                      // template
                      compile(
                        block,
                        sourceURL && (sourceURL + '-' + node.innerHTML + '[' + i + ']'),
                        (depth || 0) + 1
                      )
                    ) + ');';
                }

              }
              // Inline tag
              else {
                func += '(' + match.rule.toString() + ')' +
                  '(frag, model, ' + JSON.stringify(match.prop) + ');\n';
              }

              // Skip remaining rules
              break;
            }
          } // end iterating node rules
        }

        else {
          // Create element
          func += 'node = document.createElement("' + node.nodeName + '");\n';

          // Process attributes
          for (var ai = 0, attributes = node.attributes, alen = attributes.length;
               ai < alen; ai++) {

            for (ri = 0, rules = require('./compile-rules-attr'), rlen = rules.length;
                ri < rlen; ri++) {

              match = rules[ri](node, attributes[ai].name.toLowerCase());

              if (match) {

                // Match found, append rule to func
                func += '(' + match.rule.toString() + ')' +
                  '(node, ' +
                  JSON.stringify(attributes[ai].name) + // attr
                  ', model, ' +
                  JSON.stringify(match.prop) +          // prop
                  ');\n';

                // Skip other attribute rules
                break;
              }
            }
          }

          if (node.nodeName !== 'INPUT') {
            // Recursively compile
            func += 'node.appendChild(' +
              compile(
                node,
            sourceURL && (sourceURL + '-' + node.nodeName + '[' + i + ']'),
            (depth || 0) + 1
            ) + '(model));\n';
          }

          // Append to fragment
          func += 'frag.appendChild(node);\n';
        }

        break;


      // Text node
      case 3:
        func += 'frag.appendChild(document.createTextNode(' +
          JSON.stringify(node.data) + '));\n';
        break;


      // Comment node
      case 8:
        func += 'frag.appendChild(document.createComment(' +
          JSON.stringify(node.data) + '));\n';
        break;

    } // end switch
  } // end iterate childNodes

  func += 'return frag; })';
  func += sourceURL ?
    '\n//@ sourceURL=' + sourceURL + '\n//# sourceURL=' + sourceURL + '\n' :
    '';

  return func;
}




function matchEndBlock(block, str) {
  var match = str.match(/^\/([\w\.\-]+)?$/);
  return match ?
    block === '' || !match[1] || match[1] === block :
    false;
}




module.exports = compile;

},{"./compile-rules-attr":2,"./compile-rules-node":3}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
/**
 * utemplate
 *
 * @param {string} template
 * @param {function} model - data as Freak instance
 * @param {optional function} onChange - will be called whenever used model property changes
 *
 * @returns {string} - rendered template using model
 *
 * Basic template rendering.
 * Supported tags: {{variable}}, {{#section}}, {{^inverted_section}}
 * (short closing tags {{/}} supported)
 *
 * Does NOT support nested sections, so simple parsing via regex is possible.
 */
function utemplate(template, model, onChange) {
  return template
    // {{#section}} sectionBody {{/}}
    .replace(
      /\{\{#([\w\.\-]+)\}\}(.+?)\{\{\/([\w\.\-]*?)\}\}/g,
      function(match, openTag, body, closeTag, pos) {
        if (closeTag !== '' && closeTag !== openTag) {
          throw 'lite: Unclosed ' + openTag;
        }
        if (typeof onChange === 'function') {
          model.on('change', openTag, onChange);
        }
        var val = openTag === '.' ? model : model(openTag);
        return (typeof val === 'function' && val.len !== undefined) ?
            // Array
            (val.len > 0) ?
              // Non-empty
              val.values
                .map(function(el, i) {
                  return utemplate(body.replace(/\{\{\.\}\}/g, '{{' + i + '}}'), val, onChange);
                })
                .join('') :
              // Empty
              '' :
            // Object or boolean?
            (typeof val === 'function' && val.len === undefined) ?
              // Object
              utemplate(body, val, onChange) :
              // Cast to boolean
              (!!val) ?
                utemplate(body, model, onChange) :
                '';
      }
    )
    // {{^inverted_section}} sectionBody {{/}}
    .replace(
      /\{\{\^([\w\.\-]+)\}\}(.+?)\{\{\/([\w\.\-]*?)\}\}/g,
      function(match, openTag, body, closeTag, pos) {
        if (closeTag !== '' && closeTag !== openTag) {
          throw 'lite: Unclosed ' + openTag;
        }
        if (typeof onChange === 'function') {
          model.on('change', openTag, onChange);
        }
        var val = openTag === '.' ? model : model(openTag);
        return (typeof val === 'function' && val.len !== undefined) ?
            // Array
            (val.len === 0) ?
              // Empty
              utemplate(body, model, onChange) :
              // Non-empty
              '' :
            // Cast to boolean
            (!val) ?
              utemplate(body, model, onChange) :
              '';
      }
    )
    // {{variable}}
    .replace(
      /\{\{([\w\.\-]+)\}\}/g,
      function(match, variable, pos) {
        if (typeof onChange === 'function') {
          model.on('change', variable, onChange);
        }
        return model(variable) === undefined ? '' : model(variable) + '';
      }
    );
}



module.exports = utemplate;

},{}],7:[function(require,module,exports){
/*
 * Main function
 */
/* jshint evil: true */
function lite() {
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
      eval(lite(args[1]) + '(args[2])')
    );

    // Store model reference
    args[0].__lite__ = args[2];
  }

  else {
    console.error('lite called with invalid parameters');
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
 * TODO: refactorme
 */
lite.RE_NODE_ID = /^#[\w\.\-]+$/;
lite.RE_ENDS_WITH_NODE_ID = /.+(#[\w\.\-]+)$/;

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

},{"./compile":4,"./parse":5,"./utemplate":6,"freak":1}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwic3JjL2NvbXBpbGUtcnVsZXMtYXR0ci5qcyIsInNyYy9jb21waWxlLXJ1bGVzLW5vZGUuanMiLCJzcmMvY29tcGlsZS5qcyIsInNyYy9wYXJzZS5qcyIsInNyYy91dGVtcGxhdGUuanMiLCJzcmMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ3VwZGF0ZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIF9kZXBlbmRlbnRQcm9wcyA9IHt9O1xuICB2YXIgX2RlcGVuZGVudENvbnRleHRzID0ge307XG4gIHZhciBjYWNoZSA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICAvLyBBc3NlcnQgY29uZGl0aW9uXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVlcEVxdWFsKHgsIHkpIHtcbiAgICBpZiAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgeSA9PT0gXCJvYmplY3RcIiAmJiB5ICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyh4KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKHkpLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIHByb3AgaW4geCkge1xuICAgICAgICBpZiAoeC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmICh5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh4W3Byb3BdLCB5W3Byb3BdKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoeCAhPT0geSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/XG4gICAgICBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAndXBkYXRlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgIT09IG51bGwpIHx8XG4gICAgICAoWydpbnNlcnQnLCAnZGVsZXRlJywgJ3VwZGF0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCA9PT0gbnVsbClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIG9yIHNwZWNpZmllZCBsaXN0ZW5lcnMgZ2l2ZW4gZXZlbnQgYW5kIHByb3BlcnR5XG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIHZhciBoYW5kbGVycyA9IChsaXN0ZW5lcnNbZXZlbnRdW1snY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSA/IGEgOiBudWxsXSB8fCBbXSk7XG4gICAgdmFyIGksIGxlbiA9IGhhbmRsZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGhhbmRsZXJzW2ldLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgIH07XG4gIH1cblxuICAvLyBFeHBvcnQgbW9kZWwgdG8gSlNPTiBzdHJpbmdcbiAgLy8gTk9UIGV4cG9ydGVkOlxuICAvLyAtIHByb3BlcnRpZXMgc3RhcnRpbmcgd2l0aCBfIChQeXRob24gcHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbnZlbnRpb24pXG4gIC8vIC0gY29tcHV0ZWQgcHJvcGVydGllcyAoZGVyaXZlZCBmcm9tIG5vcm1hbCBwcm9wZXJ0aWVzKVxuICBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgZnVuY3Rpb24gZmlsdGVyKG9iaikge1xuICAgICAgdmFyIGtleSwgZmlsdGVyZWQgPSBBcnJheS5pc0FycmF5KG9iaikgPyBbXSA6IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZpbHRlcihvYmpba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9ialtrZXldICE9PSAnZnVuY3Rpb24nICYmIGtleVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmaWx0ZXIob2JqKSk7XG4gIH1cblxuICAvLyBMb2FkIG1vZGVsIGZyb20gSlNPTiBzdHJpbmcgb3Igb2JqZWN0XG4gIGZ1bmN0aW9uIGZyb21KU09OKGRhdGEpIHtcbiAgICB2YXIga2V5O1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH1cbiAgICBmb3IgKGtleSBpbiBkYXRhKSB7XG4gICAgICBpbnN0YW5jZShrZXksIGRhdGFba2V5XSk7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBrZXkpO1xuICAgIH1cbiAgICBpbnN0YW5jZS5sZW4gPSBvYmoubGVuZ3RoO1xuICB9XG5cbiAgLy8gVXBkYXRlIGhhbmRsZXI6IHJlY2FsY3VsYXRlIGRlcGVuZGVudCBwcm9wZXJ0aWVzLFxuICAvLyB0cmlnZ2VyIGNoYW5nZSBpZiBuZWNlc3NhcnlcbiAgZnVuY3Rpb24gdXBkYXRlKHByb3ApIHtcbiAgICBpZiAoIWRlZXBFcXVhbChjYWNoZVtwcm9wXSwgZ2V0KHByb3AsIGZ1bmN0aW9uKCkge30sIHRydWUpKSkge1xuICAgICAgdHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGRlcGVuZGVudHNcbiAgICBmb3IgKHZhciBpID0gMCwgZGVwID0gX2RlcGVuZGVudFByb3BzW3Byb3BdIHx8IFtdLCBsZW4gPSBkZXAubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlbGV0ZSBjaGlsZHJlbltkZXBbaV1dO1xuICAgICAgX2RlcGVuZGVudENvbnRleHRzW3Byb3BdW2ldLnRyaWdnZXIoJ3VwZGF0ZScsIGRlcFtpXSk7XG4gICAgfVxuXG4gICAgaWYgKGluc3RhbmNlLnBhcmVudCkge1xuICAgICAgLy8gTm90aWZ5IGNvbXB1dGVkIHByb3BlcnRpZXMsIGRlcGVuZGluZyBvbiBwYXJlbnQgb2JqZWN0XG4gICAgICBpbnN0YW5jZS5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgaW5zdGFuY2UucHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJveHkgdGhlIGFjY2Vzc29yIGZ1bmN0aW9uIHRvIHJlY29yZFxuICAvLyBhbGwgYWNjZXNzZWQgcHJvcGVydGllc1xuICBmdW5jdGlvbiBnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSB7XG4gICAgZnVuY3Rpb24gdHJhY2tlcihjb250ZXh0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oX3Byb3AsIF9hcmcpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0pIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0gPSBbXTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXh0KF9wcm9wLCBfYXJnLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRyYWNrZXIoaW5zdGFuY2UpO1xuICAgIGNvbnN0cnVjdChyZXN1bHQpO1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgIHJlc3VsdC5wYXJlbnQgPSB0cmFja2VyKHBhcmVudCk7XG4gICAgfVxuICAgIHJlc3VsdC5yb290ID0gdHJhY2tlcihyb290IHx8IGluc3RhbmNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2hhbGxvdyBjbG9uZSBhbiBvYmplY3RcbiAgZnVuY3Rpb24gc2hhbGxvd0Nsb25lKG9iaikge1xuICAgIHZhciBrZXksIGNsb25lO1xuICAgIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNsb25lID0ge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgY2xvbmVba2V5XSA9IG9ialtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNsb25lID0gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICAvLyBHZXR0ZXIgZm9yIHByb3AsIGlmIGNhbGxiYWNrIGlzIGdpdmVuXG4gIC8vIGNhbiByZXR1cm4gYXN5bmMgdmFsdWVcbiAgZnVuY3Rpb24gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciB2YWwgPSBvYmpbcHJvcF07XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhbCA9IHZhbC5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCBjYWxsYmFjayk7XG4gICAgICBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICAgIGNhY2hlW3Byb3BdID0gKHZhbCA9PT0gdW5kZWZpbmVkKSA/IHZhbCA6IHNoYWxsb3dDbG9uZSh2YWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgIGNhY2hlW3Byb3BdID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciByZXN1bHQgPSBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKTtcblxuICAgIHJldHVybiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcgP1xuICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgIGNoaWxkcmVuW3Byb3BdID9cbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gOlxuICAgICAgICBjaGlsZHJlbltwcm9wXSA9IGZyZWFrKHJlc3VsdCwgcm9vdCB8fCBpbnN0YW5jZSwgaW5zdGFuY2UsIHByb3ApIDpcbiAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgcmVzdWx0O1xuICB9XG5cbiAgLy8gU2V0IHByb3AgdG8gdmFsXG4gIGZ1bmN0aW9uIHNldHRlcihwcm9wLCB2YWwpIHtcbiAgICB2YXIgb2xkVmFsID0gZ2V0KHByb3ApO1xuXG4gICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5IHNldHRlclxuICAgICAgb2JqW3Byb3BdLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIHZhbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gU2ltcGxlIHByb3BlcnR5XG4gICAgICBvYmpbcHJvcF0gPSB2YWw7XG4gICAgICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGRlbGV0ZSBjYWNoZVtwcm9wXTtcbiAgICAgICAgZGVsZXRlIGNoaWxkcmVuW3Byb3BdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvbGRWYWwgIT09IHZhbCkge1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywgcHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRnVuY3Rpb25hbCBhY2Nlc3NvciwgdW5pZnkgZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgZnVuY3Rpb24gYWNjZXNzb3IocHJvcCwgYXJnLCBza2lwQ2FjaGluZykge1xuICAgIHJldHVybiAoXG4gICAgICAoYXJnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICBnZXR0ZXIgOiBzZXR0ZXJcbiAgICApKHByb3AsIGFyZywgc2tpcENhY2hpbmcpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgZnVuY3Rpb24gY29uc3RydWN0KHRhcmdldCkge1xuICAgIG1peGluKHRhcmdldCwge1xuICAgICAgdmFsdWVzOiBvYmosXG4gICAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgICAgcm9vdDogcm9vdCB8fCB0YXJnZXQsXG4gICAgICBwcm9wOiBwcm9wID09PSB1bmRlZmluZWQgPyBudWxsIDogcHJvcCxcbiAgICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICAgIG9uOiBvbixcbiAgICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgLy8gLnRyaWdnZXIoZXZlbnRbLCBwcm9wXSlcbiAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICB0b0pTT046IHRvSlNPTixcbiAgICAgIC8vIERlcHJlY2F0ZWQuIEl0IGhhcyBhbHdheXMgYmVlbiBicm9rZW4sIGFueXdheVxuICAgICAgLy8gV2lsbCB0aGluayBob3cgdG8gaW1wbGVtZW50IHByb3Blcmx5XG4gICAgICBmcm9tSlNPTjogZnJvbUpTT04sXG4gICAgICAvLyBJbnRlcm5hbDogZGVwZW5kZW5jeSB0cmFja2luZ1xuICAgICAgX2RlcGVuZGVudFByb3BzOiBfZGVwZW5kZW50UHJvcHMsXG4gICAgICBfZGVwZW5kZW50Q29udGV4dHM6IF9kZXBlbmRlbnRDb250ZXh0c1xuICAgIH0pO1xuXG4gICAgLy8gV3JhcCBtdXRhdGluZyBhcnJheSBtZXRob2QgdG8gdXBkYXRlXG4gICAgLy8gc3RhdGUgYW5kIG5vdGlmeSBsaXN0ZW5lcnNcbiAgICBmdW5jdGlvbiB3cmFwQXJyYXlNZXRob2QobWV0aG9kLCBmdW5jKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXVttZXRob2RdLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICAgIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdGFyZ2V0LnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCB0YXJnZXQucHJvcCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgIG1peGluKHRhcmdldCwge1xuICAgICAgICAvLyBGdW5jdGlvbiBwcm90b3R5cGUgYWxyZWFkeSBjb250YWlucyBsZW5ndGhcbiAgICAgICAgLy8gYGxlbmAgc3BlY2lmaWVzIGFycmF5IGxlbmd0aFxuICAgICAgICBsZW46IG9iai5sZW5ndGgsXG5cbiAgICAgICAgcG9wOiB3cmFwQXJyYXlNZXRob2QoJ3BvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIHRoaXMubGVuLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcHVzaDogd3JhcEFycmF5TWV0aG9kKCdwdXNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgdGhpcy5sZW4gLSAxLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcmV2ZXJzZTogd3JhcEFycmF5TWV0aG9kKCdyZXZlcnNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgnc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgdW5zaGlmdDogd3JhcEFycmF5TWV0aG9kKCd1bnNoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNvcnQ6IHdyYXBBcnJheU1ldGhvZCgnc29ydCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNwbGljZTogd3JhcEFycmF5TWV0aG9kKCdzcGxpY2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHMubGVuZ3RoIC0gMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICAvLyBDcmVhdGUgZnJlYWsgaW5zdGFuY2VcbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgY29uc3RydWN0KGluc3RhbmNlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwidmFyIFJFX0RFTElNSVRFRF9WQVIgPSAvXlxce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9JC87XG5cblxuLypcbiAqIEF0dHJpYnV0ZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoqXG4gICAqIHZhbHVlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICd2YWx1ZScgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGxpdGUuX2dldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgICAgIG5vZGVbYXR0cl0gPSB2YWwgfHwgJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gdGV4dCBpbnB1dD9cbiAgICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICAgJ2tleXVwJyA6ICdjaGFuZ2UnOyAvLyBJRTkgaW5jb3JlY3RseSByZXBvcnRzIGl0IHN1cHBvcnRzIGlucHV0IGV2ZW50XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG5cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHNlbGVjdGVkPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICdsaXRlLXNlbGVjdGVkJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ09QVElPTicpIHtcbiAgICAgICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgaWYgKHNlbGVjdHNVcGRhdGluZ1tpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMCwgbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV1bal0uc2VsZWN0ZWQgPSBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bal0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLnNlbGVjdGVkID0gbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG5cbiAgICAgICAgICAgIC8vIFByb2Nlc3MgYXN5bmMsIGFzIHBhcmVudE5vZGUgaXMgc3RpbGwgZG9jdW1lbnRGcmFnbWVudFxuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgaWYgKGkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIDxzZWxlY3Q+IHRvIGxpc3RcbiAgICAgICAgICAgICAgICBpID0gc2VsZWN0cy5wdXNoKG5vZGUucGFyZW50Tm9kZSkgLSAxO1xuICAgICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9uc1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zIGNvbnRleHRzXG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzLnB1c2goW10pO1xuICAgICAgICAgICAgICAgIC8vIEF0dGFjaCBjaGFuZ2UgbGlzdGVuZXJcbiAgICAgICAgICAgICAgICBub2RlLnBhcmVudE5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RzVXBkYXRpbmdbaV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgb2kgPSAwLCBvbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IG9pIDwgb2xlbjsgb2krKykge1xuICAgICAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bb2ldKHByb3AsIHNlbGVjdE9wdGlvbnNbaV1bb2ldLnNlbGVjdGVkKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHNlbGVjdHNVcGRhdGluZ1tpXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFJlbWVtYmVyIG9wdGlvbiBhbmQgY29udGV4dFxuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zW2ldLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIH0sIDApO1xuXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgbW9kZWwocHJvcCwgdGhpcy5zZWxlY3RlZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBjaGVja2VkPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICdsaXRlLWNoZWNrZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF1baV0uY2hlY2tlZCA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBpbml0KCkge1xuICAgICAgICAgICAgLy8gcmFkaW8gZ3JvdXA/XG4gICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICBpZiAoIXJhZGlvR3JvdXBzW25vZGUubmFtZV0pIHtcbiAgICAgICAgICAgICAgICAvLyBJbml0IHJhZGlvIGdyb3VwIChbMF06IG5vZGUsIFsxXTogbW9kZWwpXG4gICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEFkZCBpbnB1dCB0byByYWRpbyBncm91cFxuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgIC8vIEFkZCBjb250ZXh0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV0ucHVzaChtb2RlbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBhbGwgaW5wdXRzIGZyb20gdGhlIGdyb3VwXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCwgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNVcGRhdGluZ1tub2RlLm5hbWVdID0gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgaW5wdXQgb25seVxuICAgICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuY2hlY2tlZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzZXRUaW1lb3V0KGluaXQpO1xuICAgICAgICB9XG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBhdHRyaWJ1dGU9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGxpdGUuX2dldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKSA6XG4gICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogRmFsbGJhY2sgcnVsZSwgcHJvY2VzcyB2aWEgQHNlZSB1dGVtcGxhdGVcbiAgICogU3RyaXAgbGl0ZS0gcHJlZml4XG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3A6IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLFxuICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgdmFyIGF0dHJOYW1lID0gYXR0ci5yZXBsYWNlKCdsaXRlLScsICcnKTtcbiAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgYXR0ck5hbWUsXG4gICAgICAgICAgICBsaXRlLnV0ZW1wbGF0ZShwcm9wLCBtb2RlbCwgY2hhbmdlKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY2hhbmdlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG5dO1xuIiwiLypcbiAqIE5vZGUgcnVsZXNcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gW1xuXG4gIC8qIGpzaGludCBldmlsOiB0cnVlICovXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7dmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goL15bXFx3XFwuXFwtXSskLykpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBub2RlLmlubmVySFRNTCxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaXRlLl9nZXQobW9kZWwsIHByb3ApIHx8ICcnKTtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGxpdGUuX2dldChtb2RlbCwgcHJvcCkgfHwgJyc7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiB7eyZ2YXJ9fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eJihbXFx3XFwuXFwtXSspJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIC8vIEFuY2hvciBub2RlIGZvciBrZWVwaW5nIHNlY3Rpb24gbG9jYXRpb25cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgLy8gTnVtYmVyIG9mIHJlbmRlcmVkIG5vZGVzXG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgICAgIHZhciBpO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9IG1vZGVsKHByb3ApIHx8ICcnO1xuICAgICAgICAgICAgbGVuZ3RoID0gZWwuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgZnJhZy5hcHBlbmRDaGlsZChlbC5jaGlsZE5vZGVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShmcmFnLCBhbmNob3IpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgIH1cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7PnBhcnRpYWx9fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIC8vIG1hdGNoOiBbMV09dmFyX25hbWUsIFsyXT0nc2luZ2xlLXF1b3RlZCcgWzNdPVwiZG91YmxlLXF1b3RlZFwiXG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzBdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgbWF0Y2gpIHtcblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICB2YXIgdGFyZ2V0O1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsaXRlKFxuICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgIG1hdGNoWzFdID9cbiAgICAgICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgICAgICAgIG1hdGNoWzJdIHx8IG1hdGNoWzNdLFxuICAgICAgICAgICAgICBtb2RlbFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG1hdGNoWzFdLCBjaGFuZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3sjc2VjdGlvbn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14jKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcbiAgICAgICAgICAvLyBIb3cgbWFueSBjaGlsZE5vZGVzIGluIG9uZSBzZWN0aW9uIGl0ZW1cbiAgICAgICAgICB2YXIgY2h1bmtTaXplO1xuXG4gICAgICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGkgKiBjaHVua1NpemU7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gY2h1bmtTaXplO1xuICAgICAgICAgICAgICB2YXIgYXJyID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoXG4gICAgICAgICAgICAgICAgZXZhbCh0ZW1wbGF0ZSArICcoYXJyKGkpKScpLFxuICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gaW5zZXJ0KGluZGV4LCBjb3VudCkge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiBjaHVua1NpemU7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIGksIGZyYWdtZW50O1xuICAgICAgICAgICAgdmFyIGFyciA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKGFycihpbmRleCArIGkpKScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShmcmFnbWVudCwgcGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGRlbChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcblxuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBpbnNlcnQpO1xuICAgICAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdyZW5kZXJpbmcgJyArIHZhbC5sZW4gKyAnIHZhbHVlcycpO1xuICAgICAgICAgICAgICB2YXIgZnVuYyA9IGV2YWwodGVtcGxhdGUpO1xuICAgICAgICAgICAgICB2YXIgY2hpbGQsIGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC52YWx1ZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgZXZlbnQgZGVsZWdhdGlvbiBmb3IgYXJyYXkgaW5kZXhlc1xuICAgICAgICAgICAgICAgIC8vIEFsc28sIHVzaW5nIHZhbC52YWx1ZXNbaV0gaW5zdGVhZCBvZiB2YWxbaV1cbiAgICAgICAgICAgICAgICAvLyBzYXZlcyBBIExPVCBvZiBoZWFwIG1lbW9yeS4gRmlndXJlIG91dCBob3cgdG8gZG9cbiAgICAgICAgICAgICAgICAvLyBvbiBkZW1hbmQgbW9kZWwgY3JlYXRpb24uXG4gICAgICAgICAgICAgICAgdmFsLm9uKCdjaGFuZ2UnLCBpLCB1cGRhdGUoaSkpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKHZhbChpKSknKSk7XG4gICAgICAgICAgICAgICAgLy9yZW5kZXIuYXBwZW5kQ2hpbGQoZnVuYyh2YWwudmFsdWVzW2ldKSk7XG4gICAgICAgICAgICAgICAgY2hpbGRNb2RlbCA9IHZhbChpKTtcbiAgICAgICAgICAgICAgICBjaGlsZCA9IGZ1bmMoY2hpbGRNb2RlbCk7XG4gICAgICAgICAgICAgICAgY2hpbGQuX19saXRlX18gPSBjaGlsZE1vZGVsO1xuICAgICAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGNodW5rU2l6ZSA9IH5+KGxlbmd0aCAvIGxlbik7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9iamVjdD9cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKHZhbCknKTtcbiAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLl9fbGl0ZV9fID0gbW9kZWw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7XmludmVydGVkX3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eXFxeKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBjaGFuZ2UpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcodmFsKGkpKScpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghdmFsKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwpJyk7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICB9XG5cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG4gIC8qXG4gICAqIEZhbGxiYWNrIHJ1bGUsIG5vdCByZWNvZ25pemVkIGxpdGUgdGFnXG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50KSB7XG4gICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCdSRU1PVkVNRUxBVEVSJykpO1xuICAgICAgfVxuICAgIH07XG4gIH1cbl07XG4iLCIvKipcbiAqIENvbXBpbGUgYSB0ZW1wbGF0ZSwgcGFyc2VkIGJ5IEBzZWUgcGFyc2VcbiAqXG4gKiBAcGFyYW0ge2RvY3VtZW50RnJhZ21lbnR9IHRlbXBsYXRlXG4gKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR9IHNvdXJjZVVSTCAtIGluY2x1ZGUgc291cmNlVVJMIHRvIGFpZCBkZWJ1Z2dpbmdcbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIEZ1bmN0aW9uIGJvZHksIGFjY2VwdGluZyBGcmVhayBpbnN0YW5jZSBwYXJhbWV0ZXIsIHN1aXRhYmxlIGZvciBldmFsKClcbiAqL1xuZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgc291cmNlVVJMLCBkZXB0aCkge1xuXG4gIHZhciByaSwgcnVsZXMsIHJsZW47XG4gIHZhciBtYXRjaCwgYmxvY2s7XG5cbiAgLy8gR2VuZXJhdGUgZHluYW1pYyBmdW5jdGlvbiBib2R5XG4gIHZhciBmdW5jID0gJyhmdW5jdGlvbihtb2RlbCkge1xcbicgK1xuICAgICd2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSwgbm9kZTtcXG5cXG4nO1xuXG4gIGlmICghZGVwdGgpIHtcbiAgICAvLyBHbG9iYWwgYm9va2tlZXBpbmdcbiAgICBmdW5jICs9XG4gICAgICAndmFyIHJhZGlvR3JvdXBzID0ge307XFxuJyArXG4gICAgICAndmFyIHJhZGlvR3JvdXBzVXBkYXRpbmcgPSB7fTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0cyA9IFtdO1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RzVXBkYXRpbmcgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9ucyA9IFtdO1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RPcHRpb25zQ29udGV4dHMgPSBbXTtcXG5cXG4nO1xuICB9XG5cbiAgLy8gV3JhcCBtb2RlbCBpbiBhIEZyZWFrIGluc3RhbmNlLCBpZiBuZWNlc3NhcnlcbiAgZnVuYyArPSAnbW9kZWwgPSB0eXBlb2YgbW9kZWwgPT09IFwiZnVuY3Rpb25cIiA/JyArXG4gICAgJ21vZGVsIDogJyArXG4gICAgJ3R5cGVvZiBtb2RlbCA9PT0gXCJvYmplY3RcIiA/JyArXG4gICAgICAnbGl0ZShtb2RlbCkgOicgK1xuICAgICAgJ2xpdGUoe1wiLlwiOiBtb2RlbH0pO1xcblxcbic7XG5cbiAgLy8gSXRlcmF0ZSBjaGlsZE5vZGVzXG4gIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGgsIG5vZGU7XG4gICAgICAgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcblxuICAgIHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXG4gICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgIGNhc2UgMTpcblxuICAgICAgICAvLyBsaXRlIHRhZz9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdTQ1JJUFQnICYmIG5vZGUudHlwZSA9PT0gJ3RleHQvbGl0ZS10YWcnKSB7XG5cbiAgICAgICAgICBmb3IgKHJpID0gMCwgcnVsZXMgPSByZXF1aXJlKCcuL2NvbXBpbGUtcnVsZXMtbm9kZScpLCBybGVuID0gcnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgICByaSA8IHJsZW47IHJpKyspIHtcblxuICAgICAgICAgICAgbWF0Y2ggPSBydWxlc1tyaV0obm9kZSk7XG5cbiAgICAgICAgICAgIC8vIFJ1bGUgZm91bmQ/XG4gICAgICAgICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICAgICAgICAvLyBCbG9jayB0YWc/XG4gICAgICAgICAgICAgIGlmIChtYXRjaC5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGVtcGxhdGVcbiAgICAgICAgICAgICAgICBibG9jayA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGkrKztcbiAgICAgICAgICAgICAgICAgICAgKGkgPCBsZW4pICYmICFtYXRjaEVuZEJsb2NrKG1hdGNoLmJsb2NrLCBjaGlsZE5vZGVzW2ldLmlubmVySFRNTCB8fCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIGkrKykge1xuICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGROb2Rlc1tpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgICAgIHRocm93ICdsaXRlOiBVbmNsb3NlZCAnICsgbWF0Y2guYmxvY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgICAnKGZyYWcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2guYmxvY2spICsgJywgJyArICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jayxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5pbm5lckhUTUwgKyAnWycgKyBpICsgJ10nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICkgKyAnKTsnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIElubGluZSB0YWdcbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgJyk7XFxuJztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFNraXAgcmVtYWluaW5nIHJ1bGVzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gZW5kIGl0ZXJhdGluZyBub2RlIHJ1bGVzXG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBDcmVhdGUgZWxlbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ25vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiJyArIG5vZGUubm9kZU5hbWUgKyAnXCIpO1xcbic7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGF0dHJpYnV0ZXNcbiAgICAgICAgICBmb3IgKHZhciBhaSA9IDAsIGF0dHJpYnV0ZXMgPSBub2RlLmF0dHJpYnV0ZXMsIGFsZW4gPSBhdHRyaWJ1dGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgIGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICBmb3IgKHJpID0gMCwgcnVsZXMgPSByZXF1aXJlKCcuL2NvbXBpbGUtcnVsZXMtYXR0cicpLCBybGVuID0gcnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUsIGF0dHJpYnV0ZXNbYWldLm5hbWUudG9Mb3dlckNhc2UoKSk7XG5cbiAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNYXRjaCBmb3VuZCwgYXBwZW5kIHJ1bGUgdG8gZnVuY1xuICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICcobm9kZSwgJyArXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShhdHRyaWJ1dGVzW2FpXS5uYW1lKSArIC8vIGF0dHJcbiAgICAgICAgICAgICAgICAgICcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgICAgICAgICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgJyk7XFxuJztcblxuICAgICAgICAgICAgICAgIC8vIFNraXAgb3RoZXIgYXR0cmlidXRlIHJ1bGVzXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgICAgICAgLy8gUmVjdXJzaXZlbHkgY29tcGlsZVxuICAgICAgICAgICAgZnVuYyArPSAnbm9kZS5hcHBlbmRDaGlsZCgnICtcbiAgICAgICAgICAgICAgY29tcGlsZShcbiAgICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgc291cmNlVVJMICYmIChzb3VyY2VVUkwgKyAnLScgKyBub2RlLm5vZGVOYW1lICsgJ1snICsgaSArICddJyksXG4gICAgICAgICAgICAoZGVwdGggfHwgMCkgKyAxXG4gICAgICAgICAgICApICsgJyhtb2RlbCkpO1xcbic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQXBwZW5kIHRvIGZyYWdtZW50XG4gICAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChub2RlKTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWs7XG5cblxuICAgICAgLy8gVGV4dCBub2RlXG4gICAgICBjYXNlIDM6XG4gICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobm9kZS5kYXRhKSArICcpKTtcXG4nO1xuICAgICAgICBicmVhaztcblxuXG4gICAgICAvLyBDb21tZW50IG5vZGVcbiAgICAgIGNhc2UgODpcbiAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVDb21tZW50KCcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG5vZGUuZGF0YSkgKyAnKSk7XFxuJztcbiAgICAgICAgYnJlYWs7XG5cbiAgICB9IC8vIGVuZCBzd2l0Y2hcbiAgfSAvLyBlbmQgaXRlcmF0ZSBjaGlsZE5vZGVzXG5cbiAgZnVuYyArPSAncmV0dXJuIGZyYWc7IH0pJztcbiAgZnVuYyArPSBzb3VyY2VVUkwgP1xuICAgICdcXG4vL0Agc291cmNlVVJMPScgKyBzb3VyY2VVUkwgKyAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc291cmNlVVJMICsgJ1xcbicgOlxuICAgICcnO1xuXG4gIHJldHVybiBmdW5jO1xufVxuXG5cblxuXG5mdW5jdGlvbiBtYXRjaEVuZEJsb2NrKGJsb2NrLCBzdHIpIHtcbiAgdmFyIG1hdGNoID0gc3RyLm1hdGNoKC9eXFwvKFtcXHdcXC5cXC1dKyk/JC8pO1xuICByZXR1cm4gbWF0Y2ggP1xuICAgIGJsb2NrID09PSAnJyB8fCAhbWF0Y2hbMV0gfHwgbWF0Y2hbMV0gPT09IGJsb2NrIDpcbiAgICBmYWxzZTtcbn1cblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjb21waWxlO1xuIiwiLyoqXG4gKiBQYXJzZSBhIHRleHQgdGVtcGxhdGUgdG8gRE9NIHN0cnVjdHVyZSByZWFkeSBmb3IgY29tcGlsaW5nXG4gKiBAc2VlIGNvbXBpbGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqXG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuZnVuY3Rpb24gcGFyc2UodGVtcGxhdGUpIHtcblxuICB2YXIgaWZyYW1lLCBib2R5O1xuXG4gIGZ1bmN0aW9uIHByZXByb2Nlc3ModGVtcGxhdGUpIHtcblxuICAgIC8vIHJlcGxhY2Uge3t7dGFnfX19IHdpdGgge3smdGFnfX1cbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoL1xce1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfVxcfS9nLCAne3smJDF9fScpO1xuXG4gICAgLy8gMS4gd3JhcCBlYWNoIG5vbi1hdHRyaWJ1dGUgdGFnIGluIDxzY3JpcHQgdHlwZT1cInRleHQvbGl0ZS10YWdcIj5cbiAgICAvLyAyLiByZW1vdmUgTXVzdGFjaGUgY29tbWVudHNcbiAgICAvLyBUT0RPOiBoYW5kbGUgdGFncyBpbiBIVE1MIGNvbW1lbnRzXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG1hdGNoMSwgcG9zKSB7XG4gICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaCgvPFtcXHdcXC1dK1tePl0qPyQvKTtcbiAgICAgICAgdmFyIG9wZW5pbmcgPSBoZWFkLm1hdGNoKC88KHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgY2xvc2luZyA9IGhlYWQubWF0Y2goLzxcXC8oc2NyaXB0fFNDUklQVCkvZyk7XG4gICAgICAgIHZhciBpbnNpZGVTY3JpcHQgPVxuICAgICAgICAgICAgKG9wZW5pbmcgJiYgb3BlbmluZy5sZW5ndGggfHwgMCkgPiAoY2xvc2luZyAmJiBjbG9zaW5nLmxlbmd0aCB8fCAwKTtcbiAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgP1xuICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgIGluc2lkZVNjcmlwdCA/XG4gICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICAnPHNjcmlwdCB0eXBlPVwidGV4dC9saXRlLXRhZ1wiPicgKyBtYXRjaDEudHJpbSgpICsgJ1xceDNDL3NjcmlwdD4nO1xuICAgICAgfVxuICAgICk7XG4gICAgLy8gcHJlZml4ICdzZWxlY3RlZCcgYW5kICdjaGVja2VkJyBhdHRyaWJ1dGVzIHdpdGggJ2xpdGUtJ1xuICAgIC8vICh0byBhdm9pZCBcInNwZWNpYWxcIiBwcm9jZXNzaW5nLCBvaCBJRTgpXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgLyg8KD86b3B0aW9ufE9QVElPTilbXj5dKj8pKD86c2VsZWN0ZWR8U0VMRUNURUQpPS9nLFxuICAgICAgJyQxbGl0ZS1zZWxlY3RlZD0nKTtcblxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/OmlucHV0fElOUFVUKVtePl0qPykoPzpjaGVja2VkfENIRUNLRUQpPS9nLFxuICAgICAgJyQxbGl0ZS1jaGVja2VkPScpO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9XG5cbiAgdGVtcGxhdGUgPSBwcmVwcm9jZXNzKHRlbXBsYXRlKTtcbiAgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgYm9keS5pbm5lckhUTUwgPSB0ZW1wbGF0ZTtcblxuICByZXR1cm4gYm9keTtcbn1cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG4iLCIvKipcbiAqIHV0ZW1wbGF0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gbW9kZWwgLSBkYXRhIGFzIEZyZWFrIGluc3RhbmNlXG4gKiBAcGFyYW0ge29wdGlvbmFsIGZ1bmN0aW9ufSBvbkNoYW5nZSAtIHdpbGwgYmUgY2FsbGVkIHdoZW5ldmVyIHVzZWQgbW9kZWwgcHJvcGVydHkgY2hhbmdlc1xuICpcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gcmVuZGVyZWQgdGVtcGxhdGUgdXNpbmcgbW9kZWxcbiAqXG4gKiBCYXNpYyB0ZW1wbGF0ZSByZW5kZXJpbmcuXG4gKiBTdXBwb3J0ZWQgdGFnczoge3t2YXJpYWJsZX19LCB7eyNzZWN0aW9ufX0sIHt7XmludmVydGVkX3NlY3Rpb259fVxuICogKHNob3J0IGNsb3NpbmcgdGFncyB7ey99fSBzdXBwb3J0ZWQpXG4gKlxuICogRG9lcyBOT1Qgc3VwcG9ydCBuZXN0ZWQgc2VjdGlvbnMsIHNvIHNpbXBsZSBwYXJzaW5nIHZpYSByZWdleCBpcyBwb3NzaWJsZS5cbiAqL1xuZnVuY3Rpb24gdXRlbXBsYXRlKHRlbXBsYXRlLCBtb2RlbCwgb25DaGFuZ2UpIHtcbiAgcmV0dXJuIHRlbXBsYXRlXG4gICAgLy8ge3sjc2VjdGlvbn19IHNlY3Rpb25Cb2R5IHt7L319XG4gICAgLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7IyhbXFx3XFwuXFwtXSspXFx9XFx9KC4rPylcXHtcXHtcXC8oW1xcd1xcLlxcLV0qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBvcGVuVGFnLCBib2R5LCBjbG9zZVRhZywgcG9zKSB7XG4gICAgICAgIGlmIChjbG9zZVRhZyAhPT0gJycgJiYgY2xvc2VUYWcgIT09IG9wZW5UYWcpIHtcbiAgICAgICAgICB0aHJvdyAnbGl0ZTogVW5jbG9zZWQgJyArIG9wZW5UYWc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBvbkNoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBvcGVuVGFnLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IG9wZW5UYWcgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwob3BlblRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpID9cbiAgICAgICAgICAgIC8vIEFycmF5XG4gICAgICAgICAgICAodmFsLmxlbiA+IDApID9cbiAgICAgICAgICAgICAgLy8gTm9uLWVtcHR5XG4gICAgICAgICAgICAgIHZhbC52YWx1ZXNcbiAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGVsLCBpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdXRlbXBsYXRlKGJvZHkucmVwbGFjZSgvXFx7XFx7XFwuXFx9XFx9L2csICd7eycgKyBpICsgJ319JyksIHZhbCwgb25DaGFuZ2UpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmpvaW4oJycpIDpcbiAgICAgICAgICAgICAgLy8gRW1wdHlcbiAgICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgLy8gT2JqZWN0IG9yIGJvb2xlYW4/XG4gICAgICAgICAgICAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuID09PSB1bmRlZmluZWQpID9cbiAgICAgICAgICAgICAgLy8gT2JqZWN0XG4gICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCB2YWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgICAoISF2YWwpID9cbiAgICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgbW9kZWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgICAgJyc7XG4gICAgICB9XG4gICAgKVxuICAgIC8vIHt7XmludmVydGVkX3NlY3Rpb259fSBzZWN0aW9uQm9keSB7ey99fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xce1xcXihbXFx3XFwuXFwtXSspXFx9XFx9KC4rPylcXHtcXHtcXC8oW1xcd1xcLlxcLV0qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBvcGVuVGFnLCBib2R5LCBjbG9zZVRhZywgcG9zKSB7XG4gICAgICAgIGlmIChjbG9zZVRhZyAhPT0gJycgJiYgY2xvc2VUYWcgIT09IG9wZW5UYWcpIHtcbiAgICAgICAgICB0aHJvdyAnbGl0ZTogVW5jbG9zZWQgJyArIG9wZW5UYWc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBvbkNoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBvcGVuVGFnLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IG9wZW5UYWcgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwob3BlblRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpID9cbiAgICAgICAgICAgIC8vIEFycmF5XG4gICAgICAgICAgICAodmFsLmxlbiA9PT0gMCkgP1xuICAgICAgICAgICAgICAvLyBFbXB0eVxuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgbW9kZWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgIC8vIE5vbi1lbXB0eVxuICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgICghdmFsKSA/XG4gICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgJyc7XG4gICAgICB9XG4gICAgKVxuICAgIC8vIHt7dmFyaWFibGV9fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgdmFyaWFibGUsIHBvcykge1xuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHZhcmlhYmxlLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1vZGVsKHZhcmlhYmxlKSA9PT0gdW5kZWZpbmVkID8gJycgOiBtb2RlbCh2YXJpYWJsZSkgKyAnJztcbiAgICAgIH1cbiAgICApO1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSB1dGVtcGxhdGU7XG4iLCIvKlxuICogTWFpbiBmdW5jdGlvblxuICovXG4vKiBqc2hpbnQgZXZpbDogdHJ1ZSAqL1xuZnVuY3Rpb24gbGl0ZSgpIHtcbiAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgZnVuY3Rpb24gaGFzaGNvZGUocykge1xuICAgIHZhciBoYXNoID0gMCwgaSwgY2hyLCBsZW47XG4gICAgaWYgKHMubGVuZ3RoID09PSAwKSByZXR1cm4gaGFzaDtcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjaHIgPSBzLmNoYXJDb2RlQXQoaSk7XG4gICAgICBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBjaHI7XG4gICAgICBoYXNoIHw9IDA7IC8vIENvbnZlcnQgdG8gMzJiaXQgaW50ZWdlclxuICAgIH1cbiAgICByZXR1cm4gaGFzaDtcbiAgfVxuXG4gIC8vIGxpdGUob2JqZWN0KT9cbiAgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0Jykge1xuICAgIC8vIHJldHVybiBGcmVhayBpbnN0YW5jZVxuICAgIHJldHVybiByZXF1aXJlKCdmcmVhaycpKGFyZ3NbMF0pO1xuICB9XG5cbiAgLy8gbGl0ZSh0ZW1wbGF0ZSk/XG4gIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJykge1xuICAgIHZhciB0ZW1wbGF0ZSA9IGxpdGUucGFyc2UoYXJnc1swXSk7XG4gICAgcmV0dXJuIGxpdGUuY29tcGlsZSh0ZW1wbGF0ZSwgJ2xpdGUtJyArIGhhc2hjb2RlKHRlbXBsYXRlKSk7XG4gIH1cblxuICAvLyBsaXRlKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKT9cbiAgZWxzZSBpZiAoXG4gICAgKGFyZ3NbMF0gJiYgYXJnc1swXS5ub2RlVHlwZSkgJiZcbiAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKSAmJlxuICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ2Z1bmN0aW9uJylcbiAgKSB7XG4gICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgYXJnc1swXS5pbm5lckhUTUwgPSAnJztcblxuICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgIGFyZ3NbMF0uYXBwZW5kQ2hpbGQoXG4gICAgICBldmFsKGxpdGUoYXJnc1sxXSkgKyAnKGFyZ3NbMl0pJylcbiAgICApO1xuXG4gICAgLy8gU3RvcmUgbW9kZWwgcmVmZXJlbmNlXG4gICAgYXJnc1swXS5fX2xpdGVfXyA9IGFyZ3NbMl07XG4gIH1cblxuICBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdsaXRlIGNhbGxlZCB3aXRoIGludmFsaWQgcGFyYW1ldGVycycpO1xuICAgIGNvbnNvbGUubG9nKCdVc2FnZTpcXG4nLFxuICAgICAgJ3ZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRhcmdldFwiKTtcXG4nLFxuICAgICAgJ3ZhciB0ZW1wbGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGVtcGxhdGVcIikuaW5uZXJIVE1MO1xcbicsXG4gICAgICAndmFyIG1vZGVsID0gbGl0ZShvYmplY3QpO1xcbicsXG4gICAgICAnbGl0ZSh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7J1xuICAgICk7XG4gIH1cbn1cblxuLypcbiAqIEV4cG9ydCBzdHVmZlxuICpcbiAqIFRPRE86IHJlZmFjdG9ybWVcbiAqL1xubGl0ZS5SRV9OT0RFX0lEID0gL14jW1xcd1xcLlxcLV0rJC87XG5saXRlLlJFX0VORFNfV0lUSF9OT0RFX0lEID0gLy4rKCNbXFx3XFwuXFwtXSspJC87XG5cbmxpdGUucGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5saXRlLmNvbXBpbGUgPSByZXF1aXJlKCcuL2NvbXBpbGUnKTtcbmxpdGUudXRlbXBsYXRlID0gcmVxdWlyZSgnLi91dGVtcGxhdGUnKTtcbmxpdGUuX2dldCA9IGZ1bmN0aW9uKG1vZGVsLCBwcm9wKSB7XG4gIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSA/XG4gICAgSlNPTi5zdHJpbmdpZnkodmFsLnZhbHVlcykgOlxuICAgIHZhbDtcbn07XG5cblxuLypcbiAqIEV4cG9ydFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGxpdGU7XG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHdpbmRvdy5saXRlID0gbGl0ZTtcbiJdfQ==
