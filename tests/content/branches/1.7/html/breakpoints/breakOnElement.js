const BP_BREAKONATTRCHANGE = 1;
const BP_BREAKONCHILDCHANGE = 2;
const BP_BREAKONREMOVE = 3;

function runTest()
{
    FBTest.sysout("html.breakpoints; START");
    FBTest.setPref("service.filterSystemURLs", true);

    FBTestFirebug.openNewTab(basePath + "html/breakpoints/breakOnElement.html", function(win)
    {
        FBTestFirebug.openFirebug();
        FBTestFirebug.enableAllPanels();

        var doNotFilter = FBTest.getPref("service.filterSystemURLs");

        FBTest.compare(true, doNotFilter, "Pref service.filterSystemURLs must be set true");
        FBTest.compare(true, FW.Firebug.filterSystemURLs, "Pref Firebug.filterSystemURLs must be set true");

        // A suite of asynchronous tests.
        var testSuite = [];
        testSuite.push(function(callback) {
            breakOnMutation(win, BP_BREAKONATTRCHANGE, "breakOnAttrModified", 42, callback);
        });
        testSuite.push(function(callback) {
            breakOnMutation(win, BP_BREAKONCHILDCHANGE, "breakOnNodeInserted", 47, callback);
        });
        testSuite.push(function(callback) {
            breakOnMutation(win, BP_BREAKONREMOVE, "breakOnNodeRemoved", 53, callback);
        });

        // Reload window to activate debugger and run all tests.
        FBTestFirebug.reload(function(win) {
            FBTestFirebug.runTestSuite(testSuite, function() {
                FBTestFirebug.testDone("html.breakpoints; DONE");
            });
        })
    });
}

function breakOnMutation(win, type, buttonId, lineNo, callback)
{
    var chrome = FW.Firebug.chrome;
    var content = win.document.getElementById("content");
    var context = chrome.window.Firebug.currentContext;

    FBTestFirebug.selectPanel("html");

    // Set breakpoint.
    FW.Firebug.HTMLModule.MutationBreakpoints.onModifyBreakpoint(context,
        content, type);

    FBTestFirebug.waitForBreakInDebugger(chrome, lineNo, false, function(sourceRow)
    {
        FBTest.sysout("html.breakpoints; " + buttonId);
        FBTestFirebug.clickContinueButton(chrome);
        FBTest.progress("The continue button is pushed");
        callback();
    });

    FBTest.click(win.document.getElementById(buttonId));
    FBTest.sysout("html.breakpoints; " + buttonId + " button clicked");
}
