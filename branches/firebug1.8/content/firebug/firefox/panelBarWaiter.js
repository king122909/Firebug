/* See license.txt for terms of usage */

// ********************************************************************************************* //

/**
 * This file should be loaded by script tags ahead of bindings.xml and module loading.
 * It synchronizes the panelBar initialization with the module loading.
 */
window.panelBarWaiter = function()
{
    var panelBarWaiter = {};
    var waitingPanelBarCount = 2;
    var waitLimit = 200;
    var chromeFactory = false;
    var callbackWithChrome = null;

    /*
     * Called by module loader to signal modules loaded
     */
    panelBarWaiter.waitForPanelBar = function(chromeFactoryIn, callback)
    {
        if (chromeFactoryIn)
            chromeFactory = chromeFactoryIn;

        if (callback)
            callbackWithChrome = callback;

        waitLimit -= 1;

        if (!panelBarWaiter.initializeWhenReady(callbackWithChrome) && waitLimit > 0)
        {
            if (FBTrace.DBG_INITIALIZE)
            {
                var msg = "panelBarWaiter; waitForPanelBar "+waitLimit;
                msg += " waitingPanelBarCount: "+waitingPanelBarCount;
                msg += " chromeFactory: "+ chromeFactory;
                FBTrace.sysout(msg);
            }
            if (!chromeFactory)
                setTimeout(panelBarWaiter.waitForPanelBar, 10);
        }
    };

    panelBarWaiter.initializeWhenReady = function(callbackWithChrome)
    {
        try
        {
            // Wait until all panelBar bindings are ready before initializing
            if (waitingPanelBarCount == 0 && chromeFactory)
            {
                if (FBTrace.DBG_INITIALIZE)
                    FBTrace.sysout("panelBarWaiter; initializing now");

                var chrome = chromeFactory.createFirebugChrome(window);

                if (FBTrace.DBG_INITIALIZE)
                    FBTrace.sysout("panelBarWaiter; callback "+callbackWithChrome);

                chrome.initialize(); // This needs to be the window-specific chrome

                if (callbackWithChrome)
                    callbackWithChrome(chrome);

                delete window.panelBarWaiter;
                return true; // the panel bar is ready
            }
        }
        catch (exc)
        {
            // Disaster!
            var msg = exc.toString() +" "+(exc.fileName || exc.sourceName) + "@" + exc.lineNumber;
            Components.utils.reportError(msg);
            if (FBTrace.sysout)
                FBTrace.sysout("chrome.panelBarReady FAILS: "+msg, exc);
            window.dump("getStackDump:"+FBL.getStackDump()+"\n");
        }
        return false;
    };

    /*
     * Called by binding.xml to signal ctor for a panel
     */
    panelBarWaiter.panelBarReady = function(callback)
    {
        // We initialize Firebug from here instead of from the onload event because
        // we need to make sure it is initialized before the browser starts loading
        // the home page
        try
        {
            if(callback)
                callbackWithChrome = callback;

               waitingPanelBarCount -= 1;

            window.dump("chrome; panelBarReady (" + waitingPanelBarCount + ") "+
                (chromeFactory ? "Modules loaded" : "Modules not yet loaded")+" in "+window.location+"\n");

            panelBarWaiter.initializeWhenReady(callbackWithChrome);
        }
        catch (e)
        {
            dump("bindings panelBar ctor FAILs: "+ e+"\n");
            dump("window.top "+window.top.location+" window.opener: "+window.opener+"\n");
        }
    }

    return panelBarWaiter;
}();

// ********************************************************************************************* //
