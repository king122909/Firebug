function runTest()
{
    FBTest.sysout("issue846.START");

    FBTest.openNewTab(basePath + "net/846/Issue846.1.6.htm", function(win)
    {
        // Disable XHR spy.
        var prefOrigValue = FBTest.getPref("showXMLHttpRequests");
        FBTest.setPref("showXMLHttpRequests", false);

        // Open Firebug UI and enable Net panel.
        FBTest.enableNetPanel(function()
        {
            var options = {
                tagName: "tr",
                classes: "netRow category-xhr hasHeaders loaded",
                counter: 5
            };

            FBTest.waitForDisplayedElement("net", options, function(row)
            {
                var responses = win.document.getUserData("responses");
                FBTest.sysout("issue846.onRunTest " + responses.length);

                // Expand all requests and select response bodies.
                var panel = FW.Firebug.chrome.selectPanel("net");
                FBTestFirebug.expandElements(panel.panelNode, "netRow", "category-xhr", "hasHeaders", "loaded");
                FBTestFirebug.expandElements(panel.panelNode, "netInfoResponseTab");

                var netRows = FW.FBL.getElementsByClass(panel.panelNode, "netRow", "category-xhr",
                    "hasHeaders", "loaded");
                FBTest.compare(responses.length, netRows.length,
                    "There must be correct number of XHRs");

                for (var i=0; i<netRows.length; i++)
                {
                    var row = netRows[i];
                    var responseBody = FW.FBL.getElementByClass(row.nextSibling,
                        "netInfoResponseText", "netInfoText");
                    FBTest.compare(responses[i], responseBody.textContent,
                        "Test response must match");
                }

                // Finish test
                FBTestFirebug.setPref("showXMLHttpRequests", prefOrigValue);
                FBTestFirebug.testDone("issue846.DONE");
            });

            FBTest.click(win.document.getElementById("Button"));
        });
    });
}

