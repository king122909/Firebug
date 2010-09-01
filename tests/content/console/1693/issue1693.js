function runTest()
{
    FBTest.sysout("issue1693.START");
    FBTest.openNewTab(basePath + "console/1693/issue1693.html", function(win)
    {
        FBTest.enableConsolePanel(function(win)
        {
            FBTest.progress("issue1693.Select the Console panel and execute large request.");

            // In case of slow connetion to the server, the download can take a time
            // make sure the timeout is reset every time we receive something.
            win.document.addEventListener("data-received", function() {
                FBTest.resetTimeout(win);
            }, true);

            var config = {
                tagName: "div",
                classes: "logRow logRow-spy loaded"
            };

            FBTest.waitForDisplayedElement("console", config, function(row)
            {
                FBTest.progress("Request call back called");

                // Expand XHR entry within the Console panel. The browser must not freeze
                // and the response body must be properly displayed.
                FBTest.expandElements(row, "spyTitleCol", "spyCol");

                // Get response body element and check its content. Note that the displayed text
                // is limited in case of large responses.
                var limit = FBTest.getPref("netDisplayedResponseLimit");
                var responseBody = FW.FBL.getElementsByClass(row,
                    "netInfoResponseText", "netInfoText");

                // Generate response text (the same as the PHP file).
                var responseText = "";
                for (var i=0; i<80000; i++)
                    responseText += i + " ";

                FBTest.compare(468890, responseText.length, "Response must have correct size");

                var config = {
                    tagName: "div",
                    classes: "netInfoResponseSizeLimit"
                };

                // It takes some time to display huge response so, wait for the last message
                // saying: a limit has been reached...
                FBTest.waitForDisplayedElement("console", config, function()
                {
                    // Compare expected and actuall (displayed) response text.
                    var text1 = responseText.substr(0, limit);
                    var text2 = responseBody[0].textContent.substr(0, limit);
                    FBTest.compare(text1, text2, "The response text must be properly displayed");
                    FBTest.testDone("issue1693.DONE");
                });
            });

            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}
