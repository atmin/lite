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

        prop: match,

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
            //debugger;
          }
          if (match[1]) {
            // Variable
            model.on('change', match[1], change);
          }
          fragment.appendChild(anchor);
          setTimeout(change);
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

},{"./compile":4,"./parse":5,"./utemplate":6,"freak":1}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwic3JjL2NvbXBpbGUtcnVsZXMtYXR0ci5qcyIsInNyYy9jb21waWxlLXJ1bGVzLW5vZGUuanMiLCJzcmMvY29tcGlsZS5qcyIsInNyYy9wYXJzZS5qcyIsInNyYy91dGVtcGxhdGUuanMiLCJzcmMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnJlYWsob2JqLCByb290LCBwYXJlbnQsIHByb3ApIHtcblxuICB2YXIgbGlzdGVuZXJzID0ge1xuICAgICdjaGFuZ2UnOiB7fSxcbiAgICAndXBkYXRlJzoge30sXG4gICAgJ2luc2VydCc6IHt9LFxuICAgICdkZWxldGUnOiB7fVxuICB9O1xuICB2YXIgX2RlcGVuZGVudFByb3BzID0ge307XG4gIHZhciBfZGVwZW5kZW50Q29udGV4dHMgPSB7fTtcbiAgdmFyIGNhY2hlID0ge307XG4gIHZhciBjaGlsZHJlbiA9IHt9O1xuXG4gIC8vIEFzc2VydCBjb25kaXRpb25cbiAgZnVuY3Rpb24gYXNzZXJ0KGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgdGhyb3cgbXNnIHx8ICdhc3NlcnRpb24gZmFpbGVkJztcbiAgICB9XG4gIH1cblxuICAvLyBNaXggcHJvcGVydGllcyBpbnRvIHRhcmdldFxuICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wZXJ0aWVzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtwcm9wc1tpXV0gPSBwcm9wZXJ0aWVzW3Byb3BzW2ldXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWVwRXF1YWwoeCwgeSkge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmXG4gICAgICAgIHR5cGVvZiB5ID09PSBcIm9iamVjdFwiICYmIHkgIT09IG51bGwpIHtcblxuICAgICAgaWYgKE9iamVjdC5rZXlzKHgpLmxlbmd0aCAhPT0gT2JqZWN0LmtleXMoeSkubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgcHJvcCBpbiB4KSB7XG4gICAgICAgIGlmICh4Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgaWYgKHkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIGlmICghZGVlcEVxdWFsKHhbcHJvcF0sIHlbcHJvcF0pKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmICh4ICE9PSB5KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBFdmVudCBmdW5jdGlvbnNcbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gWydzdHJpbmcnLCAnbnVtYmVyJ10uaW5kZXhPZih0eXBlb2YgYXJndW1lbnRzWzFdKSA+IC0xID9cbiAgICAgIGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuXG4gICAgLy8gQXJncyBjaGVja1xuICAgIGFzc2VydChbJ2NoYW5nZScsICd1cGRhdGUnLCAnaW5zZXJ0JywgJ2RlbGV0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEpO1xuICAgIGFzc2VydChcbiAgICAgIChbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCAhPT0gbnVsbCkgfHxcbiAgICAgIChbJ2luc2VydCcsICdkZWxldGUnLCAndXBkYXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wID09PSBudWxsKVxuICAgICk7XG5cbiAgICAvLyBJbml0IGxpc3RlbmVycyBmb3IgcHJvcFxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICAvLyBBbHJlYWR5IHJlZ2lzdGVyZWQ/XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjaykgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgb3Igc3BlY2lmaWVkIGxpc3RlbmVycyBnaXZlbiBldmVudCBhbmQgcHJvcGVydHlcbiAgZnVuY3Rpb24gb2ZmKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdzdHJpbmcnID8gYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG4gICAgdmFyIGk7XG5cbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBhbGwgcHJvcGVydHkgd2F0Y2hlcnM/XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFJlbW92ZSBzcGVjaWZpYyBjYWxsYmFja1xuICAgICAgaSA9IGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICBpZiAoaSA+IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0uc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICB9XG5cbiAgLy8gdHJpZ2dlcignY2hhbmdlJywgcHJvcClcbiAgLy8gdHJpZ2dlcigndXBkYXRlJywgcHJvcClcbiAgLy8gdHJpZ2dlcignaW5zZXJ0JyBvciAnZGVsZXRlJywgaW5kZXgsIGNvdW50KVxuICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBhLCBiKSB7XG4gICAgdmFyIGhhbmRsZXJzID0gKGxpc3RlbmVyc1tldmVudF1bWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xID8gYSA6IG51bGxdIHx8IFtdKTtcbiAgICB2YXIgaSwgbGVuID0gaGFuZGxlcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaGFuZGxlcnNbaV0uY2FsbChpbnN0YW5jZSwgYSwgYik7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4cG9ydCBtb2RlbCB0byBKU09OIHN0cmluZ1xuICAvLyBOT1QgZXhwb3J0ZWQ6XG4gIC8vIC0gcHJvcGVydGllcyBzdGFydGluZyB3aXRoIF8gKFB5dGhvbiBwcml2YXRlIHByb3BlcnRpZXMgY29udmVudGlvbilcbiAgLy8gLSBjb21wdXRlZCBwcm9wZXJ0aWVzIChkZXJpdmVkIGZyb20gbm9ybWFsIHByb3BlcnRpZXMpXG4gIGZ1bmN0aW9uIHRvSlNPTigpIHtcbiAgICBmdW5jdGlvbiBmaWx0ZXIob2JqKSB7XG4gICAgICB2YXIga2V5LCBmaWx0ZXJlZCA9IEFycmF5LmlzQXJyYXkob2JqKSA/IFtdIDoge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZmlsdGVyKG9ialtrZXldKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2tleV0gIT09ICdmdW5jdGlvbicgJiYga2V5WzBdICE9PSAnXycpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZpbHRlcihvYmopKTtcbiAgfVxuXG4gIC8vIExvYWQgbW9kZWwgZnJvbSBKU09OIHN0cmluZyBvciBvYmplY3RcbiAgZnVuY3Rpb24gZnJvbUpTT04oZGF0YSkge1xuICAgIHZhciBrZXk7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfVxuICAgIGZvciAoa2V5IGluIGRhdGEpIHtcbiAgICAgIGluc3RhbmNlKGtleSwgZGF0YVtrZXldKTtcbiAgICAgIHRyaWdnZXIoJ3VwZGF0ZScsIGtleSk7XG4gICAgfVxuICAgIGluc3RhbmNlLmxlbiA9IG9iai5sZW5ndGg7XG4gIH1cblxuICAvLyBVcGRhdGUgaGFuZGxlcjogcmVjYWxjdWxhdGUgZGVwZW5kZW50IHByb3BlcnRpZXMsXG4gIC8vIHRyaWdnZXIgY2hhbmdlIGlmIG5lY2Vzc2FyeVxuICBmdW5jdGlvbiB1cGRhdGUocHJvcCkge1xuICAgIGlmICghZGVlcEVxdWFsKGNhY2hlW3Byb3BdLCBnZXQocHJvcCwgZnVuY3Rpb24oKSB7fSwgdHJ1ZSkpKSB7XG4gICAgICB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgZGVwZW5kZW50c1xuICAgIGZvciAodmFyIGkgPSAwLCBkZXAgPSBfZGVwZW5kZW50UHJvcHNbcHJvcF0gfHwgW10sIGxlbiA9IGRlcC5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgZGVsZXRlIGNoaWxkcmVuW2RlcFtpXV07XG4gICAgICBfZGVwZW5kZW50Q29udGV4dHNbcHJvcF1baV0udHJpZ2dlcigndXBkYXRlJywgZGVwW2ldKTtcbiAgICB9XG5cbiAgICBpZiAoaW5zdGFuY2UucGFyZW50KSB7XG4gICAgICAvLyBOb3RpZnkgY29tcHV0ZWQgcHJvcGVydGllcywgZGVwZW5kaW5nIG9uIHBhcmVudCBvYmplY3RcbiAgICAgIGluc3RhbmNlLnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCBpbnN0YW5jZS5wcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBQcm94eSB0aGUgYWNjZXNzb3IgZnVuY3Rpb24gdG8gcmVjb3JkXG4gIC8vIGFsbCBhY2Nlc3NlZCBwcm9wZXJ0aWVzXG4gIGZ1bmN0aW9uIGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApIHtcbiAgICBmdW5jdGlvbiB0cmFja2VyKGNvbnRleHQpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbihfcHJvcCwgX2FyZykge1xuICAgICAgICBpZiAoIWNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSA9IFtdO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0uaW5kZXhPZihwcm9wKSA9PT0gLTEpIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0ucHVzaChwcm9wKTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0ucHVzaChpbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRleHQoX3Byb3AsIF9hcmcsIHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gdHJhY2tlcihpbnN0YW5jZSk7XG4gICAgY29uc3RydWN0KHJlc3VsdCk7XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgcmVzdWx0LnBhcmVudCA9IHRyYWNrZXIocGFyZW50KTtcbiAgICB9XG4gICAgcmVzdWx0LnJvb3QgPSB0cmFja2VyKHJvb3QgfHwgaW5zdGFuY2UpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBTaGFsbG93IGNsb25lIGFuIG9iamVjdFxuICBmdW5jdGlvbiBzaGFsbG93Q2xvbmUob2JqKSB7XG4gICAgdmFyIGtleSwgY2xvbmU7XG4gICAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgY2xvbmUgPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICBjbG9uZVtrZXldID0gb2JqW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY2xvbmUgPSBvYmo7XG4gICAgfVxuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIC8vIEdldHRlciBmb3IgcHJvcCwgaWYgY2FsbGJhY2sgaXMgZ2l2ZW5cbiAgLy8gY2FuIHJldHVybiBhc3luYyB2YWx1ZVxuICBmdW5jdGlvbiBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHZhbCA9IG9ialtwcm9wXTtcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFsID0gdmFsLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIGNhbGxiYWNrKTtcbiAgICAgIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgICAgY2FjaGVbcHJvcF0gPSAodmFsID09PSB1bmRlZmluZWQpID8gdmFsIDogc2hhbGxvd0Nsb25lKHZhbCk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKCFza2lwQ2FjaGluZykge1xuICAgICAgY2FjaGVbcHJvcF0gPSB2YWw7XG4gICAgfVxuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBmdW5jdGlvbiBnZXR0ZXIocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldChwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpO1xuXG4gICAgcmV0dXJuIHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0JyA/XG4gICAgICAvLyBXcmFwIG9iamVjdFxuICAgICAgY2hpbGRyZW5bcHJvcF0gP1xuICAgICAgICBjaGlsZHJlbltwcm9wXSA6XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdID0gZnJlYWsocmVzdWx0LCByb290IHx8IGluc3RhbmNlLCBpbnN0YW5jZSwgcHJvcCkgOlxuICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICByZXN1bHQ7XG4gIH1cblxuICAvLyBTZXQgcHJvcCB0byB2YWxcbiAgZnVuY3Rpb24gc2V0dGVyKHByb3AsIHZhbCkge1xuICAgIHZhciBvbGRWYWwgPSBnZXQocHJvcCk7XG5cbiAgICBpZiAodHlwZW9mIG9ialtwcm9wXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHkgc2V0dGVyXG4gICAgICBvYmpbcHJvcF0uY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgdmFsKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBTaW1wbGUgcHJvcGVydHlcbiAgICAgIG9ialtwcm9wXSA9IHZhbDtcbiAgICAgIGlmICh2YWwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZGVsZXRlIGNhY2hlW3Byb3BdO1xuICAgICAgICBkZWxldGUgY2hpbGRyZW5bcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9sZFZhbCAhPT0gdmFsKSB7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yLCB1bmlmeSBnZXR0ZXIgYW5kIHNldHRlclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcsIHNraXBDYWNoaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIChhcmcgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgIGdldHRlciA6IHNldHRlclxuICAgICkocHJvcCwgYXJnLCBza2lwQ2FjaGluZyk7XG4gIH1cblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBmdW5jdGlvbiBjb25zdHJ1Y3QodGFyZ2V0KSB7XG4gICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICB2YWx1ZXM6IG9iaixcbiAgICAgIHBhcmVudDogcGFyZW50IHx8IG51bGwsXG4gICAgICByb290OiByb290IHx8IHRhcmdldCxcbiAgICAgIHByb3A6IHByb3AgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBwcm9wLFxuICAgICAgLy8gLm9uKGV2ZW50WywgcHJvcF0sIGNhbGxiYWNrKVxuICAgICAgb246IG9uLFxuICAgICAgLy8gLm9mZihldmVudFssIHByb3BdWywgY2FsbGJhY2tdKVxuICAgICAgb2ZmOiBvZmYsXG4gICAgICAvLyAudHJpZ2dlcihldmVudFssIHByb3BdKVxuICAgICAgdHJpZ2dlcjogdHJpZ2dlcixcbiAgICAgIHRvSlNPTjogdG9KU09OLFxuICAgICAgLy8gRGVwcmVjYXRlZC4gSXQgaGFzIGFsd2F5cyBiZWVuIGJyb2tlbiwgYW55d2F5XG4gICAgICAvLyBXaWxsIHRoaW5rIGhvdyB0byBpbXBsZW1lbnQgcHJvcGVybHlcbiAgICAgIGZyb21KU09OOiBmcm9tSlNPTixcbiAgICAgIC8vIEludGVybmFsOiBkZXBlbmRlbmN5IHRyYWNraW5nXG4gICAgICBfZGVwZW5kZW50UHJvcHM6IF9kZXBlbmRlbnRQcm9wcyxcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0czogX2RlcGVuZGVudENvbnRleHRzXG4gICAgfSk7XG5cbiAgICAvLyBXcmFwIG11dGF0aW5nIGFycmF5IG1ldGhvZCB0byB1cGRhdGVcbiAgICAvLyBzdGF0ZSBhbmQgbm90aWZ5IGxpc3RlbmVyc1xuICAgIGZ1bmN0aW9uIHdyYXBBcnJheU1ldGhvZChtZXRob2QsIGZ1bmMpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdW21ldGhvZF0uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgICAgZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB0YXJnZXQucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIHRhcmdldC5wcm9wKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHByb3RvdHlwZSBhbHJlYWR5IGNvbnRhaW5zIGxlbmd0aFxuICAgICAgICAvLyBgbGVuYCBzcGVjaWZpZXMgYXJyYXkgbGVuZ3RoXG4gICAgICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgICAgICBwb3A6IHdyYXBBcnJheU1ldGhvZCgncG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgdGhpcy5sZW4sIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBwdXNoOiB3cmFwQXJyYXlNZXRob2QoJ3B1c2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCB0aGlzLmxlbiAtIDEsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICByZXZlcnNlOiB3cmFwQXJyYXlNZXRob2QoJ3JldmVyc2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzaGlmdDogd3JhcEFycmF5TWV0aG9kKCdzaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICB1bnNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3Vuc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc29ydDogd3JhcEFycmF5TWV0aG9kKCdzb3J0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc3BsaWNlOiB3cmFwQXJyYXlNZXRob2QoJ3NwbGljZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50cy5sZW5ndGggLSAyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uKCd1cGRhdGUnLCB1cGRhdGUpO1xuXG4gIC8vIENyZWF0ZSBmcmVhayBpbnN0YW5jZVxuICB2YXIgaW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gYWNjZXNzb3IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBjb25zdHJ1Y3QoaW5zdGFuY2UpO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ29tbW9uSlMgZXhwb3J0XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcpIG1vZHVsZS5leHBvcnRzID0gZnJlYWs7XG4iLCJ2YXIgUkVfREVMSU1JVEVEX1ZBUiA9IC9eXFx7XFx7KFtcXHdcXC5cXC1dKylcXH1cXH0kLztcblxuXG4vKlxuICogQXR0cmlidXRlIHJ1bGVzXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IFtcblxuICAvKipcbiAgICogdmFsdWU9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ3ZhbHVlJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gbGl0ZS5fZ2V0KG1vZGVsLCBwcm9wKTtcbiAgICAgICAgICAgIGlmIChub2RlW2F0dHJdICE9PSB2YWwpIHtcbiAgICAgICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyB0ZXh0IGlucHV0P1xuICAgICAgICAgIHZhciBldmVudFR5cGUgPSBbJ3RleHQnLCAncGFzc3dvcmQnXS5pbmRleE9mKG5vZGUudHlwZSkgPiAtMSA/XG4gICAgICAgICAgICAna2V5dXAnIDogJ2NoYW5nZSc7IC8vIElFOSBpbmNvcmVjdGx5IHJlcG9ydHMgaXQgc3VwcG9ydHMgaW5wdXQgZXZlbnRcblxuICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZVthdHRyXSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcblxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogc2VsZWN0ZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2xpdGUtc2VsZWN0ZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoc2VsZWN0c1VwZGF0aW5nW2ldKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwLCBsZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXVtqXS5zZWxlY3RlZCA9IHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtqXShwcm9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGUuc2VsZWN0ZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ09QVElPTicpIHtcblxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgPHNlbGVjdD4gdG8gbGlzdFxuICAgICAgICAgICAgICAgIGkgPSBzZWxlY3RzLnB1c2gobm9kZS5wYXJlbnROb2RlKSAtIDE7XG4gICAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zXG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9ucy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICAvLyBJbml0IG9wdGlvbnMgY29udGV4dHNcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoIGNoYW5nZSBsaXN0ZW5lclxuICAgICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGVjdHNVcGRhdGluZ1tpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBvaSA9IDAsIG9sZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgb2kgPCBvbGVuOyBvaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtvaV0ocHJvcCwgc2VsZWN0T3B0aW9uc1tpXVtvaV0uc2VsZWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc2VsZWN0c1VwZGF0aW5nW2ldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gUmVtZW1iZXIgb3B0aW9uIGFuZCBjb250ZXh0XG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBtb2RlbChwcm9wLCB0aGlzLnNlbGVjdGVkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGNoZWNrZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2xpdGUtY2hlY2tlZCcgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICBpZiAocmFkaW9Hcm91cHNVcGRhdGluZ1tub2RlLm5hbWVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGUuY2hlY2tlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICAgIGlmICghcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIC8vIEluaXQgcmFkaW8gZ3JvdXAgKFswXTogbm9kZSwgWzFdOiBtb2RlbClcbiAgICAgICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdID0gW1tdLCBbXV07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gQWRkIGlucHV0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgLy8gQWRkIGNvbnRleHQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGFsbCBpbnB1dHMgZnJvbSB0aGUgZ3JvdXBcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wLCByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZS5jaGVja2VkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgICAgc2V0VGltZW91dChjaGFuZ2UpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNldFRpbWVvdXQoaW5pdCk7XG4gICAgICAgIH1cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGF0dHJpYnV0ZT1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gbGl0ZS5fZ2V0KG1vZGVsLCBwcm9wKTtcbiAgICAgICAgICAgIHJldHVybiB2YWwgP1xuICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyLCB2YWwpIDpcbiAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBGYWxsYmFjayBydWxlLCBwcm9jZXNzIHZpYSBAc2VlIHV0ZW1wbGF0ZVxuICAgKiBTdHJpcCBsaXRlLSBwcmVmaXhcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcHJvcDogbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ciksXG4gICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuICAgICAgICB2YXIgYXR0ck5hbWUgPSBhdHRyLnJlcGxhY2UoJ2xpdGUtJywgJycpO1xuICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICBhdHRyTmFtZSxcbiAgICAgICAgICAgIGxpdGUudXRlbXBsYXRlKHByb3AsIG1vZGVsLCBjaGFuZ2UpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjaGFuZ2UoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbl07XG4iLCIvKlxuICogTm9kZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoganNoaW50IGV2aWw6IHRydWUgKi9cblxuXG5cblxuICAvKipcbiAgICoge3t2YXJ9fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIGlmIChub2RlLmlubmVySFRNTC5tYXRjaCgvXltcXHdcXC5cXC1dKyQvKSkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG5vZGUuaW5uZXJIVE1MLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuICAgICAgICAgIHZhciB0ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGxpdGUuX2dldChtb2RlbCwgcHJvcCkgfHwgJycpO1xuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRleHROb2RlKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5kYXRhID0gbGl0ZS5fZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7JnZhcn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14mKFtcXHdcXC5cXC1dKykkLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnLmFwcGVuZENoaWxkKGVsLmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGZyYWcsIGFuY2hvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3s+cGFydGlhbH19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3VibGUtcXVvdGVkXCJcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvPihbXFx3XFwuXFwtXSspfCcoW15cXCddKilcXCd8XCIoW15cIl0qKVwiLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2gsXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBtYXRjaCkge1xuXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIHZhciB0YXJnZXQ7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgICB0YXJnZXQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpdGUoXG4gICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgbWF0Y2hbMV0gP1xuICAgICAgICAgICAgICAgIC8vIFZhcmlhYmxlXG4gICAgICAgICAgICAgICAgbW9kZWwobWF0Y2hbMV0pIDpcbiAgICAgICAgICAgICAgICAvLyBMaXRlcmFsXG4gICAgICAgICAgICAgICAgbWF0Y2hbMl0gfHwgbWF0Y2hbM10sXG4gICAgICAgICAgICAgIG1vZGVsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9kZWJ1Z2dlcjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG1hdGNoWzFdLCBjaGFuZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7I3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eIyhbXFx3XFwuXFwtXSspJC8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgYmxvY2s6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCwgdGVtcGxhdGUpIHtcblxuICAgICAgICAgIC8vIEFuY2hvciBub2RlIGZvciBrZWVwaW5nIHNlY3Rpb24gbG9jYXRpb25cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgLy8gTnVtYmVyIG9mIHJlbmRlcmVkIG5vZGVzXG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG4gICAgICAgICAgLy8gSG93IG1hbnkgY2hpbGROb2RlcyBpbiBvbmUgc2VjdGlvbiBpdGVtXG4gICAgICAgICAgdmFyIGNodW5rU2l6ZTtcblxuICAgICAgICAgIGZ1bmN0aW9uIHVwZGF0ZShpKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpICogY2h1bmtTaXplO1xuICAgICAgICAgICAgICB2YXIgc2l6ZSA9IGNodW5rU2l6ZTtcbiAgICAgICAgICAgICAgdmFyIGFyciA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG5cbiAgICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChwYXJlbnQuY2hpbGROb2Rlc1twb3NdKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKFxuICAgICAgICAgICAgICAgIGV2YWwodGVtcGxhdGUgKyAnKGFycihpKSknKSxcbiAgICAgICAgICAgICAgICBwYXJlbnQuY2hpbGROb2Rlc1twb3NdXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGluc2VydChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBpLCBmcmFnbWVudDtcbiAgICAgICAgICAgIHZhciBhcnIgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgICAgICBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyhhcnIoaW5kZXggKyBpKSknKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoICsgc2l6ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBzaXplID0gY291bnQgKiBjaHVua1NpemU7XG5cbiAgICAgICAgICAgIGxlbmd0aCA9IGxlbmd0aCAtIHNpemU7XG5cbiAgICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygncmVuZGVyaW5nICcgKyB2YWwubGVuICsgJyB2YWx1ZXMnKTtcbiAgICAgICAgICAgICAgdmFyIGZ1bmMgPSBldmFsKHRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgdmFyIGNoaWxkLCBjaGlsZE1vZGVsO1xuICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB2YWwudmFsdWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IGV2ZW50IGRlbGVnYXRpb24gZm9yIGFycmF5IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAvLyBBbHNvLCB1c2luZyB2YWwudmFsdWVzW2ldIGluc3RlYWQgb2YgdmFsW2ldXG4gICAgICAgICAgICAgICAgLy8gc2F2ZXMgQSBMT1Qgb2YgaGVhcCBtZW1vcnkuIEZpZ3VyZSBvdXQgaG93IHRvIGRvXG4gICAgICAgICAgICAgICAgLy8gb24gZGVtYW5kIG1vZGVsIGNyZWF0aW9uLlxuICAgICAgICAgICAgICAgIHZhbC5vbignY2hhbmdlJywgaSwgdXBkYXRlKGkpKTtcbiAgICAgICAgICAgICAgICAvL3JlbmRlci5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyh2YWwoaSkpJykpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGZ1bmModmFsLnZhbHVlc1tpXSkpO1xuICAgICAgICAgICAgICAgIGNoaWxkTW9kZWwgPSB2YWwoaSk7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBmdW5jKGNoaWxkTW9kZWwpO1xuICAgICAgICAgICAgICAgIGNoaWxkLl9fbGl0ZV9fID0gY2hpbGRNb2RlbDtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICBjaHVua1NpemUgPSB+fihsZW5ndGggLyBsZW4pO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPYmplY3Q/XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyh2YWwpJyk7XG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgY2h1bmtTaXplID0gbGVuZ3RoO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5fX2xpdGVfXyA9IG1vZGVsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoISF2YWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyhtb2RlbCknKTtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY2h1bmtTaXplID0gbGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuXG4gIC8qKlxuICAgKiB7e15pbnZlcnRlZF9zZWN0aW9ufX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXlxcXihbXFx3XFwuXFwtXSspJC8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgYmxvY2s6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCwgdGVtcGxhdGUpIHtcblxuICAgICAgICAgIC8vIEFuY2hvciBub2RlIGZvciBrZWVwaW5nIHNlY3Rpb24gbG9jYXRpb25cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgLy8gTnVtYmVyIG9mIHJlbmRlcmVkIG5vZGVzXG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGNoYW5nZSk7XG4gICAgICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgIGlmICh2YWwubGVuID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKHZhbChpKSknKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgfVxuXG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuICAvKlxuICAgKiBGYWxsYmFjayBydWxlLCBub3QgcmVjb2duaXplZCBsaXRlIHRhZ1xuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiB7XG4gICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnUkVNT1ZFTUVMQVRFUicpKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5dO1xuIiwiLyoqXG4gKiBDb21waWxlIGEgdGVtcGxhdGUsIHBhcnNlZCBieSBAc2VlIHBhcnNlXG4gKlxuICogQHBhcmFtIHtkb2N1bWVudEZyYWdtZW50fSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtzdHJpbmd8dW5kZWZpbmVkfSBzb3VyY2VVUkwgLSBpbmNsdWRlIHNvdXJjZVVSTCB0byBhaWQgZGVidWdnaW5nXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBGdW5jdGlvbiBib2R5LCBhY2NlcHRpbmcgRnJlYWsgaW5zdGFuY2UgcGFyYW1ldGVyLCBzdWl0YWJsZSBmb3IgZXZhbCgpXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHNvdXJjZVVSTCwgZGVwdGgpIHtcblxuICB2YXIgcmksIHJ1bGVzLCBybGVuO1xuICB2YXIgbWF0Y2gsIGJsb2NrO1xuXG4gIC8vIEdlbmVyYXRlIGR5bmFtaWMgZnVuY3Rpb24gYm9keVxuICB2YXIgZnVuYyA9ICcoZnVuY3Rpb24obW9kZWwpIHtcXG4nICtcbiAgICAndmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIG5vZGU7XFxuXFxuJztcblxuICBpZiAoIWRlcHRoKSB7XG4gICAgLy8gR2xvYmFsIGJvb2trZWVwaW5nXG4gICAgZnVuYyArPVxuICAgICAgJ3ZhciByYWRpb0dyb3VwcyA9IHt9O1xcbicgK1xuICAgICAgJ3ZhciByYWRpb0dyb3Vwc1VwZGF0aW5nID0ge307XFxuJyArXG4gICAgICAndmFyIHNlbGVjdHMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0c1VwZGF0aW5nID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdE9wdGlvbnMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9uc0NvbnRleHRzID0gW107XFxuXFxuJztcbiAgfVxuXG4gIC8vIFdyYXAgbW9kZWwgaW4gYSBGcmVhayBpbnN0YW5jZSwgaWYgbmVjZXNzYXJ5XG4gIGZ1bmMgKz0gJ21vZGVsID0gdHlwZW9mIG1vZGVsID09PSBcImZ1bmN0aW9uXCIgPycgK1xuICAgICdtb2RlbCA6ICcgK1xuICAgICd0eXBlb2YgbW9kZWwgPT09IFwib2JqZWN0XCIgPycgK1xuICAgICAgJ2xpdGUobW9kZWwpIDonICtcbiAgICAgICdsaXRlKHtcIi5cIjogbW9kZWx9KTtcXG5cXG4nO1xuXG4gIC8vIEl0ZXJhdGUgY2hpbGROb2Rlc1xuICBmb3IgKHZhciBpID0gMCwgY2hpbGROb2RlcyA9IHRlbXBsYXRlLmNoaWxkTm9kZXMsIGxlbiA9IGNoaWxkTm9kZXMubGVuZ3RoLCBub2RlO1xuICAgICAgIGkgPCBsZW47IGkrKykge1xuXG4gICAgbm9kZSA9IGNoaWxkTm9kZXNbaV07XG5cbiAgICBzd2l0Y2ggKG5vZGUubm9kZVR5cGUpIHtcblxuICAgICAgLy8gRWxlbWVudCBub2RlXG4gICAgICBjYXNlIDE6XG5cbiAgICAgICAgLy8gbGl0ZSB0YWc/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnU0NSSVBUJyAmJiBub2RlLnR5cGUgPT09ICd0ZXh0L2xpdGUtdGFnJykge1xuXG4gICAgICAgICAgZm9yIChyaSA9IDAsIHJ1bGVzID0gcmVxdWlyZSgnLi9jb21waWxlLXJ1bGVzLW5vZGUnKSwgcmxlbiA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgcmkgPCBybGVuOyByaSsrKSB7XG5cbiAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUpO1xuXG4gICAgICAgICAgICAvLyBSdWxlIGZvdW5kP1xuICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgICAgICAgLy8gQmxvY2sgdGFnP1xuICAgICAgICAgICAgICBpZiAobWF0Y2guYmxvY2spIHtcblxuICAgICAgICAgICAgICAgIC8vIEZldGNoIGJsb2NrIHRlbXBsYXRlXG4gICAgICAgICAgICAgICAgYmxvY2sgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICAgICAgZm9yIChpKys7XG4gICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJiAhbWF0Y2hFbmRCbG9jayhtYXRjaC5ibG9jaywgY2hpbGROb2Rlc1tpXS5pbm5lckhUTUwgfHwgJycpO1xuICAgICAgICAgICAgICAgICAgICBpKyspIHtcbiAgICAgICAgICAgICAgICAgIGJsb2NrLmFwcGVuZENoaWxkKGNoaWxkTm9kZXNbaV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgICB0aHJvdyAnbGl0ZTogVW5jbG9zZWQgJyArIG1hdGNoLmJsb2NrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArXG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG1hdGNoLmJsb2NrKSArICcsICcgKyAgIC8vIHByb3BcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgICAgICAgICAgICAgLy8gdGVtcGxhdGVcbiAgICAgICAgICAgICAgICAgICAgICBjb21waWxlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VVUkwgJiYgKHNvdXJjZVVSTCArICctJyArIG5vZGUuaW5uZXJIVE1MICsgJ1snICsgaSArICddJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAoZGVwdGggfHwgMCkgKyAxXG4gICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICApICsgJyk7JztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBJbmxpbmUgdGFnXG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICcoZnJhZywgbW9kZWwsICcgKyBKU09OLnN0cmluZ2lmeShtYXRjaC5wcm9wKSArICcpO1xcbic7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBTa2lwIHJlbWFpbmluZyBydWxlc1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IC8vIGVuZCBpdGVyYXRpbmcgbm9kZSBydWxlc1xuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGVsZW1lbnRcbiAgICAgICAgICBmdW5jICs9ICdub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIicgKyBub2RlLm5vZGVOYW1lICsgJ1wiKTtcXG4nO1xuXG4gICAgICAgICAgLy8gUHJvY2VzcyBhdHRyaWJ1dGVzXG4gICAgICAgICAgZm9yICh2YXIgYWkgPSAwLCBhdHRyaWJ1dGVzID0gbm9kZS5hdHRyaWJ1dGVzLCBhbGVuID0gYXR0cmlidXRlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICBhaSA8IGFsZW47IGFpKyspIHtcblxuICAgICAgICAgICAgZm9yIChyaSA9IDAsIHJ1bGVzID0gcmVxdWlyZSgnLi9jb21waWxlLXJ1bGVzLWF0dHInKSwgcmxlbiA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICByaSA8IHJsZW47IHJpKyspIHtcblxuICAgICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlLCBhdHRyaWJ1dGVzW2FpXS5uYW1lLnRvTG93ZXJDYXNlKCkpO1xuXG4gICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgICAgLy8gTWF0Y2ggZm91bmQsIGFwcGVuZCBydWxlIHRvIGZ1bmNcbiAgICAgICAgICAgICAgICBmdW5jICs9ICcoJyArIG1hdGNoLnJ1bGUudG9TdHJpbmcoKSArICcpJyArXG4gICAgICAgICAgICAgICAgICAnKG5vZGUsICcgK1xuICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYXR0cmlidXRlc1thaV0ubmFtZSkgKyAvLyBhdHRyXG4gICAgICAgICAgICAgICAgICAnLCBtb2RlbCwgJyArXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShtYXRjaC5wcm9wKSArICAgICAgICAgIC8vIHByb3BcbiAgICAgICAgICAgICAgICAgICcpO1xcbic7XG5cbiAgICAgICAgICAgICAgICAvLyBTa2lwIG90aGVyIGF0dHJpYnV0ZSBydWxlc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgIT09ICdJTlBVVCcpIHtcbiAgICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBpbGVcbiAgICAgICAgICAgIGZ1bmMgKz0gJ25vZGUuYXBwZW5kQ2hpbGQoJyArXG4gICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5ub2RlTmFtZSArICdbJyArIGkgKyAnXScpLFxuICAgICAgICAgICAgKGRlcHRoIHx8IDApICsgMVxuICAgICAgICAgICAgKSArICcobW9kZWwpKTtcXG4nO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFwcGVuZCB0byBmcmFnbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgY2FzZSAzOlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG5vZGUuZGF0YSkgKyAnKSk7XFxuJztcbiAgICAgICAgYnJlYWs7XG5cblxuICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICBjYXNlIDg6XG4gICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpO1xcbic7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgfSAvLyBlbmQgc3dpdGNoXG4gIH0gLy8gZW5kIGl0ZXJhdGUgY2hpbGROb2Rlc1xuXG4gIGZ1bmMgKz0gJ3JldHVybiBmcmFnOyB9KSc7XG4gIGZ1bmMgKz0gc291cmNlVVJMID9cbiAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc291cmNlVVJMICsgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNvdXJjZVVSTCArICdcXG4nIDpcbiAgICAnJztcblxuICByZXR1cm4gZnVuYztcbn1cblxuXG5cblxuZnVuY3Rpb24gbWF0Y2hFbmRCbG9jayhibG9jaywgc3RyKSB7XG4gIHZhciBtYXRjaCA9IHN0ci5tYXRjaCgvXlxcLyhbXFx3XFwuXFwtXSspPyQvKTtcbiAgcmV0dXJuIG1hdGNoID9cbiAgICBibG9jayA9PT0gJycgfHwgIW1hdGNoWzFdIHx8IG1hdGNoWzFdID09PSBibG9jayA6XG4gICAgZmFsc2U7XG59XG5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcGlsZTtcbiIsIi8qKlxuICogUGFyc2UgYSB0ZXh0IHRlbXBsYXRlIHRvIERPTSBzdHJ1Y3R1cmUgcmVhZHkgZm9yIGNvbXBpbGluZ1xuICogQHNlZSBjb21waWxlXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlXG4gKlxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cbmZ1bmN0aW9uIHBhcnNlKHRlbXBsYXRlKSB7XG5cbiAgdmFyIGlmcmFtZSwgYm9keTtcblxuICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlKSB7XG5cbiAgICAvLyByZXBsYWNlIHt7e3RhZ319fSB3aXRoIHt7JnRhZ319XG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKC9cXHtcXHtcXHsoW1xcU1xcc10qPylcXH1cXH1cXH0vZywgJ3t7JiQxfX0nKTtcblxuICAgIC8vIDEuIHdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2xpdGUtdGFnXCI+XG4gICAgLy8gMi4gcmVtb3ZlIE11c3RhY2hlIGNvbW1lbnRzXG4gICAgLy8gVE9ETzogaGFuZGxlIHRhZ3MgaW4gSFRNTCBjb21tZW50c1xuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC9cXHtcXHsoW1xcU1xcc10qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICB2YXIgaGVhZCA9IHRlbXBsYXRlLnNsaWNlKDAsIHBvcyk7XG4gICAgICAgIHZhciBpbnNpZGVUYWcgPSAhIWhlYWQubWF0Y2goLzxbXFx3XFwtXStbXj5dKj8kLyk7XG4gICAgICAgIHZhciBvcGVuaW5nID0gaGVhZC5tYXRjaCgvPChzY3JpcHR8U0NSSVBUKS9nKTtcbiAgICAgICAgdmFyIGNsb3NpbmcgPSBoZWFkLm1hdGNoKC88XFwvKHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgaW5zaWRlU2NyaXB0ID1cbiAgICAgICAgICAgIChvcGVuaW5nICYmIG9wZW5pbmcubGVuZ3RoIHx8IDApID4gKGNsb3NpbmcgJiYgY2xvc2luZy5sZW5ndGggfHwgMCk7XG4gICAgICAgIHZhciBpbnNpZGVDb21tZW50ID0gISFoZWFkLm1hdGNoKC88IS0tXFxzKiQvKTtcbiAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICByZXR1cm4gaW5zaWRlVGFnIHx8IGluc2lkZUNvbW1lbnQgP1xuICAgICAgICAgIGlzTXVzdGFjaGVDb21tZW50ID9cbiAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICBpbnNpZGVTY3JpcHQgP1xuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgJzxzY3JpcHQgdHlwZT1cInRleHQvbGl0ZS10YWdcIj4nICsgbWF0Y2gxLnRyaW0oKSArICdcXHgzQy9zY3JpcHQ+JztcbiAgICAgIH1cbiAgICApO1xuICAgIC8vIHByZWZpeCAnc2VsZWN0ZWQnIGFuZCAnY2hlY2tlZCcgYXR0cmlidXRlcyB3aXRoICdsaXRlLSdcbiAgICAvLyAodG8gYXZvaWQgXCJzcGVjaWFsXCIgcHJvY2Vzc2luZywgb2ggSUU4KVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/Om9wdGlvbnxPUFRJT04pW14+XSo/KSg/OnNlbGVjdGVkfFNFTEVDVEVEKT0vZyxcbiAgICAgICckMWxpdGUtc2VsZWN0ZWQ9Jyk7XG5cbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzppbnB1dHxJTlBVVClbXj5dKj8pKD86Y2hlY2tlZHxDSEVDS0VEKT0vZyxcbiAgICAgICckMWxpdGUtY2hlY2tlZD0nKTtcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIHRlbXBsYXRlID0gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSk7XG4gIGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gIGJvZHkuaW5uZXJIVE1MID0gdGVtcGxhdGU7XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiLyoqXG4gKiB1dGVtcGxhdGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1vZGVsIC0gZGF0YSBhcyBGcmVhayBpbnN0YW5jZVxuICogQHBhcmFtIHtvcHRpb25hbCBmdW5jdGlvbn0gb25DaGFuZ2UgLSB3aWxsIGJlIGNhbGxlZCB3aGVuZXZlciB1c2VkIG1vZGVsIHByb3BlcnR5IGNoYW5nZXNcbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHJlbmRlcmVkIHRlbXBsYXRlIHVzaW5nIG1vZGVsXG4gKlxuICogQmFzaWMgdGVtcGxhdGUgcmVuZGVyaW5nLlxuICogU3VwcG9ydGVkIHRhZ3M6IHt7dmFyaWFibGV9fSwge3sjc2VjdGlvbn19LCB7e15pbnZlcnRlZF9zZWN0aW9ufX1cbiAqIChzaG9ydCBjbG9zaW5nIHRhZ3Mge3svfX0gc3VwcG9ydGVkKVxuICpcbiAqIERvZXMgTk9UIHN1cHBvcnQgbmVzdGVkIHNlY3Rpb25zLCBzbyBzaW1wbGUgcGFyc2luZyB2aWEgcmVnZXggaXMgcG9zc2libGUuXG4gKi9cbmZ1bmN0aW9uIHV0ZW1wbGF0ZSh0ZW1wbGF0ZSwgbW9kZWwsIG9uQ2hhbmdlKSB7XG4gIHJldHVybiB0ZW1wbGF0ZVxuICAgIC8vIHt7I3NlY3Rpb259fSBzZWN0aW9uQm9keSB7ey99fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyMoW1xcd1xcLlxcLV0rKVxcfVxcfSguKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgb3BlblRhZywgYm9keSwgY2xvc2VUYWcsIHBvcykge1xuICAgICAgICBpZiAoY2xvc2VUYWcgIT09ICcnICYmIGNsb3NlVGFnICE9PSBvcGVuVGFnKSB7XG4gICAgICAgICAgdGhyb3cgJ2xpdGU6IFVuY2xvc2VkICcgKyBvcGVuVGFnO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb25DaGFuZ2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgb3BlblRhZywgb25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB2YWwgPSBvcGVuVGFnID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKG9wZW5UYWcpO1xuICAgICAgICByZXR1cm4gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSA/XG4gICAgICAgICAgICAvLyBBcnJheVxuICAgICAgICAgICAgKHZhbC5sZW4gPiAwKSA/XG4gICAgICAgICAgICAgIC8vIE5vbi1lbXB0eVxuICAgICAgICAgICAgICB2YWwudmFsdWVzXG4gICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlbCwgaSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHV0ZW1wbGF0ZShib2R5LnJlcGxhY2UoL1xce1xce1xcLlxcfVxcfS9nLCAne3snICsgaSArICd9fScpLCB2YWwsIG9uQ2hhbmdlKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5qb2luKCcnKSA6XG4gICAgICAgICAgICAgIC8vIEVtcHR5XG4gICAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIC8vIE9iamVjdCBvciBib29sZWFuP1xuICAgICAgICAgICAgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSA/XG4gICAgICAgICAgICAgIC8vIE9iamVjdFxuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgdmFsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgICAgKCEhdmFsKSA/XG4gICAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIG1vZGVsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAgICcnO1xuICAgICAgfVxuICAgIClcbiAgICAvLyB7e15pbnZlcnRlZF9zZWN0aW9ufX0gc2VjdGlvbkJvZHkge3svfX1cbiAgICAucmVwbGFjZShcbiAgICAgIC9cXHtcXHtcXF4oW1xcd1xcLlxcLV0rKVxcfVxcfSguKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgb3BlblRhZywgYm9keSwgY2xvc2VUYWcsIHBvcykge1xuICAgICAgICBpZiAoY2xvc2VUYWcgIT09ICcnICYmIGNsb3NlVGFnICE9PSBvcGVuVGFnKSB7XG4gICAgICAgICAgdGhyb3cgJ2xpdGU6IFVuY2xvc2VkICcgKyBvcGVuVGFnO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb25DaGFuZ2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgb3BlblRhZywgb25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB2YWwgPSBvcGVuVGFnID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKG9wZW5UYWcpO1xuICAgICAgICByZXR1cm4gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSA/XG4gICAgICAgICAgICAvLyBBcnJheVxuICAgICAgICAgICAgKHZhbC5sZW4gPT09IDApID9cbiAgICAgICAgICAgICAgLy8gRW1wdHlcbiAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIG1vZGVsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAvLyBOb24tZW1wdHlcbiAgICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICAoIXZhbCkgP1xuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgbW9kZWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgICcnO1xuICAgICAgfVxuICAgIClcbiAgICAvLyB7e3ZhcmlhYmxlfX1cbiAgICAucmVwbGFjZShcbiAgICAgIC9cXHtcXHsoW1xcd1xcLlxcLV0rKVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIHZhcmlhYmxlLCBwb3MpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvbkNoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCB2YXJpYWJsZSwgb25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtb2RlbCh2YXJpYWJsZSkgPT09IHVuZGVmaW5lZCA/ICcnIDogbW9kZWwodmFyaWFibGUpICsgJyc7XG4gICAgICB9XG4gICAgKTtcbn1cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gdXRlbXBsYXRlO1xuIiwiLypcbiAqIE1haW4gZnVuY3Rpb25cbiAqL1xuLyoganNoaW50IGV2aWw6IHRydWUgKi9cbmZ1bmN0aW9uIGxpdGUoKSB7XG4gIHZhciBSRV9OT0RFX0lEID0gL14jW1xcd1xcLlxcLV0rJC87XG4gIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gIGZ1bmN0aW9uIGhhc2hjb2RlKHMpIHtcbiAgICB2YXIgaGFzaCA9IDAsIGksIGNociwgbGVuO1xuICAgIGlmIChzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGhhc2g7XG4gICAgZm9yIChpID0gMCwgbGVuID0gcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY2hyID0gcy5jaGFyQ29kZUF0KGkpO1xuICAgICAgaGFzaCA9ICgoaGFzaCA8PCA1KSAtIGhhc2gpICsgY2hyO1xuICAgICAgaGFzaCB8PSAwOyAvLyBDb252ZXJ0IHRvIDMyYml0IGludGVnZXJcbiAgICB9XG4gICAgcmV0dXJuIGhhc2g7XG4gIH1cblxuICAvLyBsaXRlKG9iamVjdCk/XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyByZXR1cm4gRnJlYWsgaW5zdGFuY2VcbiAgICByZXR1cm4gcmVxdWlyZSgnZnJlYWsnKShhcmdzWzBdKTtcbiAgfVxuXG4gIC8vIGxpdGUoJyN0YXJnZXQnKT9cbiAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMF0ubWF0Y2goUkVfTk9ERV9JRCkpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKS5fX2xpdGVfXztcbiAgfVxuXG4gIC8vIGxpdGUoRE9NRWxlbWVudCk/XG4gIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIGFyZ3NbMF0ubm9kZVR5cGUpIHtcbiAgICByZXR1cm4gYXJnc1swXS5fX2xpdGVfXztcbiAgfVxuXG4gIC8vIGxpdGUodGVtcGxhdGUpP1xuICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YXIgdGVtcGxhdGUgPSBsaXRlLnBhcnNlKGFyZ3NbMF0pO1xuICAgIHJldHVybiBsaXRlLmNvbXBpbGUodGVtcGxhdGUsICdsaXRlLScgKyBoYXNoY29kZSh0ZW1wbGF0ZSkpO1xuICB9XG5cbiAgLy8gbGl0ZSh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk/XG4gIGVsc2UgaWYgKFxuICAgIChhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUpICYmXG4gICAgKHR5cGVvZiBhcmdzWzFdID09PSAnc3RyaW5nJykgJiZcbiAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdmdW5jdGlvbicpXG4gICkge1xuICAgIC8vIEVtcHR5IHRhcmdldFxuICAgIGFyZ3NbMF0uaW5uZXJIVE1MID0gJyc7XG5cbiAgICAvLyBBc3NpZ24gY29tcGlsZWQgdGVtcGxhdGVcbiAgICBhcmdzWzBdLmFwcGVuZENoaWxkKFxuICAgICAgZXZhbChcbiAgICAgICAgbGl0ZShcbiAgICAgICAgICBhcmdzWzFdLm1hdGNoKFJFX05PREVfSUQpID9cbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1sxXSkuaW5uZXJIVE1MIDpcbiAgICAgICAgICAgIGFyZ3NbMV1cbiAgICAgICAgKSArICcoYXJnc1syXSknXG4gICAgICApXG4gICAgKTtcblxuICAgIC8vIFN0b3JlIG1vZGVsIHJlZmVyZW5jZVxuICAgIGFyZ3NbMF0uX19saXRlX18gPSBhcmdzWzJdO1xuICB9XG5cbiAgZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignbGl0ZSBjYWxsZWQgd2l0aCBpbnZhbGlkIHBhcmFtZXRlcnM6JywgYXJncyk7XG4gICAgY29uc29sZS5sb2cobmV3IEVycm9yKCkuc3RhY2spO1xuICAgIGNvbnNvbGUubG9nKCdVc2FnZTpcXG4nLFxuICAgICAgJ3ZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRhcmdldFwiKTtcXG4nLFxuICAgICAgJ3ZhciB0ZW1wbGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGVtcGxhdGVcIikuaW5uZXJIVE1MO1xcbicsXG4gICAgICAndmFyIG1vZGVsID0gbGl0ZShvYmplY3QpO1xcbicsXG4gICAgICAnbGl0ZSh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7J1xuICAgICk7XG4gIH1cbn1cblxuLypcbiAqIEV4cG9ydCBzdHVmZlxuICpcbiAqL1xuXG5saXRlLnBhcnNlID0gcmVxdWlyZSgnLi9wYXJzZScpO1xubGl0ZS5jb21waWxlID0gcmVxdWlyZSgnLi9jb21waWxlJyk7XG5saXRlLnV0ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdXRlbXBsYXRlJyk7XG5saXRlLl9nZXQgPSBmdW5jdGlvbihtb2RlbCwgcHJvcCkge1xuICB2YXIgdmFsID0gbW9kZWwocHJvcCk7XG4gIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgIEpTT04uc3RyaW5naWZ5KHZhbC52YWx1ZXMpIDpcbiAgICB2YWw7XG59O1xuXG5cbi8qXG4gKiBFeHBvcnRcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBsaXRlO1xuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB3aW5kb3cubGl0ZSA9IGxpdGU7XG4iXX0=
