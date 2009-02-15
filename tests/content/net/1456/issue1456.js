function runTest()
{
    FBTest.loadScript("net/env.js", this);
    FBTest.sysout("issue1456.START");

    var responseText = "$('tb').shake();\n$('tb').value='Some Response';\n";

    // Server side handler.
    FBTest.registerPathHandler("/net/1456/issue1456.txt", function (metadata, response)
    {
        FBTest.sysout("issue1456.onPathHandler; Server side handler executed.", metadata);

        response.setHeader("Pragma", "no-cache", false);
        response.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate", false);
        response.setHeader("Content-type", "text/javascript", false);
        response.write(responseText);
    });

    openNewTab(basePath + "net/1456/issue1456.htm", function(win)
    {
        // Open Firebug UI and activate Net panel.
        FW.Firebug.showBar(true);
        FW.FirebugChrome.selectPanel("net");

        win.wrappedJSObject.runTest(function(response)
        {
            FBTest.sysout("issue1456.onResponse: ", response);

            // Expand the test request with params
            var panelNode = FW.FirebugContext.getPanel("net").panelNode;
            FBTest.sysout("fbtest.panelNode", panelNode);
            expandNetRows(panelNode, "netRow", "category-xhr", "hasHeaders", "loaded");
            expandNetTabs(panelNode, "netInfoResponseTab");

            // The response must be displayed.
            var responseBody = FW.FBL.getElementByClass(panelNode, "netInfoResponseText", 
                "netInfoText");

            FBTest.ok(responseBody, "Response tab must exist.");
            if (responseBody)
                FBTest.compare(responseText, responseBody.textContent, "Response must match.");

            // Finish test
            removeCurrentTab();
            FBTest.sysout("issue1456.DONE");
            FBTest.testDone();
        })
    })
}
