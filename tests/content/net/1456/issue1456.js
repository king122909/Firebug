function runTest()
{
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

    FBTestFirebug.openNewTab(basePath + "net/1456/issue1456.htm", function(win)
    {
        // Open Firebug UI and enable Net panel.
        FBTestFirebug.enableNetPanel(function(win)
        {
            win.wrappedJSObject.runTest(function(response)
            {
                FBTest.sysout("issue1456.onResponse: ", response);

                // Expand the test request with params
                var panelNode = FW.FirebugChrome.selectPanel("net").panelNode;
                FBTestFirebug.expandElements(panelNode, "netRow", "category-xhr", "hasHeaders", "loaded");
                FBTestFirebug.expandElements(panelNode, "netInfoResponseTab");

                // The response must be displayed.
                var responseBody = FW.FBL.getElementByClass(panelNode, "netInfoResponseText", 
                    "netInfoText");

                FBTest.ok(responseBody, "Response tab must exist.");
                if (responseBody)
                    FBTest.compare(responseText, responseBody.textContent, "Response must match.");

                // Finish test
                FBTestFirebug.testDone("issue1456.DONE");
            })
        });
    })
}
