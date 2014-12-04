/**
 * Copyright (c) 2014 EclipseSource.
 * All rights reserved.
 */

(function() {

  tabris.Proxy = function(id) {
    this.id = id || generateId();
    tabris._proxies[this.id] = this;
  };

  util.extend(tabris.Proxy.prototype, tabris.Events, {

    _create: function(properties) {
      var type = this.constructor._type || this.type;
      tabris._nativeBridge.create(this.id, type);
      if (this.constructor && this.constructor._internalProperties) {
        for (var name in this.constructor._internalProperties) {
          this._setPropertyNative(name, this.constructor._internalProperties[name]);
        }
      }
      this._setProperties(properties);
      return this;
    },

    append: function() {
      this._checkDisposed();
      for (var i = 0; i < arguments.length; i++) {
        if (!(arguments[i] instanceof tabris.Proxy)) {
          throw new Error("Cannot append non-widget");
        }
        arguments[i]._setParent(this);
      }
      return this;
    },

    appendTo: function(proxy) {
      this._checkDisposed();
      if (!(proxy instanceof tabris.Proxy)) {
        throw new Error("Cannot append to non-widget");
      }
      this._setParent(proxy);
      return this;
    },

    get: function(name) {
      this._checkDisposed();
      return this._getProperty(name);
    },

    set: function(arg1, arg2) {
      this._checkDisposed();
      if (typeof arg1 === "string") {
        this._setProperty(arg1, arg2);
      } else {
        this._setProperties(arg1);
      }
      return this;
    },

    animate: function(properties, options) {
      tabris.Animation.animate(this, properties, options);
    },

    call: function(method, parameters) {
      this._checkDisposed();
      return tabris._nativeBridge.call(this.id, method, parameters);
    },

    on: function(event, listener, context) {
      this._checkDisposed();
      var wasListening = this._isListening(event);
      tabris.Events.on.call(this, event, listener, context);
      if (!wasListening) {
        this._listen(event, true);
      }
      return this;
    },

    off: function(event, listener, context) {
      this._checkDisposed();
      tabris.Events.off.call(this, event, listener, context);
      if (!this._isListening(event)) {
        this._listen(event, false);
      }
      return this;
    },

    dispose: function() {
      if (!this._isDisposed) {
        this._destroy();
        tabris._nativeBridge.destroy(this.id);
        if (this._parent) {
          this._parent._removeChild(this);
        }
        this._isDisposed = true;
      }
    },

    parent: function() {
      return this._parent;
    },

    children: function() {
      return new tabris.ProxyCollection(this._children || []);
    },

    _listen: function(event, state) {
      var listen = this.constructor && this.constructor._listen && this.constructor._listen[event];
      if (!listen) {
        console.info(this.type + ": Unknown event type " + event);
      } else if (typeof listen === "string") {
        this._nativeListen(listen, state);
      } else if (listen instanceof Function) {
        listen.call(this, state);
      } else {
        this._nativeListen(event, state);
      }
    },

    _nativeListen: function(event, state) {
      tabris._nativeBridge.listen(this.id, event, state);
    },

    _trigger: function(event, params) {
      // TODO: all these && pre-checks can be removed once no one uses new tabris.Proxy anymore
      var trigger = this.constructor && this.constructor._trigger && this.constructor._trigger[event];
      if (trigger instanceof Function) {
        trigger.call(this, params);
      } else if (typeof trigger === "string") {
        this.trigger(trigger, params);
      } else {
        this.trigger(event, params);
      }
    },

    _destroy: function() {
      this.trigger("dispose", {});
      this._destroyChildren();
      tabris.Events.off.call(this);
      delete tabris._proxies[this.id];
    },

    _destroyChildren: function() {
      if (this._children) {
        for (var i = 0; i < this._children.length; i++) {
          this._children[i]._destroy();
        }
      }
    },

    _addChild: function(child) {
      var check = this.constructor && this.constructor._supportsChildren;
      if (check === false) {
        throw new Error(this.type + " cannot contain children");
      }
      if (typeof check === "function" && !check(child)) {
        throw new Error(this.type + " cannot contain children of type " + child.type);
      }
      if (!this._children) {
        this._children = [];
      }
      this._children.push(child);
    },

    _removeChild: function(child) {
      if (this._children) {
        var index = this._children.indexOf(child);
        if (index !== -1) {
          this._children.splice(index, 1);
        }
      }
    },

    _checkDisposed: function() {
      if (this._isDisposed) {
        throw new Error("Object is disposed");
      }
    },

    _setProperties: function(properties) {
      for (var name in properties) {
        this._setProperty(name, properties[name]);
      }
    },

    _setProperty: function(name, value) {
      var checkedValue = this._checkProperty(name, value);
      var setProperty = this.constructor && this.constructor._setProperty && this.constructor._setProperty[name];
      try {
        if (setProperty instanceof Function) {
          setProperty.call(this, checkedValue);
        } else {
          this._setPropertyNative(name, tabris.PropertyEncoding.encodeProxyToId(checkedValue));
        }
      } catch (error) {
        console.warn(this.type + ": Failed to set property \"" + name + "\" value: " + error.message);
      }
    },

    _checkProperty: function(name, value) {
      var checkProperty = this.constructor && this.constructor._checkProperty && this.constructor._checkProperty[name];
      if (!checkProperty && this.constructor._checkProperty !== true) {
        console.warn(this.type + ": Unknown property \"" + name + "\"");
      }
      if (arguments.length === 2 && checkProperty instanceof Function) {
        try {
          return checkProperty(value);
        } catch (ex) {
          console.warn(this.type + ": Unsupported value for property \"" + name + "\": " + ex.message);
        }
      }
      return value;
    },

    _setPropertyNative: function(name, value) {
      tabris._nativeBridge.set(this.id, name, value);
    },

    _getProperty: function(name) {
      this._checkProperty(name);
      var getProperty = this.constructor && this.constructor._getProperty && this.constructor._getProperty[name];
      return getProperty ? getProperty.call(this) : this._getPropertyNative(name);
    },

    _getPropertyNative: function(name) {
      return tabris._nativeBridge.get(this.id, name);
    },

    _getContainer: function() {
      return this;
    },

    _setParent: function(parent) {
      tabris._nativeBridge.set(this.id, "parent", tabris.PropertyEncoding.encodeProxyToId(parent._getContainer()));
      if (this._parent) {
        this._parent._removeChild(this);
      }
      this._parent = parent;
      this._parent._addChild(this);
    }

  });

  var idSequence = 1;

  function generateId() {
    return "o" + (idSequence++);
  }

})();
