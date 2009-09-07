function runTest(request)
{
    FBTest.sysout("issue372.START");
    FBTestFirebug.openNewTab(basePath + "net/372/issue372.html", function(win)
    {
        // Open Firebug UI and enable Net panel.
        FBTestFirebug.enableNetPanel(function(win)
        {
            win.wrappedJSObject.runTest(function(request)
            {
                // Expand the test request with params
                var panelNode = FW.FirebugChrome.selectPanel("net").panelNode;

                FBTestFirebug.expandElements(panelNode, "netRow", "category-xhr", "hasHeaders", "loaded");
                FBTestFirebug.expandElements(panelNode, "netInfoPostTab");

                // The post text must be displayed.
                var postBody = FW.FBL.getElementByClass(panelNode, "netInfoPostTable");
                if (FBTest.ok(postBody, "Post tab must exist."))
                {
                    var row = postBody.firstChild.childNodes[2];
                    FBTest.compare(win.wrappedJSObject.xml, row.textContent, 
                        "Post tab body content verified");
                }

                // Finish test
                FBTestFirebug.testDone("issue372.DONE");
            })
        });
    })
}
