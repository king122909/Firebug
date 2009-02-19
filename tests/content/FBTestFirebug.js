
function initializeFBTestFirebug()
{
    // ****************************************************************
    // Operations on Firebug
    FBTest.Firebug = {};
    FBTest.Firebug.pressKey = function(keyCode)
    {
        var doc = FBTest.FirebugWindow.document;
        var keyEvent = doc.createEvent("KeyboardEvent");
        keyEvent.initKeyEvent(
                "keypress",        //  in DOMString typeArg,
                true,             //  in boolean canBubbleArg,
                true,             //  in boolean cancelableArg,
                null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.
                false,            //  in boolean ctrlKeyArg,
                false,            //  in boolean altKeyArg,
                false,            //  in boolean shiftKeyArg,
                false,            //  in boolean metaKeyArg,
                 keyCode,               //  in unsigned long keyCodeArg,
                 0);              //  in unsigned long charCodeArg);

        doc.documentElement.dispatchEvent(keyEvent);
    };

    FBTest.Firebug.pressToggleFirebug = function()
    {
        FBTrace.sysout("pressToggleFirebug");
        FBTest.progress("pressToggleFirebug");
        this.pressKey(123); // F12
    };

    FBTest.Firebug.isFirebugOpen = function()
    {
        var browserDocument = FBTest.FirebugWindow.document;
        var fbContentBox = browserDocument.getElementById('fbContentBox');
        var collapsedFirebug = fbContentBox.getAttribute("collapsed");
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("isFirebugOpen collapsedFirebug "+ collapsedFirebug);
        return (collapsedFirebug=="true") ? false : true;
    };

    FBTest.Firebug.setToKnownState = function()
    {
        // TODO
    };
    // *******************************************************************

    // var fooTest = new FBTest.Firebug.TestHandlers("TestFoo");
    FBTest.Firebug.TestHandlers = function(testName)
    {
        this.testName = testName;
        this.progressElement = document.getElementById("firebugTestElement");
        if (!this.progressElement)
            throw new Error("TestHanders object requires element "+testName+" in document "+document.title);
        this.windowLocation = new String(window.location);
    };

    FBTest.Firebug.TestHandlers.prototype =
    {
        // fooTest.add("openFirebug", onOpenFirebug);
        add: function(handlerFunction)
        {
            var eventName = handlerFunction.name;
            this.progressElement.addEventListener(eventName, handlerFunction, true);
        },
        // function onOpenFirebug(event) { ...; fooTest.fire("enablePanels"); }
        fire: function(eventName)
        {
            var event = this.progressElement.ownerDocument.createEvent("Event");
            event.initEvent(eventName, true, false); // bubbles and not cancelable
            if (window.closed)
                throw "CLOSED "+this.windowLocation;
            FBTest.progress(eventName);
            //FBTrace.sysout("fire this", this);
            //debugger;
            this.progressElement.dispatchEvent(event);
        },

        // fooTest.fireOnNewPage("openFirebug", "http://getfirebug.com");
        fireOnNewPage: function(eventName, url, extensionCallbacks)
        {
            if (extensionCallbacks)
            {
                var TabWatcher = FBTest.FirebugWindow.TabWatcher;
                var hookFirebug =
                {
                        dispatchName: "activationEnv",
                        initContext: function(context)
                        {
                            var uriString = context.getWindowLocation();
                            if (uriString == url)
                            {
                                FBTrace.sysout("fireOnNewPage register extensionCallbacks in "+url, extensionCallbacks);
                                if (extensionCallbacks.moduleListener) FBTest.FirebugWindow.Firebug.registerModule(extensionCallbacks.moduleListener);
                                if (extensionCallbacks.uiListener) FBTest.FirebugWindow.Firebug.registerUIListener(extensionCallbacks.uiListener);
                                if (extensionCallbacks.tabWatchListener) FBTest.FirebugWindow.TabWatcher.removeListener(extensionCallbacks.tabWatchListener);
                            }
                            else
                                FBTrace.sysout("fireOnNewPage initContext skip "+uriString +" != "+url);
                            return null;
                        },
                        destroyContext: function(context)
                        {
                            if (context)
                            {
                                if (context.window.location == url)
                                {
                                    FBTrace.sysout("destroyContext, removing extensionCallbacks in "+url);
                                    if (extensionCallbacks.moduleListener) FBTest.FirebugWindow.Firebug.unregisterModule(extensionCallbacks.moduleListener);
                                    if (extensionCallbacks.uiListener) FBTest.FirebugWindow.Firebug.unregisterUIListener(extensionCallbacks.uiListener);
                                    if (extensionCallbacks.tabWatchListener) FBTest.FirebugWindow.TabWatcher.removeListener(extensionCallbacks.tabWatchListener);
                                }
                                else
                                    FBTrace.sysout("fireOnNewPage destroyContext skip "+(context?context.getName():"null context"));
                            }
                        }
                };
                TabWatcher.addListener(hookFirebug);
            }
            function cleanUpTabWatcher(event)
            {
                TabWatcher.removeListener(hookFirebug);
                window.removeEventListener("unload", cleanUpTabWatcher, true);
            }
            window.addEventListener("unload", cleanUpTabWatcher, true);

            var tabbrowser = FBTest.FirebugWindow.getBrowser();
            var testHandler = this;
            // Add tab, then make active (https://developer.mozilla.org/en/Code_snippets/Tabbed_browser)
            var newTab = tabbrowser.addTab(url);
            newTab.setAttribute("firebug", "test");
            tabbrowser.selectedTab = newTab;
            var browser = tabbrowser.getBrowserForTab(newTab);

            var onLoadURLInNewTab = function(event)
            {
                var win = event.target;   // actually  tab XUL elt
                FBTrace.sysout("fireOnNewPage onLoadURLInNewTab win.location: "+win.location);
                FBTest.FirebugWindow.getBrowser().selectedTab = win;
                //FBTrace.sysout("selectedTab ", FBTest.FirebugWindow.getBrowser().selectedTab);
                var selectedBrowser = tabbrowser.getBrowserForTab(tabbrowser.selectedTab);
                //FBTrace.sysout("selectedBrowser "+selectedBrowser.currentURI.spec);
                browser.removeEventListener('load', onLoadURLInNewTab, true);

                testHandler.fire(eventName);
            }
            //FBTrace.sysout("fireOnNewPage "+FBTest.FirebugWindow, FBTest.FirebugWindow);

            browser.addEventListener("load", onLoadURLInNewTab, true);
        },

        cleanUpTestTabs: function()
        {
            var tabbrowser = FBTest.FirebugWindow.getBrowser();
            for (var i = 0; i < tabbrowser.mTabs.length; i++)
            {
                var tab = tabbrowser.mTabs[i];
                var firebugAttr = tab.getAttribute("firebug");
                if (firebugAttr == "test")
                    tabbrowser.removeTab(tab);
            }
        },

        // function onEnablePanels(event) {...; fooTest.done();}
        done: function()
        {
            FBTest.progress("clean up tabs");
            this.cleanUpTestTabs();
            FBTest.progress(this.testName +" done");
            FBTest.testDone();
        }
    };
    window.removeEventListener('load', initializeFBTestFirebug, true);
    FBTrace.sysout("initializeFBTestFirebug complete", FBTest);
}
window.addEventListener("load", initializeFBTestFirebug, true);
window.dump("FBTestFirebug.js\n");