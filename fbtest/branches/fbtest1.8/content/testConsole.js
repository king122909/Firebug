/* See license.txt for terms of usage */

// Must be global within the browser window.
var gFindBar;

FBTestApp.ns(function() { with (FBL) {

// ************************************************************************************************
// Test Console Implementation

var Cc = Components.classes;
var Ci = Components.interfaces;

// Services
var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
var filePicker = Cc["@mozilla.org/filepicker;1"].getService(Ci.nsIFilePicker);
var cmdLineHandler = Cc["@mozilla.org/commandlinehandler/general-startup;1?type=FBTest"].getService(Ci.nsICommandLineHandler);
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
var chromeRegistry = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci.nsIChromeRegistry);

// Interfaces
var nsIFilePicker = Ci.nsIFilePicker;

var versionURL = "chrome://fbtest/content/fbtest.properties";

// ************************************************************************************************

FBTestApp.TestWindowLoader =
{
    initialize: function()
    {
        this.initializeTracing();

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestWindowLoader.initialize;");

        // Localize strings in XUL (using string bundle).
        this.internationalizeUI();
    },

    internationalizeUI: function()
    {
        var buttons = ["runAll", "stopTest", "haltOnFailedTest","noTestTimeout", "refreshList",
            "menu_showTestCaseURLBar", "menu_showTestDriverURLBar", "menu_showTestListURLBar",
            "testListUrlBar", "testCaseUrlBar", "testDriverUrlBar", "restartFirefox",
            "passingTests", "failingTests", "menu_hidePassingTests", "menu_uploadTestResults",
            "testCount", "testToolsMenu"];

        for (var i=0; i<buttons.length; i++)
        {
            var element = $(buttons[i]);
            FBL.internationalize(element, "label");
            FBL.internationalize(element, "tooltiptext");
            FBL.internationalize(element, "pickerTooltiptext");
            FBL.internationalize(element, "barTooltiptext");
        }
    },

    initializeTracing: function()
    {
        // TraceModule isn't part of Firebug end-user version.
        if (Firebug.TraceModule)
            Firebug.TraceModule.addListener(FBTestApp.TestConsole.TraceListener);

        // The tracing console can be already opened so, simulate onLoadConsole event.
        iterateBrowserWindows("FBTraceConsole", function(win)
        {
            if (win.TraceConsole.prefDomain == "extensions.firebug")
            {
                FBTestApp.TestConsole.TraceListener.onLoadConsole(win, null);
                return true;
            }
        });
    },

    shutdown: function()
    {
        if (Firebug.TraceModule)
            Firebug.TraceModule.removeListener(FBTestApp.TestConsole.TraceListener);
    }
};

// ************************************************************************************************

/**
 * This object represents main Test Console implementation.
 */
FBTestApp.TestConsole =
{
    // These are set when a testList.html is loaded.
    testListPath: null, // full path to the test list, eg a URL for the testList.html
    driverBaseURI: null,  // base for test drivers, must be a secure location, chrome or https
    testCasePath: null,  // base for testcase pages. These are normal web pages
    groups: null,
    version: null,

    initialize: function()
    {
        try
        {
            // xxxHonza: initialization would deserve to be done throug a dispatched event.
            FBTestApp.TestWindowLoader.initialize();

            // Display the current version.
            window.document.title = "Firebug Test Console " + this.getVersion();

            this.notifyObservers(this, "fbtest", "initialize");

            // Load all tests from the default test list file (testList.html).
            // The file usually defines two variables:
            // testList: array with individual test objects.
            // driverBaseURI: base directory for the test server (http://localhost:7080)
            //          if this variable isn't specified, the parent directory of the
            //          test list file is used.
            this.loadTestList(this.getDefaultTestList(), this.getDefaultTestCasePath());

            $("testCaseUrlBar").testURL = this.testCasePath;

            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("fbtest.TestConsole.initialize; " + this.getVersion() + ", " +
                    this.testCasePath);

            gFindBar = $("FindToolbar");
        }
        catch (e)
        {
            if (FBTrace.DBG_FBTEST || FBTrace.DBG_ERRORS)
                FBTrace.sysout("fbtest.TestConsole.initialize FAILS "+e, e);

            alert("There may be a useful message on the Error Console: "+e);
        }
    },

    getVersion: function()
    {
        if (!this.version)
            this.version = Firebug.loadVersion(versionURL);
        return this.version;
    },

    getDefaultTestList: function()
    {
        // 1) The default test list (suite) can be specified on the command line.
        var defaultTestList = FBTestApp.defaultTestList;

        // 2) The list from the last time (stored in preferences) can be also used.
        if (!defaultTestList)
            defaultTestList = Firebug.getPref(FBTestApp.prefDomain, "defaultTestSuite");

        // 3) If no list is specified, use the default from currently installed Firebug.
        if (!defaultTestList)
            defaultTestList = "http://getfirebug.com/tests/content/testlists/firebug1.8.html";

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestConsole.getDefaultTestList; " + defaultTestList);

        return defaultTestList;
    },

    getDefaultTestCasePath: function()
    {
        // 1) The default test list (suite) can be specified on the command line.
        var defaultTestCaseServer = FBTestApp.defaultTestCaseServer;

        // 2) The list from the last time (stored in preferences) can be also used.
        if (!defaultTestCaseServer)
            defaultTestCaseServer = Firebug.getPref(FBTestApp.prefDomain, "defaultTestCaseServer");

        // 3) If no list is specified, use the default from getfirebug
        if (!defaultTestCaseServer)
            defaultTestCaseServer = "https://getfirebug.com/tests/content/";

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestConsole.getDefaultTestCasePath; " + defaultTestCaseServer);

        return defaultTestCaseServer;
    },

    getHTTPURLBase: function()
    {
        var url = FBTestApp.TestRunner.currentTest.testCasePath;

        // Make sure the path ends properly.
        if (url && url.charAt(url.length-1) != "/")
            url += "/";

        return url;
    },

    shutdown: function()
    {
        this.notifyObservers(this, "fbtest", "shutdown");

        // Update history
        this.updatePaths();
        this.appendToHistory(this.testListPath, this.testCasePath, this.driverBaseURI);

        // Store defaults to preferences.
        Firebug.setPref(FBTestApp.prefDomain, "defaultTestSuite", this.testListPath);
        Firebug.setPref(FBTestApp.prefDomain, "defaultTestCaseServer", this.testCasePath);
        Firebug.setPref(FBTestApp.prefDomain, "defaultTestDriverServer", this.driverBaseURI);

        FBTestApp.TestWindowLoader.shutdown();

        // Unregister registered repositories.
        Firebug.unregisterRep(FBTestApp.GroupList);
        Firebug.unregisterRep(FBTestApp.TestList);
        Firebug.unregisterRep(FBTestApp.TestResultRep);

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestConsole.shutdown;");
    },

    updatePaths: function()
    {
        this.testListPath = $("testListUrlBar").testURL;
        this.testCasePath = $("testCaseUrlBar").testURL;
        this.driverBaseURI = $("testDriverUrlBar").testURL;

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.updatePaths; " + this.testListPath + ", " +
                this.testCasePath + ", " + this.driverBaseURI);
    },

    updateURLBars: function()
    {
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.updateURLBars; " + this.testListPath + ", " +
                this.testCasePath + ", " + this.driverBaseURI);

        // Update test list URL box.
        var urlBar = $("testListUrlBar");
        urlBar.testURL = this.testListPath;

        // Update test source URL box.
        urlBar = $("testCaseUrlBar");
        urlBar.testURL = this.testCasePath;

        // Update test driver URL box.
        urlBar = $("testDriverUrlBar");
        urlBar.testURL = this.driverBaseURI;
    },

    updateTestCount: function(groups)
    {
        var count = 0;
        for (var i=0; groups && i<groups.length; i++)
            count += groups[i].tests.length;

        $("testCount").value = count;
    },

    setAndLoadTestList: function()
    {
        this.updatePaths();

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.setAndLoadTestList; " + this.testListPath + ", " +
                this.testCasePath + ", " + this.driverBaseURI);

        // Append the test-case server into the history immediately. If the test list is
        // already loaded it wouldn't be done at the "successful load" moment.
        this.appendToHistory("", this.testCasePath, this.driverBaseURI);

        // xxxHonza: this is a workaround, the test-case server isn't stored into the
        // preferences in shutdown when the Firefox is restared by "Restart Firefox"
        // button in the FBTrace console.
        Firebug.setPref(FBTestApp.prefDomain, "defaultTestCaseServer", this.testCasePath);

        this.loadTestList(this.testListPath, this.testCasePath);

        FBTestApp.TestSummary.clear();
    },

    resetHistoryList: function(urlBar)
    {
        var type = urlBar.getAttribute("autocompletesearch");
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.resetHistoryList; " + type);

        if (type == "FBTestHistory")
            Firebug.clearPref(FBTestApp.prefDomain, "history");
        else if (type == "FBTestCaseHistory")
            Firebug.clearPref(FBTestApp.prefDomain, "testCaseHistory");
        else if (type == "FBTestDriverHistory")
            Firebug.clearPref(FBTestApp.prefDomain, "testDriverHistory");
    },

    loadTestList: function(testListPath, testCasePath)
    {
        this.testListPath = testListPath;
        if (testCasePath)
            this.testCasePath = testCasePath;

        // Called after tests are loaded from specified URL.
        var self = this;
        var finishCallback = function(groups)
        {
            self.groups = groups;

            self.notifyObservers(self, "fbtest", "restart")

            // Build new test list UI.
            self.refreshTestList();

            // Remember successfully loaded test within test history.
            self.appendToHistory(self.testListPath, self.testCasePath, self.driverBaseURI);

            // In case the test list path is "fbtest:all" update the self.testListPath
            // sine it has been changed as individual test lists have been loaded.
            self.testListPath = testListPath;

            self.updateURLBars();
            self.updateTestCount(groups);

            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("fbtest.onOpenTestSuite; Test list successfully loaded: " +
                    self.testListPath + ", " + self.testCasePath);

            // Finally run all tests if the browser has been launched with
            // -runFBTests argument on the command line.
            self.autoRun();
        };

        var taskBrowser = $("taskBrowser");

        if (testListPath == "fbtest:all")
            FBTestApp.TestListLoader.loadAllRegisteredTests(taskBrowser, finishCallback);
        else
            FBTestApp.TestListLoader.loadTestList(taskBrowser, testListPath, finishCallback);

        this.updateURLBars();
    },

    /*
     * @return newline delinated text summary of the test run
     */
    getErrorSummaryText: function()
    {
        var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
        var currLocale = Firebug.getPref("general.useragent", "locale");
        var systemInfo = Cc["@mozilla.org/system-info;1"].getService(Ci.nsIPropertyBag);
        var name = systemInfo.getProperty("name");
        var version = systemInfo.getProperty("version");

        var extensionsText = "";
        for (var i = 0; i < Application.extensions; i++)
        {
            var extension = Application.extensions[i];
            extensionsText = "Extension: " + extension.name + " (" + extension.id +") version: "+extension.version+"\n";
        }

        // Store head info.
        var text =
            "FBTest: " + FBTestApp.TestConsole.getVersion() + "\n" +
            "Firebug: " + Firebug.version + "\n" +
            appInfo.name + ": " + appInfo.version + ", " +
            appInfo.platformVersion + ", " +
            appInfo.appBuildID + ", " + currLocale + "\n" +
            "OS: " + name + " " + version + "\n" +
            extensionsText + "\n" +
            "Test List: " + FBTestApp.TestConsole.testListPath + "\n" +
            "Export Date: " + (new Date()).toGMTString() +
            "\n==========================================\n\n";

        var groups = FBTestApp.TestConsole.groups;

        text += "Summary:\n";

        for (group in groups)
            text += groups[group].getErrors(false);

        text += "\n";
        text += "Detailed Report:\n";

        for (group in groups)
            text += groups[group].getErrors(true);

        return text;
    },

    findTestListWindow: function(doc)
    {
        var win = doc.defaultView.wrappedJSObject;
        if (!win)
            win = doc.defaultView;

        if (win.testList)
            return win;

        var iframe = doc.getElementById("FBTest");
        if (iframe)
            return (iframe.contentWindow.wrappedJSObject ? iframe.contentWindow.wrappedJSObject : iframe.contentWindow);
    },

    notifyObservers: function(subject, topic, data)
    {
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("notifiyObservers of topic "+topic);

        observerService.notifyObservers({wrappedJSObject: this}, topic, data);
    },

    refreshTestList: function()
    {
        if (!this.groups)
        {
            FBTrace.sysout("fbtest.refreshTestList; ERROR There are no tests.");
            return;
        }

        var browser = $("taskBrowser");
        var doc = browser.contentDocument;
        var testListNode = $("testList", doc);
        if (!testListNode)
        {
            var iframed = $("FBTest", doc);
            if (iframed)
            {
                doc = iframed.contentDocument;
                testListNode = $("testList", doc);
            }
            if (!testListNode)
            {
                testListNode = doc.createElement("div");
                testListNode.setAttribute("id", "testList");
                var body = getBody(doc);
                if (!body)
                {
                    FBTrace.sysout("fbtest.refreshTestList; ERROR There is no <body> element.");
                    return;
                }
                body.appendChild(testListNode);
            }
        }

        eraseNode(testListNode);

        // Generate UI (domplate).
        var GroupList = FBTestApp.GroupList;
        this.table = GroupList.tableTag.replace({}, testListNode);

        var tbody = this.table.firstChild;
        var location = "";
        for (var i=0; i<this.groups.length; i++)
        {
            var group = this.groups[i];

            if (location != group.testListPath)
            {
                location = group.testListPath;

                // Insert group separator. The 'extension' field is only set if the console displays
                // tests from multiple extensions. So, use it and only display the separator
                // in such cases.
                if (group.extension)
                    GroupList.groupSeparatorTag.insertRows({group: group},
                        tbody.lastChild ? tbody.lastChild : tbody);
            }

            group.row = GroupList.groupRowTag.insertRows({group: group},
                tbody.lastChild ? tbody.lastChild : tbody)[0];
        }
    },

    autoRun: function()
    {
        if (!cmdLineHandler.wrappedJSObject.runFBTests)
        {
            // Check pref if the auto logger should be registered. Useful for
            // knowing, which test caused crash.
            var enableTestLogger = Firebug.getPref(FBTestApp.prefDomain, "enableTestLogger");
            if (enableTestLogger)
            {
                var listener = new FBTestApp.TestLogger.ProgressListener(new Date());
                FBTestApp.TestRunner.addListener(listener);
            }

            return;
        }

        // The auto run is done just the first time the test-console is opened.
        cmdLineHandler.wrappedJSObject.runFBTests = false;

        // Set Browser window (with Firebug) size and position. All can be spcified
        // in preferences.
        var firebugWindow = FBTestApp.FBTest.FirebugWindow;
        firebugWindow.screenX = Firebug.getPref(FBTestApp.prefDomain, "defaultScreenY");
        firebugWindow.screenY = Firebug.getPref(FBTestApp.prefDomain, "defaultScreenY");
        firebugWindow.outerWidth = Firebug.getPref(FBTestApp.prefDomain, "defaultOuterWidth");
        firebugWindow.outerHeight = Firebug.getPref(FBTestApp.prefDomain, "defaultOuterHeight");

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.autoRun; defaultTestList: " + FBTestApp.defaultTestList +
                ", defaultTest: " + FBTestApp.defaultTest);

        // Run all asynchronously so, callstack is correct.
        setTimeout(function()
        {
            // If a test is specified on the command line, run it. Otherwise
            // run entire test suite.
            if (FBTestApp.defaultTest)
            {
                var test = FBTestApp.TestConsole.getTest(FBTestApp.defaultTest);
                if (test)
                {
                    FBTestApp.TestRunner.runTests([test]);
                }
                else
                {
                    throw new Error("fbtest.autoRun; Test from command line doesn't exist: " +
                        FBTestApp.defaultTest);
                }
            }
            else
            {
                // Register a listener that continuously logs test results so,
                // in case of a crash there is at least part of the log.
                var listener = new FBTestApp.TestLogger.ProgressListener(new Date());
                FBTestApp.TestRunner.addListener(listener);

                FBTestApp.TestConsole.onRunAll(function(canceled)
                {
                    // Don't forget to remove the logger listener now.
                    FBTestApp.TestRunner.removeListener(listener);

                    // Quit Firefox now.
                    if (!canceled)
                        goQuitApplication();
                });
            }
        }, 100);
    },

    getTest: function(uri)
    {
        for (var i=0; i<this.groups.length; i++)
        {
            var group = this.groups[i];
            for (var j=0; j<group.tests.length; j++)
            {
                if (group.tests[j].uri == uri)
                    return group.tests[j];
            }
        }
        return null;
    },

    appendToHistory: function(testListPath, testCaseServer, driverBaseURI)
    {
        if (testListPath)
        {
            testListPath = trim(testListPath);
            this.appendNVPairToHistory("history", testListPath);
        }

        if (testCaseServer)
        {
            testCaseServer = trim(testCaseServer);
            this.appendNVPairToHistory("testCaseHistory", testCaseServer);
        }

        if (driverBaseURI)
        {
            driverBaseURI = trim(driverBaseURI);
            this.appendNVPairToHistory("testDriverHistory", driverBaseURI);
        }

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.appendToHistory; " + testListPath + ", " +
                testCaseServer + ", " + driverBaseURI);
    },

    getHistory: function(name)
    {
        var history = Firebug.getPref(FBTestApp.prefDomain, name);
        var arr = history.split(",");
        return arr;
    },

    appendNVPairToHistory: function(name, value)
    {
        var arr = this.getHistory(name);

        if (!value)
            return arr;

        // Avoid duplicities.
        for (var i=0; i<arr.length; i++) {
            if (arr[i] == value)
                return;
        }

        // Store in preferences.
        arr.push(value);
        Firebug.setPref(FBTestApp.prefDomain, name, arr.join(","));

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.appendNVPairToHistory; " + name + "=" + value, arr);
    },

    // UI Commands
    onRunAll: function(onAutoRunCallback)
    {
        // Join all tests from all groups.
        var testQueue = [];
        for (var i=0; i<this.groups.length; i++)
            testQueue.push.apply(testQueue, this.groups[i].tests);

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.runAll; Number of tests: " + testQueue.length);

        if (testQueue.length > 0)
            scrollIntoCenterView(testQueue[0].row);

        // ... and execute them as one test suite.
        FBTestApp.TestRunner.runTests(testQueue, onAutoRunCallback);
    },

    onStop: function()
    {
        FBTestApp.TestRunner.testQueue = null;
        FBTestApp.TestRunner.testDone(true);
    },

    onOpenTestList: function()
    {
        filePicker.init(window, null, nsIFilePicker.modeOpen);
        filePicker.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterHTML);
        filePicker.filterIndex = 1;
        filePicker.defaultString = "testList.html";

        var rv = filePicker.show();
        if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace)
        {
            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("fbtest.onOpenTestList; Test list file picked: " +
                    filePicker.file.path, filePicker.file);

            var testListUrl = Cc["@mozilla.org/network/protocol;1?name=file"]
                .createInstance(Ci.nsIFileProtocolHandler)
                .getURLSpecFromFile(filePicker.file);

            this.loadTestList(testListUrl, this.testCasePath);
        }
    },

    onRestartFirefox: function()
    {
        Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup).
            quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
    },

    onRefreshTestList: function()
    {
        $("taskBrowser").setAttribute("src", "about:blank");
        this.updatePaths();
        this.loadTestList(this.testListPath, this.testCasePath);
    },

    onToggleNoTestTimeout: function()
    {
        this.noTestTimeout = !this.noTestTimeout;
        $('noTestTimeout').setAttribute('checked', this.noTestTimeout?'true':'false');
        Firebug.setPref(FBTestApp.prefDomain, "noTestTimeout", FBTestApp.TestConsole.noTestTimeout);
    },

    onViewToolbarsPopupShowing: function(event)
    {
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.onViewToolbarsPopupShowing;");

        var popup = event.target;
        for (var i=0; i<popup.childNodes.length; i++)
        {
            var menuItem = popup.childNodes[i];
            var toolbar = $(menuItem.getAttribute("toolbar"));
            menuItem.setAttribute("checked", toolbar.collapsed ? "false" : "true");
        }
    },

    showURLBar: function(event)
    {
        var menuItem = event.originalTarget;
        var toolbar = $(menuItem.getAttribute("toolbar"));
        toolbar.collapsed = menuItem.getAttribute("checked") != "true";
        document.persist(toolbar.id, "collapsed");
    },

    // Directories
    chromeToPath: function (aPath)
    {
        try
        {
            if (!aPath || !(/^chrome:/.test(aPath)))
                return this.urlToPath( aPath );

            var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci["nsIIOService"]);
            var uri = ios.newURI(aPath, "UTF-8", null);
            var cr = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci["nsIChromeRegistry"]);
            var rv = cr.convertChromeURL(uri).spec;

            if (/content\/$/.test(aPath)) // fix bug  in convertToChromeURL
            {
                var m = /(.*\/content\/)/.exec(rv);
                if (m)
                    rv = m[1];
            }

            if (/^file:/.test(rv))
                rv = this.urlToPath(rv);
            else
                rv = this.urlToPath("file://"+rv);

            return rv;
        }
        catch (err)
        {
            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("fbtest.chromeToPath EXCEPTION", err);
        }

        return null;
    },

    urlToPath: function (aPath)
    {
        try
        {
            if (!aPath || !/^file:/.test(aPath))
                return;

            return Cc["@mozilla.org/network/protocol;1?name=file"]
                      .createInstance(Ci.nsIFileProtocolHandler)
                      .getFileFromURLSpec(aPath);
        }
        catch (e)
        {
            throw new Error("urlToPath fails for "+aPath+ " because of "+e);
        }
    },

    chromeToUrl: function (aPath, aDir)
    {
        try
        {
            if (!aPath || !(/^chrome:/.test(aPath)))
                return this.pathToUrl(aPath);

            var uri = ios.newURI(aPath, "UTF-8", null);
            var rv = chromeRegistry.convertChromeURL(uri).spec;
            if (aDir)
                rv = rv.substr(0, rv.lastIndexOf("/") + 1);

            if (/content\/$/.test(aPath)) // fix bug  in convertToChromeURL
            {
                var m = /(.*\/content\/)/.exec(rv);
                if (m)
                    rv = m[1];
            }

            if (!/^file:/.test(rv))
                rv = this.pathToUrl(rv);

            return rv;
        }
        catch (err)
        {
            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("fbtest.chromeToUrl EXCEPTION", err);
        }

        return null;
    },

    pathToUrl: function(aPath)
    {
        try
        {
            if (!aPath || !(/^file:/.test(aPath)))
                return aPath;

            var uri = ios.newURI(aPath, "UTF-8", null);
            return Cc["@mozilla.org/network/protocol;1?name=file"]
                .createInstance(Ci.nsIFileProtocolHandler)
                .getURLSpecFromFile(uri).spec;
        }
        catch (e)
        {
            throw new Error("urlToPath fails for "+aPath+ " because of "+e);
        }
    },

    onStatusBarPopupShowing: function(event)
    {
        if (!this.table)
            return false;

        var hidePassingTests = hasClass(this.table, "hidePassingTests");
        var menuItem = $("menu_hidePassingTests");
        menuItem.setAttribute("checked", hidePassingTests ? "true" : "false");

        // This could deserve more generic aproach like dispatching an event
        // to all listeners.
        FBTestApp.TestCouchUploader.onStatusBarPopupShowing(event);

        return true;
    },

    hidePassingTests: function(event)
    {
        if (!this.table)
            return;

        if (hasClass(this.table, "hidePassingTests"))
            removeClass(this.table, "hidePassingTests");
        else
            setClass(this.table, "hidePassingTests");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    iterateTests: function(callback)
    {
        var groups = FBTestApp.TestConsole.groups;
        for (groupIdx in groups)
        {
            var group = groups[groupIdx];
            var tests = group.tests;
            for (testIdx in tests)
            {
                var stop = callback(group, tests[testIdx]);
                if (stop)
                    return stop;
            }
        }
    },
};

// ************************************************************************************************

FBTestApp.TestConsole.TraceListener =
{
    // Called when console window is loaded.
    onLoadConsole: function(win, rootNode)
    {
        var consoleFrame = $("consoleFrame", win.document);
        this.addStyleSheet(consoleFrame.contentDocument,
            "chrome://fbtest/skin/traceConsole.css",
            "fbTestStyles");
    },

    addStyleSheet: function(doc, uri, id)
    {
        if ($(id, doc))
            return;

        var styleSheet = createStyleSheet(doc, uri);
        styleSheet.setAttribute("id", id);
        addStyleSheet(doc, styleSheet);
    },

    // Called when a new message is logged in to the trace-console window.
    onDump: function(message)
    {
        var index = message.text.indexOf("fbtest.");
        if (index == 0)
        {
            message.text = message.text.substr("fbtest.".length);
            message.text = trim(message.text);
        }
    }
};

// ************************************************************************************************
// FBTest

/**
 * This is the FBTest namespace with API used by test drivers. Initialization of this object
 * is made within FBTest.js
 */
var FBTest = FBTestApp.FBTest = {};

// Compatibility with Firebug 1.4
function trim(text)
{
    return text.replace(/^\s*|\s*$/g,"");
}

// ************************************************************************************************
}});
