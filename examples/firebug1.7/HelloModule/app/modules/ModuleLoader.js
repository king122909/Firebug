// Firebug dev support
Components.utils.import("resource://firebug/firebug-trace-service.js");
var FBTrace = traceConsoleService.getTracer("extensions.chromebug");

// allow this file to be loaded via resource url eg resource://firebug/ModuleLoader.js
var EXPORTED_SYMBOLS = ["ModuleLoader", "require", "define"];

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;


// Similar to: http://wiki.ecmascript.org/doku.php?id=strawman:module_loaders

/*
 * @param load: a hook that filters and transforms MRL's for loading. OMITTED
 * @param name: string to be returned by getModuleLoaderName
 * @param global: the global object to use for the execution context associated with the module loader.
 */

function ModuleLoader(name, global) {
    this.name = name;
    this.global = global;

    this.registry = {};
    this.totalEvals = 0;

    ModuleLoader.currentModuleLoader = this;
    ModuleLoader.instanceCount = 0;

    if (!ModuleLoader.loaders) {
        ModuleLoader.loaders = [];
    }
    ModuleLoader.loaders.push(this);
}
/*
 * @return the current module loader for the current execution context.
 */
ModuleLoader.current = function getCurrentModuleLoader() {
    return ModuleLoader.currentModuleLoader;
}

ModuleLoader.get = function(name) {
    for (var i = 0; i < ModuleLoader.loaders.length; i++) {
        if (ModuleLoader.loaders[i].getModuleLoaderName() === name) {
            return ModuleLoader.loaders[i];
        }
    }
}

ModuleLoader.systemPrincipal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
ModuleLoader.mozIOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);

ModuleLoader.bootStrap = function(requirejsPath) {
    var primordialLoader = new ModuleLoader("_Primordial");
    var unit = primordialLoader.loadModule(requirejsPath);
    // require.js does not export so we need to fix that
    unit.exports = {
        require: unit.sandbox.require,
        define: unit.sandbox.define
    };
    return unit.exports;
}

// The ModuleLoader.prototype will close over these globals which will be set when the outer function runs.
var coreRequire;
var define;

ModuleLoader.prototype = {
    /*
     *  @return produces the global object for the execution context associated with moduleLoader.
     */
    globalObject: function () {
        return this.global;
    },
    /*
     * @return registers a frozen object as a top-level module in the module loader's registry. The own-properties of the object are treated as the exports of the module instance.
     */
    attachModule: function(name, module) {
        this.registry[name] = module;  // its a lie, we register compilation units
    },
    /*
     * @return the module instance object registered at name, or null if there is no such module in the registry.
     */
    getModule: function(name) {
        var entry = this.registry[name];
        if (entry) return entry.exports;
    },
    /*
     * @param unit compilation unit: {
     * 	source: a string of JavaScript source,
     *  url: identifier,
     *  jsVersion: JavaScript version to compile under
     *  staringLineNumber: offset for source line numbers.
     * @return completion value
     */
    evalScript: function(unit) {
        try {
            unit.jsVersion = unit.jsVersion || "1.8";
            unit.url = unit.url || (this.getModuleLoaderName() + this.totalEvals)
            unit.startingLineNumber = unit.startingLineNumber || 1;
            // beforeCompilationUnit
            var evalResult = Cu.evalInSandbox(unit.source, unit.sandbox,  unit.jsVersion, unit.url, unit.startingLineNumber);
            // afterCompilationUnit
            this.totalEvals += 1;
            return evalResult;
        } catch (exc) {
            if (FBTrace.DBG_ERRORS) {
                FBTrace.sysout("ModuleLoader.evalScript ERROR "+exc, {exc: exc, unit: unit});
            }
        }
    },

    loadModule: function(mrl, callback) {
        var unit = {
            source: this.mozReadTextFromFile(mrl),
            url: mrl,
        }
        var thatGlobal = unit.sandbox = this.getSandbox(unit);

        if (this.global) { // simulate |with|
            for (var p in this.global) {
                thatGlobal[p] = this.global[p];
            }
        }

        thatGlobal.require = coreRequire;  // by the time we are called to loadModules, the bootstrap has set these globals
        thatGlobal.define = define;

        thatGlobal.exports = {}; // create the container for the module to fill with exported properties
        unit.exports = thatGlobal.exports; // point to the container before the source can muck with it.
        unit.evalResult = this.evalScript(unit);
        for (var p in unit.exports) {
            if (unit.exports.hasOwnProperty(p)) { // then we had at least on export
                if (callback) {
                    callback(unit.exports);  // this call throws we do not register the module?
                }
            }
        }
        this.attachModule(mrl, unit);  // even if we don't have any valid exports, so we can try to finish dependencies
        return unit;
    },

    // **** clients will get require from their ModuleLoader instance
    require: function remapRequire() {
        var maybeConfig = arguments[0];

        if (maybeConfig) {
            if (!coreRequire.isArray(maybeConfig) && typeof( maybeConfig ) !== "string") {  // isA config
                var cfg = maybeConfig;
                if (!cfg.context) {
                    cfg.context = ModuleLoader.currentModuleLoader.getModuleLoaderName();
                } // else caller better know what they are doing...
                var args = arguments;
            } else {
                var args = [{context: ModuleLoader.currentModuleLoader.getModuleLoaderName()}];
                for (var i = 0; i < arguments.length; ++i)
                       args.push(arguments[i]);
            }
            return coreRequire.apply(this, args);
        }
    },
    // ****
    getSandbox: function(unit) {
        unit.principal = this.getPrincipal();
        return unit.sandbox = new Cu.Sandbox(unit.principal);
    },

    getPrincipal: function() {
        if (!this.principal) {
            if (this.global && (this.global instanceof Ci.nsIDOMWindow)) {
                this.principal = this.global;
            } else {
                this.principal = ModuleLoader.systemPrincipal;
            }
        }
        return this.principal;
    },

    getModuleLoaderName: function()	{
        if (!this.name)	{
            if (this.global && (this.global instanceof Window) ) {
                this.name = this.safeGetWindowLocation(this.global);
            }
            else {
                ModuleLoader.instanceCount += 1;
                var count = ModuleLoader.instanceCount;
                this.name = "ModuleLoader_"+count;
            }
        }
        return this.name;
    },

    safeGetWindowLocation: function(window)	{
        try {
            if (window) {
                if (window.closed) {
                    return "(window.closed)";
                }
                else if ("location" in window) {
                    return window.location+"";
                }
                else {
                    return "(no window.location)";
                }
            }
            else {
                return "(no context.window)";
            }
        } catch(exc) {
            if (FBTrace.DBG_WINDOWS || FBTrace.DBG_ERRORS)
                FBTrace.sysout("TabContext.getWindowLocation failed "+exc, exc);
                FBTrace.sysout("TabContext.getWindowLocation failed window:", window);
            return "(getWindowLocation: "+exc+")";
        }
    },

    mozReadTextFromFile: function(pathToFile) {
        try {
            var channel = ModuleLoader.mozIOService.newChannel(pathToFile, null, null);
            var inputStream = channel.open();

            var ciStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
                .createInstance(Ci.nsIConverterInputStream);

            var bufLen = 0x8000;
            ciStream.init(inputStream, "UTF-8", bufLen,
                          Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
            var chunk = {};
            var data = "";

            while (ciStream.readString(bufLen, chunk) > 0) {
                data += chunk.value;
            }

            ciStream.close();
            inputStream.close();

            return data;
        } catch (err) {
            if (FBTrace.DBG_ERRORS || FBTrace.DBG_STORAGE)
                FBTrace.sysout("mozReadTextFromFile; EXCEPTION", err);
        }
    },

}

ModuleLoader.requireJSFileName = "resource://hellomodule/require.js";
coreRequire = ModuleLoader.bootStrap(ModuleLoader.requireJSFileName).require;

if (coreRequire) {
    define = coreRequire.def; // see require.js
} else {
    throw new Error("ModuleLoader ERROR failed to read and load "+ModuleLoader.requireJSFileName);
}



// Override to connect require.js to our loader
//
coreRequire.attach = function (url, moduleLoaderName, moduleName, callback, type) {

    var moduleLoader = ModuleLoader.get(moduleLoaderName);

    if (!moduleLoader) {  // then perhaps we can create one?
        var defaultContextName = coreRequire.defaultContextName; // it was published by requirejs
        if (!defaultContextName) {
            defaultContextName = "_"; // I saw it in the source and copied it here.
        }
        if (moduleLoaderName === defaultContextName) {
            moduleLoader = ModuleLoader.getDefaultLoader(moduleLoaderName);
        }
    }
    if (moduleLoader) { // then we are good to go!
        var unit = moduleLoader.loadModule(url, callback);
        coreRequire.completeLoad(moduleName);
        var module = moduleLoader.getModule(url);
        if (module) {
            return module;
        } else {
            coreRequire.onError(new Error("loading modules from "+url+" gave no exports; modules must add properties to |exports|"), unit);
        }
    } else {
        return coreRequire.onError( new Error("require.attach called with unknown moduleLoaderName "+moduleLoaderName+" for url "+url), ModuleLoader );
    }

}

coreRequire.chainOnError = coreRequire.onError;
coreRequire.onError = function (err, object) {
    FBTrace.sysout(err+"",{errorObject: err, moreInfo: object});
    coreRequire.chainOnError(err);
}

// Every time we createInstance we will emit a new ModuleLoader

// Prepare our exports, these will eventually be customized by the component createInstance